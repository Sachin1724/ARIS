import { Platform, PermissionsAndroid } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  ARIS_SERVICE_UUID,
  ARIS_CHARACTERISTICS,
  ArisDiscoveredDevice,
  ArisDeviceInfo,
  ScanDiagnostics,
  SetupStatusUpdate,
  NetworkInfoPayload,
} from "./bleProtocol";
import { buildCandidates, probeEndpoints } from "./networkProbe";
import { apiClient } from "../api-client";

/** Give the Bluetooth stack this long to finish powering on before scanning. */
const ADAPTER_READY_TIMEOUT = 5000;
/** Scan filtered by our service UUID first; broaden if nothing shows up. */
const FILTERED_SCAN_WINDOW = 4000;

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

interface PermissionReport {
  granted: boolean;
  locationGranted: boolean;
  missing: string[];
}

async function requestBlePermissions(): Promise<PermissionReport> {
  if (Platform.OS !== "android") {
    return { granted: true, locationGranted: true, missing: [] };
  }
  try {
    const { PERMISSIONS, RESULTS } = PermissionsAndroid;
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PERMISSIONS.BLUETOOTH_SCAN,
        PERMISSIONS.BLUETOOTH_CONNECT,
        PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const missing = Object.entries(results)
        .filter(([, state]) => state !== RESULTS.GRANTED)
        .map(([name]) => name.replace("android.permission.", ""));
      return {
        granted:
          results[PERMISSIONS.BLUETOOTH_SCAN] === RESULTS.GRANTED &&
          results[PERMISSIONS.BLUETOOTH_CONNECT] === RESULTS.GRANTED,
        // Many OEM builds return zero scan results without it, and report no error.
        locationGranted: results[PERMISSIONS.ACCESS_FINE_LOCATION] === RESULTS.GRANTED,
        missing,
      };
    }
    const granted = await PermissionsAndroid.request(PERMISSIONS.ACCESS_FINE_LOCATION);
    const ok = granted === RESULTS.GRANTED;
    return {
      granted: ok,
      locationGranted: ok,
      missing: ok ? [] : ["ACCESS_FINE_LOCATION"],
    };
  } catch {
    return { granted: false, locationGranted: false, missing: ["permission request failed"] };
  }
}

/**
 * A scan started before the adapter finishes powering on silently returns
 * nothing, which is the usual difference between a warm debug session and a
 * cold release launch.
 */
async function waitForAdapter(): Promise<string> {
  if (!nativeBleInstance) return "Unavailable";
  let state = "Unknown";
  try {
    state = await nativeBleInstance.state();
  } catch {
    return "Unknown";
  }
  if (state === "PoweredOn") return state;

  return new Promise<string>((resolve) => {
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      try {
        subscription?.remove();
      } catch {
        // listener already gone
      }
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(state), ADAPTER_READY_TIMEOUT);
    const subscription = nativeBleInstance.onStateChange((next: string) => {
      state = next;
      if (next === "PoweredOn") finish(next);
    }, true);
  });
}

export interface ScanOptions {
  /** Endpoint that worked last time, tried before any sweep. */
  savedEndpoint?: string | null;
  /** API token, so a provisioned board answers 200 instead of 401. */
  token?: string | null;
}

export class ArisBleManager {
  private isScanning = false;
  private lastDiagnostics: ScanDiagnostics | null = null;
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

  /** Why the last scan found what it found. Surfaced on the scan screen. */
  get diagnostics(): ScanDiagnostics | null {
    return this.lastDiagnostics;
  }

  /**
   * Scan for real ARIS UNO Q devices: BLE advert plus a sweep of the phone's own
   * subnet for the local API. Never yields fake or simulated devices.
   *
   * The board only advertises over BLE while its pairing window is open (hold
   * D3 for ~3s), so an empty BLE result is normal and not an error.
   */
  async startScan(
    onDeviceFound: (device: ArisDiscoveredDevice) => void,
    onError: (err: string) => void,
    options: ScanOptions = {}
  ): Promise<() => void> {
    if (this.isScanning) {
      return () => this.stopScan();
    }

    this.isScanning = true;
    const foundIds = new Set<string>();
    const cancelled = { aborted: false };
    const diagnostics: ScanDiagnostics = {
      nativeBleAvailable: nativeBleInstance !== null,
      permissionsGranted: false,
      locationPermissionGranted: false,
      adapterState: nativeBleInstance ? "Unknown" : "Unavailable",
      bleScanStarted: false,
      wifiSubnetScanned: null,
      endpointsProbed: 0,
      notes: [],
    };
    this.lastDiagnostics = diagnostics;

    const emit = (device: ArisDiscoveredDevice) => {
      if (cancelled.aborted || foundIds.has(device.id)) return;
      foundIds.add(device.id);
      onDeviceFound(device);
    };

    if (nativeBleInstance) {
      const permissions = await requestBlePermissions();
      diagnostics.permissionsGranted = permissions.granted;
      diagnostics.locationPermissionGranted = permissions.locationGranted;

      if (!permissions.granted) {
        diagnostics.notes.push(`Permissions denied: ${permissions.missing.join(", ")}`);
        onError(
          "Bluetooth permissions are required to find a nearby UNO Q. Grant them in Settings, then scan again."
        );
      } else {
        if (!permissions.locationGranted) {
          diagnostics.notes.push("Location permission denied - Android may return no BLE results.");
        }
        diagnostics.adapterState = await waitForAdapter();
        if (diagnostics.adapterState !== "PoweredOn") {
          diagnostics.notes.push(`Bluetooth adapter is ${diagnostics.adapterState}.`);
          onError(
            diagnostics.adapterState === "PoweredOff"
              ? "Bluetooth is turned off. Turn it on to find a nearby UNO Q."
              : `Bluetooth is not ready (${diagnostics.adapterState}). Wi-Fi discovery is still running.`
          );
        } else {
          diagnostics.bleScanStarted = this.beginBleScan(emit, onError, cancelled, diagnostics);
        }
      }
    } else {
      diagnostics.notes.push("Native BLE module not linked (Expo Go).");
      onError(
        "Bluetooth LE hardware scan requires an Android Development Build. In Expo Go, connect via local Wi-Fi IP address below."
      );
    }

    this.probeLocalNetwork(emit, options, cancelled, diagnostics);

    return () => {
      cancelled.aborted = true;
      this.stopScan();
    };
  }

  /**
   * Filtered scan first (cheap, and the board advertises our service UUID), then
   * an unfiltered pass for boards whose advert is truncated to the name only.
   */
  private beginBleScan(
    emit: (device: ArisDiscoveredDevice) => void,
    onError: (err: string) => void,
    cancelled: { aborted: boolean },
    diagnostics: ScanDiagnostics
  ): boolean {
    const handle = (error: any, device: any) => {
      if (cancelled.aborted) return;
      if (error) {
        diagnostics.notes.push(`BLE scan error: ${error.message || error.reason || "unknown"}`);
        onError(error.message || "BLE scan error");
        return;
      }
      if (!device) return;

      const name = device.name || device.localName || "";
      const matchesService = (device.serviceUUIDs ?? []).some(
        (uuid: string) => uuid.toLowerCase() === ARIS_SERVICE_UUID.toLowerCase()
      );
      const matchesName = /aris|unoq|uno q|arduino/i.test(name);
      if (!matchesService && !matchesName) return;

      emit({
        id: device.id,
        name: name || "ARIS UNO Q",
        rssi: device.rssi ?? -65,
        serviceUUIDs: device.serviceUUIDs ?? [ARIS_SERVICE_UUID],
        isArisGatt: matchesService,
        macAddress: device.id,
        transport: "ble",
      });
    };

    try {
      nativeBleInstance.startDeviceScan(
        [ARIS_SERVICE_UUID],
        { allowDuplicates: false },
        handle
      );
    } catch (e) {
      diagnostics.notes.push(
        `Filtered scan failed: ${e instanceof Error ? e.message : "unknown"}`
      );
      onError(e instanceof Error ? e.message : "Failed to start BLE scanner");
      return false;
    }

    setTimeout(() => {
      if (cancelled.aborted || !this.isScanning) return;
      try {
        nativeBleInstance.stopDeviceScan();
        nativeBleInstance.startDeviceScan(null, { allowDuplicates: false }, handle);
        diagnostics.notes.push("Broadened to unfiltered BLE scan.");
      } catch {
        // Keep whatever the filtered pass found.
      }
    }, FILTERED_SCAN_WINDOW);

    return true;
  }

  /** Sweep the phone's own /24 for the local API. */
  private async probeLocalNetwork(
    emit: (device: ArisDiscoveredDevice) => void,
    options: ScanOptions,
    cancelled: { aborted: boolean },
    diagnostics: ScanDiagnostics
  ): Promise<void> {
    let selfIp: string | null = null;
    try {
      const net = await NetInfo.fetch();
      const details = net.details as { ipAddress?: string } | null;
      selfIp = details?.ipAddress ?? null;
    } catch {
      diagnostics.notes.push("Could not read Wi-Fi address from the OS.");
    }

    const candidates = buildCandidates({
      savedEndpoint: options.savedEndpoint ?? null,
      selfIp,
    });
    diagnostics.wifiSubnetScanned = selfIp
      ? `${selfIp.split(".").slice(0, 3).join(".")}.0/24`
      : null;
    diagnostics.endpointsProbed = candidates.length;
    if (!selfIp) {
      diagnostics.notes.push("Not on Wi-Fi - only the saved endpoint and mDNS name were tried.");
    }

    await probeEndpoints(candidates, {
      token: options.token ?? null,
      signal: cancelled,
      onFound: (result) => {
        const host = result.url.replace(/^https?:\/\//i, "");
        emit({
          id: result.url,
          name: result.requiresToken
            ? `ARIS UNO Q (${host}, needs token)`
            : `ARIS UNO Q (${result.hardware || host})`,
          rssi: -45,
          serviceUUIDs: [ARIS_SERVICE_UUID],
          isArisGatt: false,
          macAddress: host,
          transport: "wifi",
          requiresToken: result.requiresToken,
        });
      },
    });
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
        // The sensor list comes from whatever the board actually reports. It
        // used to be a hardcoded SPS30/SHT4x set that this hardware does not
        // even have.
        let sensorsDetected: string[] = [];
        try {
          const status = await apiClient.status();
          sensorsDetected = Object.keys(status.sensors ?? {});
        } catch {
          // Leave it empty rather than inventing a parts list.
        }
        return {
          deviceId: dev.id,
          model: dev.name || "Arduino UNO Q",
          firmwareVersion: dev.firmware_version,
          protocolVersion: "1.0.0",
          uptimeSeconds: dev.uptime_seconds,
          sensorsDetected,
        };
      } catch {
        // Fall through
      }
    }

    return {
      deviceId,
      model: "Arduino UNO Q",
      firmwareVersion: "unknown",
      protocolVersion: "1.0.0",
      uptimeSeconds: 0,
      sensorsDetected: [],
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
