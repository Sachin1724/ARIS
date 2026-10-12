import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import type { SystemHealth } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";

interface UseSystemHealthResult {
  data: SystemHealth | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 10_000;

/**
 * Board health from /api/v1/system. Polled rather than streamed: these numbers
 * move slowly and do not belong on the 1Hz telemetry socket.
 */
export function useSystemHealth(): UseSystemHealthResult {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Held in state rather than computed from Date.now() during render, so a
  // render is never dependent on the clock.
  const [stale, setStale] = useState(false);
  const mountedRef = useRef(true);
  // Written on each successful read and inspected by the poll tick, so neither
  // the clock nor a ref is touched while rendering.
  const lastUpdatedAtRef = useRef<number | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!apiClient.isConfigured) {
      setData(null);
      setLastUpdated(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const next = await apiClient.system();
      if (mountedRef.current) {
        setData(next);
        setLastUpdated(new Date());
        lastUpdatedAtRef.current = Date.now();
        setStale(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof ApiClientError
            ? err.isTimeout
              ? "Request timed out. Check your connection."
              : err.message
            : "Failed to read device health",
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchHealth();

    const poll = setInterval(() => {
      if (!mountedRef.current) return;
      // Three missed polls without a fresh reading means the figures on screen
      // can no longer be trusted as current.
      const at = lastUpdatedAtRef.current;
      if (at !== null && Date.now() - at > POLL_INTERVAL * 3) setStale(true);
      fetchHealth();
    }, POLL_INTERVAL);

    // Android freezes timers in the background, so refresh on resume.
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active" && mountedRef.current) fetchHealth();
    });

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      appStateSub.remove();
    };
  }, [fetchHealth]);

  return { data, loading, error, stale, lastUpdated, refresh: fetchHealth };
}
