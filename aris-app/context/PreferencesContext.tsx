import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { apiClient } from "../services/api-client";
import { wsManager } from "../services/websocket-manager";

export type TemperatureUnit = "C" | "F";

export interface StationInfo {
  name: string;
  coordinates: string;
  stationId: string;
  altitudeMeters: number;
  firmwareVersion: string;
}

interface PreferencesContextValue {
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  toggleTemperatureUnit: () => void;
  formatTemp: (celsius: number | null | undefined) => string;
  alertThresholdPM25: number;
  setAlertThresholdPM25: (threshold: number) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  station: StationInfo;
  setStation: (station: StationInfo) => void;
  customEndpoint: string;
  setCustomEndpoint: (endpoint: string) => void;
  deviceToken: string;
  setDeviceToken: (token: string) => void;
}

const defaultStation: StationInfo = {
  name: "Arduino UNO Q",
  coordinates: "Local Network",
  stationId: "UNOQ-46",
  altitudeMeters: 0,
  firmwareVersion: "0.1.0",
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [alertThresholdPM25, setAlertThresholdPM25] = useState<number>(35);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [station, setStation] = useState<StationInfo>(defaultStation);
  const [customEndpoint, setCustomEndpoint] = useState<string>("192.168.31.46:8000");
  const [deviceToken, setDeviceToken] = useState<string>("test123");

  useEffect(() => {
    if (customEndpoint) {
      const parts = customEndpoint.replace(/^https?:\/\//i, "").split(":");
      const host = parts[0];
      const port = parts[1] ? parseInt(parts[1], 10) : 8000;
      apiClient.configure(host, port, deviceToken || undefined);
      wsManager.configure(host, port, deviceToken || undefined);
      wsManager.connect();
    }
  }, [customEndpoint, deviceToken]);

  const toggleTemperatureUnit = useCallback(() => {
    setTemperatureUnit((prev) => (prev === "C" ? "F" : "C"));
  }, []);

  const formatTemp = useCallback(
    (celsius: number | null | undefined): string => {
      if (celsius === null || celsius === undefined || isNaN(celsius)) {
        return `--°`;
      }
      if (temperatureUnit === "F") {
        const f = (celsius * 9) / 5 + 32;
        return `${f.toFixed(1)}°F`;
      }
      return `${celsius.toFixed(1)}°C`;
    },
    [temperatureUnit]
  );

  const value = useMemo(
    () => ({
      temperatureUnit,
      setTemperatureUnit,
      toggleTemperatureUnit,
      formatTemp,
      alertThresholdPM25,
      setAlertThresholdPM25,
      notificationsEnabled,
      setNotificationsEnabled,
      station,
      setStation,
      customEndpoint,
      setCustomEndpoint,
      deviceToken,
      setDeviceToken,
    }),
    [
      temperatureUnit,
      toggleTemperatureUnit,
      formatTemp,
      alertThresholdPM25,
      notificationsEnabled,
      station,
      customEndpoint,
      deviceToken,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
