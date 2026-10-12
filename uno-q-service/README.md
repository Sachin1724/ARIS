# ARIS UNO Q Service: BLE Pairing & FastAPI Telemetry Hub

This package provides the board-side daemon for the **Arduino UNO Q** running Debian Linux, implementing the custom ARIS onboarding protocol.

## System Architecture

```
+-------------------------------------------------------------------+
|                        Arduino UNO Q                              |
|                                                                   |
|  [Sensirion SPS30]  [SHT4x]  [MQ-135]  [MG-811]                   |
|          \            |         |       /                         |
|           +-----------+---------+------+                          |
|                       |                                           |
|       +---------------+----------------+                          |
|       |                                |                          |
|       v                                v                          |
|  [BlueZ GATT Service]           [FastAPI Backend]                 |
|  (LE Advertising / Auth / Wi-Fi) (REST :8000 & WS /ws/live)       |
+-------+--------------------------------+--------------------------+
        | BLE (Discovery & Setup)        | Wi-Fi (Telemetry & AI)
        v                                v
+-------------------------------------------------------------------+
|                     ARIS Mobile App                               |
+-------------------------------------------------------------------+
```

---

## GATT Service Contract

- **Primary Service UUID**: `8f4c0001-6a2b-4b6a-9e14-8d6c3b7a2f00`
- **Advertisement Local Name**: `ARIS-UNOQ`

| Characteristic | UUID | Properties | Purpose |
| :--- | :--- | :--- | :--- |
| `device_info` | `8f4c0002-6a2b-4b6a-9e14-8d6c3b7a2f00` | Read | Reports device ID, model, firmware version, and platform specs. |
| `pairing_challenge` | `8f4c0003-6a2b-4b6a-9e14-8d6c3b7a2f00` | Read, Notify | Issues a 16-byte nonce challenge with 180s expiry and rate limiting. |
| `pairing_response` | `8f4c0004-6a2b-4b6a-9e14-8d6c3b7a2f00` | Write | Submits 6-digit setup code (default `729401` in `/etc/aris/setup_code`). |
| `wifi_config` | `8f4c0005-6a2b-4b6a-9e14-8d6c3b7a2f00` | Write Encrypted | Transmits SSID and passphrase. Rejects writes if unauthorized. |
| `setup_status` | `8f4c0006-6a2b-4b6a-9e14-8d6c3b7a2f00` | Notify, Read | Emits progress events (`wifi_connecting`, `wifi_connected`, `api_ready`). |
| `network_info` | `8f4c0007-6a2b-4b6a-9e14-8d6c3b7a2f00` | Read | Reports assigned IP, port 8000, and mDNS host `aris-unoq.local`. |

---

## Quick Setup on Arduino UNO Q (Debian Linux)

1. SSH into the Arduino UNO Q:
   ```bash
   ssh arduino@<board-ip>
   ```

2. Copy this folder to `/opt/aris/uno-q-service/`.

3. Run the setup script:
   ```bash
   cd /opt/aris/uno-q-service
   chmod +x setup_uno_q.sh
   ./setup_uno_q.sh
   ```

4. Verify Bluetooth status:
   ```bash
   bluetoothctl show
   systemctl status bluetooth --no-pager
   ```

5. Verify service logs:
   ```bash
   journalctl -u aris-ble-provisioning.service -f
   journalctl -u aris-backend.service -f
   ```

---

## Local Development & Testing

You can also run both daemons directly in development mode:

```bash
# Terminal 1: Run FastAPI Telemetry Server
python3 fastapi_app.py

# Terminal 2: Run BlueZ GATT Server (requires Linux with Bluetooth controller)
sudo python3 gatt_server.py
```
