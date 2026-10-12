#!/usr/bin/env python3
"""
ARIS BLE GATT Server for Arduino UNO Q (Debian Linux / BlueZ).
Registers custom ARIS GATT Application and LE Advertisement over D-Bus.
Enforces secure challenge-response authorization before accepting Wi-Fi credentials.
"""

import sys
import os
import json
import secrets
import time
import logging
import dbus
import dbus.service
import dbus.mainloop.glib
from gi.repository import GLib

from constants import (
    ARIS_SERVICE_UUID,
    CHAR_DEVICE_INFO_UUID,
    CHAR_PAIRING_CHALLENGE_UUID,
    CHAR_PAIRING_RESPONSE_UUID,
    CHAR_WIFI_CONFIG_UUID,
    CHAR_SETUP_STATUS_UUID,
    CHAR_NETWORK_INFO_UUID,
    DEFAULT_DEVICE_ID,
    DEFAULT_DEVICE_NAME,
    DEFAULT_FIRMWARE_VERSION,
    DEFAULT_PROTOCOL_VERSION,
    FASTAPI_PORT,
    MDNS_HOSTNAME,
)
from wifi_provisioner import WifiProvisioner

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] (%(name)s) %(message)s"
)
logger = logging.getLogger("aris.ble")

BLUEZ_SERVICE_NAME = "org.bluez"
GATT_MANAGER_IFACE = "org.bluez.GattManager1"
LE_ADVERTISING_MANAGER_IFACE = "org.bluez.LEAdvertisingManager1"
DBUS_OM_IFACE = "org.freedesktop.DBus.ObjectManager"
DBUS_PROP_IFACE = "org.freedesktop.DBus.Properties"

GATT_SERVICE_IFACE = "org.bluez.GattService1"
GATT_CHRC_IFACE = "org.bluez.GattCharacteristic1"
LE_ADVERTISEMENT_IFACE = "org.bluez.LEAdvertisement1"

class InvalidArgsException(dbus.exceptions.DBusException):
    _dbus_error_name = "org.bluez.Error.InvalidArguments"

class NotPermittedException(dbus.exceptions.DBusException):
    _dbus_error_name = "org.bluez.Error.NotPermitted"

class NotAuthorizedException(dbus.exceptions.DBusException):
    _dbus_error_name = "org.bluez.Error.NotAuthorized"

class Application(dbus.service.Object):
    def __init__(self, bus):
        self.path = "/"
        self.services = []
        super().__init__(bus, self.path)

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def add_service(self, service):
        self.services.append(service)

    @dbus.service.method(DBUS_OM_IFACE, out_signature="a{oa{sa{sv}}}")
    def GetManagedObjects(self):
        response = {}
        for service in self.services:
            response[service.get_path()] = service.get_properties()
            for chrc in service.get_characteristics():
                response[chrc.get_path()] = chrc.get_properties()
        return response

class Service(dbus.service.Object):
    PATH_BASE = "/org/bluez/aris/service"

    def __init__(self, bus, index, uuid, primary):
        self.path = f"{self.PATH_BASE}{index}"
        self.bus = bus
        self.uuid = uuid
        self.primary = primary
        self.characteristics = []
        super().__init__(bus, self.path)

    def get_properties(self):
        return {
            GATT_SERVICE_IFACE: {
                "UUID": self.uuid,
                "Primary": self.primary,
                "Characteristics": dbus.Array(
                    [c.get_path() for c in self.characteristics],
                    signature="o"
                )
            }
        }

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def add_characteristic(self, characteristic):
        self.characteristics.append(characteristic)

    def get_characteristics(self):
        return self.characteristics

class Characteristic(dbus.service.Object):
    def __init__(self, bus, index, uuid, flags, service):
        self.path = f"{service.path}/char{index}"
        self.bus = bus
        self.uuid = uuid
        self.service = service
        self.flags = flags
        self.notifying = False
        super().__init__(bus, self.path)

    def get_properties(self):
        return {
            GATT_CHRC_IFACE: {
                "Service": self.service.get_path(),
                "UUID": self.uuid,
                "Flags": self.flags,
            }
        }

    def get_path(self):
        return dbus.ObjectPath(self.path)

    @dbus.service.method(GATT_CHRC_IFACE, in_signature="a{sv}", out_signature="ay")
    def ReadValue(self, options):
        logger.warning(f"Default ReadValue for {self.uuid} not implemented")
        return dbus.Array([], signature="y")

    @dbus.service.method(GATT_CHRC_IFACE, in_signature="aya{sv}")
    def WriteValue(self, value, options):
        logger.warning(f"Default WriteValue for {self.uuid} not implemented")

    @dbus.service.method(GATT_CHRC_IFACE)
    def StartNotify(self):
        self.notifying = True

    @dbus.service.method(GATT_CHRC_IFACE)
    def StopNotify(self):
        self.notifying = False

    @dbus.service.signal(DBUS_PROP_IFACE, signature="sa{sv}as")
    def PropertiesChanged(self, interface, changed, invalidated):
        pass

    def send_notification(self, value_bytes):
        if not self.notifying:
            return
        self.PropertiesChanged(
            GATT_CHRC_IFACE,
            {"Value": dbus.ByteArray(value_bytes)},
            []
        )

class Advertisement(dbus.service.Object):
    PATH_BASE = "/org/bluez/aris/advertisement"

    def __init__(self, bus, index, advertising_type="peripheral"):
        self.path = f"{self.PATH_BASE}{index}"
        self.bus = bus
        self.ad_type = advertising_type
        self.service_uuids = [ARIS_SERVICE_UUID]
        self.local_name = "ARIS-UNOQ"
        self.include_tx_power = True
        super().__init__(bus, self.path)

    def get_properties(self):
        properties = {
            "Type": self.ad_type,
            "ServiceUUIDs": dbus.Array(self.service_uuids, signature="s"),
            "LocalName": dbus.String(self.local_name),
            "IncludeTxPower": dbus.Boolean(self.include_tx_power),
        }
        return {LE_ADVERTISEMENT_IFACE: properties}

    def get_path(self):
        return dbus.ObjectPath(self.path)

    @dbus.service.method(DBUS_PROP_IFACE, in_signature="s", out_signature="a{sv}")
    def GetAll(self, interface):
        if interface != LE_ADVERTISEMENT_IFACE:
            raise InvalidArgsException()
        return self.get_properties()[LE_ADVERTISEMENT_IFACE]

    @dbus.service.method(LE_ADVERTISEMENT_IFACE, in_signature="", out_signature="")
    def Release(self):
        logger.info(f"Advertisement {self.path} released by BlueZ")


# -------------------------------------------------------------
# ARIS GATT Characteristics Implementation
# -------------------------------------------------------------

class DeviceInfoCharacteristic(Characteristic):
    def __init__(self, bus, index, service, state_manager):
        super().__init__(
            bus, index, CHAR_DEVICE_INFO_UUID,
            ["read"], service
        )
        self.state_manager = state_manager

    def ReadValue(self, options):
        logger.info("BLE Client requested device_info")
        data = {
            "id": self.state_manager.device_id,
            "name": DEFAULT_DEVICE_NAME,
            "model": "Arduino UNO Q",
            "firmware_version": DEFAULT_FIRMWARE_VERSION,
            "protocol_version": DEFAULT_PROTOCOL_VERSION,
            "hardware_platform": "Debian Linux on Renesas RZ/G2L (UNO Q)",
        }
        payload = json.dumps(data).encode("utf-8")
        return dbus.ByteArray(payload)


class PairingChallengeCharacteristic(Characteristic):
    def __init__(self, bus, index, service, state_manager):
        super().__init__(
            bus, index, CHAR_PAIRING_CHALLENGE_UUID,
            ["read", "notify"], service
        )
        self.state_manager = state_manager

    def ReadValue(self, options):
        logger.info("BLE Client requested pairing_challenge")
        challenge = self.state_manager.generate_challenge()
        data = {
            "challenge": challenge,
            "expires_in_s": 180,
            "max_attempts": 5
        }
        payload = json.dumps(data).encode("utf-8")
        return dbus.ByteArray(payload)


class PairingResponseCharacteristic(Characteristic):
    def __init__(self, bus, index, service, state_manager):
        super().__init__(
            bus, index, CHAR_PAIRING_RESPONSE_UUID,
            ["write"], service
        )
        self.state_manager = state_manager

    def WriteValue(self, value, options):
        try:
            raw_text = bytes(value).decode("utf-8").strip()
            logger.info("BLE Client submitted pairing_response")
            
            # Allow JSON format {"code": "..."} or raw 6-digit PIN
            if raw_text.startswith("{"):
                req = json.loads(raw_text)
                code = req.get("code", "")
            else:
                code = raw_text

            authorized = self.state_manager.verify_pairing_code(code)
            if not authorized:
                logger.warning("Invalid setup code submitted.")
                raise NotAuthorizedException("Invalid pairing code or challenge expired")

            logger.info("Device pairing successfully authorized!")
        except Exception as e:
            if isinstance(e, NotAuthorizedException):
                raise
            logger.error(f"Error parsing pairing response: {e}")
            raise InvalidArgsException(str(e))


class WifiConfigCharacteristic(Characteristic):
    def __init__(self, bus, index, service, state_manager, provisioner, status_char):
        super().__init__(
            bus, index, CHAR_WIFI_CONFIG_UUID,
            ["write"], service
        )
        self.state_manager = state_manager
        self.provisioner = provisioner
        self.status_char = status_char

    def WriteValue(self, value, options):
        if not self.state_manager.is_authorized():
            logger.error("Unauthorized attempt to write wifi_config rejected")
            raise NotAuthorizedException("Pairing authorization required before configuring Wi-Fi")

        try:
            payload = bytes(value).decode("utf-8")
            logger.info("BLE Client wrote wifi_config")
            config = json.loads(payload)
            ssid = config.get("ssid")
            passphrase = config.get("passphrase")

            if not ssid:
                raise InvalidArgsException("SSID is required")

            # Schedule connection asynchronously in GLib main loop
            GLib.idle_add(self._execute_provisioning, ssid, passphrase)

        except Exception as e:
            logger.error(f"Error processing wifi_config: {e}")
            raise InvalidArgsException(str(e))

    def _execute_provisioning(self, ssid, passphrase):
        self.status_char.notify_status("wifi_connecting", "Connecting to access point...", 25)
        
        result = self.provisioner.connect(ssid, passphrase)
        if result["success"]:
            self.state_manager.assigned_ip = result["ip"]
            self.status_char.notify_status("wifi_connected", "Network link established", 65)
            time.sleep(0.5)
            self.status_char.notify_status("api_ready", f"FastAPI reachable at {result['ip']}:8000", 100)
        else:
            self.status_char.notify_status("error", result.get("error", "Wi-Fi connection failed"), 0)
        return False


class SetupStatusCharacteristic(Characteristic):
    def __init__(self, bus, index, service):
        super().__init__(
            bus, index, CHAR_SETUP_STATUS_UUID,
            ["notify", "read"], service
        )
        self.last_status = {
            "status": "idle",
            "message": "Awaiting pairing authorization",
            "progress_pct": 0
        }

    def notify_status(self, status: str, message: str, progress_pct: int):
        self.last_status = {
            "status": status,
            "message": message,
            "progress_pct": progress_pct,
            "timestamp": int(time.time())
        }
        logger.info(f"Setup status notification: {self.last_status}")
        payload = json.dumps(self.last_status).encode("utf-8")
        self.send_notification(payload)

    def ReadValue(self, options):
        payload = json.dumps(self.last_status).encode("utf-8")
        return dbus.ByteArray(payload)


class NetworkInfoCharacteristic(Characteristic):
    def __init__(self, bus, index, service, state_manager):
        super().__init__(
            bus, index, CHAR_NETWORK_INFO_UUID,
            ["read"], service
        )
        self.state_manager = state_manager

    def ReadValue(self, options):
        logger.info("BLE Client requested network_info")
        ip = self.state_manager.assigned_ip or "127.0.0.1"
        data = {
            "ip": ip,
            "port": FASTAPI_PORT,
            "mdns_host": MDNS_HOSTNAME,
            "connected": self.state_manager.assigned_ip is not None,
            "ws_endpoint": f"ws://{ip}:{FASTAPI_PORT}/ws/live",
            "rest_base": f"http://{ip}:{FASTAPI_PORT}/api/v1"
        }
        payload = json.dumps(data).encode("utf-8")
        return dbus.ByteArray(payload)


# -------------------------------------------------------------
# Security & State Manager
# -------------------------------------------------------------

class DeviceStateManager:
    def __init__(self, device_id=DEFAULT_DEVICE_ID):
        self.device_id = device_id
        self.authorized = False
        self.current_challenge = None
        self.challenge_expiry = 0
        self.attempts = 0
        self.assigned_ip = None
        self.setup_code = self._load_setup_code()

    def _load_setup_code(self) -> str:
        code_path = "/etc/aris/setup_code"
        if os.path.exists(code_path):
            try:
                with open(code_path, "r") as f:
                    return f.read().strip()
            except Exception:
                pass
        return "729401"  # Default prototype one-time PIN

    def generate_challenge(self) -> str:
        self.current_challenge = secrets.token_hex(16)
        self.challenge_expiry = time.time() + 180
        self.attempts = 0
        self.authorized = False
        return self.current_challenge

    def verify_pairing_code(self, submitted_code: str) -> bool:
        if time.time() > self.challenge_expiry:
            logger.warning("Pairing challenge expired")
            return False

        if self.attempts >= 5:
            logger.warning("Too many incorrect pairing attempts. Locked out.")
            return False

        self.attempts += 1
        if secrets.compare_digest(submitted_code, self.setup_code):
            self.authorized = True
            return True
        return False

    def is_authorized(self) -> bool:
        return self.authorized


# -------------------------------------------------------------
# Main Application Bootstrapper
# -------------------------------------------------------------

def find_adapter(bus):
    remote_om = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, "/"), DBUS_OM_IFACE)
    objects = remote_om.GetManagedObjects()
    for o, p in objects.items():
        if GATT_MANAGER_IFACE in p and LE_ADVERTISING_MANAGER_IFACE in p:
            return o
    return None

def main():
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    adapter_path = find_adapter(bus)
    if not adapter_path:
        logger.error("No Bluetooth adapter found supporting GATT and LE Advertising. Run 'bluetoothctl show' on Linux.")
        sys.exit(1)

    logger.info(f"Using Bluetooth Adapter: {adapter_path}")

    state_mgr = DeviceStateManager()
    provisioner = WifiProvisioner()

    app = Application(bus)
    aris_service = Service(bus, 0, ARIS_SERVICE_UUID, True)

    status_chrc = SetupStatusCharacteristic(bus, 4, aris_service)
    aris_service.add_characteristic(DeviceInfoCharacteristic(bus, 0, aris_service, state_mgr))
    aris_service.add_characteristic(PairingChallengeCharacteristic(bus, 1, aris_service, state_mgr))
    aris_service.add_characteristic(PairingResponseCharacteristic(bus, 2, aris_service, state_mgr))
    aris_service.add_characteristic(WifiConfigCharacteristic(bus, 3, aris_service, state_mgr, provisioner, status_chrc))
    aris_service.add_characteristic(status_chrc)
    aris_service.add_characteristic(NetworkInfoCharacteristic(bus, 5, aris_service, state_mgr))

    app.add_service(aris_service)

    # Register GATT Application
    gatt_mgr = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, adapter_path), GATT_MANAGER_IFACE)
    gatt_mgr.RegisterApplication(
        app.get_path(),
        {},
        reply_handler=lambda: logger.info("ARIS GATT Application registered successfully"),
        error_handler=lambda e: logger.error(f"Failed to register GATT Application: {e}")
    )

    # Register LE Advertisement
    ad_mgr = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, adapter_path), LE_ADVERTISING_MANAGER_IFACE)
    adv = Advertisement(bus, 0)
    ad_mgr.RegisterAdvertisement(
        adv.get_path(),
        {},
        reply_handler=lambda: logger.info(f"Advertising ARIS Service UUID {ARIS_SERVICE_UUID}"),
        error_handler=lambda e: logger.error(f"Failed to register advertisement: {e}")
    )

    logger.info("ARIS BLE Provisioning Service running. Awaiting phone connections...")
    loop = GLib.MainLoop()
    try:
        loop.run()
    except KeyboardInterrupt:
        logger.info("Shutting down ARIS BLE server...")

if __name__ == "__main__":
    main()
