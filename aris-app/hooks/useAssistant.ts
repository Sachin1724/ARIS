import { useState, useCallback } from "react";
import type { AssistantResponse } from "../types/api";
import { apiClient, ApiClientError } from "../services/api-client";
import { mockAssistantResponse } from "../services/mock-data";

interface UseAssistantResult {
  response: AssistantResponse | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  ask: (question: string) => Promise<void>;
}

export function useAssistant(): UseAssistantResult {
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemo = !apiClient.isConfigured;

  const ask = useCallback(async (question: string) => {
    setLoading(true);
    setError(null);

    if (!apiClient.isConfigured) {
      setResponse(mockAssistantResponse(question));
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

  return { response, loading, error, isDemo, ask };
}
