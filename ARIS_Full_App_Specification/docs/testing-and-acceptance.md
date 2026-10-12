# Testing and Acceptance

## UI
Test supported phone sizes, safe areas, keyboard, text scaling, Poppins/Inter loading, clipping, contrast, navigation and button behavior.

## Data
Demo values labelled; raw MQ135/MG811 never shown as verified ppm; null not zero; stale readings show age; forecast-not-ready never invents predictions; observed/predicted lines differ.

## Connectivity
Test BLE disabled, permission denied, absent/multiple devices, wrong Wi-Fi password, weak signal, client isolation, DHCP change, API unavailable, WebSocket failure, app background/resume, device/router reboot and retries. Credentials never appear in logs.

## AI
Test no data, forecast not ready, uncalibrated sensors, SLM/TTS unavailable and response evidence consistency.

## Acceptance
App builds on target devices, setup can recover from failures, real status displays, live updates reconnect, no secrets are bundled/logged, and accessibility/performance checks pass.
