# Decisions

## LOCKED

- **Stack**: React Native + Expo + TypeScript, Expo Router, gluestack-ui, NativeWind
- **Typography**: Poppins headings, Inter body text (bundled locally)
- **Backend**: Arduino UNO Q hosts FastAPI, SQLite, sensor pipeline, LSTM forecast, deterministic rules, optional local SLM
- **Connectivity**: BLE for discovery/secure Wi-Fi provisioning; existing Wi-Fi for REST + WebSocket runtime communication
- **Theme**: Mascot-led lavender visual direction, soft premium environmental companion
- **AI authority**: Deterministic pipeline is authoritative; SLM phrases approved facts only — cannot invent values, thresholds, or override rules
- **Local-first**: No cloud accounts, no remote access, no mandatory cloud for first release
- **Security**: Never provision Wi-Fi over unauthenticated/unencrypted BLE; never log secrets; provider keys stay on UNO Q

## ACCEPTED (proposed, verify against hardware)

- REST + WebSocket protocol split (REST for snapshots/history/forecast/query, WebSocket for live events)
- mDNS/service discovery with QR/manual IP fallback
- BLE GATT characteristics: device_info, pairing_challenge, wifi_config (write-only), setup_status (notify), network_result — UUIDs TBD with firmware
- Development build required for BLE native module
- Production API requires authentication, TLS where feasible

## DEFERRED

- Voice/ASR/TTS (text assistant first)
- Google Home/Matter integration
- Actuator control
- Medical diagnosis
- Guaranteed source attribution
- Multi-device support
