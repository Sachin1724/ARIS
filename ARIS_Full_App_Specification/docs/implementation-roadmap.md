# Implementation Roadmap

0. Scaffold Expo TypeScript; configure Expo Router, gluestack-ui, NativeWind, Poppins/Inter, lint and strict TypeScript.
1. Design tokens, shared components, mascot and motion settings.
2. Home with clearly labelled demo fixtures and all status states.
3. Trends, Explore, Air Quality, Ask ARIS, Profile and Device Connection screens.
4. Typed REST client, WebSocket validation/reconnect/backoff, connect real FastAPI.
5. Implement/test secure BLE provisioning on both app and UNO Q; add mDNS/manual IP fallback.
6. Connect forecast/history and optional weather/traffic.
7. Text assistant first, then ASR/TTS.
8. Security, accessibility, network transition, performance and release tests.

Do not implement BLE until the device-side GATT contract and Expo SDK/library compatibility are confirmed.
