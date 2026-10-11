# Constraints

## Hardware
- Arduino UNO Q is sole backend — limited compute, storage, memory
- BLE GATT contract not yet implemented on firmware side — must verify
- Gas sensors (MQ135, MG811) uncalibrated — ADC/voltage only, not verified ppm
- LSTM forecast requires minimum hourly samples (24) before predictions available

## Stack
- Expo development build required for BLE native module (can't use Expo Go)
- gluestack-ui + NativeWind version pinning required for compatibility
- Fonts (Poppins/Inter) must be bundled locally with fallback

## Network
- Local network only — no cloud relay
- Guest Wi-Fi isolation may block app-to-device communication
- DHCP address may change — can't assume fixed IP
- mDNS support depends on network/device capabilities

## Security
- No TLS certificate authority for local device — certificate trust model TBD
- Wi-Fi credentials transit over BLE only when encrypted + authenticated
- Dev port must never be publicly exposed

## Scope (first release)
- No voice — text assistant only
- No multi-device
- No cloud accounts
- No actuator control
- No medical diagnosis or safety guarantees
- API contract is proposed, not implemented — must align with actual FastAPI
