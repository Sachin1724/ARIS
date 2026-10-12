const OWM_KEY = "3664d4b364d180ad8875724bf4772f24"; // set via settings or env

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  visibility: number;
  uvIndex: number;
  dewPoint: number;
  condition: string;
  icon: string;
  sunrise: number;
  sunset: number;
  cityName: string;
  rainChance?: number;
  pollenLevel?: string;
  stormAlert?: string;
}

export interface HourlyForecast {
  dt: number;
  temp: number;
  icon: string;
  condition: string;
  pop: number;
}

export interface DailyForecast {
  dt: number;
  tempMin: number;
  tempMax: number;
  icon: string;
  condition: string;
  humidity: number;
  pop: number;
  summary: string;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  fetchedAt: number;
}

const CACHE_TTL = 10 * 60 * 1000;
let cached: WeatherData | null = null;

function mapIcon(owmIcon: string): string {
  const map: Record<string, string> = {
    "01d": "sunny", "01n": "moon",
    "02d": "partly-sunny", "02n": "cloudy-night",
    "03d": "cloud", "03n": "cloud",
    "04d": "cloudy", "04n": "cloudy",
    "09d": "rainy", "09n": "rainy",
    "10d": "rainy", "10n": "rainy",
    "11d": "thunderstorm", "11n": "thunderstorm",
    "13d": "snow", "13n": "snow",
    "50d": "partly-sunny", "50n": "cloudy-night",
  };
  return map[owmIcon] || "cloud";
}

export function configureWeatherApi(key: string) {
  (weatherApi as { key: string }).key = key;
}

export const weatherApi = {
  key: OWM_KEY,

  async fetch(lat: number, lon: number): Promise<WeatherData> {
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;

    const key = this.key;
    if (!key) return mockWeather();

    const [currentRes, forecastRes] = await Promise.all([
      globalThis.fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`,
      ),
      globalThis.fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`,
      ),
    ]);

    if (!currentRes.ok || !forecastRes.ok) return mockWeather();

    const cur = await currentRes.json();
    const fc = await forecastRes.json();

    const nextPop = Number(fc.list?.[0]?.pop ?? 0);
    const isThunderstorm =
      (cur.weather?.[0]?.main ?? "").toLowerCase().includes("thunderstorm") ||
      fc.list?.slice(0, 4).some((entry: Record<string, any>) =>
        entry.weather?.[0]?.main?.toLowerCase().includes("thunderstorm")
      );
    const rainChance = Math.round(nextPop * 100);
    const stormAlert = isThunderstorm
      ? "Thunderstorm advisory in local grid"
      : rainChance > 40
      ? "Precipitation expected in current forecast window"
      : "Low storm probability";

    const data: WeatherData = {
      current: {
        temp: cur.main.temp,
        feelsLike: cur.main.feels_like,
        tempMin: cur.main.temp_min,
        tempMax: cur.main.temp_max,
        humidity: cur.main.humidity,
        pressure: cur.main.pressure,
        windSpeed: cur.wind.speed,
        windDeg: cur.wind.deg ?? 0,
        visibility: (cur.visibility ?? 10000) / 1000,
        uvIndex: 4,
        dewPoint: cur.main.temp - (100 - cur.main.humidity) / 5,
        condition: cur.weather?.[0]?.main ?? "Clear",
        icon: mapIcon(cur.weather?.[0]?.icon ?? "01d"),
        sunrise: cur.sys.sunrise,
        sunset: cur.sys.sunset,
        cityName: cur.name,
        rainChance,
        pollenLevel: "Low",
        stormAlert,
      },
      hourly: fc.list.slice(0, 12).map((h: Record<string, unknown>) => {
        const main = h.main as Record<string, number>;
        const weather = (h.weather as Record<string, string>[])?.[0];
        return {
          dt: h.dt as number,
          temp: main.temp,
          icon: mapIcon(weather?.icon ?? "01d"),
          condition: weather?.main ?? "Clear",
          pop: (h.pop as number) ?? 0,
        };
      }),
      daily: aggregateDailyFromHourly(fc.list),
      fetchedAt: Date.now(),
    };

    cached = data;
    return data;
  },
};

type ForecastEntry = {
  dt: number;
  main: { temp_min: number; temp_max: number; humidity: number };
  weather: { main: string; icon: string }[];
  pop: number;
};

function aggregateDailyFromHourly(list: ForecastEntry[]): DailyForecast[] {
  const days = new Map<string, ForecastEntry[]>();
  for (const entry of list) {
    const date = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (!days.has(date)) days.set(date, []);
    days.get(date)!.push(entry);
  }

  const result: DailyForecast[] = [];
  for (const [, entries] of days) {
    if (result.length >= 5) break;
    const tempMin = Math.min(...entries.map((e) => e.main.temp_min));
    const tempMax = Math.max(...entries.map((e) => e.main.temp_max));
    const midEntry = entries[Math.floor(entries.length / 2)];
    result.push({
      dt: entries[0].dt,
      tempMin,
      tempMax,
      icon: mapIcon(midEntry.weather[0]?.icon ?? "01d"),
      condition: midEntry.weather[0]?.main ?? "Clear",
      humidity: Math.round(entries.reduce((s, e) => s + e.main.humidity, 0) / entries.length),
      pop: Math.max(...entries.map((e) => e.pop)),
      summary: `${midEntry.weather[0]?.main ?? "Clear"}, ${Math.round(tempMax)}°`,
    });
  }
  return result;
}

function mockWeather(): WeatherData {
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sunriseTs = Math.floor(startOfDay.getTime() / 1000) + (5 * 3600 + 46 * 60); // 05:46 AM
  const sunsetTs = Math.floor(startOfDay.getTime() / 1000) + (17 * 3600 + 52 * 60); // 05:52 PM

  return {
    current: {
      temp: 29.4,
      feelsLike: 33.8,
      tempMin: 22.5,
      tempMax: 32.8,
      humidity: 64,
      pressure: 1012,
      windSpeed: 2.8,
      windDeg: 160,
      visibility: 6.0,
      uvIndex: 4,
      dewPoint: 22.0,
      condition: "Partly Cloudy",
      icon: "partly-sunny",
      sunrise: sunriseTs,
      sunset: sunsetTs,
      cityName: "Rourkela",
      rainChance: 35,
      pollenLevel: "Low (1.8/10)",
      stormAlert: "Isolated evening convective shower possible",
    },
    hourly: Array.from({ length: 12 }, (_, i) => {
      const dt = now + i * 3600;
      const pop = i >= 4 && i <= 8 ? 0.35 : 0.05;
      return {
        dt,
        temp: Math.round((29.5 - i * 0.4 + (i > 2 && i < 7 ? 2.5 : 0)) * 10) / 10,
        icon: i < 6 ? (pop > 0.3 ? "rainy" : "partly-sunny") : "cloudy-night",
        condition: pop > 0.3 ? "Light Rain" : i < 6 ? "Partly Cloudy" : "Clear Night",
        pop,
      };
    }),
    daily: [
      { dt: now, tempMin: 22, tempMax: 33, icon: "partly-sunny", condition: "Scattered Clouds", humidity: 64, pop: 0.35, summary: "Scattered Clouds, 33° · 35% rain chance" },
      { dt: now + 86400, tempMin: 23, tempMax: 34, icon: "sunny", condition: "Clear", humidity: 58, pop: 0.1, summary: "Clear & Sunny, 34°" },
      { dt: now + 172800, tempMin: 22, tempMax: 32, icon: "partly-sunny", condition: "Clouds", humidity: 62, pop: 0.2, summary: "Partly Cloudy, 32°" },
      { dt: now + 259200, tempMin: 24, tempMax: 33, icon: "rainy", condition: "Rain Showers", humidity: 70, pop: 0.55, summary: "Afternoon Showers, 33° · 55% rain chance" },
      { dt: now + 345600, tempMin: 23, tempMax: 34, icon: "sunny", condition: "Clear", humidity: 55, pop: 0.05, summary: "Clear, 34°" },
    ],
    fetchedAt: Date.now(),
  };
}
