# Requirements

## Functional

### Device Onboarding (FR-ONB)
- FR-ONB-1: Scan BLE devices, show stable ID, authenticate selected device
- FR-ONB-2: Securely provision existing Wi-Fi credentials over encrypted BLE
- FR-ONB-3: Show setup progress with recoverable error states
- FR-ONB-4: Preserve pairing if API discovery fails; support retry and QR/manual IP fallback
- FR-ONB-5: Mark connected only after API verification over Wi-Fi + WebSocket open

### Readings and Forecast (FR-READ)
- FR-READ-1: Show values with units, timestamp, validity and calibration state
- FR-READ-2: Distinguish raw ADC/voltage/resistance from calibrated concentration
- FR-READ-3: Show model readiness/sample count; never fabricate missing samples
- FR-READ-4: Distinguish measured, predicted, cached and demo data visually
- FR-READ-5: Show recommendations with reasons and freshness
- FR-READ-6: Show stale/disconnected state with last-seen time

### Companion AI (FR-AI)
- FR-AI-1: Typed questions first; mic/ASR/TTS deferred
- FR-AI-2: Show answer evidence; keep text available if audio fails
- FR-AI-3: If forecast not ready, explain data still being collected
- FR-AI-4: SLM must not invent measurements or make unsupported causal/medical claims

### Navigation and Screens (FR-NAV)
- FR-NAV-1: Tab bar: Home, Trends, Explore, Profile
- FR-NAV-2: Stack screens: Air Quality, Pollutant detail, Ask ARIS, Device flow, Settings
- FR-NAV-3: If no device paired, show onboarding/demo mode (demo clearly labelled)
- FR-NAV-4: Device disconnection must not trap user in modal

### Error/State Handling (FR-STATE)
- FR-STATE-1: Every async screen needs loading, success, empty/not-ready, stale/offline, error states
- FR-STATE-2: Each connection error (BLE off, permission denied, wrong password, etc.) gets clear next action
- FR-STATE-3: Never say Connected while showing cached data

## Non-Functional

### Accessibility (NFR-A11Y)
- NFR-A11Y-1: Meaningful screen-reader labels and logical focus order
- NFR-A11Y-2: Touch targets ~44-48dp
- NFR-A11Y-3: Text scaling without clipping
- NFR-A11Y-4: Never use color alone for status
- NFR-A11Y-5: Respect reduced motion
- NFR-A11Y-6: Charts need accessible labels and textual summaries

### Security (NFR-SEC)
- NFR-SEC-1: Authenticate device; do not trust BLE advertised name alone
- NFR-SEC-2: Never log passwords, tokens, pairing secrets
- NFR-SEC-3: Store tokens only in platform secure storage
- NFR-SEC-4: Provider keys stay on UNO Q
- NFR-SEC-5: Request permissions only when needed with explanation
- NFR-SEC-6: No secrets in source, bundle or logs

### Performance (NFR-PERF)
- NFR-PERF-1: Micro-interactions 120-180ms; transitions 200-280ms
- NFR-PERF-2: WebSocket reconnect with backoff
- NFR-PERF-3: Pause animations when screen unfocused

### Platform (NFR-PLAT)
- NFR-PLAT-1: Android and iOS support
- NFR-PLAT-2: Timeouts with understandable errors
- NFR-PLAT-3: No mandatory cloud for first release
