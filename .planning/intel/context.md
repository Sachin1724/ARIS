# Context

## What ARIS Is
ARIS is a friendly, mascot-led environmental companion mobile app for an Arduino UNO Q air-monitoring device. It explains local air quality, trends and forecasts in human language, with weather/traffic as optional context. The mascot is a fluffy lavender 3D character that reacts to conditions.

## Architecture Summary
- **App**: React Native + Expo + TypeScript client (no backend logic — pure UI/presentation)
- **Device**: Arduino UNO Q running FastAPI + SQLite + sensor pipeline + LSTM forecast + deterministic rules + optional SLM
- **Discovery**: BLE for initial device discovery and secure Wi-Fi provisioning
- **Runtime**: REST for request/response, WebSocket for live sensor events — all over local Wi-Fi

## Key Design Principles
- Warm, not alarmist
- Explain recommendations with evidence
- Disclose uncertainty (uncalibrated, not ready, stale)
- No fabricated readings
- Local-first operation
- SLM phrases approved facts only

## First Release Scope
Home dashboard, current readings, trends/forecasts, optional weather/traffic context, text Ask ARIS, BLE provisioning, device settings/diagnostics. No voice, no cloud, no multi-device.

## API Contract Status
All routes (`/api/v1/health`, `/status`, `/forecast`, `/history`, `/assistant/query`, `/ws/live`) are proposed — not claims of existing implementation. Must be aligned with actual UNO Q FastAPI once available.
