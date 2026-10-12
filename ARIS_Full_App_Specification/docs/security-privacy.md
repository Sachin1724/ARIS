# Security and Privacy

- Local-first core inference; no raw audio/image upload in first release.
- Authenticate the device; do not trust BLE advertised name alone.
- Never provision Wi-Fi credentials over unauthenticated/unencrypted BLE.
- Never log passwords, tokens or pairing secrets.
- Production API requires authentication, authorization, validation and consistent REST/WebSocket policy.
- Consider TLS and document certificate trust; never expose dev port publicly.
- Store tokens only in platform secure storage; don't persist Wi-Fi password in normal preferences.
- Request Bluetooth/mic/location permissions only when needed and explain location use.
- Provider keys stay on UNO Q; minimize location precision.
- Provide device forget/unpair and revoke access.
