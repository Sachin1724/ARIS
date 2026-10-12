# D3 long-hold → safe shutdown (proposed, not applied)

The board has exactly one button (D3, `INPUT_PULLUP`, 45 ms debounce). The sketch
already uses two gestures:

| Gesture | Effect | Where it lives |
|---|---|---|
| Short press (release before 3 s) | Cycle OLED page | `sketch.ino`, `aerisPollPageButton()` |
| Hold ≥ 3 s | Open the 180 s BLE pairing window | `sketch.ino` → bridge → `main.py` → `aeris_discovery_gate.json` → `aeris_ble.py` |

This adds a third, longer gesture so the board can be powered off cleanly
instead of having its supply pulled, which risks the SD card.

| Gesture | Effect |
|---|---|
| Hold ≥ 8 s | Request a clean `systemctl poweroff` |

**This is not applied.** It changes MCU firmware, so it needs a sketch upload,
and a failed upload leaves the board without sensor sampling. Apply it when you
can watch the board, not remotely.

## 1. Sketch (`sketch/sketch.ino`)

Add next to the existing button constants:

```c
#define AERIS_POWEROFF_HOLD_MS 8000UL
```

Add a state flag beside `aerisLongPressHandled`:

```c
static bool aerisPowerOffRequested = false;
```

In `aerisPollPageButton()`, after the existing 3 s pairing block, add a second
threshold. The pairing block sets `aerisLongPressHandled = true`, so this needs
its own flag rather than reusing it:

```c
    if (aerisButtonStable == LOW && !aerisPowerOffRequested
            && (unsigned long)(now - aerisPressStartedAt) >= AERIS_POWEROFF_HOLD_MS) {
        aerisPowerOffRequested = true;   // latched; Linux acts on it
        aerisLastOLEDRefresh = 0;        // let the OLED show "Shutting down"
    }
```

Clear it when the button is released (in the `raw == LOW` branch that starts a
press, so a new press starts clean):

```c
        if (raw == LOW) {
            aerisPressStartedAt = now;
            aerisLongPressHandled = false;
            aerisPowerOffRequested = false;
        }
```

Expose it to Linux beside the other `Bridge.provide(...)` calls:

```c
float getAerisPowerOffRequest() { return aerisPowerOffRequested ? 1.0f : 0.0f; }
// ...
ok &= Bridge.provide("aeris_poweroff_request", getAerisPowerOffRequest);
```

## 2. Collector (`python/main.py`)

Where it already polls the D3 pairing request (near the
`aeris_discovery_gate.json` write), add:

```python
            if float(bridge.get("aeris_poweroff_request") or 0) >= 1.0:
                # The container cannot write /run, so signal in the app dir;
                # aris-poweroff.path watches this file and runs systemctl poweroff.
                (BASE / "aeris_power_request.json").write_text(
                    json.dumps({"source": "physical_d3_8s_hold", "at": time.time()})
                )
```

## 3. Host side

Already installed by `install_boot_hardening.sh`:
`aris-poweroff.path` watches both `/run/aris/poweroff.request` and
`aeris_power_request.json`, and `aris-poweroff.service` deletes the request
before powering off, so the board does not shut down again on the next boot.

## Test without touching firmware

```bash
touch /run/aris/poweroff.request   # board should shut down cleanly
```
