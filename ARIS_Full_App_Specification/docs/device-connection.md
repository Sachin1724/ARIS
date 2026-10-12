# Device Connection: BLE Setup + Existing Wi-Fi

This is a proposed contract; it does not mean the UNO Q GATT provisioning service already exists. Verify with the actual UNO Q OS, BlueZ and chosen Expo SDK.

## Steps
1. Connect ARIS intro.
2. Request Bluetooth permission when scanning starts.
3. Scan and show device name/ID.
4. Authenticate selected device (advertised name alone is not identity).
5. Securely pair.
6. Select/enter Wi-Fi SSID; mask password.
7. Provision over authenticated/encrypted BLE.
8. Show device joining Wi-Fi.
9. Discover API via mDNS if supported; QR/manual IP fallback.
10. Authenticate and verify health/status.
11. Open WebSocket; only now show Connected.

## Proposed GATT logical characteristics
`device_info`, `pairing_challenge`, write-only `wifi_config`, `setup_status` notifications, `network_result`. UUIDs must be agreed with firmware.

Never send credentials over unauthenticated/unencrypted BLE; never log secrets. Rate-limit and expire setup sessions. Do not assume fixed DHCP IP; guest Wi-Fi isolation may block communication. If API discovery fails after Wi-Fi provisioning, preserve pairing and allow retry.

Test Bluetooth off, permission denied, no/multiple devices, wrong password, weak Wi-Fi, client isolation, DHCP change, API down, WebSocket down, app resume and device reboot.
