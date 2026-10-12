# Functional Requirements

## Device onboarding
- Scan BLE devices, show stable ID, authenticate selected device.
- Securely provision existing Wi-Fi credentials.
- Show setup progress and recoverable errors.
- Preserve pairing if API discovery fails; support retry and QR/manual IP.
- Mark connected only after API verification over Wi-Fi.

## Readings and forecast
- Show values with units, timestamp, validity and calibration.
- Distinguish raw ADC/voltage/resistance from calibrated concentration.
- Show model readiness/sample count; never fabricate missing samples.
- Distinguish measured, predicted, cached and demo data.
- Show recommendations with reasons and freshness.
- Show stale/disconnected state.

## Companion
- Typed questions first; microphone/ASR/TTS can follow.
- Show answer evidence and keep text available if audio fails.
- If forecast is not ready, say data is still being collected.
- Never let SLM invent measurements or make unsupported causal/medical claims.

## Non-functional
Accessible labels/text scaling, Android/iOS support, timeouts, understandable errors, reconnect/backoff, no secrets in logs, no provider keys in app bundle, and no mandatory cloud for first release.
