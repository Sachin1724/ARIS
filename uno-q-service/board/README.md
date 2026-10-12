# Board code mirror

The code that actually runs on the Arduino UNO Q lived only on the board, with
`.bak` copies as its version history. This directory mirrors it so changes are
reviewable and recoverable.

| Here | On the board |
|---|---|
| `python/` | `/home/arduino/ArduinoApps/aeris/python/` |
| `sketch/sketch.ino` | `/home/arduino/ArduinoApps/aeris/sketch/sketch.ino` |

`python/aeris_hotspot.py` is the live API served on port 8000 by
`aris-api.service` — **not** `uno-q-service/fastapi_app.py`, which is not
deployed anywhere.

`python/main.py` runs inside the Arduino App container (`aeris-main-1`), so it
can only write inside this app directory — that is why signalling between the
collector and the host goes through files such as `aeris_latest.json` and
`aeris_discovery_gate.json`.

## State of this mirror

- `python/aeris_hotspot.py` — `/api/v1/system`, the `/ws/live` client registry,
  and `write_link_state()` for the display. **Deployed and verified.**
- `python/main.py` — D3 shutdown poll (live, firmware flashed) and
  `push_display_state()`, which pushes link + board health to the MCU every 5s.
  **Deployed**; the push is a no-op until the sketch below is flashed.
- `sketch/sketch.ino` — D3 8s shutdown gesture (**flashed**) plus the display
  work: `setAerisLink`, the notification banner, pages 3/4, and the previously
  unwired `aeris_set_mood_request`. **Compiles (148104 B flash, 18%; 62552 B
  RAM, 23%), not yet uploaded.**

On-board backups: `main.py.prephase3`, `aeris_hotspot.py.prephase3`,
`sketch.ino.prephase3` (pre-shutdown-gesture). `sketch/sketch.ino.prePartC`
here is the flashed firmware, i.e. the rollback target for the display work.

## Known pre-existing noise

`main.py` requests two bridge methods the sketch has never provided —
`aeris_warmup_done` and `aeris_mg811_cal_mode` — so the container logs two
errors every 5s (~34k journal lines a day). Predates this work; either provide
them in the sketch or drop them from `main.py`.

## Editing

Edit here, copy to the board, restart the owning service:

```bash
scp python/aeris_hotspot.py arduino@<board>:/home/arduino/ArduinoApps/aeris/python/
sudo systemctl restart aris-api            # API changes
arduino-app-cli app restart user:aeris     # collector (main.py) changes
```

Firmware needs a compile gate and an upload, done with the board in reach:

```bash
cd /home/arduino/ArduinoApps/aeris
arduino-cli compile --fqbn arduino:zephyr:unoq sketch
arduino-cli upload  --fqbn arduino:zephyr:unoq sketch
```
