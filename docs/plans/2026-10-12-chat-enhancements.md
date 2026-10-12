# Chat Enhancements: Generation Latency Timer, Local History, & Keyboard Auto-Scroll

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the ARIS assistant chat interface by adding a live and completed response generation duration timer, persisting message history locally across app restarts, and smoothly pulling up chat messages when the user focuses the input or types.

**Architecture:**
- **Duration Tracking:** Track `startTime` at message submission, update a 100ms interval timer during `loading` state, and persist final generation latency (`duration`) in the `Message` object to display alongside timestamp metadata.
- **Local History Persistence:** Create a dedicated modular storage service (`services/chatStorage.ts`) using `@react-native-async-storage/async-storage` with an in-memory safe fallback, automatically loading history on mount and persisting updates.
- **Keyboard Auto-Scroll:** Combine `KeyboardAvoidingView` tuning for Android/iOS, `Keyboard.addListener("keyboardDidShow")` hooks, and `TextInput.onFocus` triggers to smoothly keep recent conversation visible when typing.

**Tech Stack:** React Native, Expo Router, TypeScript, `@react-native-async-storage/async-storage`, Ionicons.

---

### Task 1: Install & Set Up Chat Storage Service

**Files:**
- Create: `d:/Projects/aris/aris-app/services/chatStorage.ts`
- Modify: `d:/Projects/aris/aris-app/package.json`

**Step 1: Install `@react-native-async-storage/async-storage`**
Run:
```bash
npx expo install @react-native-async-storage/async-storage
```

**Step 2: Create `services/chatStorage.ts`**
Create storage module supporting:
- `loadChatHistory(): Promise<Message[]>`
- `saveChatHistory(messages: Message[]): Promise<void>`
- `clearChatHistory(): Promise<void>`
- Built-in error handling and safe fallback so app never crashes if storage is unavailable.

---

### Task 2: Implement Live Latency Timer & Completed Generation Duration

**Files:**
- Modify: `d:/Projects/aris/aris-app/app/ask-aris/index.tsx`

**Step 1: Update `Message` Interface**
Add `duration?: string;` to `Message` interface.

**Step 2: Live Generation Elapsed Timer**
- Add `elapsedTime` state (seconds with 1 decimal place, e.g., `1.2s`).
- When `loading` begins:
  - Record `requestStartTime = Date.now()`.
  - Start interval timer ticking every 100ms: `((Date.now() - requestStartTime) / 1000).toFixed(1)`.
- In the "Analyzing air telemetry..." loading bubble:
  - Display live timer: `Analyzing air telemetry... (${elapsedTime}s)`.
- When response resolves:
  - Calculate total duration: `${((Date.now() - requestStartTime) / 1000).toFixed(1)}s`.
  - Attach `duration` to the newly created assistant `Message`.

**Step 3: Message Timestamp & Duration Display**
- In the message footer:
  - Render duration pill/badge next to timestamp: e.g., `01:30 • ⏱ 1.8s`.

---

### Task 3: Implement Keyboard Auto-Scroll & View Pull-Up

**Files:**
- Modify: `d:/Projects/aris/aris-app/app/ask-aris/index.tsx`

**Step 1: Keyboard Listeners & Smooth Auto-Scroll**
- Import `Keyboard` from `react-native`.
- In `useEffect`, register:
  - `Keyboard.addListener("keyboardDidShow", () => scrollRef.current?.scrollToEnd({ animated: true }))`
  - `Keyboard.addListener("keyboardWillShow", () => scrollRef.current?.scrollToEnd({ animated: true }))`
- Add `onFocus` handler to `TextInput` with a 100ms delayed `scrollToEnd({ animated: true })`.

**Step 2: Configure `KeyboardAvoidingView` & `ScrollView`**
- In `KeyboardAvoidingView`:
  - Set `behavior={Platform.OS === "ios" ? "padding" : "height"}`.
  - Set `keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}`.
- In `ScrollView`:
  - Add `keyboardShouldPersistTaps="handled"`.
  - Add `keyboardDismissMode="on-drag"`.

---

### Task 4: Connect Local Persistence to Chat Screen

**Files:**
- Modify: `d:/Projects/aris/aris-app/app/ask-aris/index.tsx`

**Step 1: Load History on Mount**
- In `useEffect`, call `chatStorage.loadChatHistory()`.
- Populate initial `messages` if saved conversation exists.

**Step 2: Save on Updates**
- Call `chatStorage.saveChatHistory(messages)` whenever `messages` changes.

**Step 3: Clear History in Menu**
- In `handleClearChat`, call `chatStorage.clearChatHistory()` and reset state.

---

### Task 5: Verification & End-to-End Testing

**Step 1: Test live on connected device**
- Trigger query in Chat with ARIS on the device.
- Verify live timer updates during thinking phase (`Analyzing air telemetry... 1.5s`).
- Verify response shows generation time (`01:30 • ⏱ 1.8s`).
- Verify keyboard pulls chat up automatically when tapping the input box.
- Reload the app and verify messages are preserved from local storage.
