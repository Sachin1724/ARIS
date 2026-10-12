# API Contract (Proposed)

Routes below are draft and must match the actual UNO Q FastAPI service. Development base URL `http://<device-host>:8000` is for a trusted local network only.

- `GET /api/v1/health`
- `GET /api/v1/device`
- `GET /api/v1/status`
- `GET /api/v1/forecast`
- `GET /api/v1/history?metric=pm25&hours=24`
- `POST /api/v1/assistant/query` with `{"text":"Why is air quality changing?"}`
- WebSocket `/ws/live`

Example status:
```json
{
  "timestamp":"2026-10-11T06:00:00Z",
  "sensors":{
    "temperature_c":{"value":29.57,"unit":"°C","valid":true,"calibrated":true},
    "humidity_pct":{"value":66.45,"unit":"%","valid":true,"calibrated":true},
    "mq135_adc":{"value":422,"unit":"ADC","valid":true,"calibrated":false},
    "mg811_voltage_v":{"value":0.342,"unit":"V","valid":true,"calibrated":false}
  },
  "forecast_status":{"model_loaded":true,"input_ready":false,"hourly_samples":2,"required_hourly_samples":24}
}
```
Values are illustrative only. Use ISO 8601 timestamps, explicit units, null for unavailable values, validity/calibration/source/freshness metadata. Do not expose secrets. Authenticate REST and WebSocket in production; validate payloads and tolerate unknown fields.
