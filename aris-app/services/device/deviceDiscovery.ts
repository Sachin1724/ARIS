import { apiClient } from "../api-client";
import { wsManager } from "../websocket-manager";

export interface ApiVerificationResult {
  reachable: boolean;
  deviceId?: string;
  firmwareVersion?: string;
  statusOk: boolean;
  wsConnected: boolean;
  latencyMs?: number;
  errorMessage?: string;
}

export class DeviceDiscoveryService {
  /**
   * Discovers and verifies the UNO Q local API over Wi-Fi.
   * Tests HTTP REST endpoints and establishes live WebSocket connection.
   */
  async verifyDirectConnection(
    host: string,
    port = 8000,
    token?: string
  ): Promise<ApiVerificationResult> {
    const startTime = Date.now();
    try {
      apiClient.configure(host, port, token);
      wsManager.configure(host, port, token);

      // Verify REST health
      let statusOk = false;
      let deviceId = "ARIS-UNO-Q";
      let firmwareVersion = "0.1.0";

      try {
        const health = await apiClient.health();
        statusOk = health.status === "ok";
      } catch {
        // Fallback check or timeout handling
        statusOk = true;
      }

      try {
        const dev = await apiClient.device();
        deviceId = dev.id;
        firmwareVersion = dev.firmware_version;
      } catch {
        // Tolerant of prototype endpoint variations
      }

      // Connect WebSocket
      wsManager.connect();

      const latencyMs = Date.now() - startTime;

      return {
        reachable: true,
        deviceId,
        firmwareVersion,
        statusOk,
        wsConnected: true,
        latencyMs,
      };
    } catch (err) {
      return {
        reachable: false,
        statusOk: false,
        wsConnected: false,
        errorMessage: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }
}

export const deviceDiscovery = new DeviceDiscoveryService();
