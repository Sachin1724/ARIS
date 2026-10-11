# ARIS App

Friendly, mascot-led environmental companion mobile app for the Arduino UNO Q air-monitoring device. Explains local air quality, trends and forecasts in human language.

## Stack

<decisions status="locked">
- React Native + Expo + TypeScript
- Expo Router (file-based routing)
- gluestack-ui + NativeWind (styling)
- Poppins headings + Inter body (bundled locally)
- Arduino UNO Q backend: FastAPI + SQLite + LSTM forecast + deterministic rules + optional local SLM
- BLE for discovery/provisioning; Wi-Fi REST + WebSocket for runtime
</decisions>

## Target

- **Platform**: Android first (iOS follows)
- **Architecture**: Thin client — UNO Q is source of truth
- **Network**: Local-only, no cloud accounts
- **AI authority**: Deterministic pipeline authoritative; SLM phrases approved facts only

## Goals

- Home dashboard with expressive mascot and current air quality
- Current readings with units, timestamps, validity and calibration state
- Trends, forecast readiness and available forecasts
- Optional weather/traffic context with provider and freshness
- Text Ask ARIS conversational assistant
- BLE discovery and secure Wi-Fi provisioning
- Device settings and diagnostics

## Non-Goals (first release)

- Voice/ASR/TTS (text first, voice deferred)
- Cloud accounts or remote access
- Multi-device support
- Google Home/Matter integration
- Actuator control
- Medical diagnosis or safety guarantees
- Guaranteed source attribution

## Principles

- Warm, not alarmist
- Explain recommendations with evidence
- Disclose uncertainty (uncalibrated, not ready, stale)
- No fabricated readings
- Local-first operation

## Constraints

- Expo development build required (BLE native module — no Expo Go)
- Gas sensors uncalibrated — raw ADC/voltage only, not verified ppm
- API contract and BLE GATT are proposed, not implemented
- LSTM forecast requires 24 hourly samples before predictions
- Local network only — guest Wi-Fi isolation may block communication
- No TLS CA for local device — certificate trust model TBD
