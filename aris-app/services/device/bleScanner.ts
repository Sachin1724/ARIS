import { arisBleManager } from "./bleManager";
import { ARIS_SERVICE_UUID, ArisDiscoveredDevice } from "./bleProtocol";

export { ARIS_SERVICE_UUID };

export interface ScanSubscription {
  stop: () => void;
}

/**
 * Initiates BLE scanning filtered strictly for ARIS GATT service.
 */
export function scanForAris(
  onFound: (device: ArisDiscoveredDevice) => void,
  onError: (message: string) => void
): () => void {
  let active = true;
  let cleanupFn: (() => void) | null = null;

  arisBleManager
    .startScan(
      (device) => {
        if (!active) return;
        // Verify device advertises ARIS service
        if (device.isArisGatt || device.serviceUUIDs?.includes(ARIS_SERVICE_UUID)) {
          onFound(device);
        }
      },
      (err) => {
        if (!active) return;
        onError(err);
      }
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
