#!/usr/bin/env bash
# ==============================================================================
# ARIS Setup Script for Arduino UNO Q (Debian Linux)
# Sets up BlueZ BLE GATT Provisioning Service and FastAPI Telemetry Hub
# ==============================================================================

set -e

echo "=== [1/5] Verifying Arduino UNO Q Bluetooth Subsystem ==="
if ! command -v bluetoothctl &> /dev/null; then
    echo "bluetoothctl not found. Installing bluez..."
    sudo apt-get update && sudo apt-get install -y bluez bluez-tools python3-dbus python3-gi python3-pip
fi

echo "--- Current Bluetooth Controller Status ---"
sudo bluetoothctl show || true
sudo systemctl status bluetooth --no-pager || true

echo "Powering on Bluetooth controller and enabling LE Advertising..."
sudo bluetoothctl power on || true
sudo bluetoothctl advertise on || true

echo "=== [2/5] Creating ARIS Configuration Directory ==="
sudo mkdir -p /etc/aris
if [ ! -f /etc/aris/setup_code ]; then
    echo "729401" | sudo tee /etc/aris/setup_code > /dev/null
    sudo chmod 600 /etc/aris/setup_code
    echo "Generated default one-time setup code: 729401"
fi

echo "=== [3/5] Installing Python Dependencies ==="
sudo pip3 install --break-system-packages -r requirements.txt || sudo pip3 install -r requirements.txt

echo "=== [4/5] Deploying Systemd Services ==="
sudo cp systemd/aris-ble-provisioning.service /etc/systemd/system/
sudo cp systemd/aris-backend.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable aris-ble-provisioning.service
sudo systemctl enable aris-backend.service

sudo systemctl restart aris-backend.service
sudo systemctl restart aris-ble-provisioning.service

echo "=== [5/5] Verification & Health Check ==="
echo "ARIS BLE Provisioning Service Status:"
sudo systemctl status aris-ble-provisioning.service --no-pager || true

echo "ARIS FastAPI Backend Status:"
sudo systemctl status aris-backend.service --no-pager || true

echo ""
echo "=== SETUP COMPLETE ==="
echo "The Arduino UNO Q is now advertising BLE Service UUID 8f4c0001-6a2b-4b6a-9e14-8d6c3b7a2f00"
echo "Open ARIS app -> Tap 'Find my device' -> Select UNO Q -> Enter PIN (729401)"
