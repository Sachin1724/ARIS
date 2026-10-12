# Animation and Motion

Motion should make ARIS responsive, not distract. Respect reduced-motion settings.

## Starting timing targets
Micro-interactions 120–180 ms; transitions 200–280 ms; sheets 220–320 ms; mascot reactions 250–450 ms; ambient idle loop 3–6 seconds. Tune on real devices.

## Mascot states
- `idle`: gentle breathing/float, pause in background.
- `welcome`: one small bounce/wave.
- `good_conditions`: happy blink/lift.
- `conditions_changing`: curious tilt.
- `poor_air_quality`: calm concerned expression; no flashing/panic.
- `thinking`: subtle dots/glow plus “Thinking”.
- `listening`: microphone pulse and explicit listening label.
- `speaking`: gentle waveform or pulse.
- `device_disconnected`: concerned look plus reconnect action.
- `data_uncertain`: neutral/curious plus explanation.
- `success`: one short confirmation.

## UI motion
Cards fade/translate on first mount, not every sensor tick. Numeric changes crossfade. Animate chart initially but keep live updates subtle. Buttons provide pressed feedback. Connection timeline updates by real stage, not an endless fake spinner. Success animation is brief and skippable.

Avoid restarting mascot animation on every update; pause when screen is unfocused; keep assets small. Reduced-motion mode uses static art and minimal transitions.
