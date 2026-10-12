import { useState, useEffect, useCallback, useRef } from "react";
import type { DeviceStatus } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";
import { wsManager } from "../services/websocket-manager";

interface UseDeviceStatusResult {
  status: DeviceStatus | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useDeviceStatus(): UseDeviceStatusResult {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!apiClient.isConfigured) {
      setStatus(null);
      setLastUpdated(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.status();
      if (mountedRef.current) {
        setStatus(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (mountedRef.current) {
        const message =
          err instanceof ApiClientError
            ? err.isTimeout
              ? "Request timed out. Check your connection."
              : err.message
            : "Failed to fetch device status";
        setError(message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    const unsubscribe = wsManager.onEvent((event) => {
      if (event.type === "sensor_update" && mountedRef.current) {
        setStatus((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            timestamp: event.timestamp,
            sensors: { ...prev.sensors, ...(event.data as DeviceStatus["sensors"]) },
          };
        });
        setLastUpdated(new Date());
      }
    });

    // ponytail: HTTP poll every 15s as fallback when WS drops
    const pollInterval = setInterval(() => {
      if (apiClient.isConfigured && mountedRef.current) {
        fetchStatus();
      }
    }, 15_000);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [fetchStatus]);

  const stale =
    lastUpdated !== null && Date.now() - lastUpdated.getTime() > 60000;

  return { status, loading, error, stale, lastUpdated, refresh: fetchStatus };
}
