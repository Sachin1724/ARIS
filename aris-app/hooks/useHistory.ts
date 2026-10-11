import { useState, useCallback } from "react";
import type { HistoryResponse } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";
import { mockHistory } from "../services/mock-data";

interface UseHistoryResult {
  data: HistoryResponse | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  fetch: (metric: string, hours?: number) => Promise<void>;
}

export function useHistory(): UseHistoryResult {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemo = !apiClient.isConfigured;

  const fetchHistory = useCallback(async (metric: string, hours = 24) => {
    setLoading(true);
    setError(null);

    if (!apiClient.isConfigured) {
      setData(mockHistory(metric, hours));
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.history(metric, hours);
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to fetch history",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, isDemo, fetch: fetchHistory };
}
