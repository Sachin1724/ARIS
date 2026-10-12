"""AERIS future app API. Separate process; not started by main.py.

Default loopback-only; use authenticated reverse proxy / pairing later.
Reads existing output and never changes calibration or weather history.
"""
import json
import os
import hmac
import math
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode

BASE = Path(__file__).resolve().parent
LATEST = BASE / 'aeris_latest.json'
ADVICE = BASE / 'aeris_advice.json'
TOKEN_FILE = BASE / '.aeris_app_token'
HOST = os.getenv('AERIS_API_HOST', '127.0.0.1')
PORT = int(os.getenv('AERIS_API_PORT', '8090'))
QWEN_PORT = 8088
LLM_LOCK = threading.Lock()  # keep 0.5B model from being overloaded
ALLOWED_ORIGIN = os.getenv('AERIS_APP_ORIGIN', '')


def load_json(path):
    return json.loads(path.read_text())


def request_json(url, timeout=12):
    req = Request(url, headers={'User-Agent': 'AERIS-UNOQ/1.0'})
    with urlopen(req, timeout=timeout) as r:
        return json.load(r)


def remote_location_weather(place):
    """Outdoor modeled weather for a requested city, not a physical sensor."""
    geo = request_json('https://geocoding-api.open-meteo.com/v1/search?' + urlencode({
        'name': place, 'count': 1, 'language': 'en', 'format': 'json'}))
    hits = geo.get('results') or []
    if not hits:
        raise ValueError('Location not found; please provide city and country')
    hit = hits[0]
    params = urlencode({'latitude': hit['latitude'], 'longitude': hit['longitude'],
                        'current': 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
                        'timezone': 'auto'})
    wx = request_json('https://api.open-meteo.com/v1/forecast?' + params)
    return {'location': ', '.join(str(v) for v in (hit.get('name'), hit.get('admin1'),
                hit.get('country')) if v),
            'source': 'Open-Meteo modeled outdoor weather',
            'observation_time': (wx.get('current') or {}).get('time'),
            'weather': wx.get('current') or {}, 'units': wx.get('current_units') or {}}


def qwen_address():
    gateway_file = BASE / 'aeris_llm_gateway.txt'
    if gateway_file.exists():
        import ipaddress
        ip = gateway_file.read_text().strip()
        ipaddress.ip_address(ip)
        return f'http://{ip}:{QWEN_PORT}/v1/chat/completions'
    return f'http://127.0.0.1:{QWEN_PORT}/v1/chat/completions'


def answer_question(question, place=None):
    data = load_json(LATEST)
    timestamp = data.get('timestamp')
    if not isinstance(timestamp, str):
        raise ValueError('AERIS timestamp missing')
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(timestamp).astimezone(timezone.utc)).total_seconds()
    if not -60 <= age <= 180:
        raise ValueError('AERIS sensor report unavailable or stale')
    context = data.get('display') or {}
    if place:
        location_context = remote_location_weather(place)
    else:
        location_context = None
    observations = {
        'local_AERIS_sensor_and_model_summary': context,
        'local_sensor_timestamp': timestamp,
        'requested_location_weather': location_context,
        'data_quality': 'MG811 CO2, GP2Y PM and MQ135 gas identity NOT calibrated',
    }
    prompt = ('Answer the user weather question ONLY using supplied observations. '
              'Local UNO Q BME690 observations are indoor/local; Open-Meteo is regional/outdoor modeled. '
              'Use requested_location_weather only for the explicitly requested place. '
              'Report forecast as experimental LSTM forecast, not certain weather. '
              'Do not invent data or claim MQ135 measures distinct gases, CO2 or PM2.5. '
              'For missing data say unavailable. Be concise; max 100 words.')
    payload = {'model': 'local', 'messages': [
        {'role': 'system', 'content': prompt},
        {'role': 'user', 'content': json.dumps(observations, ensure_ascii=False)[:6500]
          + '\nQuestion: ' + question}],
        'temperature': 0.1, 'max_tokens': 180, 'stream': False}
    request = Request(qwen_address(), data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    if not LLM_LOCK.acquire(blocking=False):
        raise RuntimeError('Qwen is handling another app request; retry shortly')
    try:
        with urlopen(request, timeout=70) as response:
            result = json.load(response)
    finally:
        LLM_LOCK.release()
    answer = (result['choices'][0]['message'].get('content') or '').strip()
    if not answer:
        raise RuntimeError('Empty Qwen response')
    return {'answer': answer, 'model': 'Qwen 2.5 0.5B on UNO Q',
            'sensor_timestamp': timestamp, 'location_source': location_context['source'] if place else None,
            'generated_at': datetime.now().astimezone().isoformat()}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, result, status=200):
        body = json.dumps(result, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        origin = self.headers.get('Origin', '')
        if ALLOWED_ORIGIN and origin == ALLOWED_ORIGIN:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Vary', 'Origin')
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if not TOKEN_FILE.exists():
            return False
        expected = TOKEN_FILE.read_text().strip()
        return len(expected) >= 32 and hmac.compare_digest(
            self.headers.get('Authorization', ''), 'Bearer ' + expected)

    def do_OPTIONS(self):
        self.send_json({}, 200)

    def do_GET(self):
        if not self.authorized():
            return self.send_json({'error': 'Unauthorized'}, 401)
        if self.path == '/api/status':
            try:
                d = load_json(LATEST)
                return self.send_json({'timestamp': d.get('timestamp'),
                    'display': d.get('display'), 'advisor': d.get('advisor')})
            except Exception as e:
                return self.send_json({'error': str(e)}, 503)
        return self.send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        if not self.authorized():
            return self.send_json({'error': 'Unauthorized'}, 401)
        if self.path != '/api/ask':
            return self.send_json({'error': 'Not found'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 2048:
                return self.send_json({'error': 'Invalid request length'}, 400)
            obj = json.loads(self.rfile.read(length))
            question = obj.get('question')
            place = obj.get('location')
            if not isinstance(question, str) or not 1 <= len(question.strip()) <= 300:
                return self.send_json({'error': 'Invalid question'}, 400)
            if place is not None and (not isinstance(place, str) or not 2 <= len(place.strip()) <= 100):
                return self.send_json({'error': 'Invalid location'}, 400)
            return self.send_json(answer_question(question.strip(), place.strip() if place else None))
        except ValueError as exc:
            return self.send_json({'error': str(exc)}, 400)
        except Exception as exc:
            return self.send_json({'error': str(exc)}, 503)


if __name__ == '__main__':
    if not TOKEN_FILE.exists() or len(TOKEN_FILE.read_text().strip()) < 32:
        raise SystemExit('Create secure python/.aeris_app_token before enabling API')
    print(f'AERIS app API available at {HOST}:{PORT}', flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
