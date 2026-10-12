import { useState, useCallback } from "react";
import type { AssistantResponse } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";

interface UseAssistantResult {
  response: AssistantResponse | null;
  loading: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
}

export function useAssistant(): UseAssistantResult {
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string) => {
    setLoading(true);
    setError(null);

    if (!apiClient.isConfigured) {
      setError("Connect your Arduino UNO Q to query live sensor telemetry.");
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.askAssistant({ text: question });
      setResponse(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to get answer",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { response, loading, error, ask };
}
