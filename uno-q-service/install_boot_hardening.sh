#!/usr/bin/env bash
# Installs the ARIS boot/power hardening on the UNO Q. Run on the board:
#   sudo bash install_boot_hardening.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/4] watchdog: a hard hang reboots itself instead of needing a power pull ==="
install -d /etc/systemd/system.conf.d
install -m 644 "$HERE/systemd/aris-watchdog.conf" /etc/systemd/system.conf.d/

echo "=== [2/4] safe-shutdown request path ==="
install -m 644 "$HERE/systemd/aris-poweroff.path" /etc/systemd/system/
install -m 644 "$HERE/systemd/aris-poweroff.service" /etc/systemd/system/
install -m 644 "$HERE/systemd/aris-tmpfiles.conf" /etc/tmpfiles.d/aris.conf
systemd-tmpfiles --create /etc/tmpfiles.d/aris.conf

echo "=== [3/4] enable ==="
systemctl daemon-reload
systemctl enable --now aris-poweroff.path

echo "=== [4/4] apply the watchdog (re-executes systemd; services keep running) ==="
systemctl daemon-reexec
systemctl show -p RuntimeWatchdogUSec -p RebootWatchdogUSec

echo
echo "Done. Safe shutdown from anywhere on the board:  touch /run/aris/poweroff.request"
