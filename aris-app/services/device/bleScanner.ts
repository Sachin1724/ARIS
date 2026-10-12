import { arisBleManager, ScanOptions } from "./bleManager";
import { ARIS_SERVICE_UUID, ArisDiscoveredDevice, ScanDiagnostics } from "./bleProtocol";

export { ARIS_SERVICE_UUID };
export type { ScanOptions, ScanDiagnostics };

export interface ScanSubscription {
  stop: () => void;
}

/** Diagnostics for the scan that just ran, for the UI to explain an empty list. */
export function getScanDiagnostics(): ScanDiagnostics | null {
  return arisBleManager.diagnostics;
}

/**
 * Initiates discovery over BLE (filtered to the ARIS GATT service) and over the
 * local network. Filtering happens in the manager, which also knows whether a
 * Wi-Fi endpoint answered 200 or asked for a token.
 */
export function scanForAris(
  onFound: (device: ArisDiscoveredDevice) => void,
  onError: (message: string) => void,
  options: ScanOptions = {}
): () => void {
  let active = true;
  let cleanupFn: (() => void) | null = null;

  arisBleManager
    .startScan(
      (device) => {
        if (active) onFound(device);
      },
      (err) => {
        if (active) onError(err);
      },
      options
    )
    .then((cleanup) => {
      if (!active) {
        cleanup();
      } else {
        cleanupFn = cleanup;
      }
    })
    .catch((err) => {
      onError(err instanceof Error ? err.message : "BLE scan error");
    });

  return () => {
    active = false;
    if (cleanupFn) {
      cleanupFn();
    } else {
      arisBleManager.stopScan();
    }
  };
}
