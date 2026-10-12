"""
Wi-Fi Provisioner for Arduino UNO Q (Debian Linux).
Configures network credentials via NetworkManager (nmcli) or wpa_supplicant.
"""

import subprocess
import socket
import logging
import time
import re
from typing import Optional, Dict

logger = logging.getLogger("aris.wifi_provisioner")

class WifiProvisioner:
    def __init__(self, interface: str = "wlan0"):
        self.interface = interface

    def connect(self, ssid: str, passphrase: Optional[str] = None, timeout_s: int = 25) -> Dict[str, any]:
        """
        Connects the board to the provided SSID.
        Returns a dictionary with status, ip, and gateway.
        """
        logger.info(f"Initiating Wi-Fi connection to SSID: {ssid} on interface {self.interface}")

        # Check if NetworkManager is available
        has_nmcli = self._check_command("nmcli")

        if has_nmcli:
            success = self._connect_via_nmcli(ssid, passphrase, timeout_s)
        else:
            success = self._connect_via_wpa_supplicant(ssid, passphrase, timeout_s)

        if not success:
            return {
                "success": False,
                "error": "Failed to authenticate or associate with Wi-Fi network",
                "ip": None,
            }

        # Wait for DHCP lease and retrieve IP
        ip_address = self._wait_for_ip(timeout_s=15)
        if not ip_address:
            return {
                "success": False,
                "error": "Associated with access point, but DHCP lease timed out",
                "ip": None,
            }

        logger.info(f"Successfully connected to Wi-Fi. IP: {ip_address}")
        return {
            "success": True,
            "error": None,
            "ip": ip_address,
            "ssid": ssid,
        }

    def get_current_ip(self) -> Optional[str]:
        """
        Retrieves the current IPv4 address of the Wi-Fi interface.
        """
        try:
            # First attempt: parse ip addr show
            res = subprocess.run(
                ["ip", "-4", "addr", "show", self.interface],
                capture_output=True,
                text=True,
                check=False
            )
            if res.returncode == 0:
                match = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+)", res.stdout)
                if match:
                    return match.group(1)

            # Fallback: query socket connection to external target
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.5)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception as e:
            logger.warning(f"Unable to determine current IP: {e}")
            return None

    def _wait_for_ip(self, timeout_s: int = 15) -> Optional[str]:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            ip = self.get_current_ip()
            if ip and not ip.startswith("127."):
                return ip
            time.sleep(1)
        return None

    def _connect_via_nmcli(self, ssid: str, passphrase: Optional[str], timeout_s: int) -> bool:
        cmd = ["nmcli", "device", "wifi", "connect", ssid]
        if passphrase:
            cmd.extend(["password", passphrase])

        try:
            logger.info("Executing nmcli wifi connect...")
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
            if res.returncode == 0:
                logger.info("nmcli connection command succeeded.")
                return True
            else:
                logger.error(f"nmcli failed: {res.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logger.error("nmcli connection timed out")
            return False
        except Exception as e:
            logger.error(f"Error executing nmcli: {e}")
            return False

    def _connect_via_wpa_supplicant(self, ssid: str, passphrase: Optional[str], timeout_s: int) -> bool:
        logger.info("Configuring via wpa_cli fallback...")
        try:
            # Add network
            res = subprocess.run(["wpa_cli", "-i", self.interface, "add_network"], capture_output=True, text=True)
            net_id = res.stdout.strip()
            if not net_id.isdigit():
                return False

            # Set SSID
            subprocess.run(["wpa_cli", "-i", self.interface, "set_network", net_id, "ssid", f'"{ssid}"'], check=True)

            # Set Key
            if passphrase:
                subprocess.run(["wpa_cli", "-i", self.interface, "set_network", net_id, "psk", f'"{passphrase}"'], check=True)
            else:
                subprocess.run(["wpa_cli", "-i", self.interface, "set_network", net_id, "key_mgmt", "NONE"], check=True)

            # Enable and select
            subprocess.run(["wpa_cli", "-i", self.interface, "enable_network", net_id], check=True)
            subprocess.run(["wpa_cli", "-i", self.interface, "select_network", net_id], check=True)
            subprocess.run(["wpa_cli", "-i", self.interface, "save_config"], check=True)
            return True
        except Exception as e:
            logger.error(f"wpa_cli error: {e}")
            return False

    def _check_command(self, cmd: str) -> bool:
        res = subprocess.run(["which", cmd], capture_output=True)
        return res.returncode == 0
