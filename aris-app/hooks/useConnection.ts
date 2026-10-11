import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/api-client";
import { wsManager } from "../services/websocket-manager";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected" | "demo";

interface UseConnectionResult {
  status: ConnectionStatus;
  connect: (host: string, port?: number) => Promise<boolean>;
  disconnect: () => void;
}

export function useConnection(): UseConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>(
    apiClient.isConfigured ? "connected" : "demo",
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
          setStatus(apiClient.isConfigured ? "disconnected" : "demo");
          break;
      }
    });
    return unsubscribe;
  }, []);

  const connect = useCallback(async (host: string, port = 8000): Promise<boolean> => {
    try {
      apiClient.configure(host, port);
      wsManager.configure(host, port);

      const health = await apiClient.health();
      if (health.status === "ok" || health.status === "degraded") {
        wsManager.connect();
        setStatus("connected");
        return true;
      }
      setStatus("disconnected");
      return false;
    } catch {
      setStatus("disconnected");
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
    setStatus("demo");
  }, []);

  return { status, connect, disconnect };
}
