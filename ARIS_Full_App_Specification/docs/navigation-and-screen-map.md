# Navigation and Screen Map

Expo Router proposal:
```text
app/
  _layout.tsx
  index.tsx
  (tabs)/_layout.tsx
  (tabs)/home.tsx
  (tabs)/trends.tsx
  (tabs)/explore.tsx
  (tabs)/profile.tsx
  air-quality/index.tsx
  pollutant/[id].tsx
  ask-aris/index.tsx
  device/index.tsx
  device/scan.tsx
  device/pair.tsx
  device/wifi-setup.tsx
  device/connecting.tsx
  device/diagnostics.tsx
  settings/index.tsx
  settings/privacy.tsx
```
Home = current summary, mascot, recommendation. Trends = history and forecast. Explore = weather/optional traffic. Ask ARIS = chat/voice. Device = BLE setup, Wi-Fi provisioning, verification and diagnostics. Profile = privacy, units, notifications and device management.

If no device is paired, show onboarding/demo mode without pretending demo values are live. Device disconnection must not trap the user in a modal.
