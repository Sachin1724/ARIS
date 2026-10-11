# Phase 1 Plan: Project Scaffold and Foundation

## Goal
Bootable Expo TypeScript app on Android with tab navigation, styled components, custom fonts, and strict TypeScript. Ready for feature development in Phase 2+.

## Tracer Slice
**Plan 1.0**: Create app, configure all tooling, render a styled Home tab with Poppins heading and Inter body text on Android device/emulator.

---

## Plan 1.1: Create Expo Project

### Task 1.1.1: Scaffold Expo app
```bash
npx create-expo-app@latest aris-app --template blank-typescript
cd aris-app
```
- **Verify**: `npx expo start` boots without errors
- **Delivers**: NFR-PLAT-1

### Task 1.1.2: Configure strict TypeScript
Edit `tsconfig.json`:
- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"skipLibCheck": true`
- **Verify**: `npx tsc --noEmit` passes clean

### Task 1.1.3: Configure ESLint
```bash
npx expo lint
```
- Verify lint runs clean on scaffolded code

---

## Plan 1.2: Install and Configure UI Stack

### Task 1.2.1: Install NativeWind + Tailwind
```bash
npx expo install nativewind tailwindcss@3
```
- Create `tailwind.config.js` with `nativewind/preset`
- Add `nativewind/babel` to `babel.config.js`
- Wrap Metro config with `withNativeWind`
- **Verify**: `className="bg-red-500"` renders red background

### Task 1.2.2: Install gluestack-ui v2
```bash
npx expo install @gluestack-ui/themed @gluestack-style/react react-native-svg
```
- Wrap app in `GluestackUIProvider` in root layout
- **Verify**: `<Button><ButtonText>Test</ButtonText></Button>` renders

### Task 1.2.3: Install and load fonts
```bash
npx expo install expo-font @expo-google-fonts/poppins @expo-google-fonts/inter expo-splash-screen
```
- Load fonts in `app/_layout.tsx` using `useFonts`
- Keep splash screen visible until fonts loaded
- Define font family constants:
  ```ts
  export const fonts = {
    heading: 'Poppins_600SemiBold',
    headingBold: 'Poppins_700Bold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
  } as const;
  ```
- **Verify**: Text renders in Poppins/Inter on device

---

## Plan 1.3: Configure Routing and Navigation

### Task 1.3.1: Set up Expo Router with tab layout
Create file structure:
```
app/
  _layout.tsx          # Root layout (providers, fonts)
  index.tsx            # Redirect to (tabs)/home
  (tabs)/
    _layout.tsx        # Tab bar with 4 tabs
    home.tsx           # Home tab placeholder
    trends.tsx         # Trends tab placeholder
    explore.tsx        # Explore tab placeholder
    profile.tsx        # Profile tab placeholder
```
- Tab bar icons (use placeholder icons from `@expo/vector-icons`)
- **Verify**: All 4 tabs navigate correctly
- **Delivers**: FR-NAV-1, FR-NAV-2

### Task 1.3.2: Add stack screen placeholders
```
app/
  air-quality/index.tsx
  ask-aris/index.tsx
  device/index.tsx
  settings/index.tsx
```
- Each renders a simple titled screen
- **Verify**: Can navigate from tabs to stack screens and back

---

## Plan 1.4: Design Token Foundation

### Task 1.4.1: Create design tokens file
`constants/tokens.ts`:
```ts
export const colors = {
  background: '#FBF8FF',
  surface: '#FFFFFF',
  surfaceLavender: '#F1ECFF',
  lavender: '#7C5CFC',
  lavenderDark: '#5B43D6',
  sky: '#83C7F5',
  ink: '#191936',
  secondaryText: '#686985',
  success: '#1AA879',
  caution: '#E99A22',
  danger: '#E65B65',
  info: '#448DEB',
  border: '#E9E5F3',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32,
} as const;
```
- Extend `tailwind.config.js` with these tokens
- **Verify**: `className="bg-lavender"` renders correct purple

### Task 1.4.2: Create Tailwind theme extension
Extend `tailwind.config.js` theme with:
- Custom colors from tokens
- Font families mapping to loaded Poppins/Inter
- Spacing scale
- **Verify**: Tailwind classes use project tokens

---

## Plan 1.5: Development Build Setup

### Task 1.5.1: Configure development build
```bash
npx expo install expo-dev-client
npx expo prebuild --platform android
```
- Create `eas.json` with development profile (for future use)
- **Verify**: `npx expo run:android` builds and launches on device/emulator
- **Delivers**: NFR-PLAT-1

---

## Verification

After all plans complete:
1. `npx tsc --noEmit` — clean
2. `npx expo lint` — clean
3. App boots on Android with 4 tabs
4. Poppins headings and Inter body text render
5. Lavender theme colors applied
6. Navigation between tabs and stack screens works
7. Development build runs on physical Android device or emulator
