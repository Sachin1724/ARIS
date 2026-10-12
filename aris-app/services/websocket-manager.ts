import type { WebSocketEvent } from "../types/api";

type Listener = (event: WebSocketEvent) => void;
type StatusListener = (status: "connecting" | "connected" | "disconnected" | "error") => void;

const INITIAL_RETRY_DELAY = 1000;
/** No frame (sensor update OR heartbeat) within this window = link is dead. */
const LIVENESS_TIMEOUT = 10000;
const WATCHDOG_INTERVAL = 5000;
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
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastActivityAt = 0;
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

  /** Socket open AND a frame seen recently. False means reconnect is needed. */
  get isHealthy(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN &&
      Date.now() - this.lastActivityAt < LIVENESS_TIMEOUT
    );
  }

  /**
   * Reconnect only when the link is not proven alive. Safe to call on every
   * app resume: a healthy socket is left untouched, a silent one is replaced.
   */
  ensureHealthy() {
    if (!this.url || this.intentionalClose) return;
    if (this.isHealthy) return;
    if (this.ws) {
      this.forceReconnect();
    } else {
      this.connect();
    }
  }

  connect() {
    if (!this.url) return;
    // CONNECTING counts too: a second socket here is the duplicate-connection bug.
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.intentionalClose = false;
    this.notifyStatus("connecting");

    try {
      const wsUrl = this.authToken ? `${this.url}?token=${this.authToken}` : this.url;
      this.ws = new WebSocket(wsUrl);
      // Stamped before open so a socket stuck in CONNECTING also trips the watchdog.
      this.lastActivityAt = Date.now();
      this.startWatchdog();
    } catch {
      this.notifyStatus("error");
      this.scheduleRetry();
      return;
    }

    this.ws.onopen = () => {
      this.lastActivityAt = Date.now();
      this.retryDelay = INITIAL_RETRY_DELAY;
      this.notifyStatus("connected");
    };

    this.ws.onmessage = (event) => {
      // Any frame proves liveness, including heartbeats and frames we drop.
      this.lastActivityAt = Date.now();
      try {
        const parsed = JSON.parse(event.data as string) as unknown;
        if (isWebSocketEvent(parsed)) {
          const normalized = normalizeEvent(parsed);
          this.listeners.forEach((listener) => listener(normalized));
        }
      } catch {
        // malformed event ignored per spec
      }
    };

    this.ws.onclose = () => {
      this.stopWatchdog();
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
    this.stopWatchdog();
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

  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      if (this.intentionalClose) return;
      if (Date.now() - this.lastActivityAt >= LIVENESS_TIMEOUT) {
        this.forceReconnect();
      }
    }, WATCHDOG_INTERVAL);
  }

  private stopWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  /**
   * Drop a half-open socket (Android doze leaves them OPEN but silent) and
   * reconnect once. Handlers are detached first so the discarded socket's
   * onclose cannot schedule a second retry.
   */
  private forceReconnect() {
    this.stopWatchdog();
    const dead = this.ws;
    this.ws = null;
    if (dead) {
      dead.onopen = null;
      dead.onmessage = null;
      dead.onclose = null;
      dead.onerror = null;
      try {
        dead.close();
      } catch {
        // already gone
      }
    }
    this.retryDelay = INITIAL_RETRY_DELAY;
    this.notifyStatus("disconnected");
    this.connect();
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

/** Unix epoch (s or ms) or ISO string in, ISO string out. */
export function normalizeTimestamp(value: string | number): string {
  if (typeof value === "string") return value;
  // Values below ~2001 in ms are really seconds.
  const ms = value < 1e12 ? value * 1000 : value;
  return new Date(ms).toISOString();
}

function normalizeEvent(event: WebSocketEvent): WebSocketEvent {
  return { ...event, timestamp: normalizeTimestamp(event.timestamp) };
}

export function isWebSocketEvent(data: unknown): data is WebSocketEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  const ts = obj["timestamp"];
  return (
    typeof obj["type"] === "string" &&
    (typeof ts === "string" || (typeof ts === "number" && Number.isFinite(ts))) &&
    typeof obj["data"] === "object" &&
    obj["data"] !== null
  );
}

export const wsManager = new WebSocketManager();
