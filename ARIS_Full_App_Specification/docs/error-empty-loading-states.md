# Error, Empty, Loading and Stale States

Every asynchronous screen needs loading, success, empty/not-ready, stale/offline and error states.

Home: skeleton loading; no device → onboarding/demo prompt; stale → show last update; partial sensors → show available data; forecast not ready → “I'm still learning the pattern from recent readings”; uncalibrated gas sensors → raw response/calibration required.

Connection: Bluetooth off, permission denied, no device, authentication failure, wrong Wi-Fi password, network out of range, API unavailable, WebSocket failure and changed DHCP address each get a clear next action. Preserve pairing if only API discovery fails.

Network: timeout offers retry and last update; unauthorized resets session appropriately; unsupported API version explains compatibility issue; malformed event is ignored safely. On app resume, verify status before showing live.

Copy example: “I can’t reach your UNO Q right now. Your last reading was 12 minutes ago.” Never say Connected while showing cached data.
