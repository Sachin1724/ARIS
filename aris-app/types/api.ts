export type ConnectionState =
  | "not_connected"
  | "scanning"
  | "pairing"
  | "provisioning"
  | "connecting_wifi"
  | "discovering_api"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error";

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

export interface DeviceInfo {
  id: string;
  name: string;
  firmware_version: string;
  uptime_seconds: number;
}

export interface ForecastStatus {
  model_loaded: boolean;
  input_ready: boolean;
  hourly_samples: number;
  required_hourly_samples: number;
}

export interface DeviceStatus {
  timestamp: string;
  sensors: Record<string, SensorValue>;
  forecast_status: ForecastStatus;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
}

export interface HistoryResponse {
  metric: string;
  points: ForecastPoint[];
  from: string;
  to: string;
}

export interface ArisForecast {
  predicted_temperature_c: number;
  predicted_humidity_pct: number;
  current_temperature_c: number;
  current_humidity_pct: number;
  temp_change: number;
  humidity_change: number;
  forecast_horizon: string;
  model: string;
  training_samples: number;
  generated_at: string;
}

export interface ForecastResponse {
  metric: string;
  points: ForecastPoint[];
  model_version: string;
  generated_at: string;
  aris_forecast?: ArisForecast;
}

export interface AssistantQuery {
  text: string;
}

export interface AssistantResponse {
  answer: string;
  evidence: Array<{
    label: string;
    value: string;
    unit: string;
    timestamp?: string;
  }>;
  reasoning: string;
  caveats?: string[];
}

export interface WebSocketEvent {
  type: "sensor_update" | "forecast_update" | "status_change" | "alert";
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}
