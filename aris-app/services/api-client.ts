import type {
  HealthResponse,
  DeviceInfo,
  DeviceStatus,
  ForecastResponse,
  HistoryResponse,
  AssistantQuery,
  AssistantResponse,
  ApiError,
} from "../types/api";

const DEFAULT_TIMEOUT = 10000;

class ApiClient {
  private baseUrl: string | null = null;

  configure(host: string, port = 8000) {
    this.baseUrl = `http://${host}:${port}`;
  }

  get isConfigured(): boolean {
    return this.baseUrl !== null;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiClientError(0, "API client not configured. Connect a device first.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
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
    });
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
