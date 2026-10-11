# Roadmap

## Milestone 1: ARIS App v1 — First Release

### Phase 1: Project Scaffold and Foundation
Scaffold Expo TypeScript project. Configure Expo Router, gluestack-ui, NativeWind, Poppins/Inter fonts, ESLint, strict TypeScript. Set up development build config for BLE native module.
- **Delivers**: FR-NAV-1, FR-NAV-2, NFR-PLAT-1
- **Success**: App boots on Android with tab navigation, fonts render, strict TS compiles clean

### Phase 2: Design System and Shared Components
Implement design tokens (colors, spacing, typography). Build shared components: cards, buttons, status badges, sensor value display, loading/error/empty states. Integrate mascot asset with animation states.
- **Delivers**: NFR-A11Y-2, NFR-A11Y-4, NFR-PERF-1, NFR-A11Y-5
- **Success**: Component library renders all states; mascot shows idle/welcome; reduced-motion respected

### Phase 3: Home Screen with Demo Data
Home screen with greeting, connection state, mascot, primary air-quality status, compact sensor row, trend preview, recommendation with "Why?", Ask ARIS CTA. All states: loading, demo, connected, stale, disconnected, uncalibrated, forecast-not-ready. Demo data clearly labelled.
- **Delivers**: FR-READ-1, FR-READ-2, FR-READ-4, FR-READ-6, FR-STATE-1, FR-NAV-3
- **Success**: Home screen renders all 7 states with demo fixtures; demo label visible

### Phase 4: Core Screens
Build Trends (metric/time-range selectors, observed history, predicted points, model readiness), Explore (weather, wind, humidity, optional traffic with source/freshness), Air Quality detail (chart, explanation, calibration note), Ask ARIS (conversation UI, typed input), Profile (device management, units, privacy), Device Connection screens (intro, scan, pair, wifi-setup, connecting, diagnostics).
- **Delivers**: FR-READ-3, FR-READ-5, FR-AI-1, FR-NAV-4, FR-STATE-2, NFR-A11Y-6
- **Success**: All screens render with demo data; navigation flows work end-to-end

### Phase 5: REST Client and WebSocket
Typed REST client for all `/api/v1/` endpoints. WebSocket connection manager with validation, reconnect with exponential backoff, refetch snapshot on reconnect. Connect to real FastAPI backend. Handle auth, timeouts, malformed events.
- **Delivers**: FR-READ-1, FR-READ-6, FR-STATE-3, NFR-PERF-2, NFR-PLAT-2, NFR-SEC-3
- **Success**: App displays live device data; WebSocket reconnects after drop; stale state shown correctly

### Phase 6: BLE Provisioning
Implement BLE scanning, device authentication, secure pairing, Wi-Fi credential provisioning over encrypted BLE. mDNS discovery with QR/manual IP fallback. Full connection state machine.
- **Delivers**: FR-ONB-1, FR-ONB-2, FR-ONB-3, FR-ONB-4, FR-ONB-5, NFR-SEC-1, NFR-SEC-2, NFR-SEC-5
- **Gate**: Do not start until UNO Q GATT contract and Expo BLE library compatibility are confirmed
- **Success**: Can discover, pair, provision Wi-Fi, and reach Connected state on real device

### Phase 7: Forecast, History and External Context
Connect forecast/history endpoints. Display LSTM predictions with confidence bounds. Integrate optional weather/traffic providers. Show provider source and freshness.
- **Delivers**: FR-READ-3, FR-READ-5, FR-AI-3
- **Success**: Trends shows real forecast data; Explore shows weather with source; forecast-not-ready state works

### Phase 8: Text Assistant
Wire Ask ARIS to `/api/v1/assistant/query`. Display conversational answer with evidence/reasons, expandable "Why I say this", values with units/timestamps, caveats. Handle no-data, forecast-not-ready, uncalibrated, SLM-unavailable gracefully.
- **Delivers**: FR-AI-1, FR-AI-2, FR-AI-3, FR-AI-4
- **Success**: Can ask questions and get evidence-backed answers; no fabricated data in responses

### Phase 9: Security, Accessibility, Testing and Release
Security audit (credentials, secure storage, no secrets in bundle/logs). Accessibility pass (screen reader, focus order, contrast, text scaling). Network transition testing. Performance profiling. Release build and acceptance tests.
- **Delivers**: NFR-SEC-6, NFR-A11Y-1, NFR-A11Y-3, NFR-PLAT-1
- **Success**: All release checklist items pass; app builds for Android; acceptance criteria met
