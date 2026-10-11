# Phase 1 Research: Project Scaffold and Foundation

## Stack Compatibility

### Expo + React Native
- Expo SDK 52+ with TypeScript template
- `npx create-expo-app` with `--template blank-typescript`
- Development build required (not Expo Go) for BLE native module later
- `npx expo prebuild` generates native projects for Android

### Expo Router
- File-based routing, included in modern Expo SDK
- `expo-router` package with `app/` directory convention
- Tab layout via `(tabs)/_layout.tsx`
- Stack screens via nested routes

### gluestack-ui v2 + NativeWind v4
- gluestack-ui v2 uses NativeWind under the hood
- NativeWind v4 requires `nativewind` + `tailwindcss` 3.x
- Config: `tailwind.config.js` with `nativewind/preset`
- Babel plugin: `nativewind/babel`
- Metro config: `withNativeWind` wrapper
- gluestack-ui v2: `@gluestack-ui/themed` package with provider setup

### Fonts
- `expo-font` for loading Poppins and Inter
- `@expo-google-fonts/poppins` and `@expo-google-fonts/inter` packages
- Load in root layout, show splash until loaded
- Fallback: system sans-serif

### ESLint + TypeScript
- `eslint` with `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- `expo lint` built-in setup
- `strict: true` in tsconfig.json

### Development Build
- `eas.json` for build profiles
- `npx expo prebuild` for native project generation
- `eas build --profile development --platform android` for dev client
- Or local build: `npx expo run:android`

## Key Decisions

- Use Expo SDK 52 (latest stable)
- Pin gluestack-ui + NativeWind compatible versions
- Android-first development build
- No BLE packages yet (Phase 6 gate)
- No EAS account needed for local dev builds
