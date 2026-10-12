import type { WebSocketEvent } from "../types/api";

type Listener = (event: WebSocketEvent) => void;
type StatusListener = (status: "connecting" | "connected" | "disconnected" | "error") => void;

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const BACKOFF_FACTOR = 2;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private authToken: string | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private retryDelay = INITIAL_RETRY_DELAY;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  configure(hostOrUrl: string, port = 8000, token?: string) {
    if (token) this.authToken = token;
    const trimmed = hostOrUrl.trim();
    if (trimmed.startsWith("https://")) {
      this.url = trimmed.replace(/^https:\/\//i, "wss://").replace(/\/+$/, "") + "/ws/live";
    } else if (trimmed.startsWith("http://")) {
      this.url = trimmed.replace(/^http:\/\//i, "ws://").replace(/\/+$/, "") + "/ws/live";
    } else if (trimmed.startsWith("wss://") || trimmed.startsWith("ws://")) {
      this.url = trimmed.replace(/\/+$/, "");
      if (!this.url.endsWith("/ws/live")) {
        this.url += "/ws/live";
      }
    } else if (trimmed.includes(":")) {
      this.url = `ws://${trimmed}/ws/live`;
    } else {
      this.url = `ws://${trimmed}:${port}/ws/live`;
    }
  }

  setToken(token: string) {
    this.authToken = token;
  }

  unconfigure() {
    this.disconnect();
    this.url = null;
    this.authToken = null;
  }

  connect() {
    if (!this.url) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.intentionalClose = false;
    this.notifyStatus("connecting");

    try {
      const wsUrl = this.authToken ? `${this.url}?token=${this.authToken}` : this.url;
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.notifyStatus("error");
      this.scheduleRetry();
      return;
    }

    this.ws.onopen = () => {
      this.retryDelay = INITIAL_RETRY_DELAY;
      this.notifyStatus("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as unknown;
        if (isWebSocketEvent(parsed)) {
          this.listeners.forEach((listener) => listener(parsed));
        }
      } catch {
        // malformed event ignored per spec
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose) {
        this.notifyStatus("disconnected");
        this.scheduleRetry();
      }
    };

    this.ws.onerror = () => {
      this.notifyStatus("error");
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus("disconnected");
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private scheduleRetry() {
    if (this.intentionalClose) return;
    this.retryTimeout = setTimeout(() => {
      this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * BACKOFF_FACTOR, MAX_RETRY_DELAY);
  }

  private notifyStatus(status: "connecting" | "connected" | "disconnected" | "error") {
    this.statusListeners.forEach((listener) => listener(status));
  }
}

function isWebSocketEvent(data: unknown): data is WebSocketEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj["type"] === "string" &&
    typeof obj["timestamp"] === "string" &&
    typeof obj["data"] === "object" &&
    obj["data"] !== null
  );
}

export const wsManager = new WebSocketManager();
