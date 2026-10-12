import type {
  HealthResponse,
  DeviceInfo,
  DeviceStatus,
  SystemHealth,
  ForecastResponse,
  HistoryResponse,
  AssistantQuery,
  AssistantResponse,
  ApiError,
} from "../types/api";

const DEFAULT_TIMEOUT = 10000;

class ApiClient {
  private baseUrl: string | null = null;
  private authToken: string | null = null;

  configure(hostOrUrl: string, port = 8000, token?: string) {
    if (token) this.authToken = token;
    const trimmed = hostOrUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      this.baseUrl = trimmed.replace(/\/+$/, "");
    } else if (trimmed.includes(":")) {
      this.baseUrl = `http://${trimmed}`;
    } else {
      this.baseUrl = `http://${trimmed}:${port}`;
    }
  }

  setToken(token: string) {
    this.authToken = token;
  }

  unconfigure() {
    this.baseUrl = null;
    this.authToken = null;
  }

  get isConfigured(): boolean {
    return this.baseUrl !== null;
  }

  private async request<T>(path: string, options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiClientError(0, "API client not configured. Connect a device first.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ApiClientError(response.status, body || response.statusText);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiClientError(0, "Request timed out");
      }
      throw new ApiClientError(0, error instanceof Error ? error.message : "Network error");
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/v1/health");
  }

  /** Board health for the system monitor. */
  async system(): Promise<SystemHealth> {
    return this.request<SystemHealth>("/api/v1/system");
  }

  async device(): Promise<DeviceInfo> {
    return this.request<DeviceInfo>("/api/v1/device");
  }

  async status(): Promise<DeviceStatus> {
    return this.request<DeviceStatus>("/api/v1/status");
  }

  async forecast(metric?: string): Promise<ForecastResponse> {
    const params = metric ? `?metric=${encodeURIComponent(metric)}` : "";
    return this.request<ForecastResponse>(`/api/v1/forecast${params}`);
  }

  async history(metric: string, hours = 24): Promise<HistoryResponse> {
    return this.request<HistoryResponse>(
      `/api/v1/history?metric=${encodeURIComponent(metric)}&hours=${hours}`,
    );
  }

  async askAssistant(query: AssistantQuery): Promise<AssistantResponse> {
    return this.request<AssistantResponse>("/api/v1/assistant/query", {
      method: "POST",
      body: JSON.stringify(query),
    }, 120_000);
  }

  async streamAssistant(
    query: AssistantQuery,
    onMeta: (meta: { evidence: AssistantResponse["evidence"]; reasoning: string }) => void,
    onDelta: (text: string) => void,
    onDone: (answer: string) => void,
  ): Promise<void> {
    if (!this.baseUrl) {
      throw new ApiClientError(0, "API client not configured. Connect a device first.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/assistant/stream`, {
        method: "POST",
        body: JSON.stringify(query),
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ApiClientError(response.status, body || response.statusText);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new ApiClientError(0, "No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (eventType === "meta") onMeta(parsed);
              else if (eventType === "delta") onDelta(parsed.content || "");
              else if (eventType === "done") onDone(parsed.answer || "");
            } catch {}
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiClientError(0, "Request timed out");
      }
      throw new ApiClientError(0, error instanceof Error ? error.message : "Network error");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  get isTimeout(): boolean {
    return this.status === 0 && this.message === "Request timed out";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export const apiClient = new ApiClient();
