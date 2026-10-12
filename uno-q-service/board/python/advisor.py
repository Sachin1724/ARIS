import json
import math
import re
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


BASE = Path(__file__).resolve().parent

LLAMA_CLI = (
    Path.home() / "llama.cpp/build/bin/llama-cli"
)

MODEL_FILE = (
    Path.home() /
    "aeris_slm/models/qwen2.5-0.5b-q4.gguf"
)

ADVICE_FILE = BASE / "aeris_advice.json"
LAST_GOOD_FILE = BASE / "aeris_advice_last_good.json"
ADVISOR_HEALTH_FILE = BASE / "aeris_advisor_health.json"

TIMEZONE = ZoneInfo("Asia/Kolkata")

# Do not generate text on every sensor reading.
ADVICE_INTERVAL = 15 * 60

# Prevent the SLM from holding resources indefinitely.
LLM_TIMEOUT = 60


def valid_number(value):
    try:
        number = float(value)
        if math.isfinite(number):
            return number
    except (ValueError, TypeError):
        pass

    return None


def fmt(value, unit, digits=1):
    if value is None:
        return "unavailable"

    return f"{value:.{digits}f} {unit}"


def aqi_description(value):
    if value is None or value < 0:
        return "unavailable"

    if value <= 50:
        return "Good"
    if value <= 100:
        return "Moderate"
    if value <= 150:
        return "Unhealthy for sensitive groups"
    if value <= 200:
        return "Unhealthy"
    if value <= 300:
        return "Very unhealthy"

    return "Hazardous"


def build_facts(sensor, outdoor, weather=None, forecast=None):
    # Check Bosch validity flags before using data.
    bme_ok = sensor.get("bme_ok") == 1
    pressure_ok = sensor.get("pressure_ok") == 1
    gas_ok = sensor.get("gas_ok") == 1

    temp = (
        valid_number(sensor.get("temp"))
        if bme_ok else None
    )
    humidity = (
        valid_number(sensor.get("rh"))
        if bme_ok else None
    )
    pressure = (
        valid_number(sensor.get("pressure"))
        if pressure_ok else None
    )

    bme_gas = (
        valid_number(sensor.get("gas"))
        if gas_ok else None
    )

    if temp is not None and not (-40 <= temp <= 85):
        temp = None

    if humidity is not None and not (0 <= humidity <= 100):
        humidity = None

    if pressure is not None and not (300 <= pressure <= 1100):
        pressure = None

    # Analog measurements are electrical signals,
    # not concentrations in ppm.
    mq_voltage = valid_number(sensor.get("mq_v"))
    mg_voltage = valid_number(sensor.get("mg_v"))

    if mq_voltage is not None and mq_voltage < 0:
        mq_voltage = None

    if mg_voltage is not None and mg_voltage < 0:
        mg_voltage = None

    # Outdoor record is already freshness checked
    # by outdoor_api. Do not change local sensor data.
    values = (
        outdoor.get("values", {})
        if outdoor else {}
    )

    facts = {
        "timestamp": datetime.now(
            TIMEZONE
        ).isoformat(timespec="seconds"),

        "location": "Rourkela, Odisha",

        "local_temperature_c": temp,
        "local_humidity_percent": humidity,
        "local_pressure_hpa": pressure,
        "local_bme_gas_kohm": bme_gas,

        "mq135_ao_voltage_v": mq_voltage,
        "mg811_ao_voltage_v": mg_voltage,

        "outdoor_pm25_ugm3":
            valid_number(values.get("pm2_5")),
        "outdoor_pm10_ugm3":
            valid_number(values.get("pm10")),
        "outdoor_us_aqi":
            valid_number(values.get("us_aqi")),

        "outdoor_data_time":
            outdoor.get("time") if outdoor else None,

        "co2_ppm": None,
        "weather_lstm_prediction": None,

        "sensor_source": "AERIS physical sensors",
        "outdoor_source": (
            "Open-Meteo outdoor model"
            if outdoor else "Unavailable"
        ),
    }

    # Independent regional model fields: never overwrite physical measurements.
    met = (weather or {}).get("measurements") if isinstance(weather, dict) and weather.get("status") == "available" else None
    if isinstance(met, dict):
        facts["regional_weather"] = {
            "source": "Open-Meteo regional model",
            "model_time_utc": met.get("observation_time_utc"),
            "hourly_model_time_utc": met.get("hourly_model_time_utc"),
            "temperature_c": valid_number(met.get("temperature_2m")),
            "humidity_percent": valid_number(met.get("relative_humidity_2m")),
            "wind_m_s": valid_number(met.get("wind_speed_10m")),
            "cloud_percent": valid_number(met.get("cloud_cover")),
            "precipitation_mm": valid_number(met.get("precipitation")),
            "rain_probability_percent": valid_number(met.get("precipitation_probability")),
            "uv_index": valid_number(met.get("uv_index")),
        }
    else:
        facts["regional_weather"] = None
    facts["weather_lstm_prediction"] = forecast if isinstance(forecast, dict) else None

    # Use MG811 ppm only if genuinely calibrated.
    if (
        sensor.get("co2_cal_ok") == 1
        and sensor.get("co2_range_ok") == 1
    ):
        co2 = valid_number(sensor.get("co2_ppm"))

        if co2 is not None and co2 > 0:
            facts["co2_ppm"] = co2

    # Read the latest unified snapshot when available. This never affects
    # the sensor pipeline or the LSTM's own prediction/history.
    try:
        report = json.loads((BASE / "aeris_latest.json").read_text())
        generated = datetime.fromisoformat(report["timestamp"])
        age = (datetime.now(TIMEZONE) - generated.astimezone(TIMEZONE)).total_seconds()
        if 0 <= age <= 180:
            lstm = (report.get("ml") or {}).get("weather_lstm") or {}
            forecast = lstm.get("forecast")
            if isinstance(forecast, dict) and lstm.get("loaded"):
                facts["weather_lstm_prediction"] = forecast
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return facts


def rule_based_feedback(facts):
    notes = []

    temp = facts["local_temperature_c"]
    humidity = facts["local_humidity_percent"]
    pressure = facts["local_pressure_hpa"]
    aqi = facts["outdoor_us_aqi"]

    if temp is None:
        notes.append(
            "Local temperature is unavailable."
        )
    elif temp >= 32:
        notes.append(
            "Local temperature is high. "
            "Keep hydrated and avoid excessive heat exposure."
        )
    elif temp >= 28:
        notes.append(
            "Local conditions are warm."
        )
    elif temp < 16:
        notes.append(
            "Local conditions are relatively cool."
        )
    else:
        notes.append(
            "Local temperature is in a moderate range."
        )

    if humidity is not None:
        if humidity >= 70:
            notes.append(
                "Humidity is high, which may feel uncomfortable."
            )
        elif humidity < 30:
            notes.append(
                "Humidity is low; the air may feel dry."
            )
        else:
            notes.append(
                "Humidity is within a moderate range."
            )

    if pressure is not None:
        notes.append(
            f"Local pressure is {pressure:.1f} hPa. "
            "One pressure reading alone cannot "
            "determine whether it will rain."
        )

    if aqi is not None:
        category = aqi_description(aqi)

        notes.append(
            f"Regional outdoor US AQI is {aqi:.0f} "
            f"({category}), according to Open-Meteo."
        )

        if aqi > 100:
            notes.append(
                "People sensitive to air pollution "
                "should consider limiting prolonged "
                "outdoor exertion."
            )
        elif aqi > 50:
            notes.append(
                "People unusually sensitive to air "
                "pollution may wish to monitor conditions."
            )
    else:
        notes.append(
            "Regional outdoor AQI is unavailable."
        )

    if facts["co2_ppm"] is None:
        notes.append(
            "Indoor CO2 concentration is unavailable "
            "because MG811 calibration is incomplete."
        )

    regional = facts.get("regional_weather")
    if isinstance(regional, dict):
        fields = (
            ("temperature_c", "Regional modeled outdoor temperature", "C"),
            ("humidity_percent", "Regional modeled outdoor humidity", "%"),
            ("wind_m_s", "Regional modeled outdoor wind", "m/s"),
            ("cloud_percent", "Regional modeled cloud cover", "%"),
            ("precipitation_mm", "Regional modeled precipitation", "mm"),
            ("rain_probability_percent", "Regional modeled rain probability", "%"),
            ("uv_index", "Regional modeled UV index", ""),
        )
        for key, label, unit in fields:
            n = valid_number(regional.get(key))
            if n is not None:
                notes.append(f"{label}: {n:.1f} {unit}".strip())

    predicted = facts.get("weather_lstm_prediction")
    if isinstance(predicted, dict):
        t = valid_number(predicted.get("temperature_C"))
        rh = valid_number(predicted.get("humidity_percent"))
        target = predicted.get("target")
        if t is not None and rh is not None and target:
            notes.append(
                f"Experimental local LSTM forecast for {target}: "
                f"temperature {t:.1f} C, humidity {rh:.0f}%. "
                "This is a model estimate, not an outdoor forecast."
            )
    return " ".join(notes)



def generate_with_llm(facts, detailed=False, diagnostics=None):
    """Local Qwen explanation, or None if source/response checks fail.

    diagnostics is optional, preserving older callers of this function.
    """
    from urllib.request import Request, urlopen

    def fail(reason, detail=None):
        if diagnostics is not None:
            diagnostics["reason"] = reason
            if detail:
                diagnostics["detail"] = str(detail)[:180]
        print("[ADVISOR] Qwen unavailable:", reason,
              (str(detail)[:180] if detail else ""), flush=True)
        return None

    gateway_path = BASE / "aeris_llm_gateway.txt"
    if not gateway_path.is_file():
        return fail("missing_gateway_file")

    gateway = gateway_path.read_text().strip()

    # Gateway is generated by Docker network discovery.
    import ipaddress
    try:
        ipaddress.ip_address(gateway)
    except ValueError:
        return fail("invalid_gateway_address")

    temp = valid_number(facts.get("local_temperature_c"))
    rh = valid_number(facts.get("local_humidity_percent"))
    aqi = valid_number(facts.get("outdoor_us_aqi"))
    pressure = valid_number(facts.get("local_pressure_hpa"))

    if temp is None and rh is None:
        return fail("missing_local_temperature_and_humidity")

    # Only weather comfort is entrusted to the SLM.
    observations = []
    if temp is not None:
        observations.append(f"Temperature: {temp:.1f} C")
    if rh is not None:
        observations.append(f"Humidity: {rh:.0f}%")

    # Pass verified modeled regional weather to Qwen independently of rule-based notes.
    regional = facts.get("regional_weather")
    if isinstance(regional, dict):
        for key, label, unit in (
            ("temperature_c", "REGIONAL outdoor temperature", "C"),
            ("humidity_percent", "REGIONAL outdoor humidity", "%"),
            ("wind_m_s", "REGIONAL modeled wind", "m/s"),
            ("cloud_percent", "REGIONAL modeled cloud cover", "%"),
            ("precipitation_mm", "REGIONAL modeled precipitation", "mm"),
            ("rain_probability_percent", "REGIONAL modeled rain probability", "%"),
            ("uv_index", "REGIONAL modeled UV index", ""),
        ):
            value = valid_number(regional.get(key))
            if value is not None:
                observations.append(f"{label}: {value:.1f} {unit}".strip())

    predicted = facts.get("weather_lstm_prediction")
    if isinstance(predicted, dict):
        pred_t = valid_number(predicted.get("temperature_C"))
        pred_rh = valid_number(predicted.get("humidity_percent"))
        if pred_t is not None and pred_rh is not None and predicted.get("target"):
            observations.append(
                f"Experimental next-hour LOCAL LSTM prediction for {predicted['target']}: "
                f"temperature {pred_t:.1f} C, humidity {pred_rh:.0f}%. "
                "This is an uncertain model prediction, not observed weather."
            )

    if detailed:
        if pressure is not None:
            observations.append(
                f"Pressure: {pressure:.1f} hPa"
            )
        task = (
            "Explain how the available temperature and "
            "humidity may feel to a person. "
            "Write 2 short sentences, under 50 words; mention LSTM only if supplied."
        )
        limit = 120
    else:
        task = (
            "Write a short factual weather check-in distinguishing LOCAL indoor "
            "sensors and REGIONAL outdoor modeled readings. "
            "Only mention outdoor conditions when supplied. "
            "Avoid activity recommendations. Use at most 18 words. "
            "mention LSTM only if supplied."
        )
        limit = 105

    system = (
        "You are AERIS, a friendly weather companion. "
        "Use ONLY the supplied sensor and modeled weather readings. "
        "Indoor and regional outdoor values are different sources. "
        "Do not discuss air quality or AQI (added separately). "
        "Do not claim sunshine from temperature alone. "
        "Avoid exaggeration, outdoor activity or safety recommendations. "
        "If a local LSTM prediction was supplied, you may describe it as uncertain. "
        "Do not invent predictions or outdoor weather. "
        "Do not invent observations. "
        "Do not say opening windows is safe. "
        "Avoid repetition. Write ONE grammatical sentence, 12 to 18 words, ending with a period. "
        "Describe the supplied observations without inventing future conditions."
    )

    if not isinstance(facts.get("weather_lstm_prediction"), dict):
        system += (
            " No forecast is available in the supplied observations. "
            "Discuss only current measurements. "
            "Never mention LSTM, prediction, forecast, or next-hour. "
            "Do not discuss unavailable forecasting."
        )

    user = "\n".join(observations) + "\n" + task

    payload = {
        "model": "local",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": limit,
        "temperature": 0.1,
        "stream": False,
    }

    request = Request(
        f"http://{gateway}:8088/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    # This part is determined by verified Open-Meteo AQI.
    if aqi is None:
        air_note = (
            "I don't have a current outdoor air-quality "
            "reading, so I can't judge that part yet."
        ) if detailed else ""
    elif aqi <= 50:
        air_note = (
            "The regional outdoor air-quality estimate "
            "is in the good category."
        )
    elif aqi <= 100:
        air_note = (
            "Outdoor air quality is moderate; people "
            "unusually sensitive to pollution may "
            "want to take extra care."
        )
    elif aqi <= 150:
        air_note = (
            "Outdoor air quality isn't great for "
            "sensitive people right now, so consider "
            "reducing prolonged outdoor exertion."
        )
    elif aqi <= 200:
        air_note = (
            "Outdoor air quality is unhealthy, so "
            "consider limiting prolonged outdoor exertion."
        )
    elif aqi <= 300:
        air_note = (
            "Outdoor air quality is very unhealthy. "
            "It's best to avoid prolonged outdoor exertion."
        )
    else:
        air_note = (
            "Outdoor air quality is hazardous. "
            "Avoid outdoor physical activity."
        )

    try:
        with urlopen(request, timeout=LLM_TIMEOUT) as response:
            result = json.load(response)

        choice = result["choices"][0]
        response_text = " ".join(
            choice["message"]["content"].split()
        ).strip()

        if not response_text:
            return fail("empty_response")
        if len(response_text) > 500:
            return fail("response_too_long", len(response_text))
        if choice.get("finish_reason") == "length" or response_text[-1] not in ".!?":
            # Preserve only a complete initial sentence if the model rambles.
            # Do not fabricate a period at the end of unfinished generated text.
            complete = re.search(r"^(.{12,240}?[.!?])(?:\s|$)", response_text)
            if complete:
                response_text = complete.group(1).strip()
            else:
                # A small model occasionally ends mid-sentence. One bounded retry
                # with a shorter instruction, without weakening factual checks.
                retry_payload = dict(payload)
                retry_payload["messages"] = [
                    payload["messages"][0],
                    {"role": "user", "content":
                     "Use only these readings. Write ONE complete factual sentence, "
                     "12 to 16 words, ending with a period. Do not invent details.\n"
                     + "\n".join(observations)},
                ]
                retry_payload["temperature"] = 0.0
                retry_payload["max_tokens"] = 120
                retry_request = Request(
                    f"http://{gateway}:8088/v1/chat/completions",
                    data=json.dumps(retry_payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST")
                with urlopen(retry_request, timeout=LLM_TIMEOUT) as retry_response:
                    retried = json.load(retry_response)
                retry_choice = retried["choices"][0]
                response_text = " ".join(
                    retry_choice["message"]["content"].split()).strip()
                choice = retry_choice
                if (not response_text or len(response_text) > 500
                        or retry_choice.get("finish_reason") == "length"
                        or response_text[-1] not in ".!?"):
                    return fail("unfinished_sentence_after_retry")
                if diagnostics is not None:
                    diagnostics["retried_for_completion"] = True

        if not isinstance(facts.get("weather_lstm_prediction"), dict):
            if re.search(r"\b(?:lstm|prediction|forecast|next.hour)\b", response_text, re.I):
                if diagnostics is not None:
                    diagnostics["rejected_text_preview"] = response_text[:240]
                return fail("unsupported_lstm_claim")

        lower = response_text.lower()
        # Claims about conditions not observed by the indoor BME sensor
        # must never slip through solely because they end with punctuation.
        unsupported = (
            r"\b(?:sunny|sunshine|clear skies|cloudy|overcast|stormy|"
            r"raining|rainy|drizzle|snowing|snowy|windy|breezy|"
            r"air is safe|safe outside|safe outdoors|air is clean|"
            r"opening? (?:the )?windows?|aqi|air quality|pollution)\b"
        )
        unsupported_claim = re.search(unsupported, lower)
        # Only rain/cloud/wind language can be supported by independently
        # fetched regional conditions; never infer them from the BME.
        if unsupported_claim:
            term = unsupported_claim.group(0)
            reg = facts.get("regional_weather") or {}
            supported = (
                (term in ("sunny", "sunshine", "clear skies", "cloudy", "overcast") and valid_number(reg.get("cloud_percent")) is not None)
                or (term in ("rain", "rainy", "raining", "drizzle") and valid_number(reg.get("precipitation_mm")) is not None)
                or (term in ("windy", "breezy") and valid_number(reg.get("wind_m_s")) is not None)
            )
            cloud = valid_number(reg.get("cloud_percent"))
            rain = valid_number(reg.get("precipitation_mm"))
            if term in ("sunny", "sunshine", "clear skies") and (cloud is None or cloud > 20):
                supported = False
            if term in ("cloudy", "overcast") and (cloud is None or cloud < 60):
                supported = False
            if term in ("rain", "rainy", "raining", "drizzle") and (rain is None or rain <= 0):
                supported = False
            if not supported:
                return fail("unsupported_weather_or_safety_claim", term)
        # Check descriptions that conflict with supplied observations.
        if rh is not None:
            if rh < 70 and re.search(r"\b(?:high humidity|humidity is high|very humid|muggy|sticky)\b", lower):
                return fail("humidity_description_conflicts_with_reading")
            if rh >= 70 and re.search(r"\b(?:low humidity|humidity is low|dry humidity)\b", lower):
                return fail("humidity_description_conflicts_with_reading")
        if temp is not None:
            if temp >= 28 and re.search(r"\b(?:keep (?:yourself |your hands |your feet )?warm|bundle up|wear a jacket|cold day|chilly day)\b", lower):
                return fail("temperature_advice_conflicts_with_reading")
        # The LLM must not independently report numeric facts that were
        # not verified here; app also receives exact structured data.
        if re.search(r"\b(?:safe to go outside|safe to open|no pollution)\b", lower):
            return fail("unsupported_safety_claim")
        if diagnostics is not None:
            diagnostics["reason"] = "accepted"
            diagnostics["finish_reason"] = choice.get("finish_reason")

        if detailed:
            extra = []
            if pressure is not None:
                extra.append(
                    f"Measured pressure is "
                    f"{pressure:.1f} hPa."
                )
            if aqi is not None:
                extra.append(
                    f"The regional modeled US AQI is "
                    f"{aqi:.0f}."
                )
            if air_note:
                extra.append(air_note)
            if facts.get("co2_ppm") is None:
                extra.append(
                    "Indoor CO2 is not yet calibrated."
                )
            return " ".join([response_text] + extra)

        return " ".join(
            part for part in (response_text, air_note)
            if part
        )

    except Exception as exc:
        return fail("request_or_parse_error", "%s: %s" % (type(exc).__name__, exc))


class AERISAdvisor:
    def __init__(self):
        self.lock = threading.Lock()
        self.busy = False
        self.next_run = 0.0
        self.latest = None
        self.last_outdoor_signature = None
        self.last_weather_signature = None
        self.health = {"state": "initialized", "last_tick": None, "last_started": None, "last_finished": None, "last_error": None, "last_skip": None}
        self.last_health_write = 0.0
        self._save_health(force=True)

        print("[ADVISOR] Initialized")
        print(
            "[ADVISOR] llama.cpp:",
            LLAMA_CLI.is_file()
        )
        print(
            "[ADVISOR] Model:",
            MODEL_FILE.is_file()
        )

    def _save_health(self, force=False):
        """Best-effort, rate-limited diagnostics; no changes to sensor files."""
        now = time.monotonic()
        if not force and now - self.last_health_write < 60:
            return
        self.last_health_write = now
        try:
            report = dict(self.health)
            report["busy"] = self.busy
            report["seconds_until_next_run"] = round(max(0.0, self.next_run - now), 1)
            path = ADVISOR_HEALTH_FILE.with_suffix(".json.tmp")
            path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            path.replace(ADVISOR_HEALTH_FILE)
        except OSError:
            pass

    def _save(self, result):
        temp = ADVICE_FILE.with_suffix(".json.tmp")

        temp.write_text(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False
            ),
            encoding="utf-8"
        )

        temp.replace(ADVICE_FILE)

    def _worker(self, sensor, outdoor, weather=None, forecast=None):
        try:
            with self.lock:
                self.health["state"] = "worker_running"
                self._save_health(force=True)
            facts = build_facts(sensor, outdoor, weather, forecast)

            rules = rule_based_feedback(facts)

            print("\n===== AERIS WEATHER ADVISOR =====")
            print("Mode: SENSOR-BASED")
            print(rules)

            diagnostic = {}
            llm_text = generate_with_llm(facts, diagnostics=diagnostic)

            if llm_text:
                print("\nAI explanation (experimental):")
                print(llm_text)
            else:
                print(
                    "\nAI explanation: unavailable; "
                    "sensor-based advice active."
                )

            result = {
                "generated_at": facts["timestamp"],
                "facts": facts,
                "sensor_feedback": rules,
                "llm_feedback": llm_text,
                "llm_available": llm_text is not None,
                "llm_diagnostic": diagnostic,
            }

            # Last valid text is archival only: never pass it off as fresh.
            if llm_text is not None:
                last_good = {
                    "generated_at": facts["timestamp"],
                    "llm_feedback": llm_text,
                    "facts": facts,
                }
                tmp = LAST_GOOD_FILE.with_suffix(".json.tmp")
                tmp.write_text(json.dumps(last_good, indent=2,
                                          ensure_ascii=False), encoding="utf-8")
                tmp.replace(LAST_GOOD_FILE)
            else:
                try:
                    last_good = json.loads(LAST_GOOD_FILE.read_text(encoding="utf-8"))
                    stamp = datetime.fromisoformat(last_good["generated_at"])
                    age_s = max(0, (datetime.now(TIMEZONE) - stamp).total_seconds())
                    result["last_successful_llm"] = {
                        "generated_at": last_good["generated_at"],
                        "age_seconds": round(age_s),
                        "stale": age_s > ADVICE_INTERVAL,
                        "llm_feedback": last_good.get("llm_feedback"),
                        "note": "Historical explanation only; not current sensor conditions",
                    }
                except (OSError, ValueError, TypeError, KeyError):
                    pass
            self._save(result)

            with self.lock:
                self.health["last_finished"] = datetime.now(TIMEZONE).isoformat()
                self.health["state"] = "worker_saved"
                self.health["last_error"] = None
                self._save_health(force=True)
                self.latest = result

            print("===============================\n")

        except Exception as exc:
            print("[ADVISOR] Error:", exc)
            with self.lock:
                self.health["state"] = "worker_error"
                self.health["last_error"] = f"{type(exc).__name__}: {str(exc)[:250]}"
                self._save_health(force=True)

        finally:
            with self.lock:
                self.busy = False
                self._save_health(force=True)

    def tick(self, sensor, outdoor_record=None, weather=None, forecast=None):
        now = time.monotonic()

        # A fresh outdoor record should trigger an
        # immediate update, rather than waiting 15 minutes.
        outdoor_signature = None

        if outdoor_record:
            values = outdoor_record.get("values", {})

            if values.get("us_aqi") is not None:
                outdoor_signature = (
                    outdoor_record.get("time"),
                    values.get("us_aqi")
                )

        # A fresh regional weather timestamp deserves one early advisor update.
        # Do not trigger on age_seconds, which changes every sensor reading.
        weather_signature = None
        if isinstance(weather, dict) and weather.get("status") == "available":
            met = weather.get("measurements") or {}
            if isinstance(met, dict):
                weather_signature = (
                    met.get("observation_time_utc"),
                    met.get("hourly_model_time_utc"),
                )
                if not any(weather_signature):
                    weather_signature = None

        with self.lock:
            self.health["last_tick"] = datetime.now(TIMEZONE).isoformat()
            outdoor_changed = (
                outdoor_signature is not None
                and outdoor_signature != self.last_outdoor_signature
            )
            weather_changed = (
                weather_signature is not None
                and weather_signature != self.last_weather_signature
            )

            if self.busy:
                self.health["last_skip"] = "worker_busy"
                self._save_health()
                return

            if now < self.next_run and not (outdoor_changed or weather_changed):
                self.health["last_skip"] = "interval_not_elapsed"
                self._save_health()
                return

            self.busy = True
            self.health["state"] = "worker_scheduled"
            self.health["last_started"] = datetime.now(TIMEZONE).isoformat()
            self.health["last_skip"] = None
            self._save_health(force=True)
            self.next_run = now + ADVICE_INTERVAL

            if outdoor_signature is not None:
                self.last_outdoor_signature = outdoor_signature
            if weather_signature is not None:
                self.last_weather_signature = weather_signature

        # Copies prevent accidental shared-data changes.
        sensor_copy = dict(sensor)

        outdoor_copy = None

        if outdoor_record is not None:
            outdoor_copy = {
                **outdoor_record,
                "values": dict(
                    outdoor_record.get("values", {})
                )
            }

        weather_copy = json.loads(json.dumps(weather)) if isinstance(weather, dict) else None
        forecast_copy = json.loads(json.dumps(forecast)) if isinstance(forecast, dict) else None
        threading.Thread(
            target=self._worker,
            args=(sensor_copy, outdoor_copy, weather_copy, forecast_copy),
            daemon=True,
            name="AERIS-Advisor"
        ).start()
