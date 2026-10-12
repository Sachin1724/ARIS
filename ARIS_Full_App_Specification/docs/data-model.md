# Data Model

```ts
export type ConnectionState =
  | "not_connected" | "scanning" | "pairing" | "provisioning"
  | "connecting_wifi" | "discovering_api" | "connected"
  | "reconnecting" | "offline" | "error";

export interface SensorValue {
  value: number | null;
  unit: string;
  timestamp?: string;
  valid: boolean;
  calibrated?: boolean;
  source?: "device_sensor" | "weather_provider" | "traffic_provider" | "derived";
  stale?: boolean;
}

export interface ForecastPoint {
  timestamp: string;
  value: number | null;
  unit: string;
  kind: "observed" | "predicted";
  lowerBound?: number | null;
  upperBound?: number | null;
}
```
Unavailable values are null, not zero. Raw ADC/voltage/resistance is not a calibrated concentration. Track last successful update separately from current time. Mark cached data stale. Never store Wi-Fi passwords in ordinary app state or logs.
