import { arisBleManager } from "./bleManager";
import { NetworkInfoPayload, SetupStatusUpdate } from "./bleProtocol";

export interface WifiCredentials {
  ssid: string;
  passphrase?: string;
  securityType?: "WPA2" | "WPA3" | "Open";
}

export class WifiProvisioningService {
  /**
   * Securely transfer Wi-Fi credentials to UNO Q over authenticated BLE channel.
   */
  async provision(
    deviceId: string,
    credentials: WifiCredentials,
    onProgress?: (status: SetupStatusUpdate) => void
  ): Promise<NetworkInfoPayload> {
    if (!credentials.ssid.trim()) {
      throw new Error("Network name (SSID) is required");
    }

    let unsubscribe: (() => void) | null = null;
    if (onProgress) {
      unsubscribe = arisBleManager.onStatusUpdate(onProgress);
    }

    try {
      const result = await arisBleManager.provisionWifi(
        deviceId,
        credentials.ssid,
        credentials.passphrase || ""
      );
      return result;
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  }
}

export const wifiProvisioning = new WifiProvisioningService();
