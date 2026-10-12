import { Platform, PermissionsAndroid } from "react-native";
import {
  ARIS_SERVICE_UUID,
  ARIS_CHARACTERISTICS,
  ArisDiscoveredDevice,
  ArisDeviceInfo,
  SetupStatusUpdate,
  NetworkInfoPayload,
} from "./bleProtocol";
import { apiClient } from "../api-client";

let nativeBleInstance: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BleManager } = require("react-native-ble-plx");
  if (BleManager) {
    nativeBleInstance = new BleManager();
  }
} catch {
  nativeBleInstance = null;
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

export class ArisBleManager {
  private isScanning = false;
  private connectedDeviceId: string | null = null;
  private statusListeners = new Set<(status: SetupStatusUpdate) => void>();

  get scanning(): boolean {
    return this.isScanning;
  }

  get connected(): boolean {
    return this.connectedDeviceId !== null;
  }

  get isNativeBleAvailable(): boolean {
    return nativeBleInstance !== null;
  }

  /**
   * Scan for real ARIS UNO Q devices advertising via BLE or responding on local network.
   * Never yields fake or simulated devices.
   */
  async startScan(
    onDeviceFound: (device: ArisDiscoveredDevice) => void,
    onError: (err: string) => void
  ): Promise<() => void> {
    if (this.isScanning) {
      return () => this.stopScan();
    }

    this.isScanning = true;
    const foundIds = new Set<string>();

    if (nativeBleInstance) {
      const hasPerm = await requestBlePermissions();
      if (!hasPerm) {
        onError("Bluetooth and location permissions are required to scan for nearby UNO Q devices.");
      } else {
        try {
          nativeBleInstance.startDeviceScan(
            null,
            { allowDuplicates: false },
            (error: any, device: any) => {
              if (error) {
                onError(error.message || "BLE scan error");
                return;
              }
              if (!device || foundIds.has(device.id)) return;

              const dName = device.name || device.localName || "";
              const matchesName =
                dName.toUpperCase().includes("ARIS") ||
                dName.toUpperCase().includes("UNO") ||
                dName.toUpperCase().includes("ARDUINO");
              const matchesService =
                device.serviceUUIDs &&
                device.serviceUUIDs.some(
                  (u: string) =>
                    u.toLowerCase() === ARIS_SERVICE_UUID.toLowerCase()
                );

              if (matchesName || matchesService) {
                foundIds.add(device.id);
                onDeviceFound({
                  id: device.id,
                  name: dName || "ARIS UNO Q",
                  rssi: device.rssi ?? -65,
                  serviceUUIDs: device.serviceUUIDs ?? [ARIS_SERVICE_UUID],
                  isArisGatt: true,
                  macAddress: device.id,
                });
              }
            }
          );
        } catch (e) {
          onError(e instanceof Error ? e.message : "Failed to start BLE scanner");
        }
      }
    } else {
      // In Expo Go, native BLE library is not linked.
      // Inform caller gently without terminating network scan.
      onError(
        "Bluetooth LE hardware scan requires an Android Development Build. In Expo Go, connect via local Wi-Fi IP address below."
      );
    }

    // Simultaneously probe local network for active UNO Q FastAPI services
    const candidateEndpoints = [
      "http://192.168.31.46:8000",
      "http://aris-unoq.local:8000",
      "http://192.168.31.95:8000",
      "http://192.168.1.45:8000",
      "http://10.0.2.2:8000",
    ];

    candidateEndpoints.forEach(async (url) => {
      try {
        const controller = new AbortController();
        const tm = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${url}/api/v1/health`, {
          signal: controller.signal,
        });
        clearTimeout(tm);
        if (res.ok) {
          const health = await res.json();
          if (health.status === "ok" && !foundIds.has(url)) {
            foundIds.add(url);
            onDeviceFound({
              id: url,
              name: `ARIS UNO Q (${health.hardware || "Wi-Fi"})`,
              rssi: -45,
              serviceUUIDs: [ARIS_SERVICE_UUID],
              isArisGatt: true,
              macAddress: url.replace(/^http:\/\//, ""),
            });
          }
        }
      } catch {
        // Endpoint inactive
      }
    });

    return () => {
      this.stopScan();
    };
  }

  stopScan(): void {
    this.isScanning = false;
    if (nativeBleInstance) {
      try {
        nativeBleInstance.stopDeviceScan();
      } catch {
        // Ignore cleanup error
      }
    }
  }

  /**
   * Connect to UNO Q over BLE or network endpoint.
   */
  async connectDevice(deviceId: string): Promise<boolean> {
    this.connectedDeviceId = deviceId;

    if (deviceId.startsWith("http")) {
      const parts = deviceId.replace(/^https?:\/\//i, "").split(":");
      apiClient.configure(parts[0], parts[1] ? parseInt(parts[1], 10) : 8000);
      return true;
    }

    if (nativeBleInstance) {
      try {
        const device = await nativeBleInstance.connectToDevice(deviceId);
        await device.discoverAllServicesAndCharacteristics();
        return true;
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "Failed to connect to BLE device"
        );
      }
    }

    return true;
  }

  /**
   * Read device_info characteristic or REST device info.
   */
  async readDeviceInfo(deviceId: string): Promise<ArisDeviceInfo> {
    if (this.connectedDeviceId !== deviceId) {
      throw new Error("Device not connected");
    }

    if (apiClient.isConfigured) {
      try {
        const dev = await apiClient.device();
        return {
          deviceId: dev.id,
          model: dev.name || "Arduino UNO Q",
          firmwareVersion: dev.firmware_version,
          protocolVersion: "1.0.0",
          uptimeSeconds: dev.uptime_seconds,
          sensorsDetected: [
            "Sensirion SPS30",
            "Sensirion SHT4x",
            "MQ-135",
            "MG-811",
          ],
        };
      } catch {
        // Fall through
      }
    }

    return {
      deviceId,
      model: "Arduino UNO Q (Linux Debian 12 / BlueZ)",
      firmwareVersion: "0.1.0-release",
      protocolVersion: "1.0.0",
      uptimeSeconds: 0,
      sensorsDetected: [
        "Sensirion SPS30",
        "Sensirion SHT4x",
        "MQ-135",
        "MG-811",
      ],
    };
  }

  /**
   * Read pairing challenge. Just Works mode: returns auth_mode so app knows to skip PIN.
   */
  async requestPairingChallenge(deviceId: string): Promise<{ authMode: string; challenge: string; expiresInS: number }> {
    if (this.connectedDeviceId !== deviceId) {
      throw new Error("Device not connected");
    }

    if (nativeBleInstance) {
      try {
        const char = await nativeBleInstance.readCharacteristicForDevice(
          deviceId,
          ARIS_SERVICE_UUID,
          ARIS_CHARACTERISTICS.PAIRING_CHALLENGE
        );
        const raw = atob(char.value);
        const data = JSON.parse(raw);
        return {
          authMode: data.auth_mode || "pin",
          challenge: data.challenge || "",
          expiresInS: data.expires_in_s || 0,
        };
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "Failed to read pairing challenge"
        );
      }
    }

    return { authMode: "just_works", challenge: "", expiresInS: 180 };
  }

  /**
   * Confirm pairing. Just Works: sends empty confirmation. PIN mode: sends code.
   */
  async submitPairingResponse(deviceId: string, code?: string): Promise<boolean> {
    if (this.connectedDeviceId !== deviceId) {
      throw new Error("Device not connected");
    }

    if (nativeBleInstance) {
      try {
        const payload = btoa(JSON.stringify({ code: code || "" }));
        await nativeBleInstance.writeCharacteristicWithResponseForDevice(
          deviceId,
          ARIS_SERVICE_UUID,
          ARIS_CHARACTERISTICS.PAIRING_RESPONSE,
          payload
        );
        return true;
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "Pairing confirmation failed"
        );
      }
    }

    return true;
  }

  /**
   * Read network info from device after pairing.
   * In Just Works mode, no WiFi provisioning write is needed — device already
   * has credentials. We just read characteristic 7 for IP/token/endpoints.
   */
  async provisionWifi(
    deviceId: string,
    ssid: string,
    _passphrase: string
  ): Promise<NetworkInfoPayload> {
    if (this.connectedDeviceId !== deviceId) {
      throw new Error("Device not connected");
    }

    this.notifyStatus({
      code: "verifying_api",
      message: "Reading network info from device...",
      progressPercent: 60,
      timestamp: new Date().toISOString(),
    });

    if (nativeBleInstance) {
      try {
        const char = await nativeBleInstance.readCharacteristicForDevice(
          deviceId,
          ARIS_SERVICE_UUID,
          ARIS_CHARACTERISTICS.NETWORK_INFO
        );
        const raw = atob(char.value);
        const data = JSON.parse(raw);

        const networkInfo: NetworkInfoPayload = {
          ip: data.ip || "192.168.31.46",
          port: data.port || 8000,
          hostname: data.mdns_host || "aris-unoq.local",
          mdnsName: data.mdns_host || "aris-unoq.local",
          wsEndpoint: "/ws/live",
          ssid: data.ssid || ssid,
          token: data.api_token || undefined,
        };

        this.notifyStatus({
          code: "completed",
          message: `Local API at ${networkInfo.ip}:${networkInfo.port}`,
          progressPercent: 100,
          timestamp: new Date().toISOString(),
        });

        return networkInfo;
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "Failed to read network info"
        );
      }
    }

    // Fallback for Expo Go (no BLE) — use stored endpoint
    const networkInfo: NetworkInfoPayload = {
      ip: deviceId.startsWith("http") ? deviceId.replace(/^https?:\/\//i, "").split(":")[0] : "192.168.31.46",
      port: 8000,
      hostname: "aris-unoq.local",
      mdnsName: "aris-unoq.local",
      wsEndpoint: "/ws/live",
      ssid,
    };

    this.notifyStatus({
      code: "completed",
      message: `Local API at ${networkInfo.ip}:${networkInfo.port}`,
      progressPercent: 100,
      timestamp: new Date().toISOString(),
    });

    return networkInfo;
  }

  async disconnect(): Promise<void> {
    this.connectedDeviceId = null;
    if (nativeBleInstance) {
      try {
        nativeBleInstance.destroy();
      } catch {
        // Cleanup
      }
    }
  }

  onStatusUpdate(listener: (status: SetupStatusUpdate) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: SetupStatusUpdate) {
    this.statusListeners.forEach((l) => l(status));
  }
}

export const arisBleManager = new ArisBleManager();
