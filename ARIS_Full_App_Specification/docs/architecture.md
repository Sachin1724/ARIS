# Architecture

```text
React Native / Expo app
  Home · Trends · Explore · Ask ARIS · Device Connection · Settings
  BLE for discovery/provisioning; Wi-Fi for REST + WebSocket
                         ⇅
Arduino UNO Q
  FastAPI · sensor pipeline · SQLite · LSTM forecast
  deterministic decision engine · optional local SLM
  optional outbound HTTPS for weather/traffic
```

The app is a client and does not duplicate authoritative forecast or decision logic. UNO Q is the source of truth for device readings and forecasts. The SLM may phrase approved facts but cannot invent values or override rules. Provider keys stay on UNO Q.

Offline: local sensing/storage/inference continues as supported; phone access still needs a reachable local network. External context is cached with timestamps. If the device cannot be reached, show last-seen data as stale.

Use REST for snapshots/history/forecast/query and WebSocket for live events. Prefer mDNS/service discovery if supported, with QR/manual IP fallback. Production requires authentication, secure provisioning and encrypted transport where feasible.
