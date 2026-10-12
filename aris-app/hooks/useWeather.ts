import { useState, useEffect, useCallback } from "react";
import { weatherApi, type WeatherData } from "../services/weather-api";

const ROURKELA_LAT = 22.2604;
const ROURKELA_LON = 84.8536;

export function useWeather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await weatherApi.fetch(ROURKELA_LAT, ROURKELA_LON);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { weather: data, loading, refresh };
}
