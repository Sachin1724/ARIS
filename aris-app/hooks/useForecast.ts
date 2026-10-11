import { useState, useCallback } from "react";
import type { ForecastResponse } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";
import { mockForecast } from "../services/mock-data";

interface UseForecastResult {
  data: ForecastResponse | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  fetch: (metric?: string) => Promise<void>;
}

export function useForecast(): UseForecastResult {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemo = !apiClient.isConfigured;

  const fetchForecast = useCallback(async (metric?: string) => {
    setLoading(true);
    setError(null);

    if (!apiClient.isConfigured) {
      setData(mockForecast);
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.forecast(metric);
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to fetch forecast",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, isDemo, fetch: fetchForecast };
}
