import { useState, useEffect, useCallback } from "react";
import { apiClient, ApiClientError } from "../services/api-client";
import { wsManager } from "../services/websocket-manager";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface UseConnectionResult {
  status: ConnectionStatus;
  connect: (host: string, port?: number, token?: string) => Promise<boolean>;
  disconnect: () => void;
}

export function useConnection(): UseConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>(
    apiClient.isConfigured ? "connected" : "disconnected",
  );

  useEffect(() => {
    const unsubscribe = wsManager.onStatusChange((wsStatus) => {
      switch (wsStatus) {
        case "connected":
          setStatus("connected");
          break;
        case "connecting":
          setStatus("reconnecting");
          break;
        case "disconnected":
        case "error":
          // WS dropped but apiClient may still reach the server — try HTTP health check
          if (apiClient.isConfigured) {
            setStatus("reconnecting");
            apiClient.health().then((h) => {
              if (h.status === "ok" || h.status === "degraded") {
                setStatus("connected");
                wsManager.connect();
              } else {
                setStatus("disconnected");
              }
            }).catch(() => setStatus("disconnected"));
          } else {
            setStatus("disconnected");
          }
          break;
      }
    });
    return unsubscribe;
  }, []);

  const connect = useCallback(async (host: string, port = 8000, token?: string): Promise<boolean> => {
    try {
      apiClient.configure(host, port, token);
      wsManager.configure(host, port, token);

      const health = await apiClient.health();
      if (health.status === "ok" || health.status === "degraded") {
        wsManager.connect();
        setStatus("connected");
        return true;
      }
      setStatus("disconnected");
      return false;
    } catch (err) {
      setStatus("disconnected");
      if (err instanceof ApiClientError && err.isUnauthorized) {
        throw new Error("Authentication failed. Check device token.");
      }
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    wsManager.unconfigure();
    apiClient.unconfigure();
    setStatus("disconnected");
  }, []);

  return { status, connect, disconnect };
}
