/**
 * ARIS BLE GATT Protocol Contract
 * Target: Arduino UNO Q Debian Linux (BlueZ GATT Server) central communication
 */

export const ARIS_SERVICE_UUID = "8f4c0001-6a2b-4b6a-9e14-8d6c3b7a2f00";

export const ARIS_CHARACTERISTICS = {
  /** Read: Device ID, model, firmware and protocol version */
  DEVICE_INFO: "8f4c0002-6a2b-4b6a-9e14-8d6c3b7a2f00",

  /** Read/Notify: Begin authorization and retrieve fresh challenge nonce */
  PAIRING_CHALLENGE: "8f4c0003-6a2b-4b6a-9e14-8d6c3b7a2f00",

  /** Write: Submit user one-time authorization proof / 6-digit setup PIN */
  PAIRING_RESPONSE: "8f4c0004-6a2b-4b6a-9e14-8d6c3b7a2f00",

  /** Write: Authenticated & encrypted Wi-Fi credentials (SSID + PSK) */
  WIFI_CONFIG: "8f4c0005-6a2b-4b6a-9e14-8d6c3b7a2f00",

  /** Notify: Setup progress state machine events */
  SETUP_STATUS: "8f4c0006-6a2b-4b6a-9e14-8d6c3b7a2f00",

  /** Read: Device local IP address, port, mDNS name, and WebSocket path */
  NETWORK_INFO: "8f4c0007-6a2b-4b6a-9e14-8d6c3b7a2f00",
} as const;

export interface ArisDiscoveredDevice {
  id: string;
  name: string;
  rssi: number;
  serviceUUIDs?: string[];
  isArisGatt: boolean;
  macAddress?: string;
  /** How it was found. Wi-Fi entries can be used without pairing. */
  transport?: "ble" | "wifi";
  /** Reachable but rejecting us: the API token is missing or stale. */
  requiresToken?: boolean;
}

/** Why a scan found nothing — shown in the UI instead of an empty list. */
export interface ScanDiagnostics {
  nativeBleAvailable: boolean;
  permissionsGranted: boolean;
  locationPermissionGranted: boolean;
  adapterState: string;
  bleScanStarted: boolean;
  wifiSubnetScanned: string | null;
  endpointsProbed: number;
  notes: string[];
}

export interface ArisDeviceInfo {
  deviceId: string;
  model: string;
  firmwareVersion: string;
  protocolVersion: string;
  uptimeSeconds: number;
  sensorsDetected: string[];
}

export type SetupStatusCode =
  | "idle"
  | "authenticating"
  | "auth_success"
  | "auth_failed"
  | "connecting_wifi"
  | "wifi_connected"
  | "wifi_failed"
  | "verifying_api"
  | "completed"
  | "timeout"
  | "error";

export interface SetupStatusUpdate {
  code: SetupStatusCode;
  message: string;
  progressPercent: number;
  timestamp: string;
  errorDetail?: string;
}

export interface NetworkInfoPayload {
  ip: string;
  port: number;
  hostname: string;
  mdnsName: string;
  wsEndpoint: string;
  ssid: string;
  token?: string;
}
