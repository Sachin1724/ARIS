import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Mascot } from "page-mascot";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { useWeather } from "../../hooks/useWeather";
import { usePreferences } from "../../context/PreferencesContext";
import { apiClient } from "../../services/api-client";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface IndoorHourlyPoint {
  timestamp: string;
  value: number;
  unit: string;
}

function formatHourLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", hour12: true });
}

interface DayData {
  label: string;
  date: string;
  tempC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  condition: string;
  symbolIcon: keyof typeof Ionicons.glyphMap;
  uvIndex: number;
  humidityPct: number;
  windKmH: number;
  pressureHPa: number;
  rainMm: number;
  hourly: {
    time: string;
    tempC: number;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
  }[];
  timeline: {
    period: string;
    hours: string;
    title: string;
    desc: string;
    detailedEvidence: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
    badgeLabel: string;
  }[];
  adviceTitle: string;
  adviceBody: string;
}

const daySchedules: Record<string, DayData> = {
  Today: {
    label: "Today",
    date: "10 Oct",
    tempC: 29.6,
    feelsLikeC: 32.0,
    highC: 31.0,
    lowC: 24.0,
    condition: "Partly Cloudy",
    symbolIcon: "partly-sunny-outline",
    uvIndex: 4,
    humidityPct: 66,
    windKmH: 12,
    pressureHPa: 990,
    rainMm: 0,
    hourly: [
      { time: "Now", tempC: 29.6, icon: "sunny", iconColor: "#F59E0B" },
      { time: "11 AM", tempC: 30.5, icon: "partly-sunny", iconColor: "#F59E0B" },
      { time: "2 PM", tempC: 31.2, icon: "sunny", iconColor: "#F59E0B" },
      { time: "5 PM", tempC: 30.0, icon: "partly-sunny", iconColor: "#F59E0B" },
      { time: "8 PM", tempC: 27.2, icon: "cloudy-night", iconColor: "#38BDF8" },
    ],
    timeline: [
      { period: "Morning", hours: "7–10 AM", title: "Good air quality", desc: "Optimal for running, walking, and ventilation.", detailedEvidence: "SPS30 baseline: PM2.5 14 µg/m³. Light wind aids dispersion.", color: colors.statusGood, icon: "walk", badgeLabel: "Good" },
      { period: "Afternoon", hours: "11 AM–4 PM", title: "Moderate (rising)", desc: "Particulate buildup during traffic peak.", detailedEvidence: "SPS30 projected: PM2.5 28–36 µg/m³.", color: colors.statusModerate, icon: "bicycle", badgeLabel: "Moderate" },
      { period: "Evening", hours: "5–8 PM", title: "Sensitive groups caution", desc: "Thermal inversion may trap fine aerosols.", detailedEvidence: "Peak: PM2.5 ~42 µg/m³. Limit strenuous outdoor activity.", color: colors.statusUnhealthy, icon: "car", badgeLabel: "Unhealthy" },
      { period: "Night", hours: "After 8 PM", title: "Improving", desc: "Particulate settling and clearance overnight.", detailedEvidence: "PM2.5 dropping below 22 µg/m³. Safe for night cooling.", color: colors.info, icon: "moon", badgeLabel: "Improving" },
    ],
    adviceTitle: "Best time to go out",
    adviceBody: "Early morning before 10 AM or after 8 PM.",
  },
  Sat: {
    label: "Sat",
    date: "11 Oct",
    tempC: 32.1,
    feelsLikeC: 34.5,
    highC: 33.0,
    lowC: 23.0,
    condition: "Clear Sky",
    symbolIcon: "sunny-outline",
    uvIndex: 6,
    humidityPct: 58,
    windKmH: 14,
    pressureHPa: 992,
    rainMm: 0,
    hourly: [
      { time: "08:00", tempC: 26.0, icon: "sunny", iconColor: "#F59E0B" },
      { time: "11:00", tempC: 31.0, icon: "sunny", iconColor: "#F59E0B" },
      { time: "14:00", tempC: 32.5, icon: "sunny", iconColor: "#F59E0B" },
      { time: "17:00", tempC: 30.5, icon: "sunny", iconColor: "#F59E0B" },
      { time: "20:00", tempC: 27.0, icon: "moon", iconColor: "#38BDF8" },
    ],
    timeline: [
      { period: "Morning", hours: "7–10 AM", title: "Clean air & cool breeze", desc: "High wind allows thorough ventilation.", detailedEvidence: "PM2.5 12 µg/m³. Clean outdoor inflow.", color: colors.statusGood, icon: "walk", badgeLabel: "Good" },
      { period: "Afternoon", hours: "11 AM–4 PM", title: "High UV radiation", desc: "Wear sun protection; air quality moderate.", detailedEvidence: "UV Index 6. PM ~24 µg/m³.", color: colors.statusModerate, icon: "sunny", badgeLabel: "High UV" },
      { period: "Evening", hours: "5–8 PM", title: "Pleasant outdoor weather", desc: "Mild conditions for walks and light sports.", detailedEvidence: "PM2.5 22 µg/m³. Minimal stagnation.", color: colors.statusGood, icon: "bicycle", badgeLabel: "Good" },
      { period: "Night", hours: "After 8 PM", title: "Stable night air", desc: "Comfortable for restful sleep with open airflow.", detailedEvidence: "PM2.5 16 µg/m³.", color: colors.info, icon: "moon", badgeLabel: "Optimal" },
    ],
    adviceTitle: "Weekend Activity Tip",
    adviceBody: "Clear skies all day. Plan outdoor sports before noon.",
  },
  Sun: {
    label: "Sun",
    date: "12 Oct",
    tempC: 30.0,
    feelsLikeC: 32.8,
    highC: 30.5,
    lowC: 24.0,
    condition: "Scattered Clouds",
    symbolIcon: "cloud-outline",
    uvIndex: 4,
    humidityPct: 70,
    windKmH: 10,
    pressureHPa: 989,
    rainMm: 0,
    hourly: [
      { time: "08:00", tempC: 25.5, icon: "cloudy", iconColor: "#8B928A" },
      { time: "11:00", tempC: 28.5, icon: "partly-sunny", iconColor: "#F59E0B" },
      { time: "14:00", tempC: 30.2, icon: "cloudy", iconColor: "#8B928A" },
      { time: "17:00", tempC: 28.8, icon: "partly-sunny", iconColor: "#F59E0B" },
      { time: "20:00", tempC: 26.4, icon: "cloudy-night", iconColor: "#38BDF8" },
    ],
    timeline: [
      { period: "Morning", hours: "7–10 AM", title: "Good air, light cloud cover", desc: "Ideal for distance workouts.", detailedEvidence: "PM2.5 18 µg/m³. Moderate humidity 70%.", color: colors.statusGood, icon: "walk", badgeLabel: "Good" },
      { period: "Afternoon", hours: "11 AM–4 PM", title: "Moderate humidity", desc: "Occasional particulate accumulation.", detailedEvidence: "PM2.5 32 µg/m³. Light localized haze possible.", color: colors.statusModerate, icon: "bicycle", badgeLabel: "Moderate" },
      { period: "Evening", hours: "5–8 PM", title: "Cool breeze setting in", desc: "Airflow increases; conditions comfortable.", detailedEvidence: "Wind 10 km/h aiding dispersion.", color: colors.statusGood, icon: "walk", badgeLabel: "Comfortable" },
      { period: "Night", hours: "After 8 PM", title: "Mild overcast night", desc: "Stable baseline particulate.", detailedEvidence: "PM2.5 steady at 20 µg/m³.", color: colors.info, icon: "moon", badgeLabel: "Stable" },
    ],
    adviceTitle: "Sunday Outdoor Window",
    adviceBody: "Overcast morning is favorable for cycling.",
  },
  Mon: {
    label: "Mon",
    date: "13 Oct",
    tempC: 28.8,
    feelsLikeC: 30.2,
    highC: 29.5,
    lowC: 22.0,
    condition: "Light Breeze",
    symbolIcon: "leaf-outline",
    uvIndex: 3,
    humidityPct: 62,
    windKmH: 16,
    pressureHPa: 994,
    rainMm: 0,
    hourly: [
      { time: "08:00", tempC: 24.0, icon: "sunny", iconColor: "#F59E0B" },
      { time: "11:00", tempC: 27.5, icon: "sunny", iconColor: "#F59E0B" },
      { time: "14:00", tempC: 29.0, icon: "sunny", iconColor: "#F59E0B" },
      { time: "17:00", tempC: 27.5, icon: "partly-sunny", iconColor: "#F59E0B" },
      { time: "20:00", tempC: 25.0, icon: "moon", iconColor: "#38BDF8" },
    ],
    timeline: [
      { period: "Morning", hours: "7–10 AM", title: "Prime air for commute", desc: "Strong breeze provides exceptional clearance.", detailedEvidence: "PM2.5 11 µg/m³. Cleanest window of the week.", color: colors.statusGood, icon: "walk", badgeLabel: "Good" },
      { period: "Afternoon", hours: "11 AM–4 PM", title: "Moderate during traffic", desc: "Slight uptick near transit routes.", detailedEvidence: "PM2.5 26 µg/m³. Within national standards.", color: colors.statusModerate, icon: "car", badgeLabel: "Moderate" },
      { period: "Evening", hours: "5–8 PM", title: "Clean evening air", desc: "Sustained wind prevents stagnation.", detailedEvidence: "Wind 16 km/h. PM2.5 19 µg/m³.", color: colors.statusGood, icon: "bicycle", badgeLabel: "Good" },
      { period: "Night", hours: "After 8 PM", title: "Crisp night air", desc: "High atmospheric transparency.", detailedEvidence: "PM2.5 14 µg/m³. Excellent ventilation window.", color: colors.info, icon: "moon", badgeLabel: "Clean" },
    ],
    adviceTitle: "Weekly Forecast Note",
    adviceBody: "Monday has cleanest air of the week due to high wind.",
  },
};

const days = [
  { label: "Today", date: "10 Oct" },
  { label: "Sat", date: "11 Oct" },
  { label: "Sun", date: "12 Oct" },
  { label: "Mon", date: "13 Oct" },
];

const fiveDayForecast = [
  { day: "Today", date: "10 Oct", tempC: 29.6, aqi: "Moderate", aqiColor: colors.statusModerate, icon: "partly-sunny-outline" as const },
  { day: "Sat", date: "11 Oct", tempC: 32.1, aqi: "Good", aqiColor: colors.statusGood, icon: "sunny-outline" as const },
  { day: "Sun", date: "12 Oct", tempC: 30.0, aqi: "Moderate", aqiColor: colors.statusModerate, icon: "cloud-outline" as const },
  { day: "Mon", date: "13 Oct", tempC: 28.8, aqi: "Good", aqiColor: colors.statusGood, icon: "leaf-outline" as const },
  { day: "Tue", date: "14 Oct", tempC: 31.0, aqi: "Moderate", aqiColor: colors.statusModerate, icon: "sunny-outline" as const },
];

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { refresh: refreshDevice, status: deviceStatus } = useDeviceStatus();
  const { refresh: refreshWeather } = useWeather();
  const { formatTemp } = usePreferences();
  const [mode, setMode] = useState<"indoor" | "outdoor">(
    params.mode === "outdoor" ? "outdoor" : "indoor",
  );
  const [selectedDay, setSelectedDay] = useState("Today");
  const [showNext5Days, setShowNext5Days] = useState(false);
  const [expandedSlotIndex, setExpandedSlotIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [indoorTemp, setIndoorTemp] = useState<IndoorHourlyPoint[]>([]);
  const [indoorHumidity, setIndoorHumidity] = useState<IndoorHourlyPoint[]>([]);
  const [indoorPressure, setIndoorPressure] = useState<IndoorHourlyPoint[]>([]);
  const [indoorLoading, setIndoorLoading] = useState(false);

  const fetchIndoorHistory = useCallback(async () => {
    if (!apiClient.isConfigured) return;
    setIndoorLoading(true);
    try {
      const [tempRes, humRes, pressRes] = await Promise.all([
        apiClient.history("temperature_c", 24),
        apiClient.history("humidity_pct", 24),
        apiClient.history("pressure_hpa", 24),
      ]);
      setIndoorTemp(tempRes.points.map((p) => ({ timestamp: p.timestamp, value: p.value ?? 0, unit: p.unit })));
      setIndoorHumidity(humRes.points.map((p) => ({ timestamp: p.timestamp, value: p.value ?? 0, unit: p.unit })));
      setIndoorPressure(pressRes.points.map((p) => ({ timestamp: p.timestamp, value: p.value ?? 0, unit: p.unit })));
    } catch {
      // keep stale data
    } finally {
      setIndoorLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "indoor") fetchIndoorHistory();
  }, [mode, fetchIndoorHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (mode === "indoor") {
        await Promise.allSettled([refreshDevice(), fetchIndoorHistory()]);
      } else {
        await Promise.allSettled([refreshDevice(), refreshWeather()]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshDevice, refreshWeather, fetchIndoorHistory, mode]);

  const day = useMemo(() => daySchedules[selectedDay] || daySchedules.Today, [selectedDay]);

  const currentTemp = deviceStatus?.sensors?.temperature_c?.value ?? null;
  const currentHumidity = deviceStatus?.sensors?.humidity_pct?.value ?? null;
  const currentPm25 = deviceStatus?.sensors?.pm25?.value ?? null;
  const currentPressure = deviceStatus?.sensors?.pressure_hpa?.value ?? null;

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header + mode toggle */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Your Day</Text>
          <View style={s.modeToggle}>
            <Pressable
              style={[s.modeChip, mode === "indoor" && s.modeChipActive]}
              onPress={() => setMode("indoor")}
              accessibilityRole="button"
            >
              <Ionicons name="home-outline" size={14} color={mode === "indoor" ? colors.background : colors.secondaryText} />
              <Text style={[s.modeChipText, mode === "indoor" && s.modeChipTextActive]}>Room</Text>
            </Pressable>
            <Pressable
              style={[s.modeChip, mode === "outdoor" && s.modeChipActive]}
              onPress={() => setMode("outdoor")}
              accessibilityRole="button"
            >
              <Ionicons name="leaf-outline" size={14} color={mode === "outdoor" ? colors.background : colors.secondaryText} />
              <Text style={[s.modeChipText, mode === "outdoor" && s.modeChipTextActive]}>Outdoor</Text>
            </Pressable>
          </View>
        </View>

        {mode === "indoor" ? (
          <>
            {/* Indoor current readings */}
            <View style={s.card}>
              <Text style={s.sectionLabel}>Right Now</Text>
              <View style={s.indoorCurrentRow}>
                <View style={s.indoorCurrentItem}>
                  <Ionicons name="thermometer-outline" size={20} color={colors.accent} />
                  <Text style={s.indoorCurrentValue}>
                    {currentTemp != null ? formatTemp(currentTemp) : "--"}
                  </Text>
                  <Text style={s.indoorCurrentLabel}>Temperature</Text>
                </View>
                <View style={s.indoorCurrentItem}>
                  <Ionicons name="water-outline" size={20} color="#38BDF8" />
                  <Text style={s.indoorCurrentValue}>
                    {currentHumidity != null ? `${Math.round(currentHumidity)}%` : "--"}
                  </Text>
                  <Text style={s.indoorCurrentLabel}>Humidity</Text>
                </View>
                <View style={s.indoorCurrentItem}>
                  <Ionicons name="speedometer-outline" size={20} color="#A78BFA" />
                  <Text style={s.indoorCurrentValue}>
                    {currentPressure != null ? (currentPressure / 10).toFixed(1) : "--"}
                  </Text>
                  <Text style={s.indoorCurrentLabel}>kPa</Text>
                </View>
              </View>
            </View>

            {/* Temperature 24h */}
            <View style={s.card}>
              <View style={s.metricHeader}>
                <Ionicons name="thermometer-outline" size={16} color={colors.accent} />
                <Text style={s.sectionLabel}>Temperature</Text>
              </View>
              {indoorLoading ? (
                <ActivityIndicator color={colors.accent} style={{ paddingVertical: 16 }} />
              ) : indoorTemp.length === 0 ? (
                <Text style={s.indoorEmpty}>No data yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.indoorHourlyStrip}>
                    {indoorTemp.map((pt) => (
                      <View key={pt.timestamp} style={s.indoorHourlyItem}>
                        <Text style={s.indoorHourlyTime}>{formatHourLabel(pt.timestamp)}</Text>
                        <Text style={s.indoorHourlyTemp}>{formatTemp(pt.value)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Humidity 24h */}
            <View style={s.card}>
              <View style={s.metricHeader}>
                <Ionicons name="water-outline" size={16} color="#38BDF8" />
                <Text style={s.sectionLabel}>Humidity</Text>
              </View>
              {indoorLoading ? (
                <ActivityIndicator color="#38BDF8" style={{ paddingVertical: 16 }} />
              ) : indoorHumidity.length === 0 ? (
                <Text style={s.indoorEmpty}>No data yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.indoorHourlyStrip}>
                    {indoorHumidity.map((pt) => (
                      <View key={pt.timestamp} style={s.indoorHourlyItem}>
                        <Text style={s.indoorHourlyTime}>{formatHourLabel(pt.timestamp)}</Text>
                        <Text style={[s.indoorHourlyTemp, { color: "#38BDF8" }]}>{Math.round(pt.value)}%</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Pressure 24h */}
            <View style={s.card}>
              <View style={s.metricHeader}>
                <Ionicons name="speedometer-outline" size={16} color="#A78BFA" />
                <Text style={s.sectionLabel}>Pressure</Text>
              </View>
              {indoorLoading ? (
                <ActivityIndicator color="#A78BFA" style={{ paddingVertical: 16 }} />
              ) : indoorPressure.length === 0 ? (
                <Text style={s.indoorEmpty}>No data yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.indoorHourlyStrip}>
                    {indoorPressure.map((pt) => (
                      <View key={pt.timestamp} style={s.indoorHourlyItem}>
                        <Text style={s.indoorHourlyTime}>{formatHourLabel(pt.timestamp)}</Text>
                        <Text style={[s.indoorHourlyTemp, { color: "#A78BFA" }]}>{(pt.value / 10).toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Mascot advice for indoor */}
            <View style={s.card}>
              <View style={s.adviceRow}>
                <Mascot state="advice" mood="alert" size={56} />
                <View style={s.adviceText}>
                  <Text style={s.adviceTitle}>Room Conditions</Text>
                  <Text style={s.adviceBody}>
                    {currentTemp != null && currentHumidity != null
                      ? currentTemp > 30
                        ? "Room is warm. Open windows or turn on a fan."
                        : currentHumidity > 70
                          ? "Humidity is high. Ventilate to reduce moisture."
                          : "Conditions look comfortable right now."
                      : "Connect to UNO Q to see room conditions."}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Day selector */}
            <View style={s.dayRow}>
              {days.map((d) => {
                const active = selectedDay === d.label;
                return (
                  <Pressable
                    key={d.label}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => { setSelectedDay(d.label); setExpandedSlotIndex(null); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.label}, ${d.date}`}
                  >
                    <Text style={[s.dayChipLabel, active && s.dayChipLabelActive]}>{d.label}</Text>
                    <Text style={[s.dayChipDate, active && s.dayChipDateActive]}>{d.date}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Weather card */}
            <View style={s.card}>
              <View style={s.weatherTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.bigTemp}>{formatTemp(day.tempC)}</Text>
                  <Text style={s.condition}>{day.condition}</Text>
                  <Text style={s.feelsLike}>
                    Feels {formatTemp(day.feelsLikeC)} · H {formatTemp(day.highC)} L {formatTemp(day.lowC)}
                  </Text>
                </View>
                <View style={s.weatherIcon}>
                  <Ionicons name={day.symbolIcon} size={32} color="#F59E0B" />
                  <Text style={s.uvText}>UV {day.uvIndex}</Text>
                </View>
              </View>

              {/* Stats bento: 2x2 */}
              <View style={s.bentoGrid}>
                <View style={s.bentoCell}>
                  <Ionicons name="water-outline" size={16} color="#38BDF8" />
                  <Text style={s.bentoCellValue}>{day.humidityPct}%</Text>
                  <Text style={s.bentoCellLabel}>Humidity</Text>
                </View>
                <View style={s.bentoCell}>
                  <Ionicons name="navigate-outline" size={16} color="#38BDF8" />
                  <Text style={s.bentoCellValue}>{day.windKmH} km/h</Text>
                  <Text style={s.bentoCellLabel}>Wind</Text>
                </View>
                <View style={s.bentoCell}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.accent} />
                  <Text style={s.bentoCellValue}>{day.pressureHPa}</Text>
                  <Text style={s.bentoCellLabel}>hPa</Text>
                </View>
                <View style={s.bentoCell}>
                  <Ionicons name="rainy-outline" size={16} color="#38BDF8" />
                  <Text style={s.bentoCellValue}>{day.rainMm} mm</Text>
                  <Text style={s.bentoCellLabel}>Rain</Text>
                </View>
              </View>

              {/* Hourly strip */}
              <View style={s.hourlyRow}>
                {day.hourly.map((h, i) => (
                  <View key={i} style={s.hourlyItem}>
                    <Text style={s.hourlyTime}>{h.time}</Text>
                    <Ionicons name={h.icon} size={18} color={h.iconColor} style={{ marginVertical: 4 }} />
                    <Text style={s.hourlyTemp}>{formatTemp(h.tempC)}</Text>
                  </View>
                ))}
              </View>

              {/* 5-day toggle */}
              <Pressable
                style={s.expandRow}
                onPress={() => setShowNext5Days(!showNext5Days)}
                accessibilityRole="button"
                accessibilityLabel="Toggle 5-day forecast"
              >
                <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                <Text style={s.expandRowText}>5-Day Forecast</Text>
                <Ionicons name={showNext5Days ? "chevron-up" : "chevron-forward"} size={14} color={colors.secondaryText} />
              </Pressable>

              {showNext5Days && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {fiveDayForecast.map((item) => (
                    <Pressable
                      key={item.day}
                      style={s.fiveDayRow}
                      onPress={() => { if (daySchedules[item.day]) setSelectedDay(item.day); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.day}`}
                    >
                      <Ionicons name={item.icon} size={16} color={item.aqiColor} />
                      <Text style={s.fiveDayDay}>{item.day}</Text>
                      <Text style={s.fiveDayDate}>{item.date}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={s.fiveDayTemp}>{formatTemp(item.tempC)}</Text>
                      <Text style={[s.fiveDayAqi, { color: item.aqiColor }]}>{item.aqi}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Timeline card */}
            <View style={s.card}>
              <Text style={s.sectionLabel}>Activity Schedule</Text>
              {day.timeline.map((slot, index) => {
                const isExpanded = expandedSlotIndex === index;
                const isLast = index === day.timeline.length - 1;
                return (
                  <Pressable
                    key={slot.period}
                    style={s.timelineRow}
                    onPress={() => setExpandedSlotIndex(isExpanded ? null : index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${slot.period}, ${slot.title}`}
                  >
                    <View style={s.trackCol}>
                      <View style={[s.trackDot, { backgroundColor: slot.color }]} />
                      {!isLast && <View style={s.trackLine} />}
                    </View>
                    <View style={s.slotContent}>
                      <View style={s.slotHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.slotPeriod}>{slot.period}</Text>
                          <Text style={s.slotHours}>{slot.hours}</Text>
                        </View>
                        <Text style={[s.slotBadge, { color: slot.color }]}>{slot.badgeLabel}</Text>
                      </View>
                      <Text style={s.slotTitle}>{slot.title}</Text>
                      <Text style={s.slotDesc}>{slot.desc}</Text>
                      {isExpanded && (
                        <View style={s.evidenceBox}>
                          <Ionicons name="hardware-chip-outline" size={12} color={colors.accent} />
                          <Text style={s.evidenceText}>{slot.detailedEvidence}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Mascot advice */}
            <View style={s.card}>
              <View style={s.adviceRow}>
                <Mascot state="advice" mood="alert" size={56} />
                <View style={s.adviceText}>
                  <Text style={s.adviceTitle}>{day.adviceTitle}</Text>
                  <Text style={s.adviceBody}>{day.adviceBody}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 12 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontFamily: typography.fontFamilies.bold, fontSize: 22, color: colors.primaryText },

  modeToggle: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  modeChipActive: { backgroundColor: colors.accent },
  modeChipText: { fontFamily: typography.fontFamilies.semiBold, fontSize: 12, color: colors.secondaryText },
  modeChipTextActive: { color: colors.background },

  indoorCurrentRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 8 },
  indoorCurrentItem: { alignItems: "center", gap: 4 },
  indoorCurrentValue: { fontFamily: typography.fontFamilies.bold, fontSize: 22, color: colors.primaryText },
  indoorCurrentLabel: { fontFamily: typography.fontFamilies.regular, fontSize: 11, color: colors.secondaryText },

  metricHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  indoorEmpty: { fontFamily: typography.fontFamilies.regular, fontSize: 13, color: colors.secondaryText, textAlign: "center", paddingVertical: 20 },
  indoorHourlyStrip: { flexDirection: "row", gap: 16, paddingVertical: 4 },
  indoorHourlyItem: { alignItems: "center", minWidth: 52 },
  indoorHourlyTime: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: colors.secondaryText },
  indoorHourlyTemp: { fontFamily: typography.fontFamilies.semiBold, fontSize: 13, color: colors.primaryText },
  indoorHourlyHum: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: "#38BDF8" },

  dayRow: { flexDirection: "row", gap: 8 },
  dayChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.card, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  dayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayChipLabel: { fontFamily: typography.fontFamilies.semiBold, fontSize: 13, color: colors.primaryText },
  dayChipLabelActive: { color: colors.background },
  dayChipDate: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: colors.secondaryText, marginTop: 1 },
  dayChipDateActive: { color: "rgba(13, 17, 14, 0.7)" },

  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 },

  weatherTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  bigTemp: { fontFamily: typography.fontFamilies.bold, fontSize: 36, color: colors.primaryText, lineHeight: 40 },
  condition: { fontFamily: typography.fontFamilies.semiBold, fontSize: 14, color: colors.primaryText, marginTop: 2 },
  feelsLike: { fontFamily: typography.fontFamilies.regular, fontSize: 12, color: colors.secondaryText, marginTop: 4 },
  weatherIcon: { width: 80, height: 72, borderRadius: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  uvText: { fontFamily: typography.fontFamilies.medium, fontSize: 10, color: colors.secondaryText, marginTop: 4 },

  bentoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  bentoCell: { width: "48%" as unknown as number, backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.borderLight, gap: 4, flexGrow: 1, flexBasis: "46%" },
  bentoCellValue: { fontFamily: typography.fontFamilies.semiBold, fontSize: 14, color: colors.primaryText },
  bentoCellLabel: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: colors.secondaryText },

  hourlyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  hourlyItem: { alignItems: "center", flex: 1 },
  hourlyTime: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: colors.secondaryText },
  hourlyTemp: { fontFamily: typography.fontFamilies.semiBold, fontSize: 12, color: colors.primaryText },

  expandRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  expandRowText: { flex: 1, fontFamily: typography.fontFamilies.semiBold, fontSize: 13, color: colors.primaryText },

  fiveDayRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  fiveDayDay: { fontFamily: typography.fontFamilies.semiBold, fontSize: 12, color: colors.primaryText },
  fiveDayDate: { fontFamily: typography.fontFamilies.regular, fontSize: 10, color: colors.secondaryText },
  fiveDayTemp: { fontFamily: typography.fontFamilies.medium, fontSize: 12, color: colors.primaryText, marginRight: 8 },
  fiveDayAqi: { fontFamily: typography.fontFamilies.semiBold, fontSize: 10 },

  sectionLabel: { fontFamily: typography.fontFamilies.semiBold, fontSize: 13, color: colors.secondaryText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },

  timelineRow: { flexDirection: "row", alignItems: "flex-start" },
  trackCol: { alignItems: "center", width: 20, marginRight: 12 },
  trackDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  trackLine: { width: 2, flex: 1, backgroundColor: colors.borderLight, marginVertical: 4, minHeight: 40 },
  slotContent: { flex: 1, paddingBottom: 14 },
  slotHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotPeriod: { fontFamily: typography.fontFamilies.semiBold, fontSize: 13, color: colors.primaryText },
  slotHours: { fontFamily: typography.fontFamilies.regular, fontSize: 11, color: colors.secondaryText },
  slotBadge: { fontFamily: typography.fontFamilies.semiBold, fontSize: 11 },
  slotTitle: { fontFamily: typography.fontFamilies.medium, fontSize: 13, color: colors.primaryText, marginTop: 2 },
  slotDesc: { fontFamily: typography.fontFamilies.regular, fontSize: 12, color: colors.secondaryText, marginTop: 2, lineHeight: 17 },
  evidenceBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8, backgroundColor: colors.surfaceMuted, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.borderLight },
  evidenceText: { fontFamily: typography.fontFamilies.regular, fontSize: 11, color: colors.secondaryText, flex: 1, lineHeight: 15 },

  adviceRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  adviceText: { flex: 1 },
  adviceTitle: { fontFamily: typography.fontFamilies.semiBold, fontSize: 14, color: colors.primaryText },
  adviceBody: { fontFamily: typography.fontFamilies.regular, fontSize: 12, color: colors.secondaryText, marginTop: 2, lineHeight: 17 },
});
