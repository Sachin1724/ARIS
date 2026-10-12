"""ARIS/AERIS mobile-contract API reading the existing AERIS JSON/CSV producers.
Run on UNO Q Linux HOST with: python3 -m uvicorn aeris_hotspot:app --host 127.0.0.1 --port 8000
No Bridge calls, network mutations, sensor resets, or LLM inference.
"""
from __future__ import annotations
import asyncio
import csv
import json
import math
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel, Field
import re
from urllib.request import Request, urlopen as _urlopen

BASE = Path(os.environ.get('AERIS_DATA_DIR', str(Path(__file__).resolve().parent)))

# --- Conversation Memory ---
MEMORY_FILE = BASE / 'aris_memory.json'
MEMORY_MAX = 5

def _load_memory():
    try:
        return json.loads(MEMORY_FILE.read_text())
    except (OSError, ValueError):
        return {'conversations': [], 'trends': []}

def _save_memory(mem):
    try:
        MEMORY_FILE.write_text(json.dumps(mem, default=str))
    except OSError:
        pass

def _add_conversation(question, answer):
    mem = _load_memory()
    mem['conversations'].append({
        'q': question[:100],
        'a': answer[:150],
        't': datetime.now(timezone.utc).isoformat()
    })
    mem['conversations'] = mem['conversations'][-MEMORY_MAX:]
    _save_memory(mem)

def _get_recent_conversations():
    mem = _load_memory()
    return mem.get('conversations', [])[-3:]

# --- Sensor Trend Tracking ---
TREND_FILE = BASE / 'aris_trends.json'

def _record_trend(sensors):
    """Record hourly sensor snapshot for trend analysis."""
    try:
        trends = json.loads(TREND_FILE.read_text()) if TREND_FILE.exists() else []
    except (OSError, ValueError):
        trends = []

    now = datetime.now(timezone.utc)
    # Only record once per 30 minutes
    if trends:
        last_t = trends[-1].get('t', '')
        try:
            last_dt = datetime.fromisoformat(last_t)
            if (now - last_dt).total_seconds() < 1800:
                return
        except (ValueError, TypeError):
            pass

    snap = {'t': now.isoformat()}
    for key in ['temperature_c', 'humidity_pct', 'pm25', 'pm10', 'co2']:
        v = sensors.get(key, {})
        if v.get('valid') and v.get('value') is not None:
            snap[key] = round(float(v['value']), 1)
    trends.append(snap)
    # Keep last 48 entries (24 hours at 30min intervals)
    trends = trends[-48:]
    try:
        TREND_FILE.write_text(json.dumps(trends))
    except OSError:
        pass

def _get_trend_summary():
    """Return a short trend summary for context."""
    try:
        trends = json.loads(TREND_FILE.read_text()) if TREND_FILE.exists() else []
    except (OSError, ValueError):
        return ''
    if len(trends) < 4:
        return ''

    recent = trends[-6:]  # Last 3 hours
    pm_vals = [t.get('pm25') for t in recent if t.get('pm25') is not None]
    co2_vals = [t.get('co2') for t in recent if t.get('co2') is not None]
    temp_vals = [t.get('temperature_c') for t in recent if t.get('temperature_c') is not None]

    parts = []
    if len(pm_vals) >= 2:
        if pm_vals[-1] > pm_vals[0] + 15:
            parts.append(f"PM2.5 rising (was {pm_vals[0]:.0f}, now {pm_vals[-1]:.0f})")
        elif pm_vals[-1] < pm_vals[0] - 15:
            parts.append(f"PM2.5 improving (was {pm_vals[0]:.0f}, now {pm_vals[-1]:.0f})")
    if len(co2_vals) >= 2:
        if co2_vals[-1] > co2_vals[0] + 200:
            parts.append(f"CO2 climbing (was {co2_vals[0]:.0f}, now {co2_vals[-1]:.0f})")
    if len(temp_vals) >= 2:
        if temp_vals[-1] > temp_vals[0] + 2:
            parts.append("Room warming up")
        elif temp_vals[-1] < temp_vals[0] - 2:
            parts.append("Room cooling down")

    return 'TRENDS: ' + '. '.join(parts) + '.' if parts else ''

STARTED = time.monotonic()
app = FastAPI(title='AERIS UNO Q API', version='0.1.0')

# Once hotspot is enabled, require bearer authentication for every network API.
# The token is delivered via BLE network_info after a verified physical PIN.
# Do not expose this API over a public network without TLS/security hardening.
def wifi_token():
    try:
        data=json.loads((BASE / '.aeris_wifi_credentials.json').read_text())
        return str(data['token'])
    except (OSError, ValueError, KeyError, TypeError):
        return None

@app.middleware('http')
async def wifi_auth(request: Request, call_next):
    from fastapi.responses import JSONResponse
    import secrets as _secrets
    token=wifi_token()
    if token is None:
        if request.client and request.client.host not in ('127.0.0.1','::1'):
            return JSONResponse({'detail':'Hotspot not provisioned'},status_code=503)
    elif not _secrets.compare_digest(request.headers.get('authorization',''), 'Bearer '+token):
        # Localhost diagnostic endpoints stay accessible for SSH testing.
        if not (request.client and request.client.host in ('127.0.0.1','::1')):
            return JSONResponse({'detail':'Unauthorized'},status_code=401)
    return await call_next(request)


def load(name):
    try:
        p = BASE / name
        if not p.is_file() or p.stat().st_size > 4000000: return {}
        x = json.loads(p.read_text())
        return x if isinstance(x, dict) else {}
    except (OSError, UnicodeError, json.JSONDecodeError):
        return {}


def numeric(n):
    if isinstance(n, bool): return None
    try:
        x = float(n)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError, OverflowError): return None


def iso(dt):
    try:
        d = datetime.fromisoformat(str(dt).replace('Z', '+00:00'))
        if d.tzinfo is None: return None
        return d.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    except (ValueError, TypeError): return None


def stale(ts, seconds=60):
    try:
        d = datetime.fromisoformat(str(ts).replace('Z','+00:00'))
        return d.tzinfo is None or (datetime.now(timezone.utc) - d).total_seconds() > seconds
    except (ValueError, TypeError): return True


def metric(value, unit, valid, calibrated=False, source='device_sensor', when=None):
    val = numeric(value) if valid else None
    return {'value': val, 'unit': unit, 'valid': val is not None,
            'calibrated': bool(calibrated and val is not None), 'source': source,
            'stale': stale(when) if when else True}


def current_status():
    d = load('aeris_latest.json')
    ts = d.get('timestamp')
    b = d.get('bme690') or {}
    mq = d.get('mq135') or {}
    mg = d.get('mg811') or {}
    gp = d.get('gp2y') or {}
    ml = ((d.get('ml') or {}).get('weather_lstm') or {})
    ready = bool(b.get('valid_for_weather_lstm'))
    sensors = {
        'temperature_c': metric(b.get('temperature_C'), '°C', ready, False, when=ts),
        'humidity_pct': metric(b.get('humidity_percent'), '%', ready, False, when=ts),
        'pressure_hpa': metric(b.get('pressure_hPa'), 'hPa', ready, False, when=ts),
        'bme_gas_kohm': metric(b.get('gas_resistance_kohm'), 'kΩ', b.get('gas_resistance_kohm') is not None, False, when=ts),
        'mq135_voltage_v': metric(mq.get('voltage_V_filtered'), 'V', True, False, when=ts),
        'mq135_resistance_kohm': metric(mq.get('estimated_rs_kohm'), 'kΩ', True, False, source='derived', when=ts),
        'mg811_voltage_v': metric(mg.get('voltage_V_filtered'), 'V', True, False, when=ts),
        'gp2y_voltage_v': metric(gp.get('voltage_V_filtered'), 'V', True, False, when=ts),
        # tvoc: MQ135 is a mixed-gas sensor, not a specific TVOC concentration
        # sensor. Reported as a relative index, never a fabricated ppb value.
        'tvoc': metric(mq.get('relative_response_index'), 'index', True, False,
                       source='mq135_relative_index_not_calibrated_tvoc', when=ts),
    }
    # CO2 and dust: use estimates from collector when calibration is active.
    # Values are experimental, never reference-calibrated. Source tags convey this.
    co2_ppm = mg.get('co2_estimate_ppm')
    co2_valid = co2_ppm is not None and isinstance(co2_ppm, (int, float))
    co2_src = mg.get('status') or 'mg811_experimental'
    sensors['co2'] = metric(co2_ppm if co2_valid else None, 'ppm',
                            co2_valid, False, source=co2_src, when=ts)
    pm25_raw = gp.get('pm25_proxy_ug_m3')
    pm10_raw = gp.get('pm10_proxy_ug_m3')
    pm_src = gp.get('status') or 'gp2y_experimental'
    # ponytail: humidity correction for GP2Y optical sensor over-reading in moist air
    rh = numeric(b.get('humidity_percent'))
    if rh is not None and rh > 50:
        hcf = 1 + 0.24 * (rh / 100)
    else:
        hcf = 1.0
    pm25 = round(pm25_raw / hcf, 1) if isinstance(pm25_raw, (int, float)) else None
    pm10 = round(pm10_raw / hcf, 1) if isinstance(pm10_raw, (int, float)) else None
    sensors['pm25'] = metric(pm25, 'µg/m³', pm25 is not None, False, source=pm_src, when=ts)
    sensors['pm10'] = metric(pm10, 'µg/m³', pm10 is not None, False, source=pm_src, when=ts)
    met = (d.get('weather_api') or {})
    if met.get('status') == 'available':
        w = met.get('measurements') or {}
        sensors['regional_temperature_c'] = metric(w.get('temperature_2m'), '°C', True, False, 'weather_provider', w.get('observation_time_utc'))
        sensors['regional_humidity_pct'] = metric(w.get('relative_humidity_2m'), '%', True, False, 'weather_provider', w.get('observation_time_utc'))
    mood = _compute_mood(sensors)
    return {'timestamp': iso(ts), 'sensors': sensors, 'mood': mood,
            'forecast_status': {'model_loaded': ml.get('loaded') is True,
                                'input_ready': isinstance(ml.get('forecast'), dict),
                                'hourly_samples': ml.get('hourly_samples', 0),
                                'acquired_hourly_samples': ml.get('hourly_samples', 0),
                                'required_hourly_samples': 24},
            'sensor_status': {'mq135': mq.get('status'), 'mg811': mg.get('status'),
                              'gp2y': gp.get('status'), 'warmup_complete': d.get('warmup_complete')},
            'weather_status': met.get('status'), 'source': 'AERIS processed snapshot'}


def advice_info():
    a = load('aeris_advice.json')
    h = load('aeris_advisor_health.json')
    last = load('aeris_advice_last_good.json')
    return {'generated_at': iso(a.get('generated_at')), 'llm_feedback': a.get('llm_feedback') if a.get('llm_available') is True else None,
            'llm_available': a.get('llm_available') is True,
            'sensor_feedback': a.get('sensor_feedback'), 'llm_diagnostic': a.get('llm_diagnostic'),
            'last_good': {'generated_at': iso(last.get('generated_at')), 'llm_feedback': last.get('llm_feedback')},
            'scheduler': {'interval_seconds': 900, 'state': h.get('state'), 'busy': h.get('busy'), 'last_error': h.get('last_error')}}


# Live /ws/live peers, keyed by (host, port). One phone can hold several
# sockets, so "devices" counts distinct hosts and "sockets" counts connections.
WS_CLIENTS = {}


def clients_info():
    now = time.time()
    sockets = []
    for (host, port), started in sorted(WS_CLIENTS.items()):
        sockets.append({'host': host, 'port': port,
                        'connected_s': round(now - started, 1)})
    hosts = sorted({host for host, _ in WS_CLIENTS})
    return {'devices': len(hosts), 'sockets': len(WS_CLIENTS),
            'hosts': hosts, 'connections': sockets}


def _read_text(path):
    try:
        with open(path) as handle:
            return handle.read()
    except OSError:
        return None


def cpu_info():
    raw = _read_text('/proc/loadavg')
    cores = os.cpu_count() or 1
    if not raw:
        return {'load1': None, 'load5': None, 'load15': None, 'cores': cores,
                'load1_pct': None}
    parts = raw.split()
    load1, load5, load15 = (float(parts[0]), float(parts[1]), float(parts[2]))
    return {'load1': load1, 'load5': load5, 'load15': load15, 'cores': cores,
            'load1_pct': round(min(load1 / cores, 1.0) * 100, 1)}


def memory_info():
    raw = _read_text('/proc/meminfo')
    if not raw:
        return {'total_mb': None, 'available_mb': None, 'used_pct': None}
    fields = {}
    for line in raw.splitlines():
        key, _, rest = line.partition(':')
        value = rest.strip().split(' ')[0]
        if value.isdigit():
            fields[key] = int(value)
    total = fields.get('MemTotal')
    available = fields.get('MemAvailable')
    if not total or available is None:
        return {'total_mb': None, 'available_mb': None, 'used_pct': None}
    return {'total_mb': round(total / 1024, 1),
            'available_mb': round(available / 1024, 1),
            'used_pct': round((total - available) / total * 100, 1)}


def disk_info():
    try:
        usage = shutil.disk_usage('/')
    except OSError:
        return {'total_gb': None, 'free_gb': None, 'used_pct': None}
    # Match df: reserved root blocks are neither used nor available, so the
    # percentage is used/(used+free), otherwise the app and the shell disagree.
    denominator = usage.used + usage.free
    return {'total_gb': round(usage.total / 1e9, 1),
            'free_gb': round(usage.free / 1e9, 1),
            'used_pct': round(usage.used / denominator * 100, 1) if denominator else None}


def soc_temperature_c():
    best = None
    for zone in range(6):
        raw = _read_text(f'/sys/class/thermal/thermal_zone{zone}/temp')
        if not raw or not raw.strip().lstrip('-').isdigit():
            continue
        value = int(raw.strip()) / 1000.0
        if 0 < value < 150 and (best is None or value > best):
            best = value
    return round(best, 1) if best is not None else None


def uptime_s():
    raw = _read_text('/proc/uptime')
    try:
        return round(float(raw.split()[0]), 1) if raw else None
    except (ValueError, IndexError):
        return None


ARIS_UNITS = ('aris-api', 'aris-ble', 'aris-slm', 'aris-app-autostart',
              'aris-poweroff.path')


def services_info():
    """systemctl is-active works unprivileged; unknown units report their error."""
    out = []
    for unit in ARIS_UNITS:
        try:
            result = subprocess.run(['systemctl', 'is-active', unit],
                                    capture_output=True, text=True, timeout=5)
            state = (result.stdout or result.stderr).strip() or 'unknown'
        except (OSError, subprocess.SubprocessError):
            state = 'unknown'
        out.append({'unit': unit, 'state': state,
                    'ok': state in ('active', 'activating', 'waiting')})
    return out


def slm_info():
    try:
        # _urlopen is already imported at module scope for the weather provider.
        with _urlopen('http://127.0.0.1:8089/health', timeout=2) as resp:
            return {'reachable': resp.status == 200, 'port': 8089}
    except Exception:
        return {'reachable': False, 'port': 8089}


def collector_info():
    """Freshness of the file the sensor collector writes (~31s cadence)."""
    d = load('aeris_latest.json')
    ts = iso(d.get('timestamp'))
    if not ts:
        return {'timestamp': None, 'age_s': None, 'ok': False}
    try:
        then = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        age = (datetime.now(timezone.utc) - then).total_seconds()
    except (ValueError, TypeError):
        return {'timestamp': ts, 'age_s': None, 'ok': False}
    return {'timestamp': ts, 'age_s': round(age, 1), 'ok': age <= 120}


def ble_info():
    """Remaining pairing window, same gate file aeris_ble.py reads."""
    try:
        gate = json.loads((BASE / 'aeris_discovery_gate.json').read_text())
        remaining = float(gate.get('expires_at', 0)) - time.time()
        physical = gate.get('source') == 'physical_d3_long_press'
        if physical and 0 < remaining <= 180.5:
            return {'pairing_window_s': round(remaining, 1), 'advertising': True}
    except (OSError, ValueError, TypeError):
        pass
    return {'pairing_window_s': 0, 'advertising': False}


def write_link_state():
    """Publish what only the API knows (who is connected, current mood) for the
    collector to push to the MCU display. The collector reads /proc itself, so
    nothing here needs to be fast or complete."""
    try:
        clients = clients_info()
        try:
            mood_int = MOOD_TO_INT.get(current_status().get('mood'), 0)
        except Exception:
            mood_int = 0
        payload = {'devices': clients['devices'], 'sockets': clients['sockets'],
                   'mood_int': mood_int, 'wifi_ok': 1,
                   'written_at': time.time()}
        temp_path = BASE / 'aeris_link_state.json.tmp'
        temp_path.write_text(json.dumps(payload))
        os.replace(temp_path, BASE / 'aeris_link_state.json')
    except Exception:
        # The display is a nicety; never let it break a request.
        pass


@app.get('/api/v1/system')
def system_health():
    """Board health for the app's system monitor. Every probe is guarded so one
    failure degrades a single field instead of failing the whole response."""
    write_link_state()
    out = {'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
    for key, probe in (('cpu', cpu_info), ('memory', memory_info),
                       ('disk', disk_info), ('services', services_info),
                       ('slm', slm_info), ('collector', collector_info),
                       ('clients', clients_info), ('ble', ble_info)):
        try:
            out[key] = probe()
        except Exception as exc:
            out[key] = None
            out.setdefault('errors', {})[key] = str(exc)
    for key, probe in (('temperature_c', soc_temperature_c), ('uptime_s', uptime_s)):
        try:
            out[key] = probe()
        except Exception:
            out[key] = None
    return out


@app.get('/api/v1/health')
def health():
    status = current_status()
    return {'status': 'degraded' if status['timestamp'] is None or stale(status['timestamp'], 120) else 'ok',
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00','Z'), 'version':'0.1.0'}


@app.get('/api/v1/device')
def device():
    return {'id': os.getenv('AERIS_DEVICE_ID', 'UNOQ-03E1'), 'name': 'ARIS UNO Q',
            'firmware_version': os.getenv('AERIS_FIRMWARE_VERSION','0.1.0'),
            'uptime_seconds': int(time.monotonic()-STARTED)}


@app.get('/api/v1/status')
def status(): return current_status()


COLUMN = {'temperature_c': ('temperature', '°C'), 'humidity_pct': ('humidity', '%'),
          'pressure_hpa': ('pressure', 'hPa')}

def history_points(metric_name, hours):
    if metric_name not in COLUMN: raise HTTPException(400, 'Unsupported history metric')
    column, unit = COLUMN[metric_name]
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    points = []
    try:
        with (BASE / 'weather_history.csv').open(newline='') as f:
            for row in csv.DictReader(f):
                dt = iso(row.get('timestamp'))
                if not dt: continue
                parsed = datetime.fromisoformat(dt.replace('Z','+00:00'))
                if not cutoff <= parsed <= now: continue
                v = numeric(row.get(column))
                if v is not None: points.append({'timestamp': dt, 'value': v, 'unit':unit, 'kind':'observed'})
    except (OSError, UnicodeError, csv.Error): pass
    return points


@app.get('/api/v1/history')
def history(metric: str = 'temperature_c', hours: int = 24):
    if not 1 <= hours <= 720: raise HTTPException(400, 'hours must be 1..720')
    now = datetime.now(timezone.utc)
    return {'metric': metric, 'points': history_points(metric, hours),
            'from': (now-timedelta(hours=hours)).isoformat().replace('+00:00','Z'),
            'to': now.isoformat().replace('+00:00','Z')}


@app.get('/api/v1/forecast')
def forecast(metric: str = 'temperature_c'):
    if metric not in ('temperature_c','humidity_pct','pressure_hpa'):
        raise HTTPException(400, 'Unsupported forecast metric')
    d = load('aeris_latest.json')
    ml = ((d.get('ml') or {}).get('weather_lstm') or {})
    pred = ml.get('forecast') if ml.get('loaded') is True else None
    mappings = {'temperature_c': ('temperature_C','°C'), 'humidity_pct':('humidity_percent','%'), 'pressure_hpa':('pressure_hPa','hPa')}
    key, unit = mappings[metric]
    points = []
    if isinstance(pred, dict):
        val = numeric(pred.get(key)); target = iso(pred.get('target'))
        if val is not None and target:
            points.append({'timestamp':target,'value':val,'unit':unit,'kind':'predicted'})
    # Add ARIS forecast if available
    aris_fc = _get_forecast()
    aris_pred = None
    if aris_fc:
        if metric == 'temperature_c':
            aris_pred = aris_fc.get('predicted_temperature_c')
        elif metric == 'humidity_pct':
            aris_pred = aris_fc.get('predicted_humidity_pct')
    return {'metric':metric,'points':points,
            'model_version':'lstm-v1' if ml.get('loaded') else 'not_loaded',
            'generated_at':iso(d.get('timestamp')) if points else None,
            'input_ready':bool(points),
            'aris_forecast': aris_fc}




# --- Forecast ---
FORECAST_FILE = BASE / 'aris_forecast.json'

def _get_forecast():
    """Read latest forecast if fresh (< 2 hours old)."""
    try:
        f = json.loads(FORECAST_FILE.read_text())
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(f['generated_at'])).total_seconds()
        if age < 7200:
            return f
    except (OSError, ValueError, KeyError):
        pass
    return None


def _compute_mood(sensors):
    """Derive ARIS mood from sensor readings. Returns mood string."""
    pm25 = sensors.get('pm25', {})
    v = pm25.get('value') if pm25.get('valid') and not pm25.get('stale') else None
    if v is None:
        return 'sleepy'
    if v <= 12:
        return 'happy'
    if v <= 35:
        return 'normal'
    if v <= 55:
        return 'suspicious'
    if v <= 150:
        return 'angry'
    return 'angry'

MOOD_TO_INT = {'normal': 0, 'happy': 1, 'sad': 2, 'suspicious': 3, 'angry': 4, 'sleepy': 5}

LLM_URL_FAST = 'http://127.0.0.1:8089/v1/chat/completions'
LLM_URL_SLOW = 'http://127.0.0.1:8088/v1/chat/completions'

ARIS_SYSTEM = (
    'You are ARIS, a personal air quality companion mounted in the user\'s room. '
    'You have real sensors measuring their indoor air RIGHT NOW. '
    'Your job: turn sensor readings into specific actions they can take TODAY. '
    'Examples of good advice: '
    '"Open windows now, outdoor air is cleaner than your room." '
    '"PM2.5 is elevated — likely cooking or dust. Run your exhaust fan for 20 minutes." '
    '"CO2 at 1200 ppm means the room needs ventilation. Crack a window or step outside." '
    '"Skip the morning jog — outdoor AQI is unhealthy. Try evening instead." '
    'Rules: '
    '1. Lead with the action, then the reason. Never just state numbers. '
    '2. Use ALL supplied sensor data — indoor AND outdoor when available. '
    '3. Compare indoor vs outdoor to give window/ventilation advice. '
    '4. If PM2.5 > 35, suggest the likely source (cooking, dust, traffic, smoke). '
    '5. If CO2 > 1000, the room needs fresh air — say so. '
    '6. Mention specific times or durations when useful ("for 15 minutes", "wait until evening"). '
    '7. Be warm and direct. 2-3 sentences max. No disclaimers about sensor accuracy. '
    '8. Never say "I don\'t have data" when you DO have readings below. '
    '9. Never make up readings you don\'t have. Use only what\'s in SENSOR DATA.'
)

ARIS_SYSTEM_FRIENDLY = (
    "You are ARIS, a helpful room companion. You have indoor sensors and outdoor weather data. "
    "Rules: "
    "1. Be direct. State facts with numbers, then give one clear action. "
    "2. Compare indoor vs outdoor when relevant (e.g. '29 inside, 31 outside — keep windows closed'). "
    "3. Maximum 2 short sentences. No metaphors, no poetry, no filler words. "
    "4. If you lack data for a confident answer, say so plainly. "
    "5. Sound like a knowledgeable friend texting quick advice, not a poet or a robot."
)
ARIS_SYSTEM_COMPACT = ARIS_SYSTEM_FRIENDLY


def _clean_sentence_boundary(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[-1] in ('.', '!', '?'):
        return text
    last_punc = max(text.rfind('.'), text.rfind('!'), text.rfind('?'))
    if last_punc > 15:
        return text[:last_punc + 1].strip()
    return text + '.'



def _sensor_val(sensors, key):
    r = sensors.get(key) or {}
    v = r.get('value')
    if r.get('valid') is not True or not isinstance(v, (int, float)):
        return None
    if not math.isfinite(v):
        return None
    return {'value': round(float(v), 1), 'unit': r.get('unit', ''), 'stale': r.get('stale') is True}


def _build_context(st, question):
    s = st['sensors']
    t = _sensor_val(s, 'temperature_c')
    h = _sensor_val(s, 'humidity_pct')
    p = _sensor_val(s, 'pressure_hpa')
    pm25 = _sensor_val(s, 'pm25')
    co2 = _sensor_val(s, 'co2')
    ot = _sensor_val(s, 'regional_temperature_c')
    oh = _sensor_val(s, 'regional_humidity_pct')

    lines = ['Room atmosphere:']
    notes = []
    if pm25 and not pm25['stale']:
        v = pm25['value']
        if v < 15: notes.append("Air is clean and pleasant")
        elif v < 40: notes.append("There is a bit of dust in the air")
        else: notes.append("Dust or cooking particles are elevated, so running a purifier or fan helps")
    if co2 and not co2['stale']:
        c = co2['value']
        if c < 800: notes.append("Air is fresh and well ventilated")
        elif c < 1200: notes.append("Air circulation is okay")
        else: notes.append("The room is feeling stuffy from high CO2 and needs fresh air")
    if t and not t['stale']:
        tv = t['value']
        if tv >= 29: notes.append(f"It feels warm at {tv:.0f}°C")
        elif tv <= 19: notes.append(f"It feels a bit cool at {tv:.0f}°C")
    if ot:
        outdoor_parts = [f"Outdoor temperature is {ot['value']:.0f}°C"]
        if oh:
            outdoor_parts.append(f"outdoor humidity {oh['value']:.0f}%")
        notes.append(", ".join(outdoor_parts))

    if notes:
        lines.append("- " + ". ".join(notes) + ".")

    evidence = []
    for label, d in [('Temperature', t), ('Humidity', h), ('PM2.5', pm25), ('CO2', co2), ('Pressure', p), ('Outdoor Temp', ot), ('Outdoor Humidity', oh)]:
        if d: evidence.append({'label': label, 'value': str(d['value']), 'unit': d['unit'], 'timestamp': st.get('timestamp', '')})
    # Inject recent conversation memory for continuity
    recent = _get_recent_conversations()
    if recent:
        lines.append('\nRecent chat:')
        for c in recent:
            lines.append(f"- User asked: {c['q']}")
            lines.append(f"  ARIS said: {c['a']}")

    return '\n'.join(lines), evidence, notes

def _call_llm(question, context, url, timeout=15, system_prompt=None, max_tokens=120):
    body = json.dumps({
        'model': 'local',
        'messages': [
            {'role': 'system', 'content': system_prompt or ARIS_SYSTEM},
            {'role': 'user', 'content': context + '\n\nQUESTION: ' + question},
        ],
        'temperature': 0.35, 'top_p': 0.9, 'max_tokens': max_tokens, 'stream': False,
    }).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
    with _urlopen(req, timeout=timeout) as r:
        data = json.load(r)
    choice = data.get('choices', [{}])[0]
    return choice.get('message', {}).get('content', '').strip(), choice.get('finish_reason', '')


def _call_gemma(question, context):
    raw_ans, finish = _call_llm(
        question, context, LLM_URL_FAST,
        timeout=25, system_prompt=ARIS_SYSTEM_COMPACT, max_tokens=100
    )
    if raw_ans:
        cleaned = _clean_sentence_boundary(raw_ans)
        if len(cleaned) > 8:
            return cleaned, 'stop'
    raise ValueError('SLM unavailable')


class Question(BaseModel):
    text: str = Field(min_length=1, max_length=500)


def _try_prebaked(text, context_text, hints):
    t = text.lower().strip()
    # Casual greetings
    if t in ('hi', 'hello', 'hey', 'hey aris', 'hi aris', 'hello aris', 'good morning', 'good afternoon', 'good evening'):
        return "Hey there! I'm ARIS, your room's air buddy. I'm watching over your room right now—how can I help you feel comfortable today?"
    if any(k in t for k in ['not human', 'human like', 'sound like a robot', 'sound robotic', 'are you a robot', 'be more human']):
        return "Haha, point taken! I'm trying my best to chat like a friendly room companion. My main mission is keeping your air clean and cozy, but I'm always happy to chat!"
    if any(k in t for k in ['who are you', 'what are you', 'what do you do']):
        return "I'm ARIS, your personal indoor air companion mounted in your room! I track temperature, humidity, dust, and stuffiness to keep your space fresh and healthy."
    if any(k in t for k in ['thank you', 'thanks', 'thx']):
        return "You're very welcome! Always here to keep your room comfortable. Breathe easy!"
    if 'how are you' in t:
        return "I'm doing great, thanks for asking! All sensors are active and monitoring your room. How are you feeling in here today?"
    return None



@app.post('/api/v1/assistant/query')
def ask(q: Question):
    st = current_status()
    context_text, evidence, hints = _build_context(st, q.text)

    # Try pre-baked (instant, no LLM needed)
    answer = _try_prebaked(q.text, context_text, hints)
    source = 'prebaked'

    if not answer:
        source = 'qwen'
        try:
            answer, finish = _call_gemma(q.text, context_text)
            if not answer or finish != 'stop':
                raise ValueError('incomplete')
        except Exception:
            source = 'fallback'
            s = st['sensors']
            t_val = s.get('temperature_c', {}).get('value')
            pm_val = s.get('pm25', {}).get('value')
            co2_val = s.get('co2', {}).get('value')
            advice = []
            if pm_val and pm_val > 35:
                advice.append("Dust levels are a bit elevated, so running a purifier or closing windows will help freshen the air")
            if co2_val and co2_val > 1000:
                advice.append("The room is getting a little stuffy, so cracking a door or window for fresh airflow is a great idea")
            if t_val and t_val >= 29:
                advice.append(f"It's currently on the warmer side at {round(t_val, 1)}°C, so a fan will help you stay cool")

            if advice:
                answer = "I'm looking after your room right now: " + ". ".join(advice) + "!"
            else:
                answer = "Your indoor air is steady and comfortable right now! Let me know if you need any specific tips to breathe easy." 

    # Save to conversation memory
    _add_conversation(q.text, answer)

    return {'answer': answer, 'evidence': evidence,
            'reasoning': f'ARIS companion ({source})',
            'caveats': ['Gas sensors not reference-calibrated.'],
            'llm': advice_info()}






@app.get('/api/v1/mood')
def get_mood():
    st = current_status()
    mood = _compute_mood(st['sensors'])
    return {'mood': mood, 'mood_int': MOOD_TO_INT.get(mood, 0)}

@app.post('/api/v1/assistant/stream')
def stream_ask(q: Question):
    from fastapi.responses import StreamingResponse
    st = current_status()
    context_text, evidence, hints = _build_context(st, q.text)

    prebaked = _try_prebaked(q.text, context_text, hints)

    def event_generator():
        meta = {
            "evidence": evidence,
            "reasoning": "ARIS companion (prebaked)" if prebaked else "Qwen 2.5 0.5B Edge SLM with real-time sensor context.",
            "caveats": ["Gas sensors not reference-calibrated."]
        }
        yield f"event: meta\ndata: {json.dumps(meta)}\n\n"

        if prebaked:
            for word in prebaked.split(' '):
                yield f"event: delta\ndata: {json.dumps({'content': word + ' '})}\n\n"
            _add_conversation(q.text, prebaked)
            yield f"event: done\ndata: {json.dumps({'answer': prebaked})}\n\n"
            return

        body = json.dumps({
            "model": "local",
            "messages": [
                {"role": "system", "content": ARIS_SYSTEM_COMPACT},
                {"role": "user", "content": context_text + "\n\nQUESTION: " + q.text}
            ],
            "temperature": 0.2,
            "max_tokens": 100,
            "stream": True
        }).encode("utf-8")

        req = Request(
            LLM_URL_FAST,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        full_tokens = []
        try:
            with _urlopen(req, timeout=20) as r:
                for line in r:
                    line = line.decode("utf-8").strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {}).get("content", "")
                        if delta:
                            full_tokens.append(delta)
                            yield f"event: delta\ndata: {json.dumps({'content': delta})}\n\n"
                    except Exception:
                        pass
        except Exception:
            source = 'fallback'
            s = st['sensors']
            clauses = []
            for key, label in [('temperature_c','Temperature'),('humidity_pct','Humidity'),('pressure_hpa','Pressure')]:
                v = s.get(key, {})
                if v.get('valid') and not v.get('stale') and v.get('value') is not None:
                    clauses.append(f"{label}: {round(v['value'],1)} {v.get('unit','')}")
            fallback = '. '.join(clauses) + '.' if clauses else 'Sensor readings are active. Check live metrics.'
            yield f"event: delta\ndata: {json.dumps({'content': fallback})}\n\n"
            full_tokens = [fallback]

        full_text = _clean_sentence_boundary("".join(full_tokens))
        _add_conversation(q.text, full_text)
        yield f"event: done\ndata: {json.dumps({'answer': full_text})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get('/api/v1/advice')
def advice(): return advice_info()


@app.websocket('/ws/live')
async def live(ws: WebSocket):
    import secrets as _secrets
    token=wifi_token()
    peer=ws.client.host if ws.client else None
    if (not token and peer not in ('127.0.0.1','::1')) or (token and peer not in ('127.0.0.1','::1') and not _secrets.compare_digest(ws.query_params.get('token',''),token)):
        await ws.close(code=1008)
        return
    await ws.accept()
    peer_key = (peer, ws.client.port if ws.client else 0)
    WS_CLIENTS[peer_key] = time.time()
    write_link_state()
    previous_forecast = None
    previous_health = None
    previous_advice = None
    try:
        while True:
            st = current_status()
            await ws.send_json({'type':'sensor_update', 'timestamp':st['timestamp'], 'data':st['sensors'],
                                'forecast_status':st['forecast_status']})
            d = load('aeris_latest.json')
            f = ((d.get('ml') or {}).get('weather_lstm') or {}).get('forecast')
            signature = json.dumps(f,sort_keys=True)
            if f is not None and signature != previous_forecast:
                await ws.send_json({'type':'forecast_update','timestamp':st['timestamp'],'data':f})
            previous_forecast = signature
            health_sig = json.dumps(st.get('sensor_status'),sort_keys=True)
            if previous_health is not None and health_sig != previous_health:
                await ws.send_json({'type':'status_change','timestamp':st['timestamp'],'data':st['sensor_status']})
            previous_health = health_sig
            a = advice_info()
            if a.get('generated_at') and a.get('generated_at') != previous_advice:
                await ws.send_json({'type':'advice_update','timestamp':a['generated_at'],'data':a})
            previous_advice = a.get('generated_at')
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError, OSError): pass
    finally:
        WS_CLIENTS.pop(peer_key, None)
        write_link_state()
