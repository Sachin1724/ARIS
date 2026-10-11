import type {
  DeviceStatus,
  HealthResponse,
  DeviceInfo,
  ForecastResponse,
  HistoryResponse,
  AssistantResponse,
  ForecastPoint,
} from "../types/api";

const now = () => new Date().toISOString();

export const mockHealth: HealthResponse = {
  status: "ok",
  timestamp: now(),
  version: "0.1.0",
};

export const mockDevice: DeviceInfo = {
  id: "ARIS-UNO-Q-DEMO",
  name: "UNO Q (Demo)",
  firmware_version: "0.1.0-demo",
  uptime_seconds: 3600,
};

export const mockStatus: DeviceStatus = {
  timestamp: now(),
  sensors: {
    temperature_c: { value: 29.57, unit: "°C", valid: true, calibrated: true },
    humidity_pct: { value: 66.45, unit: "%", valid: true, calibrated: true },
    mq135_adc: { value: 422, unit: "ADC", valid: true, calibrated: false },
    mg811_voltage_v: { value: 0.342, unit: "V", valid: true, calibrated: false },
  },
  forecast_status: {
    model_loaded: false,
    input_ready: false,
    hourly_samples: 2,
    required_hourly_samples: 24,
  },
};

export function mockHistory(metric: string, hours: number): HistoryResponse {
  const points: ForecastPoint[] = [];
  const end = Date.now();
  const start = end - hours * 3600 * 1000;
  const step = (hours * 3600 * 1000) / 24;

  for (let t = start; t <= end; t += step) {
    const base = metric === "temperature_c" ? 28 : metric === "humidity_pct" ? 60 : 400;
    const noise = (Math.random() - 0.5) * 4;
    points.push({
      timestamp: new Date(t).toISOString(),
      value: Math.round((base + noise) * 100) / 100,
      unit: metric === "temperature_c" ? "°C" : metric === "humidity_pct" ? "%" : "ADC",
      kind: "observed",
    });
  }

  return {
    metric,
    points,
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
  };
}

export const mockForecast: ForecastResponse = {
  metric: "temperature_c",
  points: [],
  model_version: "not_loaded",
  generated_at: now(),
};

export function mockAssistantResponse(question: string): AssistantResponse {
  return {
    answer:
      "This is demo mode. Connect your UNO Q device to get real answers based on measured data and deterministic rules.",
    evidence: [
      { label: "Temperature", value: "29.6", unit: "°C", timestamp: now() },
      { label: "Humidity", value: "66.5", unit: "%" },
    ],
    reasoning:
      "Demo data only. Real answers come from the device's deterministic pipeline, not generated text.",
    caveats: [
      "These are simulated values for demonstration",
      "Gas sensor readings are uncalibrated",
    ],
  };
}
