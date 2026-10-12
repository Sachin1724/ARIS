import { arisBleManager } from "./bleManager";
import { scanForAris } from "./bleScanner";
import { wifiProvisioning, WifiCredentials } from "./wifiProvisioning";
import { deviceDiscovery, ApiVerificationResult } from "./deviceDiscovery";
import {
  ArisDiscoveredDevice,
  ArisDeviceInfo,
  SetupStatusUpdate,
  NetworkInfoPayload,
} from "./bleProtocol";

export type OnboardingStage =
  | "unpaired"
  | "scanning"
  | "device_selected"
  | "authorizing"
  | "authorized"
  | "provisioning_wifi"
  | "verifying_network"
  | "connected"
  | "error";

export interface ActiveOnboardingState {
  stage: OnboardingStage;
  selectedDevice: ArisDiscoveredDevice | null;
  deviceInfo: ArisDeviceInfo | null;
  networkInfo: NetworkInfoPayload | null;
  verification: ApiVerificationResult | null;
  error: string | null;
}

class DeviceApiService {
  private state: ActiveOnboardingState = {
    stage: "unpaired",
    selectedDevice: null,
    deviceInfo: null,
    networkInfo: null,
    verification: null,
    error: null,
  };

  private listeners = new Set<(state: ActiveOnboardingState) => void>();

  getState(): ActiveOnboardingState {
    return { ...this.state };
  }

  subscribe(listener: (state: ActiveOnboardingState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private updateState(partial: Partial<ActiveOnboardingState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.getState()));
  }

  selectDevice(device: ArisDiscoveredDevice) {
    this.updateState({
      selectedDevice: device,
      stage: "device_selected",
      error: null,
    });
  }

  async authorizeDevice(code: string): Promise<boolean> {
    const { selectedDevice } = this.state;
    if (!selectedDevice) throw new Error("No device selected");

    this.updateState({ stage: "authorizing" });
    try {
      await arisBleManager.connectDevice(selectedDevice.id);
      const info = await arisBleManager.readDeviceInfo(selectedDevice.id);
      const success = await arisBleManager.submitPairingResponse(selectedDevice.id, code);
      if (success) {
        this.updateState({
          stage: "authorized",
          deviceInfo: info,
          error: null,
        });
        return true;
      } else {
        throw new Error("Invalid setup authorization code");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pairing authorization failed";
      this.updateState({ stage: "error", error: msg });
      throw err;
    }
  }

  async provisionWifiAndConnect(
    credentials: WifiCredentials,
    onProgress?: (update: SetupStatusUpdate) => void
  ): Promise<boolean> {
    const { selectedDevice } = this.state;
    if (!selectedDevice) throw new Error("No device selected");

    this.updateState({ stage: "provisioning_wifi" });
    try {
      const network = await wifiProvisioning.provision(
        selectedDevice.id,
        credentials,
        onProgress
      );

      this.updateState({
        stage: "verifying_network",
        networkInfo: network,
      });

      // Step 6: Verify direct communication over Wi-Fi
      const verification = await deviceDiscovery.verifyDirectConnection(
        network.ip,
        network.port,
        network.token
      );

      if (verification.reachable && verification.statusOk) {
        // Step 7: Connected to ARIS
        this.updateState({
          stage: "connected",
          verification,
          error: null,
        });
        return true;
      } else {
        throw new Error(
          verification.errorMessage ||
            "Device connected to Wi-Fi, but local API could not be reached. Ensure you are on the same Wi-Fi subnet."
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wi-Fi setup failed";
      this.updateState({ stage: "error", error: msg });
      throw err;
    }
  }

  reset() {
    this.state = {
      stage: "unpaired",
      selectedDevice: null,
      deviceInfo: null,
      networkInfo: null,
      verification: null,
      error: null,
    };
    this.listeners.forEach((l) => l(this.getState()));
  }
}

export const deviceApi = new DeviceApiService();
