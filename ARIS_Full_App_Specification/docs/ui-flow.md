# UI Flow

## First launch
Splash → value proposition/privacy → Connect ARIS or Explore demo → BLE permission → scan → select device → secure pairing → Wi-Fi credentials → provisioning → device joins network → discover API → authenticate/verify status → open WebSocket → success → Home.

## Returning user
Load saved non-secret device identity/connection hints → try known host or rediscover → verify status → open WebSocket → Home shows connected/reconnecting and last-seen time.

## From Home
Air-quality card → detail → pollutant details. Forecast preview → Trends. Recommendation → “Why?” evidence. Ask ARIS → answer/reasons → optional speech.

## Connection state
`idle → permission_check → scanning → device_selected → authenticating → wifi_config → provisioning → joining_wifi → discovering_api → verifying_api → connected`
Recoverable errors: Bluetooth off, permission denied, no device, auth failure, wrong Wi-Fi password, network unreachable, API unavailable, WebSocket unavailable, cancelled.

## Live updates
Fetch REST snapshot → render timestamped data → subscribe WebSocket → validate event → update UI. On disconnect show reconnecting/stale, reconnect with backoff and refetch snapshot.
