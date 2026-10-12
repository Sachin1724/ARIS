import { BreakdownItem } from "./chatStorage";

const OWM_KEY = "3664d4b364d180ad8875724bf4772f24";

interface OwmForecastSlice {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  wind: {
    speed: number;
    deg?: number;
  };
  pop: number; // Probability of precipitation (0 to 1)
}

interface OwmForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: OwmForecastSlice[];
  city: {
    id: number;
    name: string;
    country: string;
    coord: {
      lat: number;
      lon: number;
    };
  };
}

export interface WeatherAssistantResult {
  answer: string;
  evidence: BreakdownItem[];
  locationName: string;
}

export const assistantWeatherService = {
  /**
   * Determines if the user's query asks for weather, forecast, rain, or climate for a location.
   */
  isLocationWeatherQuery(query: string): boolean {
    const q = query.toLowerCase();

    // Must be directly asking about weather — not just mentioning it in passing
    const weatherPatterns = [
      /weather\s+(in|at|for|near|tomorrow|today|tonight)/,
      /forecast\s+(in|at|for|near|tomorrow|today)/,
      /(will it|is it going to)\s+(rain|storm|be sunny|be hot|be cold)/,
      /^(rain|raining|rainy)\b/,
      /\b(temperature|humidity)\s+(in|at|for|tomorrow|today)/,
      /how.*(hot|cold|warm|humid).*(tomorrow|today|tonight|outside)/,
      /what.*(weather|temperature|forecast)/,
    ];

    const isWeatherQuestion = weatherPatterns.some((p) => p.test(q));
    if (!isWeatherQuestion) return false;

    const locationIndicators = [
      "chhend",
      "rourkela",
      "koel nagar",
      "civil township",
      "panposh",
      "delhi",
      "mumbai",
      "kolkata",
      "bhubaneswar",
      "area",
      "tomorrow",
      "tonight",
      "today",
      "morning",
      "evening",
      "weekend",
    ];

    return locationIndicators.some((term) => q.includes(term));
  },

  /**
   * Extracts location and time target from query, fetches live OpenWeatherMap forecast,
   * and crafts a conversational AI reply with structured rationale items.
   */
  async resolveLocationWeather(
    query: string,
    defaultCity = "Rourkela"
  ): Promise<WeatherAssistantResult | null> {
    const q = query.toLowerCase();

    // 1. Detect target location
    let locationTarget = defaultCity;
    if (q.includes("chhend")) {
      locationTarget = "Chhend";
    } else if (q.includes("koel nagar")) {
      locationTarget = "Koel Nagar";
    } else if (q.includes("civil township")) {
      locationTarget = "Civil Township";
    } else if (q.includes("panposh")) {
      locationTarget = "Panposh";
    } else if (q.includes("rourkela")) {
      locationTarget = "Rourkela";
    } else {
      // General regex search for "in <place>" or "at <place>" or "of <place> area"
      const match = query.match(/(?:in|at|of|for)\s+([a-zA-Z\s]+?)(?:\s+area|\s+tomorrow|\s+today|\s+tonight|\?|$)/i);
      if (match && match[1]?.trim()) {
        const candidate = match[1].trim();
        // Ignore non-locations like "weather", "tomorrow", "condition"
        if (!/^(the|weather|condition|tomorrow|today|my|our|air)$/i.test(candidate)) {
          locationTarget = candidate;
        }
      }
    }

    // 2. Detect target timeframe
    const isTomorrow = q.includes("tomorrow");
    const isToday = q.includes("today") || q.includes("tonight") || (!isTomorrow && !q.includes("weekend"));
    const timeframeLabel = isTomorrow ? "tomorrow" : isToday ? "today" : "in the coming days";

    // 3. Fetch from OpenWeatherMap Forecast API
    let forecastData: OwmForecastResponse | null = null;
    let resolvedCity = locationTarget;

    const queriesToTry = [
      `${locationTarget},IN`,
      `${locationTarget},Rourkela,IN`,
      `Rourkela,IN`,
    ];

    for (const locationQuery of queriesToTry) {
      try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
          locationQuery
        )}&units=metric&appid=${OWM_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as OwmForecastResponse;
          if (json.list && json.list.length > 0) {
            forecastData = json;
            resolvedCity = json.city?.name || locationTarget;
            break;
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    if (!forecastData || !forecastData.list || forecastData.list.length === 0) {
      return null;
    }

    // 4. Filter slices for target timeframe
    const now = new Date();
    const targetDate = new Date();
    if (isTomorrow) {
      targetDate.setDate(now.getDate() + 1);
    }
    const targetDateIso = targetDate.toISOString().slice(0, 10);

    let matchingSlices = forecastData.list.filter((slice) =>
      slice.dt_txt.startsWith(targetDateIso)
    );

    // If no exact slices match date boundaries (e.g. late evening query), take the next 8 slices (24 hours)
    if (matchingSlices.length === 0) {
      matchingSlices = isTomorrow
        ? forecastData.list.slice(4, 12)
        : forecastData.list.slice(0, 8);
    }

    if (matchingSlices.length === 0) {
      matchingSlices = forecastData.list.slice(0, 8);
    }

    // 5. Aggregate metrics
    const temps = matchingSlices.map((s) => s.main.temp);
    const minTemp = Math.round(Math.min(...temps));
    const maxTemp = Math.round(Math.max(...temps));
    const avgHumidity = Math.round(
      matchingSlices.reduce((acc, s) => acc + s.main.humidity, 0) / matchingSlices.length
    );
    const maxPop = Math.round(Math.max(...matchingSlices.map((s) => s.pop || 0)) * 100);
    const maxWind = Math.max(...matchingSlices.map((s) => s.wind.speed)).toFixed(1);

    // Dominant weather condition
    const midSlice = matchingSlices[Math.floor(matchingSlices.length / 2)] || matchingSlices[0];
    const conditionMain = midSlice.weather[0]?.main || "Clear";
    const conditionDesc = midSlice.weather[0]?.description || "clear sky";

    // 6. Synthesize natural conversational answer
    const locationDisplay =
      locationTarget.toLowerCase() === "chhend"
        ? "Chhend (Rourkela)"
        : locationTarget.toLowerCase() === "rourkela"
        ? "Rourkela"
        : `${locationTarget}`;

    let rainAssessment = "";
    if (maxPop === 0) {
      rainAssessment = "No rain expected (0% chance of precipitation).";
    } else if (maxPop < 25) {
      rainAssessment = `Minimal rain probability (${maxPop}% chance).`;
    } else if (maxPop < 60) {
      rainAssessment = `Moderate precipitation possibility (${maxPop}% chance of scattered showers).`;
    } else {
      rainAssessment = `Rain is likely (${maxPop}% chance of showers). Keep an umbrella handy.`;
    }

    let activityAdvice = "";
    if (maxPop < 30 && maxTemp <= 34) {
      activityAdvice = "Conditions are favorable for outdoor runs, workouts, and ventilation.";
    } else if (maxPop >= 50) {
      activityAdvice = "Consider indoor exercise or monitoring skies before heading outside.";
    } else {
      activityAdvice = "Stay hydrated during the warmer afternoon hours.";
    }

    const answer = `For ${timeframeLabel} in ${locationDisplay}, expect ${conditionDesc} conditions with temperatures ranging from ${minTemp}°C to a high of ${maxTemp}°C. Relative humidity will average around ${avgHumidity}%. ${rainAssessment} ${activityAdvice}`;

    // 7. Structured evidence items
    const evidence: BreakdownItem[] = [
      {
        icon: "location",
        iconBg: "rgba(56, 189, 248, 0.15)",
        iconColor: "#38BDF8",
        title: "Target Area",
        detail: `${locationDisplay} (OpenWeatherMap)`,
      },
      {
        icon: "thermometer",
        iconBg: "rgba(234, 179, 8, 0.15)",
        iconColor: "#EAB308",
        title: isTomorrow ? "Tomorrow's Temp" : "Forecast Temp",
        detail: `${minTemp}°C – ${maxTemp}°C expected`,
      },
      {
        icon: conditionMain.toLowerCase().includes("rain") ? "rainy" : "sunny",
        iconBg: "rgba(16, 185, 129, 0.15)",
        iconColor: "#10B981",
        title: "Sky Condition",
        detail: `${conditionDesc.charAt(0).toUpperCase() + conditionDesc.slice(1)}`,
      },
      {
        icon: "water",
        iconBg: "rgba(59, 130, 246, 0.15)",
        iconColor: "#3B82F6",
        title: "Rain Probability",
        detail: `${maxPop}% precipitation chance`,
      },
      {
        icon: "speedometer",
        iconBg: "rgba(168, 85, 247, 0.15)",
        iconColor: "#A855F7",
        title: "Humidity & Wind",
        detail: `${avgHumidity}% RH • ${maxWind} m/s wind`,
      },
    ];

    return {
      answer,
      evidence,
      locationName: locationDisplay,
    };
  },
};
