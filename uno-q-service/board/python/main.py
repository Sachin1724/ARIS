
from arduino.app_utils import App, Bridge
from outdoor_api import OutdoorAirMonitor
from advisor import AERISAdvisor

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

import ctypes
import csv
import math
import time
import statistics
from collections import deque
from dust_signal import analyze_dust
import os
import json
import threading
import urllib.parse
import urllib.request
from datetime import timezone

# ==========================================
# AERIS - WEATHER + GAS MONITOR
# UNO Q Linux
# ==========================================

TZ = ZoneInfo("Asia/Kolkata")

BASE = Path(__file__).resolve().parent
HISTORY_PATH = BASE / "weather_history.csv"
LIB_PATH = BASE / "libaeris_lstm.so"

READ_INTERVAL = 5
PRINT_INTERVAL = 30

FEATURES = [
    "temperature",
    "humidity",
    "pressure",
    "dew_point",
    "hour_sin",
    "hour_cos",
    "month_sin",
    "month_cos"
]

# ==========================================
# LOAD LSTM
# ==========================================

model = None

try:
    model = ctypes.CDLL(str(LIB_PATH))

    model.aeris_predict.argtypes = [
        ctypes.POINTER(ctypes.c_float),
        ctypes.POINTER(ctypes.c_float)
    ]

    model.aeris_predict.restype = ctypes.c_int

    print("LSTM: LOADED")

except Exception as exc:
    print("LSTM load error:", exc)


# ==========================================
# SAFE BRIDGE FUNCTIONS
# ==========================================

def _proc_value(path):
    try:
        with open(path) as handle:
            return handle.read()
    except OSError:
        return None


def board_load_pct():
    raw = _proc_value("/proc/loadavg")
    if not raw:
        return -1
    try:
        return int(min(float(raw.split()[0]) / (os.cpu_count() or 1), 1.0) * 100)
    except (ValueError, IndexError):
        return -1


def board_memory_pct():
    raw = _proc_value("/proc/meminfo")
    if not raw:
        return -1
    fields = {}
    for row in raw.splitlines():
        key, _, rest = row.partition(":")
        value = rest.strip().split(" ")[0]
        if value.isdigit():
            fields[key] = int(value)
    total, available = fields.get("MemTotal"), fields.get("MemAvailable")
    if not total or available is None:
        return -1
    return int((total - available) / total * 100)


def board_temperature_c():
    raw = _proc_value("/sys/class/thermal/thermal_zone0/temp")
    if not raw or not raw.strip().lstrip("-").isdigit():
        return -1000
    return int(int(raw.strip()) / 1000)


def push_display_state():
    """Send link + board health to the MCU so the OLED can show them.

    /proc and /sys are the host's inside this container, so the numbers are
    read here directly. Only the client count and mood come from the API, via
    aeris_link_state.json; if that file is missing or stale nothing is
    connected, which is exactly what the display should say.
    """
    devices = sockets = wifi_ok = 0
    mood_int = None
    try:
        link = json.loads((BASE / "aeris_link_state.json").read_text())
        if time.time() - float(link.get("written_at", 0)) <= 60:
            devices = int(link.get("devices", 0))
            sockets = int(link.get("sockets", 0))
            wifi_ok = int(link.get("wifi_ok", 0))
            mood_int = link.get("mood_int")
    except (OSError, ValueError, TypeError):
        pass

    try:
        Bridge.call("aeris_set_link", devices, sockets, wifi_ok,
                    board_load_pct(), board_memory_pct(), board_temperature_c())
        if devices > 0:
            # An app is connected, so the pairing window has done its job.
            # Close it on the MCU and expire the gate so aeris_ble.py stops
            # advertising instead of waiting out the remaining 180s.
            Bridge.call("aeris_close_discovery")
            gate = BASE / "aeris_discovery_gate.json"
            if gate.exists():
                gate.unlink()
        if mood_int is not None:
            # Linux sees PM2.5 and staleness; the MCU only has its dust voltage.
            Bridge.call("aeris_set_mood_request", int(mood_int))
    except Exception:
        # Firmware without the display push, or a bridge hiccup.
        pass


def bridge_float(name):
    try:
        value = float(Bridge.call(name))
        return value if math.isfinite(value) else None
    except Exception as exc:
        print(f"Bridge error [{name}]: {exc}")
        return None


def bridge_int(name):
    value = bridge_float(name)
    return int(value) if value is not None else None


def display_value(value, unit="", decimals=2):
    if value is None:
        return "N/A"
    return f"{value:.{decimals}f} {unit}".strip()


# ==========================================
# READ ALL AERIS SENSORS
# ==========================================

def read_sensors():
    names = {
        "temp": "aeris_temp",
        "rh": "aeris_humidity",
        "pressure": "aeris_pressure",
        "gas": "aeris_gas",
        "mq_adc": "aeris_mq135",
        "mg_adc": "aeris_mg811",
        "mq_v": "aeris_mq135_voltage",
        "mg_v": "aeris_mg811_voltage",
        "dust_enabled": "aeris_dust_enabled",
        "dust_adc": "aeris_dust_adc",
        "dust_v": "aeris_dust_voltage",
        "dust_cal_ok": "aeris_dust_cal_ok",
        "dust_density": "aeris_dust_density",
        "mq_relative": "aeris_mq135_relative",
        "co2_ppm": "aeris_co2_ppm",
        "bme_ok": "aeris_status",
        "pressure_ok": "aeris_pressure_ok",
        "gas_ok": "aeris_gas_ok",
        "mq_cal_ok": "aeris_mq135_cal_ok",
        "co2_cal_ok": "aeris_co2_cal_ok",
        "co2_range_ok": "aeris_co2_range_ok",
        "warmup_done": "aeris_warmup_done",
        "mg_cal_mode": "aeris_mg811_cal_mode"
    }

    return {
        key: bridge_float(method)
        for key, method in names.items()
    }


# ==========================================
# WEATHER LSTM FEATURES
# ==========================================

def valid_weather(data):
    t = data["temp"]
    rh = data["rh"]
    p = data["pressure"]

    return (
        data["bme_ok"] == 1
        and data["pressure_ok"] == 1
        and t is not None
        and rh is not None
        and p is not None
        # AERIS_TEMPORARY_WEATHER_GUARD_V1
        # Conservative indoor operational screening.
        and 0 <= t <= 45
        and 5 <= rh <= 98
        and 950 <= p <= 1050
    )


def dew_point(t, rh):
    gamma = (
        math.log(rh / 100.0)
        + 17.27 * t / (237.7 + t)
    )

    return 237.7 * gamma / (17.27 - gamma)


def weather_features(timestamp, data):
    hour = timestamp.hour
    month = timestamp.month

    return [
        data["temp"],
        data["rh"],
        data["pressure"],
        dew_point(data["temp"], data["rh"]),
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        math.sin(2 * math.pi * month / 12),
        math.cos(2 * math.pi * month / 12)
    ]


# ==========================================
# HOURLY HISTORY
# ==========================================

# AERIS_HISTORY_SAFETY_V2
# Operational screening, not sensor calibration.
def valid_history_features(values):
    if len(values) != 8:
        return False
    if not all(math.isfinite(x) for x in values):
        return False

    t, rh, p, dew = values[:4]
    return (
        0 <= t <= 45
        and 5 <= rh <= 98
        and 950 <= p <= 1050
        and -60 <= dew <= t + 0.5
    )


def latest_logged_hour():
    """Most recent hour in original CSV, including rejected data."""
    latest = None

    if not HISTORY_PATH.exists():
        return None

    with HISTORY_PATH.open("r", newline="") as f:
        for row in csv.DictReader(f):
            try:
                ts = datetime.fromisoformat(row["timestamp"])
                if ts.tzinfo is None:
                    continue

                ts = ts.astimezone(TZ).replace(
                    minute=0,
                    second=0,
                    microsecond=0
                )

                if latest is None or ts > latest:
                    latest = ts

            except (KeyError, ValueError, TypeError):
                continue

    return latest


def load_history():
    records = {}

    if not HISTORY_PATH.exists():
        return []

    with HISTORY_PATH.open("r", newline="") as f:
        for row in csv.DictReader(f):
            try:
                ts = datetime.fromisoformat(
                    row["timestamp"]
                )

                if ts.tzinfo is None:
                    continue

                ts = ts.astimezone(TZ).replace(
                    minute=0,
                    second=0,
                    microsecond=0
                )

                values = [
                    float(row[name])
                    for name in FEATURES
                ]

                if valid_history_features(values):
                    records[ts.isoformat()] = (
                        ts, values
                    )
            except (KeyError, ValueError):
                continue

    return sorted(
        records.values(),
        key=lambda item: item[0]
    )[-24:]


def save_hour(ts, values):
    new_file = (
        not HISTORY_PATH.exists()
        or HISTORY_PATH.stat().st_size == 0
    )

    with HISTORY_PATH.open("a", newline="") as f:
        writer = csv.writer(f)

        if new_file:
            writer.writerow(["timestamp"] + FEATURES)

        writer.writerow([ts.isoformat()] + values)


def prepared_history(history, current_hour):
    """Fill at most one single-hour gap IN MEMORY; never write synthetic CSV rows."""
    records = {ts: vals for ts, vals in history if valid_history_features(vals)}
    if current_hour not in records:
        return None, []
    # Exact 24-hour window avoids accepting stale/fragmented earlier history.
    expected = [current_hour - timedelta(hours=i) for i in range(23, -1, -1)]
    missing = [i for i, ts in enumerate(expected) if ts not in records]
    if not missing:
        return [(ts, records[ts]) for ts in expected], []
    if len(missing) != 1 or missing[0] in (0, 23):
        return None, []
    ix = missing[0]
    previous, following = expected[ix - 1], expected[ix + 1]
    if previous not in records or following not in records:
        return None, []
    middle = [(a + b) / 2.0 for a, b in zip(records[previous], records[following])]
    # Time-of-day features should be calculated for the missing hour exactly,
    # not approximated by averages of phase vectors.
    hour, month = expected[ix].hour, expected[ix].month
    middle[4:] = [math.sin(2 * math.pi * hour / 24), math.cos(2 * math.pi * hour / 24),
                  math.sin(2 * math.pi * month / 12), math.cos(2 * math.pi * month / 12)]
    if not valid_history_features(middle):
        return None, []
    records[expected[ix]] = middle
    return [(ts, records[ts]) for ts in expected], [expected[ix].isoformat()]


def history_ready(history, current_hour):
    prepared, _ = prepared_history(history, current_hour)
    return prepared is not None


# ==========================================
# NATIVE LSTM
# ==========================================

def run_lstm(history):
    if model is None:
        raise RuntimeError("LSTM not loaded")

    flat = [
        value
        for _, row in history
        for value in row
    ]

    if len(flat) != 192:
        raise ValueError("Invalid LSTM input shape")

    Input = ctypes.c_float * 192
    Output = ctypes.c_float * 3

    output = Output()

    rc = model.aeris_predict(
        Input(*flat),
        output
    )

    if rc != 0:
        raise RuntimeError(
            f"LSTM error code: {rc}"
        )

    predicted = list(output)

    if not all(math.isfinite(x) for x in predicted):
        raise ValueError("Invalid prediction values")

    return predicted


# ==========================================
# UNIFIED ENVIRONMENT / API / ML READINESS V4
# ==========================================
# Source of truth: MCU values. API values are separate, never
# substituted into measured sensor values or LSTM history.
# Set AERIS_LAT / AERIS_LON in Docker environment to enable
# independent Open-Meteo weather enrichment. Existing outdoor_api
# and advisor integrations remain active regardless.
API_INTERVAL_S = 900
API_MAX_AGE_S = 3600
REPORT_PATH = BASE / "aeris_latest.json"
# Variables verified as current observations from Open-Meteo.
API_CURRENT_FIELDS = (
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "cloud_cover", "precipitation", "weather_code",
    "temperature_2m", "relative_humidity_2m", "is_day"
)
# Some variables are available as hourly model predictions, not current values.
API_HOURLY_FIELDS = (
    "shortwave_radiation", "uv_index", "precipitation_probability",
    "visibility"
)
API_FIELDS = API_CURRENT_FIELDS + API_HOURLY_FIELDS
api_lock = threading.Lock()
api_state = {"record": None, "timestamp": None, "error": "not configured"}
api_last_attempt = 0.0
api_busy = False
last_report = 0.0
last_api_notice = None


def finite_number(value, lo=None, hi=None):
    try:
        number = float(value)
        if not math.isfinite(number):
            return None
        if lo is not None and number < lo:
            return None
        if hi is not None and number > hi:
            return None
        return number
    except (TypeError, ValueError, OverflowError):
        return None


def fetch_open_meteo():
    """Outdoor model enrichment; never replace local sensor measurements."""
    global api_busy
    try:
        # Reuse the already-working outdoor air monitor location by default.
        # Environment variables may override BOTH coordinates when desired.
        latitude = finite_number(os.getenv("AERIS_LAT"), -90, 90)
        longitude = finite_number(os.getenv("AERIS_LON"), -180, 180)
        if latitude is None:
            latitude = finite_number(OutdoorAirMonitor.LATITUDE, -90, 90)
        if longitude is None:
            longitude = finite_number(OutdoorAirMonitor.LONGITUDE, -180, 180)
        if latitude is None or longitude is None:
            raise ValueError("Weather enrichment coordinates unavailable")

        params = urllib.parse.urlencode({
            "latitude": latitude,
            "longitude": longitude,
            "current": ",".join(API_CURRENT_FIELDS),
            "hourly": ",".join(API_HOURLY_FIELDS),
            "forecast_days": 2,
            "wind_speed_unit": "ms",
            "timezone": "UTC",
        })
        url = "https://api.open-meteo.com/v1/forecast?" + params
        req = urllib.request.Request(url, headers={"User-Agent": "AERIS/1.0"})
        with urllib.request.urlopen(req, timeout=15) as response:
            payload = json.load(response)
        if payload.get("error"):
            raise ValueError(str(payload.get("reason", "Open-Meteo API error"))[:180])
        current = payload.get("current") or {}
        units = payload.get("current_units") or {}
        hourly = payload.get("hourly") or {}
        hourly_units = payload.get("hourly_units") or {}
        record = {name: finite_number(current.get(name)) for name in API_CURRENT_FIELDS}
        record["observation_time_utc"] = current.get("time")
        record["latitude"] = latitude
        record["longitude"] = longitude
        record["location"] = "Rourkela, Odisha" if (abs(latitude - 22.225) < 0.01 and abs(longitude - 84.8641) < 0.01) else "Configured coordinates"
        record["units"] = {name: units.get(name) for name in API_CURRENT_FIELDS}

        # Choose the latest hourly model time <= now (or nearest available hour).
        # Hourly values are explicitly time-labelled, never passed as sensor readings.
        times = hourly.get("time") or []
        hour_ix = None
        if times:
            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            parsed = []
            for ix, ts in enumerate(times):
                try:
                    dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                    if dt.tzinfo is not None:
                        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                    parsed.append((ix, dt))
                except (TypeError, ValueError):
                    continue
            previous = [(ix, dt) for ix, dt in parsed if dt <= now_utc]
            if previous:
                hour_ix = max(previous, key=lambda x: x[1])[0]
            elif parsed:
                hour_ix = min(parsed, key=lambda x: abs((x[1] - now_utc).total_seconds()))[0]
        record["hourly_model_time_utc"] = times[hour_ix] if hour_ix is not None else None
        for name in API_HOURLY_FIELDS:
            series = hourly.get(name) or []
            record[name] = finite_number(series[hour_ix]) if hour_ix is not None and hour_ix < len(series) else None
            record["units"][name] = hourly_units.get(name)
        record["source"] = "Open-Meteo regional model/grid (not local sensors)"
        with api_lock:
            api_state.update(record=record, timestamp=time.time(), error=None)
    except Exception as exc:
        with api_lock:
            api_state["error"] = "%s: %s" % (type(exc).__name__, str(exc)[:150])
    finally:
        with api_lock:
            api_busy = False


def tick_weather_enrichment():
    global api_last_attempt, api_busy
    now_mono = time.monotonic()
    with api_lock:
        if api_busy or now_mono - api_last_attempt < API_INTERVAL_S:
            return
        api_busy = True
        api_last_attempt = now_mono
    threading.Thread(target=fetch_open_meteo, daemon=True).start()


def current_api_weather():
    with api_lock:
        record = api_state["record"]
        timestamp = api_state["timestamp"]
        error = api_state["error"]
    age = time.time() - timestamp if timestamp is not None else None
    if record is None or age is None or age > API_MAX_AGE_S:
        return {"status": "unavailable_or_stale", "age_seconds": age,
                "error": error, "measurements": None}
    return {"status": "available", "age_seconds": round(age, 1),
            "error": error, "measurements": record}


def safe_outdoor_summary(value):
    # Avoid serializing arbitrary third-party objects or secrets into reports.
    if isinstance(value, dict):
        summary = {}
        for key, val in value.items():
            name = str(key)
            if any(secret in name.lower() for secret in
                   ("key", "token", "password", "secret", "auth")):
                continue
            if isinstance(val, (str, bool, int, float)) or val is None:
                summary[name] = val if not isinstance(val, float) or math.isfinite(val) else None
        return summary
    return {"status": "provided_to_existing_advisor" if value is not None else "unavailable"}


# =====================================================
# AERIS CALIBRATION + FILTERING (single owner: Python)
# =====================================================
CAL_PATH = BASE / "aeris_calibration.json"
VC_MQ = 5.0                # Sensor MODULE supply in volts, not ADC reference
RL_MQ = 10.0              # kOhm; MEASURE your module load resistor
MQ_CLEAN_AIR_PPM = 420.0  # Illustrative anchor only, NOT measured CO2
MQ_SLOPE = -2.769
MQ_COEFF = 116.6
MQ_REFERENCE_C = 20.0
MQ_REFERENCE_RH = 65.0
MG811_SENSOR_SLOPE_V_DECADE = -0.0215  # bare sensor, FC-22 gain unverified
# Optional *illustrative* MODULE-output slope. Not a calibration or safety reading.
# Set to None to show only relative MG811 signal changes.
MG811_ASSUMED_MODULE_SLOPE_V_DECADE = -0.120
MG811_AUTO_REFERENCE_SAMPLES = 120  # ~1 hour at 30 seconds per sample
MG811_AUTO_REFERENCE_MIN_SPAN_SEC = 45 * 60
MG811_AUTO_REFERENCE_MAX_SPREAD_V = 0.080  # reject drifting reference
# HIGH GP2Y voltages must never be learned as clean-air baseline.
GP2Y_LOW_REGIME_MAX_V = 0.90
FILTER_WINDOW = 12
FILTER_ALPHA = 0.2
MIN_WARMUP_SEC = 600
CAL_UPDATE_SEC = 900
# Trend compares a current ~1 minute filtered signal with the previous ~2-6 minutes.
TREND_WINDOW_SECONDS = 360
TREND_REFERENCE_MIN_AGE = 120
TREND_REFERENCE_MAX_AGE = 360
TREND_MQ_CHANGE_PCT = 5.0  # relative change in Rs, not gas concentration
TREND_MG_CHANGE_V = 0.020  # voltage response; direction requires verified sensor polarity
TREND_DUST_CHANGE_V = 0.060
ROLLING_PATH = BASE / "aeris_baseline_observations.json"
ROLLING_PERSIST_SEC = 900
# 10%/hour baseline max drift at 15-minute updates, experiment only
BASELINE_STEP_FRACTION = 0.025
# Weather-based tuning is OFF by default, never an indoor PM calibration
API_PM_TUNING_LOG = os.getenv("AERIS_PM_TUNING_LOG", "0") == "1"

CAL_DEFAULT = {
    "version": 1,
    "dust_v0": None, "mq135_r0_kohm": None,
    "mg811_low_v": None, "mg811_low_ppm": 420.0,
    "mg811_reference_kind": None,
    "mg811_high_v": None, "mg811_high_ppm": None,
    "mg811_gain": None,  # Must be measured for bare-sensor slope mode
    "dust_k25": 0.50, "dust_k10": 0.80,
    "updated_at": None, "baseline_method": "operational_unverified",
}


def load_calibration():
    config = CAL_DEFAULT.copy()
    try:
        obj = json.loads(CAL_PATH.read_text())
        if isinstance(obj, dict):
            for k in CAL_DEFAULT:
                if k in obj:
                    config[k] = obj[k]
    except (OSError, ValueError, TypeError) as exc:
        print("Calibration: defaults used:", str(exc)[:80])
    for k in ("dust_k25", "dust_k10"):
        n = finite_number(config[k], 0, 2)
        config[k] = n if n is not None else CAL_DEFAULT[k]
    for k in ("dust_v0", "mq135_r0_kohm", "mg811_low_v", "mg811_high_v",
              "mg811_high_ppm", "mg811_gain"):
        config[k] = finite_number(config[k], 0.00001)
    # Explicit environment calibration is allowed, but no automatic CO2 baseline.
    if os.getenv("AERIS_MG811_LOW_V"):
        config["mg811_low_v"] = finite_number(os.getenv("AERIS_MG811_LOW_V"), 0.01, 5)
    return config


calibration = load_calibration()
boot_mono = time.monotonic()
filters = {k: {"window": deque(maxlen=FILTER_WINDOW), "ema": None}
           for k in ("mq_v", "mg_v", "dust_v")}
# In-memory history is intentionally bounded and not written every five seconds.
rolling = {"mq_rs": deque(maxlen=21000), "dust_v": deque(maxlen=3000), "mg_v": deque(maxlen=3000)}
trends = {k: deque(maxlen=100) for k in ("mq_rs", "mg_v", "dust_v")}
last_cal_update = 0.0
last_rolling_sample = 0.0
last_rolling_persist = 0.0


def load_rolling_history():
    """Restore bounded observations after Docker restart (never touch LSTM CSV)."""
    try:
        obj = json.loads(ROLLING_PATH.read_text())
    except (OSError, ValueError, TypeError):
        return
    now = time.time()
    for name, age_limit in (("mq_rs", 7 * 86400), ("dust_v", 86400), ("mg_v", 86400)):
        values = obj.get(name, []) if isinstance(obj, dict) else []
        if not isinstance(values, list):
            continue
        for item in values[-rolling[name].maxlen:]:
            if not isinstance(item, (list, tuple)) or len(item) != 2:
                continue
            try:
                ts, v = float(item[0]), float(item[1])
            except (ValueError, TypeError):
                continue
            if math.isfinite(ts) and math.isfinite(v) and 0 <= now - ts <= age_limit:
                rolling[name].append((ts, v))


def save_rolling_history():
    """Crash-safe rolling observations; separate from weather_history.csv."""
    temporary = ROLLING_PATH.with_suffix(".json.tmp")
    with temporary.open("w") as fh:
        json.dump({k: list(v) for k, v in rolling.items()}, fh, allow_nan=False)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(temporary, ROLLING_PATH)


load_rolling_history()


def save_calibration():
    calibration["updated_at"] = datetime.now(TZ).isoformat()
    temp = CAL_PATH.with_suffix(".json.tmp")
    with temp.open("w") as f:
        json.dump(calibration, f, indent=2, allow_nan=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, CAL_PATH)


def moving_voltage(name, raw):
    state = filters[name]
    n = finite_number(raw, 0, 5)
    if n is None:
        return None
    state["window"].append(n)
    med = statistics.median(state["window"])
    state["ema"] = med if state["ema"] is None else (
        FILTER_ALPHA * med + (1 - FILTER_ALPHA) * state["ema"])
    return state["ema"]


def warmup_ready(data):
    mcu = data.get("warmup_done")
    # If MCU firmware has the flag, trust it. Otherwise restart-safe fallback
    # conservatively waits ten minutes for this Python process.
    return mcu == 1 if mcu is not None else (time.monotonic() - boot_mono >= MIN_WARMUP_SEC)


def mq_rs_kohm(v):
    # Incoming Bridge voltage MUST already be reconstructed MODULE AO volts.
    if v is None or not 0.01 < v < VC_MQ:
        return None
    return RL_MQ * (VC_MQ / v - 1.0)


def mq_compensation_factor(temp, humidity):
    """Weak, heuristic correction; not a datasheet-validated compensation."""
    if temp is None or humidity is None:
        return 1.0
    return max(0.8, min(1.2, 1 + 0.002 * (temp - MQ_REFERENCE_C)
                        + 0.001 * (humidity - MQ_REFERENCE_RH)))


def mq_rs_ratio(v, temp, humidity):
    rs = mq_rs_kohm(v)
    r0 = calibration.get("mq135_r0_kohm")
    if rs is None or r0 is None or r0 <= 0:
        return rs, None
    return rs, rs * mq_compensation_factor(temp, humidity) / r0


def mq_index(v, temp, humidity, ready):
    rs, ratio = mq_rs_ratio(v, temp, humidity)
    result = {"voltage_V_filtered": v, "estimated_rs_kohm": rs,
              "rs_over_r0": ratio, "eco2_equivalent_estimate_ppm": None,
              "relative_response_index": None, "calibrated_gas_ppm": None,
              "status": "WARMING_UP" if not ready else "BASELINE_PENDING"}
    if not ready or ratio is None or ratio <= 0:
        return result
    # 116.6*(Rs/R0')^-2.769, normalized so ratio=1 means 420 ppm.
    # This is an indicative, cross-sensitive eCO2 scale, NOT actual CO2.
    anchor_ratio = (MQ_CLEAN_AIR_PPM / MQ_COEFF) ** (1 / MQ_SLOPE)
    value = MQ_COEFF * ((ratio * anchor_ratio) ** MQ_SLOPE)
    result["eco2_equivalent_estimate_ppm"] = round(max(400, min(5000, value)), 0)
    result["relative_response_index"] = round(1 / ratio, 3)
    result["status"] = "EXPERIMENTAL_GAS_MIXTURE_NOT_SPECIFIC"
    return result


def mq_gas_hypotheses(mq):
    """Three single-gas interpretations of ONE cross-sensitive signal.

    No defensible gas ppm coefficients are available for the user's
    actual module/baseline. We intentionally do NOT invent ppm values.
    """
    ratio = mq.get("rs_over_r0")
    valid = isinstance(ratio, (int, float)) and math.isfinite(ratio) and ratio > 0
    response = round(1 / ratio, 3) if valid else None
    labels = {"nh3": "ammonia", "alcohol": "alcohol vapor", "benzene": "benzene"}
    return {
        "status": "ALTERNATIVE_SINGLE_GAS_HYPOTHESES_NOT_IDENTIFICATION" if valid else "NOT_READY",
        "mixture_separation_possible": False,
        "additive": False,
        "assumption": "Each alternative assumes only the named gas caused the same MQ135 response",
        "gas_hypotheses": {
            k: {"name": label, "relative_response_index": response,
                "equivalent_ppm": None, "calibrated": False,
                "reason": "No gas-specific curve/module calibration"}
            for k, label in labels.items()
        }
    }


def dust_proxy(v, rh, enabled):
    result = {"voltage_V_filtered": v, "dust_proxy_ug_m3": None,
              "pm25_proxy_ug_m3": None, "pm10_proxy_ug_m3": None,
              "pm25_pm10_calibrated": False, "status": "UNAVAILABLE"}
    if not enabled or v is None:
        return result
    if rh is not None and rh > 80:
        result["status"] = "HUMID_UNRELIABLE"
        return result
    zero = calibration.get("dust_v0")
    if zero is None:
        result["status"] = "BASELINE_PENDING"
        return result
    if v >= 2.5:
        result["status"] = "HIGH_SIGNAL_UNVERIFIED"
        return result
    dust = max(0, (v - zero) * 200)
    result.update(dust_proxy_ug_m3=round(dust, 1),
                  pm25_proxy_ug_m3=round(dust * calibration["dust_k25"], 1),
                  pm10_proxy_ug_m3=round(dust * calibration["dust_k10"], 1),
                  status="EXPERIMENTAL_OPTICAL_PROXIES")
    return result


def mg811_estimate(v, ready, temp=None):
    result = {"voltage_V_filtered": v, "co2_estimate_ppm": None,
              "calibrated": False, "status": "WARMING_UP" if not ready else "BASELINE_PENDING",
              "reference_kind": calibration.get("mg811_reference_kind") or
                                ("USER_SUPPLIED_UNVERIFIED" if calibration.get("mg811_low_v") is not None else None)}
    low_v = calibration.get("mg811_low_v")
    if not ready or v is None or low_v is None:
        return result
    high_v = calibration.get("mg811_high_v")
    low_ppm = calibration.get("mg811_low_ppm") or 420
    high_ppm = calibration.get("mg811_high_ppm")
    if high_v is not None and high_ppm is not None and high_ppm > low_ppm and high_v < low_v:
        span = low_v - high_v
        if not (high_v - 0.25 * span <= v <= low_v + 0.25 * span):
            result["status"] = "OUTSIDE_TWO_POINT_MARGIN"
            return result
        slope = (high_v - low_v) / math.log10(high_ppm / low_ppm)
        result["status"] = "TWO_POINT_ESTIMATE_UNVERIFIED"
    else:
        gain = calibration.get("mg811_gain")
        if gain is None or gain <= 0:
            slope = MG811_ASSUMED_MODULE_SLOPE_V_DECADE
            if slope is None:
                result["status"] = "REFERENCE_LEARNED_RELATIVE_ONLY"
                return result
            result["status"] = "ASSUMED_420_ANCHOR_AND_SLOPE_EXPERIMENTAL"
        else:
            slope = MG811_SENSOR_SLOPE_V_DECADE * gain
            result["status"] = "DATASHEET_SLOPE_ESTIMATE_UNVERIFIED"
    if slope >= 0:
        result["status"] = "INVALID_NEGATIVE_SLOPE_REQUIRED"
        return result
    exponent = (v - low_v) / slope
    if abs(exponent) > 20:
        result["status"] = "OUTSIDE_PLAUSIBLE_TRANSFER"
        return result
    ppm = low_ppm * 10 ** exponent
    # Avoid presenting arbitrary clamped numbers as actual ambient CO2.
    if not 350 <= ppm <= 10000:
        result["status"] = "ESTIMATE_OUTSIDE_350_10000_UNRELIABLE"
        return result
    result["co2_estimate_ppm"] = round(ppm, 0)
    if temp is not None and (temp < 15 or temp > 35):
        result["status"] += "; TEMPERATURE_OUTSIDE_TYPICAL_RANGE"
    return result


def update_baselines(data, filtered, ready):
    global last_cal_update, last_rolling_sample, last_rolling_persist
    now_m = time.monotonic()
    if not ready:
        return
    if now_m - last_rolling_sample >= 30:
        last_rolling_sample = now_m
        v = filtered.get("dust_v")
        if (data.get("dust_enabled") == 1 and data.get("rh") is not None
                and data.get("rh") <= 80 and v is not None
                and .1 <= v <= GP2Y_LOW_REGIME_MAX_V):
            rolling["dust_v"].append((time.time(), v))
        mg_v = filtered.get("mg_v")
        if mg_v is not None and 0.05 < mg_v < 4.9:
            rolling["mg_v"].append((time.time(), mg_v))
        rs = mq_rs_kohm(filtered.get("mq_v"))
        if rs is not None and 1 <= rs <= 1000:
            rolling["mq_rs"].append((time.time(), rs))
    if now_m - last_rolling_persist >= ROLLING_PERSIST_SEC:
        last_rolling_persist = now_m
        try:
            save_rolling_history()
        except OSError as exc:
            print("Baseline observations persistence error:", exc)
    if now_m - last_cal_update < CAL_UPDATE_SEC:
        return
    last_cal_update = now_m
    changed = False
    def percentile(values, fraction):
        ordered = sorted(values)
        return ordered[int(fraction * (len(ordered) - 1))]
    for name, key, lifetime, min_count in (
        ("dust_v", "dust_v0", 86400, 120),
        ("mq_rs", "mq135_r0_kohm", 7 * 86400, 120),
    ):
        cutoff = time.time() - lifetime
        while rolling[name] and rolling[name][0][0] < cutoff:
            rolling[name].popleft()
        observations = [v for _, v in rolling[name]]
        if len(observations) < min_count:
            continue
        # Optical zero: low voltage. MQ135 in reducing-gas conditions:
        # cleaner air generally means HIGHER resistance, so use upper percentile.
        # Both are operational heuristics, NOT controlled gas calibration.
        target = percentile(observations, 0.05 if name == "dust_v" else 0.95)
        if name == "dust_v":
            target = max(.1, min(.9, target))
        existing = calibration.get(key)
        if existing is None:
            calibration[key] = round(target, 5)
        else:
            delta = max(-BASELINE_STEP_FRACTION, min(BASELINE_STEP_FRACTION,
                                                    (target - existing) / existing))
            calibration[key] = round(existing * (1 + delta), 5)
        changed = True
    # Auto-reference only the VOLTAGE, not a real measured 420-ppm CO2 level.
    # A stable indoor sensor can be far above outdoor CO2; this is an assumption.
    # Never override a manually provided reference.
    if calibration.get("mg811_low_v") is None:
        recent = [(t, v) for t, v in rolling["mg_v"]
                  if time.time() - t <= 86400]
        if len(recent) >= MG811_AUTO_REFERENCE_SAMPLES:
            chosen = recent[-MG811_AUTO_REFERENCE_SAMPLES:]
            values = [v for _, v in chosen]
            if (chosen[-1][0] - chosen[0][0] >= MG811_AUTO_REFERENCE_MIN_SPAN_SEC
                    and max(values) - min(values) <= MG811_AUTO_REFERENCE_MAX_SPREAD_V):
                calibration["mg811_low_v"] = round(statistics.median(values), 5)
                calibration["mg811_reference_kind"] = "AUTO_ASSUMED_420_NOT_OUTDOOR_VERIFIED"
                changed = True
    if changed:
        save_calibration()


def classify_trend(name, current, ready, reliable=True):
    """Classify electrical response direction, not individual gas concentration."""
    if not ready:
        return {"status": "WARMING_UP", "direction": None, "comparison": None}
    if not reliable or current is None or not math.isfinite(current):
        return {"status": "UNRELIABLE", "direction": None, "comparison": None}
    now = time.monotonic()
    series = trends[name]
    while series and now - series[0][0] > TREND_WINDOW_SECONDS:
        series.popleft()
    references = [x for t, x in series if
                  TREND_REFERENCE_MIN_AGE <= now - t <= TREND_REFERENCE_MAX_AGE]
    if name == "mq_rs":
        threshold = TREND_MQ_CHANGE_PCT
        comparison = "sensor resistance"
    elif name == "mg_v":
        threshold = TREND_MG_CHANGE_V
        comparison = "amplified sensor voltage"
    else:
        threshold = TREND_DUST_CHANGE_V
        comparison = "optical sensor voltage"
    state = {"status": "LEARNING_TREND", "direction": None,
             "comparison": comparison, "change": None}
    if len(references) >= 5:
        reference = statistics.median(references)
        delta = current - reference
        metric = 100 * delta / reference if name == "mq_rs" and reference > 0 else delta
        state["change"] = round(metric, 2 if name == "mq_rs" else 4)
        state["change_unit"] = "%" if name == "mq_rs" else "V"
        if abs(metric) <= threshold:
            state.update(status="STABLE", direction="STABLE")
        else:
            # MQ135: smaller Rs tends toward more reducing gas response;
            # MG811: voltage fall is *assumed* CO2-increasing polarity.
            # GP2Y: larger voltage implies more optical scattering.
            more = (metric < 0) if name in ("mq_rs", "mg_v") else (metric > 0)
            state.update(status="EXPERIMENTAL_RESPONSE_TREND",
                         direction="INCREASING_RESPONSE" if more else "DECREASING_RESPONSE")
    series.append((now, current))
    return state


def process_air_data(data):
    ready = warmup_ready(data)
    filtered = {k: moving_voltage(k, data.get(k)) for k in filters}
    update_baselines(data, filtered, ready)
    mq = mq_index(filtered["mq_v"], data.get("temp"), data.get("rh"), ready)
    mq["single_gas_hypotheses"] = mq_gas_hypotheses(mq)
    mg = mg811_estimate(filtered["mg_v"], ready, data.get("temp"))
    pm = dust_proxy(filtered["dust_v"], data.get("rh"), data.get("dust_enabled") == 1)
    rs = mq.get("estimated_rs_kohm")
    mq["trend"] = classify_trend("mq_rs", rs, ready, reliable=rs is not None)
    mg["trend"] = classify_trend("mg_v", filtered["mg_v"], ready,
                                 reliable=filtered["mg_v"] is not None)
    pm["trend"] = classify_trend("dust_v", filtered["dust_v"], ready,
                                 reliable=(pm["status"] == "EXPERIMENTAL_OPTICAL_PROXIES"))
    return {"warmup_complete": ready, "mq135": mq, "mg811": mg, "gp2y": pm}


# Optional rough comparison against Open-Meteo's REGIONAL outdoor model.
# Requires AERIS_PM_TUNING_LOG=1 AND AERIS_SENSOR_OUTDOORS=1; log only,
# never silently modify k25/k10. The outdoor module may expose the values
# under slightly different dict layouts, so absent values are skipped.
PM_PAIR_PATH = BASE / "aeris_pm_model_pairs.csv"
last_pm_pair_bucket = None


def log_optional_pm_pair(now, processed, outdoor_record):
    global last_pm_pair_bucket
    if not API_PM_TUNING_LOG or os.getenv("AERIS_SENSOR_OUTDOORS") != "1":
        return
    hour = now.replace(minute=0, second=0, microsecond=0).isoformat()
    if hour == last_pm_pair_bucket or not isinstance(outdoor_record, dict):
        return
    pm = processed["gp2y"]
    if pm["status"] != "EXPERIMENTAL_OPTICAL_PROXIES":
        return
    external = outdoor_record.get("current") or outdoor_record
    if not isinstance(external, dict):
        return
    ext25 = finite_number(external.get("pm2_5"), 0)
    ext10 = finite_number(external.get("pm10"), 0)
    if ext25 is None or ext10 is None:
        return
    file_new = not PM_PAIR_PATH.exists()
    with PM_PAIR_PATH.open("a", newline="") as f:
        writer = csv.writer(f)
        if file_new:
            writer.writerow(["timestamp", "dust_proxy_ug_m3", "model_pm25_ug_m3",
                             "model_pm10_ug_m3", "source"])
        writer.writerow([now.isoformat(), pm["dust_proxy_ug_m3"], ext25, ext10,
                         "Open-Meteo regional modeled, not calibration reference"])
    last_pm_pair_bucket = hour


def suggest_pm_factors(min_days=3):
    """Return origin-constrained regression factors; NEVER apply automatically."""
    if not PM_PAIR_PATH.exists():
        return None
    with PM_PAIR_PATH.open(newline="") as f:
        rows = list(csv.DictReader(f))
    if len(rows) < 24 * min_days:
        return None
    readings = []
    dates = set()
    for row in rows:
        try:
            d = float(row["dust_proxy_ug_m3"])
            a = float(row["model_pm25_ug_m3"])
            b = float(row["model_pm10_ug_m3"])
            if d > 5 and all(map(math.isfinite, (d, a, b))):
                readings.append((d, a, b))
                dates.add(row["timestamp"][:10])
        except (ValueError, KeyError):
            continue
    if len(dates) < min_days or len(readings) < 24 * min_days:
        return None
    denominator = sum(x*x for x, _, _ in readings)
    if denominator <= 0:
        return None
    return {"suggested_k25": sum(x*y for x,y,_ in readings)/denominator,
            "suggested_k10": sum(x*z for x,_,z in readings)/denominator,
            "pairs": len(readings), "days": len(dates),
            "status": "regional_modeled_reference_NOT_applied"}


def read_advice_summary():
    path = BASE / "aeris_advice.json"
    try:
        advice = json.loads(path.read_text())
        return {"generated_at": advice.get("generated_at"),
                "llm_available": advice.get("llm_available") is True,
                "llm_feedback": advice.get("llm_feedback"),
                "sensor_feedback": advice.get("sensor_feedback")}
    except (OSError, ValueError, TypeError):
        return {"generated_at": None, "llm_available": False,
                "llm_feedback": None, "sensor_feedback": None}


def final_dashboard(data, processed, forecast, outdoor_record):
    bme_valid = valid_weather(data)
    mq = processed["mq135"]
    mg = processed["mg811"]
    pm = processed["gp2y"]
    outdoor_values = (outdoor_record or {}).get("values") or {}
    return {
        "local": {"temperature_C": data.get("temp") if bme_valid else None,
                  "humidity_percent": data.get("rh") if bme_valid else None,
                  "pressure_hPa": data.get("pressure") if bme_valid else None,
                  "bme_gas_resistance_kohm": data.get("gas") if data.get("gas_ok") == 1 else None},
        "gas": {"mq135_relative_response_index": mq.get("relative_response_index"),
                "mq135_trend": mq.get("trend", {}).get("direction"),
                "single_gas_hypotheses": mq.get("single_gas_hypotheses"),
                "mg811_relative_trend": mg.get("trend", {}).get("direction"),
                "co2_ppm": None, "co2_status": "NOT_REFERENCE_CALIBRATED"},
        "particulates": {"pm25_ug_m3": None, "pm10_ug_m3": None,
                         "status": "GP2Y_UNRELIABLE"},
        "outdoor": {"location": "Rourkela, Odisha", "source": "Open-Meteo modeled",
                    "us_aqi": finite_number(outdoor_values.get("us_aqi"), 0, 500)},
        "next_hour_lstm": forecast,
        "labels": {"co2": "not calibrated", "mq135": "mixed-gas response only",
                   "nh3_alcohol_benzene": "single-gas hypotheses; not measured concentrations"}
    }


def compose_report(now, data, outdoor_record, forecast=None, processed=None):
    bme_valid = valid_weather(data)
    processed = processed or process_air_data(data)
    api = current_api_weather()
    met = api["measurements"] if api["status"] == "available" else None
    fields = {"pm25": None, "pm10": None, "no2": None, "so2": None,
              "co": None, "o3": None, "nh3": None,
              "temperature": finite_number(data.get("temp")) if bme_valid else None,
              "humidity": finite_number(data.get("rh")) if bme_valid else None,
              "wind_speed": met.get("wind_speed_10m") if met else None,
              "wind_direction": met.get("wind_direction_10m") if met else None,
              "solar_radiation": met.get("shortwave_radiation") if met else None}
    return {
        "timestamp": now.isoformat(),
        "display": final_dashboard(data, processed, forecast, outdoor_record),
        "advisor": read_advice_summary(),
        "bme690": {"valid_for_weather_lstm": bme_valid,
                   "temperature_C": data.get("temp"), "humidity_percent": data.get("rh"),
                   "pressure_hPa": data.get("pressure"),
                   "gas_resistance_kohm": data.get("gas") if data.get("gas_ok") == 1 else None},
        "warmup_complete": processed["warmup_complete"],
        "mq135": processed["mq135"], "mg811": processed["mg811"],
        "gp2y": processed["gp2y"], "calibration": {"path": str(CAL_PATH),
                        "dust_v0": calibration.get("dust_v0"),
                        "mq135_r0_kohm": calibration.get("mq135_r0_kohm"),
                        "mg811_low_v": calibration.get("mg811_low_v"),
                        "mg811_reference_kind": calibration.get("mg811_reference_kind"),
                        "mg811_assumed_module_slope_v_decade": MG811_ASSUMED_MODULE_SLOPE_V_DECADE,
                        "dust_k25": calibration["dust_k25"], "dust_k10": calibration["dust_k10"],
                        "method": "PROVISIONAL_SELF_BASELINE_NOT_REFERENCE_CALIBRATED",
                        "observations_path": str(ROLLING_PATH)},
        "weather_api": api,
        "existing_outdoor_module": safe_outdoor_summary(outdoor_record),
        "ml": {"weather_lstm": {"loaded": model is not None,
                                "hourly_samples": len(history), "forecast": forecast,
                                "interpolated_hours": last_interpolated_hours},
               "aqi": {"status": "withheld_unverified_inputs_or_ABI",
                       "valid_features": sum(v is not None for v in fields.values()),
                       "required_features": 12, "features": fields},
               "scenario": {"status": "withheld_unverified_25_feature_schema_or_ABI"}},
        "llm": {"status": "existing_AERISAdvisor_tick_invoked_separately",
                "note": "Qwen availability depends on advisor.py and its runtime"},
    }


last_interpolated_hours = []


def write_report(record):
    # Only replace the latest JSON snapshot, never the CSV history.
    temp_path = REPORT_PATH.with_suffix(".json.tmp")
    with temp_path.open("w") as handle:
        json.dump(record, handle, indent=2, allow_nan=False, default=str)
    os.replace(temp_path, REPORT_PATH)


# ==========================================
# INITIAL STATE
# ==========================================

# AERIS_OUTDOOR_INTEGRATION_V1
outdoor = OutdoorAirMonitor(BASE)
# AERIS_ADVISOR_INTEGRATION_V1
advisor = AERISAdvisor()

history = load_history()

# Track disk separately from accepted LSTM samples.
# This prevents duplicate timestamps after filtering.
last_saved_hour = latest_logged_hour()

last_print = 0
last_forecast_hour = None
last_forecast = None

print("\nAERIS GAS + WEATHER STARTED")
print("LSTM loaded:", model is not None)
print("Recovered hourly samples:", len(history))
print("Recovered baseline observations:", {k: len(v) for k, v in rolling.items()})
print("History file:", HISTORY_PATH)


# ==========================================
# MAIN LOOP
# ==========================================

def loop():
    global history
    global last_saved_hour
    global last_print
    global last_forecast_hour
    global last_forecast
    global last_report

    now = datetime.now(TZ)

    hour_bucket = now.replace(
        minute=0,
        second=0,
        microsecond=0
    )

    if last_forecast is not None and last_forecast_hour != hour_bucket:
        last_forecast = None
    # Poll MCU D3 long-press request without affecting sensor/LSTM cadence.
    # File is only a discovery gate, NOT authentication and NOT a Wi-Fi command.
    try:
        remaining = bridge_float("aeris_discovery_remaining")
        if remaining is not None and remaining > 0:
            gate = BASE / "aeris_discovery_gate.json"
            temp_gate = BASE / "aeris_discovery_gate.json.tmp"
            code = bridge_float("aeris_pair_code")
            if code is not None and 100000 <= int(code) <= 999999:
                temp_gate.write_text(json.dumps({"expires_at": time.time() + min(180.0, remaining),
                                                 "source": "physical_d3_long_press",
                                                 "pair_code": f"{int(code):06d}"}))
                os.chmod(temp_gate, 0o600)
                os.replace(temp_gate, gate)
    except Exception as exc:
        print("BLE discovery gate error:", exc)
    # Poll MCU D3 8-second hold: a request for a clean Linux shutdown. This
    # container cannot write /run, so the request is dropped in the app dir,
    # where aris-poweroff.path (running as root on the host) picks it up.
    try:
        # Called directly rather than via bridge_float(): that helper prints on
        # every miss, and this key does not exist until the sketch is flashed.
        requested = float(Bridge.call("aeris_poweroff_request"))
        if requested >= 1.0:
            request = BASE / "aeris_power_request.json"
            if not request.exists():
                temp_request = BASE / "aeris_power_request.json.tmp"
                temp_request.write_text(json.dumps({
                    "source": "physical_d3_8s_hold",
                    "requested_at": time.time(),
                }))
                os.replace(temp_request, request)
                print("Shutdown requested by D3 8s hold")
    except Exception:
        # Old firmware without the gesture, or a bridge hiccup: nothing to do.
        pass
    push_display_state()
    data = read_sensors()
    processed = process_air_data(data)

    # Outdoor API never modifies sensor data.
    try:
        outdoor.tick()
    except Exception as exc:
        print("Outdoor API module error:", exc)
    tick_weather_enrichment()

    # Read cached outdoor data without changing
    # any physical sensor measurement.
    try:
        outdoor_record, _, _ = outdoor.snapshot()
    except Exception as exc:
        print("Outdoor snapshot error:", exc)
        outdoor_record = None

    try:
        log_optional_pm_pair(now, processed, outdoor_record)
    except Exception as exc:
        print("PM comparison logging error:", exc)

    # Preserve existing advisor/Qwen implementation.
    try:
        advisor.tick(data, outdoor_record, current_api_weather(), last_forecast)
    except Exception as exc:
        print("Advisor runtime error:", exc)

    try:
        weather_ok = valid_weather(data)

        # Save only valid real hourly data
        if weather_ok and (
            last_saved_hour is None
            or hour_bucket > last_saved_hour
        ):
            values = weather_features(
                hour_bucket, data
            )

            save_hour(hour_bucket, values)

            history.append((hour_bucket, values))
            history = history[-24:]
            last_saved_hour = hour_bucket

            print(
                "NEW HOURLY SAMPLE:",
                hour_bucket.isoformat()
            )

        if time.monotonic() - last_print >= PRINT_INTERVAL:
            last_print = time.monotonic()

            print("\n" + "=" * 42)
            print("AERIS | LIVE ENVIRONMENT MONITOR")
            print("=" * 42)

            print(
                "Time:",
                now.isoformat(timespec="seconds")
            )

            print(
                "Temperature:",
                display_value(data["temp"], "C")
            )

            print(
                "Humidity:",
                display_value(data["rh"], "%")
            )

            print(
                "Pressure:",
                display_value(data["pressure"], "hPa")
            )

            print(
                "BME Gas:",
                display_value(data["gas"], "kOhm")
            )

            print("-" * 42)

            print("MQ135 ADC:", display_value(data.get("mq_adc"), decimals=0))
            print("MQ135 AO:", display_value(data.get("mq_v"), "V", 3))
            mq = processed["mq135"]
            print("MQ135:", mq["status"])
            print("MQ135 electrical trend:", mq["trend"]["direction"] or mq["trend"]["status"])
            if mq["eco2_equivalent_estimate_ppm"] is not None:
                print("MQ135 eCO2-equivalent estimate:",
                      mq["eco2_equivalent_estimate_ppm"], "ppm (NOT CO2 measurement)")
                print("MQ135 relative index:", mq["relative_response_index"])
            print("-" * 42)
            print("MG811 ADC:", display_value(data.get("mg_adc"), decimals=0))
            print("MG811 AO:", display_value(data.get("mg_v"), "V", 3))
            mg = processed["mg811"]
            print("MG811:", mg["status"])
            print("MG811 electrical trend:", mg["trend"]["direction"] or mg["trend"]["status"])
            print("MG811 auto-reference samples:", len(rolling["mg_v"]), "/", MG811_AUTO_REFERENCE_SAMPLES)
            print("MG811 reference:", mg.get("reference_kind") or "PENDING")
            if mg["co2_estimate_ppm"] is not None:
                print("MG811 CO2 estimate (unverified):", mg["co2_estimate_ppm"], "ppm")
            print("-" * 42)
            print("GP2Y dust sensor:", analyze_dust(data.get("dust_v"))["status"])
            print("GP2Y ADC:", display_value(data.get("dust_adc"), decimals=0))
            print("GP2Y AO:", display_value(data.get("dust_v"), "V", 3))
            pm = processed["gp2y"]
            print("GP2Y quality:", pm["status"])
            print("GP2Y optical trend:", pm["trend"]["direction"] or pm["trend"]["status"])
            if filtered_gp2y_voltage := pm.get("voltage_V_filtered"):
                if filtered_gp2y_voltage >= 2.5:
                    print("GP2Y CHECK: HIGH SIGNAL; check LED pulse, divider, wiring; PM withheld")
            if pm["dust_proxy_ug_m3"] is not None:
                print("Optical dust proxy (experimental):", pm["dust_proxy_ug_m3"], "ug/m3")
                print("PM2.5 proxy (experimental):", pm["pm25_proxy_ug_m3"], "ug/m3")
                print("PM10 proxy (experimental):", pm["pm10_proxy_ug_m3"], "ug/m3")
            print("-" * 42)
            print("Hourly samples:", f"{len(history)}/24")
            print("LSTM loaded:", model is not None)
            print(
                "Hourly input ready:",
                history_ready(history, hour_bucket)
            )
            print("=" * 42)

        # Unified telemetry: asynchronous API, untouched sensor history.
        if time.monotonic() - last_report >= PRINT_INTERVAL:
            last_report = time.monotonic()
            report = compose_report(now, data, outdoor_record, forecast=last_forecast, processed=processed)
            write_report(report)
            api_meta = report["weather_api"]
            weather_fields = api_meta.get("measurements") or {}
            print("AERIS UNIFIED | weather API:", api_meta["status"])
            print("Wind speed (m/s):", weather_fields.get("wind_speed_10m"))
            print("Wind direction (deg):", weather_fields.get("wind_direction_10m"))
            print("Wind gusts (m/s):", weather_fields.get("wind_gusts_10m"))
            print("Solar radiation (W/m2):", weather_fields.get("shortwave_radiation"))
            print("UV / clouds / rain / visibility:",
                  weather_fields.get("uv_index"), weather_fields.get("cloud_cover"),
                  weather_fields.get("precipitation"), weather_fields.get("visibility"))
            print("AQI/Scenario native inference: withheld pending verified ABI")
            print("Qwen: existing advisor integration (runtime status not verified)")
            print("Unified JSON:", REPORT_PATH)

        # Never use rapid samples as hourly history
        if (
            model is not None
            and history_ready(history, hour_bucket)
            and last_forecast_hour != hour_bucket
        ):
            prepared, interpolated = prepared_history(history, hour_bucket)
            last_interpolated_hours[:] = interpolated
            if interpolated:
                print("LSTM: single missing hour interpolated IN MEMORY:", interpolated)
            prediction = run_lstm(prepared)

            target = hour_bucket + timedelta(hours=1)

            print("\n===== NEXT-HOUR LSTM =====")
            print("Target:", target.isoformat())
            print(
                f"Temperature: {prediction[0]:.2f} C"
            )
            print(
                f"Humidity: {prediction[1]:.2f} %"
            )
            print(
                f"Pressure: {prediction[2]:.2f} hPa"
            )
            print("==========================")

            last_forecast_hour = hour_bucket
            last_forecast = {"target": target.isoformat(),
                             "temperature_C": prediction[0],
                             "humidity_percent": prediction[1],
                             "pressure_hPa": prediction[2]}
            # Forecast is also included in the unified snapshot.
            write_report(compose_report(now, data, outdoor_record,
                                        forecast=last_forecast, processed=processed))

    except Exception as exc:
        print("AERIS LOOP ERROR:", exc)

    time.sleep(READ_INTERVAL)


App.run(user_loop=loop)
