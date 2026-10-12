import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Mascot } from "page-mascot";
import ConnectionBanner from "../../components/ConnectionBanner";
import StaleIndicator from "../../components/StaleIndicator";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { useConnection } from "../../hooks/useConnection";
import { usePreferences } from "../../context/PreferencesContext";
import { useWeather } from "../../hooks/useWeather";
import { useForecast } from "../../hooks/useForecast";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { apiClient } from "../../services/api-client";
import { wsManager } from "../../services/websocket-manager";

function minutesAgo(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 60000);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function aqiFromPm25(pm25: number) {
  if (pm25 <= 12.0) return { label: "Good", color: colors.statusGood, level: 0 };
  if (pm25 <= 35.4) return { label: "Moderate", color: colors.statusModerate, level: 1 };
  if (pm25 <= 55.4) return { label: "Sensitive", color: colors.statusSensitive, level: 2 };
  return { label: "Unhealthy", color: colors.statusUnhealthy, level: 3 };
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatHour(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", hour12: true });
}

function formatDay(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short" });
}

function weatherIcon(name: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    sunny: "sunny-outline",
    moon: "moon-outline",
    "partly-sunny": "partly-sunny-outline",
    "cloudy-night": "cloudy-night-outline",
    cloud: "cloud-outline",
    cloudy: "cloudy-outline",
    rainy: "rainy-outline",
    thunderstorm: "thunderstorm-outline",
    snow: "snow-outline",
  };
  return map[name] || "cloud-outline";
}

function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function HomeScreen() {
  const router = useRouter();
  const { status, loading, error, stale, lastUpdated, refresh } =
    useDeviceStatus();
  const connection = useConnection();
  const { formatTemp, station } = usePreferences();
  const { weather, refresh: refreshWeather } = useWeather();
  const { data: localForecast, fetch: fetchLocalForecast } = useForecast();

  const [showStationModal, setShowStationModal] = useState(false);
  const [expandAdvisory, setExpandAdvisory] = useState(false);
  const [viewMode, setViewMode] = useState<"indoor" | "outdoor">("indoor");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLocalForecast("temperature_c");
  }, [fetchLocalForecast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refresh(),
        refreshWeather(),
        fetchLocalForecast("temperature_c"),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshWeather, fetchLocalForecast]);

  const staleMinutes = stale && lastUpdated ? minutesAgo(lastUpdated) : null;

  if (loading && !status) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LoadingState message="Connecting with ARIS..." />
      </SafeAreaView>
    );
  }

  if (error && !status) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ErrorState
          title="Cannot reach device"
          message={error}
          action="Retry Connection"
          onRetry={refresh}
          secondaryAction="Pair or Connect ARIS"
          onSecondaryAction={() => router.push("/device")}
        />
      </SafeAreaView>
    );
  }

  const sensors = status?.sensors ?? {};
  const hasIndoorData = status !== null && status?.sensors?.temperature_c?.value != null;
  const indoorTempC = hasIndoorData ? (sensors.temperature_c?.value ?? null) : null;
  const indoorTemp = indoorTempC != null ? formatTemp(indoorTempC) : "--°";
  const indoorHumidity =
    hasIndoorData && sensors.humidity_pct?.value != null
      ? Math.round(sensors.humidity_pct.value)
      : null;
  const pm25 = hasIndoorData && sensors.pm25?.value != null ? sensors.pm25.value : null;
  const co2 = hasIndoorData && sensors.co2?.value != null ? sensors.co2.value : null;
  const tvoc = hasIndoorData && sensors.tvoc?.value != null ? sensors.tvoc.value : null;

  const aqi = pm25 != null
    ? aqiFromPm25(pm25)
    : hasIndoorData
      ? { label: "Live", color: colors.success, level: 0 }
      : { label: "Offline", color: colors.secondaryText, level: 0 };

  const mascotState = !hasIndoorData
    ? "welcome"
    : stale
      ? "device_disconnected"
      : aqi.level === 0
        ? "good_conditions"
        : aqi.level === 1
          ? "advice"
          : "device_disconnected";

  const mascotMood = !hasIndoorData
    ? ("neutral" as const)
    : stale
      ? ("sleepy" as const)
      : aqi.level === 0
        ? ("energetic" as const)
        : aqi.level === 1
          ? ("neutral" as const)
          : aqi.level === 2
            ? ("tired" as const)
            : ("coughing" as const);

  const greeting = getGreeting();
  const w = weather?.current;
  const outdoorTemp = w ? `${Math.round(w.temp)}°` : "--°";
  const outdoorCondition = w?.condition ?? "Loading";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* ── ARIS Brand Header with App Logo ── */}
        <View style={styles.topBrandRow}>
          <View style={styles.brandGroup}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandTitleText}>ARIS</Text>
              <Text style={styles.brandSubtitleText}>Environmental Companion</Text>
            </View>
          </View>
          <Pressable
            style={styles.hardwareBadge}
            onPress={() => router.push("/device/scan")}
            accessibilityRole="button"
            accessibilityLabel="Device status"
          >
            <View
              style={[
                styles.hardwareDot,
                {
                  backgroundColor:
                    connection.status === "connected"
                      ? colors.accent
                      : colors.statusModerate,
                },
              ]}
            />
            <Text style={styles.hardwareBadgeText}>
              {connection.status === "connected"
                ? "UNO Q"
                : "Offline"}
            </Text>
          </Pressable>
        </View>

        {(connection.status === "disconnected" || connection.status === "reconnecting") && (
          <ConnectionBanner status={connection.status} />
        )}
        {staleMinutes !== null && (
          <StaleIndicator lastUpdated={`${staleMinutes} min ago`} />
        )}

        {/* ── Environmental Hero (Primary: UNO Q Room / Secondary: Outdoor) ── */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeaderRow}>
            <Pressable
              style={styles.locationChip}
              onPress={() => setShowStationModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Station: ${station.name}`}
            >
              <Ionicons
                name={viewMode === "indoor" ? "home-outline" : "location-sharp"}
                size={14}
                color={colors.accent}
              />
              <Text style={styles.locationText}>
                {viewMode === "indoor"
                  ? `Room · ${station.name.split(" (")[0]}`
                  : (w?.cityName ?? station.name.split(" (")[0])}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.secondaryText} />
            </Pressable>

            {/* Segmented Mode Toggle: Room (Sensors) vs Outdoor */}
            <View style={styles.modePillContainer}>
              <Pressable
                style={[styles.modePillBtn, viewMode === "indoor" && styles.modePillBtnActive]}
                onPress={() => setViewMode("indoor")}
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === "indoor" }}
              >
                <Text style={[styles.modePillText, viewMode === "indoor" && styles.modePillTextActive]}>
                  Room
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modePillBtn, viewMode === "outdoor" && styles.modePillBtnActive]}
                onPress={() => setViewMode("outdoor")}
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === "outdoor" }}
              >
                <Text style={[styles.modePillText, viewMode === "outdoor" && styles.modePillTextActive]}>
                  Outdoor
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Main Hero Content: Left Metrics + Right Mascot (No Overlap) ── */}
          <View style={styles.heroMainRow}>
            <View style={styles.heroMetricsCol}>
              <Text style={styles.heroTemp}>
                {viewMode === "indoor" ? indoorTemp : outdoorTemp}
              </Text>
              <Text style={styles.heroCondition}>
                {viewMode === "indoor"
                  ? (hasIndoorData ? `Room Climate · ${aqi.label} Air` : "No UNO Q Connected")
                  : outdoorCondition}
              </Text>
              <Text style={styles.heroMeta}>
                {viewMode === "indoor"
                  ? (hasIndoorData
                      ? `BME680 · ${indoorHumidity ?? "--"}% RH · ${sensors.pressure_hpa?.value != null ? (sensors.pressure_hpa.value / 10).toFixed(1) + " kPa" : (co2 != null ? "CO₂ " + Math.round(co2) + " ppm" : "TVOC " + (tvoc != null ? tvoc.toFixed(2) : "--"))}`
                      : "Connect Arduino UNO Q to stream telemetry")
                  : (w
                      ? `Feels like ${Math.round(w.feelsLike)}° · H:${Math.round(w.tempMax)}° L:${Math.round(w.tempMin)}°`
                      : "Atmospheric context")}
              </Text>
            </View>

            <View style={styles.heroMascotWrap}>
              <Mascot
                state={mascotState}
                mood={mascotMood}
                size={76}
                interactive
              />
            </View>
          </View>
        </View>

        {/* ── Mode-Specific Content ── */}
        {viewMode === "indoor" ? (
          <>
            {/* Quick Outdoor Banner */}
            <Pressable
              style={styles.quickSnapshotCard}
              onPress={() => setViewMode("outdoor")}
              accessibilityRole="button"
              accessibilityLabel={`Outdoor temperature ${outdoorTemp}, ${outdoorCondition}. Tap for outdoor weather forecast`}
            >
              <View style={styles.quickSnapshotLeft}>
                <View style={styles.quickSnapshotIconWrap}>
                  <Ionicons
                    name={w ? weatherIcon(w.icon) : "partly-sunny-outline"}
                    size={20}
                    color={colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickSnapshotTitle}>Outdoor: {outdoorTemp} · {outdoorCondition}</Text>
                  <Text style={styles.quickSnapshotSub}>
                    Rain {w?.rainChance ?? "--"}% · Tap for sun timing, UV & pollen
                  </Text>
                </View>
              </View>
              <View style={styles.quickSnapshotAction}>
                <Text style={styles.quickSnapshotActionText}>Outdoor</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.navSelected} />
              </View>
            </Pressable>

            {/* Room Forecast (UNO Q LSTM) */}
            <Pressable style={styles.card} onPress={() => router.push({ pathname: "/(tabs)/explore", params: { mode: "indoor" } })}>
              <View style={styles.sectionLabelRow}>
                <View style={styles.indoorBadge}>
                  <Text style={styles.badgeText}>INDOOR</Text>
                </View>
                <Text style={styles.cardLabel}>Next Hour Forecast</Text>
              </View>
              {localForecast?.aris_forecast ? (() => {
                const fc = localForecast.aris_forecast;
                const tempUp = fc.temp_change > 0;
                const humUp = fc.humidity_change > 0;
                return (
                  <View style={styles.forecastGrid}>
                    <View style={styles.forecastCell}>
                      <Ionicons name="thermometer-outline" size={20} color={colors.accent} />
                      <Text style={styles.forecastValue}>{formatTemp(fc.predicted_temperature_c)}</Text>
                      <View style={styles.forecastChangeRow}>
                        <Ionicons
                          name={tempUp ? "arrow-up" : "arrow-down"}
                          size={12}
                          color={tempUp ? colors.statusUnhealthy : colors.statusGood}
                        />
                        <Text style={[styles.forecastChange, { color: tempUp ? colors.statusUnhealthy : colors.statusGood }]}>
                          {Math.abs(fc.temp_change).toFixed(1)}°
                        </Text>
                      </View>
                      <Text style={styles.forecastLabel}>Temperature</Text>
                    </View>
                    <View style={styles.forecastCell}>
                      <Ionicons name="water-outline" size={20} color="#60A5FA" />
                      <Text style={styles.forecastValue}>{fc.predicted_humidity_pct.toFixed(0)}%</Text>
                      <View style={styles.forecastChangeRow}>
                        <Ionicons
                          name={humUp ? "arrow-up" : "arrow-down"}
                          size={12}
                          color={humUp ? "#60A5FA" : colors.secondaryText}
                        />
                        <Text style={[styles.forecastChange, { color: humUp ? "#60A5FA" : colors.secondaryText }]}>
                          {Math.abs(fc.humidity_change).toFixed(0)}%
                        </Text>
                      </View>
                      <Text style={styles.forecastLabel}>Humidity</Text>
                    </View>
                    <View style={styles.forecastCell}>
                      <Ionicons name="analytics-outline" size={20} color={colors.secondaryText} />
                      <Text style={styles.forecastMeta}>{fc.training_samples}</Text>
                      <Text style={styles.forecastLabel}>Samples</Text>
                      <Text style={[styles.forecastLabel, { marginTop: 2 }]}>LSTM</Text>
                    </View>
                  </View>
                );
              })() : localForecast?.points && localForecast.points.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hourlyStrip}
                >
                  {localForecast.points.slice(0, 10).map((p, i) => (
                    <View key={i} style={styles.hourlySlot}>
                      <Text style={styles.hourlyTime}>
                        {i === 0 ? "Now" : formatHour(Math.floor(new Date(p.timestamp).getTime() / 1000))}
                      </Text>
                      <Ionicons name="thermometer-outline" size={18} color={colors.accent} />
                      <Text style={styles.hourlyTemp}>{formatTemp(p.value)}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyForecastBox}>
                  <Ionicons
                    name={hasIndoorData ? "hourglass-outline" : "hardware-chip-outline"}
                    size={26}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.emptyForecastTitle}>
                    {hasIndoorData ? "Building Forecast Model" : "No Room Forecast"}
                  </Text>
                  <Text style={styles.emptyForecastText}>
                    {hasIndoorData
                      ? "LSTM model is collecting sensor samples. Forecast will appear once enough hourly data is gathered."
                      : "Connect your Arduino UNO Q to generate local microclimate predictions from on-device sensors."}
                  </Text>
                  {!hasIndoorData && (
                    <Pressable
                      style={styles.connectPromptBtn}
                      onPress={() => router.push("/device/scan")}
                      accessibilityRole="button"
                      accessibilityLabel="Connect Arduino UNO Q"
                    >
                      <Ionicons name="bluetooth" size={14} color={colors.background} />
                      <Text style={styles.connectPromptBtnText}>Connect UNO Q</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Pressable>

            {/* Air Quality */}
            <Pressable
              style={styles.card}
              onPress={() => router.push("/air-quality")}
              accessibilityRole="button"
              accessibilityLabel={`Air quality ${aqi.label}${pm25 != null ? `, PM2.5 ${Math.round(pm25)}` : ""}`}
            >
              <View style={styles.sectionLabelRow}>
                <View style={styles.indoorBadge}>
                  <Text style={styles.badgeText}>INDOOR</Text>
                </View>
                <Text style={styles.cardLabel}>Air Quality</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.aqiBadge, { backgroundColor: aqi.color }]}>
                  <Text style={styles.aqiBadgeText}>{aqi.label}</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.background} />
                </View>
              </View>
              <View style={styles.aqiValueRow}>
                <Text style={styles.aqiValue}>{pm25 != null ? Math.round(pm25) : "--"}</Text>
                <View style={styles.aqiMeta}>
                  <Text style={styles.aqiUnit}>µg/m³ PM2.5</Text>
                  {pm25 != null && (
                    <View style={styles.trendRow}>
                      <Ionicons name="remove-outline" size={12} color={colors.secondaryText} />
                      <Text style={styles.trendText}>Live sensor data</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>

            {/* Sensor Readings */}
            <View style={styles.card}>
              <View style={styles.sectionLabelRow}>
                <View style={styles.indoorBadge}>
                  <Text style={styles.badgeText}>INDOOR</Text>
                </View>
                <Text style={styles.cardLabel}>Sensor Readings</Text>
              </View>
              <View style={styles.sensorGrid}>
                <View style={styles.sensorCell}>
                  <Ionicons name="thermometer-outline" size={18} color="#EF4444" />
                  <Text style={styles.sensorValue}>{indoorTemp}</Text>
                  <Text style={styles.sensorLabel}>Temperature</Text>
                </View>
                <View style={styles.sensorCell}>
                  <Ionicons name="water-outline" size={18} color="#38BDF8" />
                  <Text style={styles.sensorValue}>{indoorHumidity != null ? `${indoorHumidity}%` : "--"}</Text>
                  <Text style={styles.sensorLabel}>Humidity</Text>
                </View>
                <View style={styles.sensorCell}>
                  <Ionicons name="speedometer-outline" size={18} color="#A78BFA" />
                  <Text style={styles.sensorValue}>
                    {sensors.pressure_hpa?.value != null ? (sensors.pressure_hpa.value / 10).toFixed(1) : "--"}
                  </Text>
                  <Text style={styles.sensorLabel}>Pressure kPa</Text>
                </View>
                <View style={styles.sensorCell}>
                  <Ionicons name="flask-outline" size={18} color="#FB923C" />
                  <Text style={styles.sensorValue}>{tvoc != null ? tvoc.toFixed(2) : "--"}</Text>
                  <Text style={styles.sensorLabel}>TVOC index</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Quick Room Banner */}
            <Pressable
              style={styles.quickSnapshotCard}
              onPress={() => setViewMode("indoor")}
              accessibilityRole="button"
              accessibilityLabel="Switch back to Room sensors"
            >
              <View style={styles.quickSnapshotLeft}>
                <View style={styles.quickSnapshotIconWrap}>
                  <Ionicons name="home-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickSnapshotTitle}>
                    {hasIndoorData ? `Room: ${indoorTemp} · ${indoorHumidity ?? "--"}% RH` : `Room: Offline`}
                  </Text>
                  <Text style={styles.quickSnapshotSub}>
                    {hasIndoorData ? `Sensirion SHT4x & SPS30 Air Status: ${aqi.label}` : "Connect UNO Q to stream room telemetry"}
                  </Text>
                </View>
              </View>
              <View style={styles.quickSnapshotAction}>
                <Text style={styles.quickSnapshotActionText}>Room</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.navSelected} />
              </View>
            </Pressable>

            {/* Atmospheric Conditions (Rain, Sun, UV, Wind) */}
            <View style={styles.card}>
              <View style={styles.sectionLabelRow}>
                <View style={styles.outdoorBadge}>
                  <Text style={styles.badgeText}>OUTDOOR</Text>
                </View>
                <Text style={styles.cardLabel}>Atmospheric Conditions</Text>
              </View>
              <View style={styles.outdoorBentoGrid}>
                <View style={styles.outdoorBentoCell}>
                  <View style={styles.outdoorBentoCellHeader}>
                    <Ionicons name="rainy-outline" size={14} color="#38BDF8" />
                    <Text style={styles.outdoorBentoCellTitle}>Rain & Storm</Text>
                  </View>
                  <Text style={styles.outdoorBentoCellValue}>
                    {w?.rainChance ?? "--"}% Chance
                  </Text>
                  <Text style={styles.outdoorBentoCellLabel} numberOfLines={1}>
                    {w?.stormAlert ?? "Low storm risk"}
                  </Text>
                </View>
                <View style={styles.outdoorBentoCell}>
                  <View style={styles.outdoorBentoCellHeader}>
                    <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
                    <Text style={styles.outdoorBentoCellTitle}>Sun Timing</Text>
                  </View>
                  <Text style={styles.outdoorBentoCellValue}>
                    Rise {w ? formatTime(w.sunrise) : "--"}
                  </Text>
                  <Text style={styles.outdoorBentoCellLabel}>
                    Set {w ? formatTime(w.sunset) : "--"}
                  </Text>
                </View>
                <View style={styles.outdoorBentoCell}>
                  <View style={styles.outdoorBentoCellHeader}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.statusGood} />
                    <Text style={styles.outdoorBentoCellTitle}>UV & Pollen</Text>
                  </View>
                  <Text style={styles.outdoorBentoCellValue}>
                    UV {w?.uvIndex ?? "--"} {w ? (w.uvIndex <= 2 ? "(Low)" : w.uvIndex <= 5 ? "(Moderate)" : "(High)") : ""}
                  </Text>
                  <Text style={styles.outdoorBentoCellLabel}>
                    Pollen {w?.pollenLevel ?? "--"}
                  </Text>
                </View>
                <View style={styles.outdoorBentoCell}>
                  <View style={styles.outdoorBentoCellHeader}>
                    <Ionicons name="speedometer-outline" size={14} color={colors.accent} />
                    <Text style={styles.outdoorBentoCellTitle}>Atmosphere</Text>
                  </View>
                  <Text style={styles.outdoorBentoCellValue}>
                    {w?.pressure != null ? (w.pressure / 10).toFixed(1) : "--"} kPa
                  </Text>
                  <Text style={styles.outdoorBentoCellLabel}>
                    Wind {w ? `${w.windSpeed} m/s ${windDirection(w.windDeg)}` : "--"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hourly Weather Forecast */}
            {weather && (
              <View style={styles.card}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.outdoorBadge}>
                    <Text style={styles.badgeText}>OUTDOOR</Text>
                  </View>
                  <Text style={styles.cardLabel}>Hourly Weather Forecast</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hourlyStrip}
                >
                  {weather.hourly.slice(0, 10).map((h, i) => (
                    <View key={h.dt} style={styles.hourlySlot}>
                      <Text style={styles.hourlyTime}>
                        {i === 0 ? "Now" : formatHour(h.dt)}
                      </Text>
                      <Ionicons name={weatherIcon(h.icon)} size={20} color={colors.accent} />
                      <Text style={styles.hourlyTemp}>{Math.round(h.temp)}°</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 5-Day Forecast */}
            {weather && (
              <View style={styles.card}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.outdoorBadge}>
                    <Text style={styles.badgeText}>OUTDOOR</Text>
                  </View>
                  <Text style={styles.cardLabel}>5-Day Forecast</Text>
                </View>
                {weather.daily.map((d) => (
                  <View key={d.dt} style={styles.dailyRow}>
                    <Text style={styles.dailyDay}>{formatDay(d.dt)}</Text>
                    <Ionicons name={weatherIcon(d.icon)} size={18} color={colors.accent} />
                    <Text style={styles.dailyCondition}>{d.condition}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.dailyHigh}>{Math.round(d.tempMax)}°</Text>
                    <View style={styles.dailyTempBar}>
                      <View
                        style={[
                          styles.dailyTempFill,
                          {
                            left: `${((d.tempMin - 18) / 22) * 100}%`,
                            right: `${100 - ((d.tempMax - 18) / 22) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.dailyLow}>{Math.round(d.tempMin)}°</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Outdoor Detail Bento Grids */}
            {w && (
              <>
                <View style={styles.bentoRow}>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="sunny-outline" size={14} color={colors.accent} />
                      <Text style={styles.bentoCellLabel}>UV Index</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>
                      {w.uvIndex > 0 ? w.uvIndex : "Low"}
                    </Text>
                    <Text style={styles.bentoCellSub}>Low rest of day</Text>
                  </View>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="water-outline" size={14} color="#38BDF8" />
                      <Text style={styles.bentoCellLabel}>Humidity</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>{w.humidity}%</Text>
                    <Text style={styles.bentoCellSub}>Outdoor</Text>
                  </View>
                </View>
                <View style={styles.bentoRow}>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="flag-outline" size={14} color={colors.accent} />
                      <Text style={styles.bentoCellLabel}>Wind</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>
                      {Math.round(w.windSpeed * 3.6)} km/h
                    </Text>
                    <Text style={styles.bentoCellSub}>{windDirection(w.windDeg)}</Text>
                  </View>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="thermometer-outline" size={14} color="#FB923C" />
                      <Text style={styles.bentoCellLabel}>Dew Point</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>{Math.round(w.dewPoint)}°</Text>
                    <Text style={styles.bentoCellSub}>
                      {w.dewPoint > 20 ? "Muggy" : "Comfortable"}
                    </Text>
                  </View>
                </View>
                <View style={styles.bentoRow}>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="speedometer-outline" size={14} color={colors.accent} />
                      <Text style={styles.bentoCellLabel}>Pressure</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>{(w.pressure / 10).toFixed(1)} kPa</Text>
                    <Text style={styles.bentoCellSub}>
                      {w.pressure > 1013 ? "Rising" : "Falling"}
                    </Text>
                  </View>
                  <View style={[styles.bentoCell, { flex: 1 }]}>
                    <View style={styles.bentoCellHeader}>
                      <Ionicons name="eye-outline" size={14} color="#38BDF8" />
                      <Text style={styles.bentoCellLabel}>Visibility</Text>
                    </View>
                    <Text style={styles.bentoCellValue}>{w.visibility.toFixed(1)} km</Text>
                    <Text style={styles.bentoCellSub}>
                      {w.visibility >= 10 ? "Clear" : w.visibility >= 5 ? "Moderate" : "Low"}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Sunrise / Sunset */}
            {w && (
              <View style={styles.card}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.outdoorBadge}>
                    <Text style={styles.badgeText}>OUTDOOR</Text>
                  </View>
                  <Text style={styles.cardLabel}>Sun & Moon</Text>
                </View>
                <View style={styles.sunMoonRow}>
                  <View style={styles.sunMoonCell}>
                    <Ionicons name="sunny-outline" size={22} color="#EAB308" />
                    <Text style={styles.sunMoonLabel}>Sunrise</Text>
                    <Text style={styles.sunMoonValue}>{formatTime(w.sunrise)}</Text>
                  </View>
                  <View style={styles.sunMoonDivider} />
                  <View style={styles.sunMoonCell}>
                    <Ionicons name="moon-outline" size={22} color="#A78BFA" />
                    <Text style={styles.sunMoonLabel}>Sunset</Text>
                    <Text style={styles.sunMoonValue}>{formatTime(w.sunset)}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Advisory Card (always visible) ── */}
        <Pressable
          style={styles.card}
          onPress={() => setExpandAdvisory(!expandAdvisory)}
          accessibilityRole="button"
          accessibilityLabel="Toggle advisory details"
        >
          <View style={styles.cardRow}>
            <Ionicons name="bulb-outline" size={18} color={colors.accent} />
            <Text style={[styles.advisoryText, { flex: 1, marginLeft: 10 }]}>
              {aqi.level >= 2
                ? "Air quality needs attention. Limit outdoor activity."
                : "Air quality may rise this afternoon. Consider limiting strenuous outdoor activity."}
            </Text>
            <Ionicons
              name={expandAdvisory ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.secondaryText}
            />
          </View>
          {expandAdvisory && (
            <View style={styles.advisoryDetail}>
              <View style={styles.advisoryRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.statusGood} />
                <Text style={styles.advisoryDetailText}>
                  Morning window (07:00-11:00) optimal for ventilation.
                </Text>
              </View>
              <View style={styles.advisoryRow}>
                <Ionicons name="alert-circle" size={14} color={colors.statusModerate} />
                <Text style={styles.advisoryDetailText}>
                  Afternoon traffic peak and low wind reduce clearance.
                </Text>
              </View>
            </View>
          )}
        </Pressable>

        {/* ── Day Timeline ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Your Day</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/explore")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View full timeline"
            >
              <Text style={styles.linkText}>Full timeline</Text>
            </Pressable>
          </View>
          <View style={styles.timelineList}>
            <View style={styles.timelineSlot}>
              <View style={[styles.timelineDot, { backgroundColor: colors.statusGood }]} />
              <Text style={styles.timelineSlotText}>Morning (7-10 AM)</Text>
              <Text style={[styles.timelineStatus, { color: colors.statusGood }]}>Good</Text>
            </View>
            <View style={styles.timelineSlot}>
              <View style={[styles.timelineDot, { backgroundColor: colors.statusModerate }]} />
              <Text style={styles.timelineSlotText}>Afternoon (11 AM-4 PM)</Text>
              <Text style={[styles.timelineStatus, { color: colors.statusModerate }]}>Moderate</Text>
            </View>
            <View style={styles.timelineSlot}>
              <View style={[styles.timelineDot, { backgroundColor: colors.statusGood }]} />
              <Text style={styles.timelineSlotText}>Evening (5-9 PM)</Text>
              <Text style={[styles.timelineStatus, { color: colors.statusGood }]}>Good</Text>
            </View>
          </View>
        </View>

        {/* ── Greeting Footer ── */}
        <View style={styles.footerSection}>
          <Text style={styles.footerGreeting}>{greeting}, Sachi</Text>
          <Text style={styles.footerSub}>
            {aqi.level === 0
              ? "Air quality is good in your area."
              : aqi.level === 1
                ? "Air quality is moderate. Stay aware."
                : "Air quality needs attention."}
          </Text>
        </View>
      </ScrollView>

      {/* ── Station Modal ── */}
      <Modal
        visible={showStationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStationModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStationModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
                <Text style={styles.modalTitle}>Hardware Station</Text>
              </View>
              <Pressable
                onPress={() => setShowStationModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={colors.secondaryText} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              {[
                ["Station", station.name],
                ["Hardware ID", station.stationId],
                ["Coordinates", station.coordinates],
                ["Altitude", `${station.altitudeMeters} m MSL`],
                ["Status", "Calibrated (SPS30)"],
                ["Wi-Fi", "-62 dBm"],
              ].map(([label, value]) => (
                <View key={label} style={styles.modalRow}>
                  <Text style={styles.modalLabel}>{label}</Text>
                  <Text style={styles.modalValue}>{value}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.modalAction}
              onPress={() => {
                setShowStationModal(false);
                router.push("/settings");
              }}
            >
              <Ionicons name="settings-outline" size={15} color={colors.background} />
              <Text style={styles.modalActionText}>Settings</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 100,
    gap: 12,
  },

  // Brand Header
  topBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 4,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandTitleText: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 17,
    color: colors.primaryText,
    letterSpacing: 0.5,
  },
  brandSubtitleText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 10,
    color: colors.secondaryText,
    marginTop: -2,
  },
  hardwareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hardwareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hardwareBadgeText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.primaryText,
  },

  // Weather Hero
  heroSection: {
    paddingTop: 8,
    paddingBottom: 8,
    width: "100%",
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  modePillContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 2,
    alignItems: "center",
  },
  modePillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modePillBtnActive: {
    backgroundColor: colors.navSelectedBackground,
  },
  modePillText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  modePillTextActive: {
    color: colors.navSelected,
    fontFamily: typography.fontFamilies.semiBold,
  },

  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  heroMetricsCol: {
    flex: 1,
    paddingRight: 10,
  },
  heroTemp: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 54,
    color: colors.primaryText,
    lineHeight: 58,
  },
  heroCondition: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 16,
    color: colors.primaryText,
    marginTop: 2,
  },
  heroMeta: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 4,
    lineHeight: 16,
  },
  heroMascotWrap: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  // Quick Snapshot Banner
  quickSnapshotCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  quickSnapshotLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  quickSnapshotIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  quickSnapshotTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  quickSnapshotSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 2,
  },
  quickSnapshotAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.navSelectedBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 0,
  },
  quickSnapshotActionText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.navSelected,
  },

  // Outdoor Bento
  outdoorBentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  outdoorBentoCell: {
    width: "48.5%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 10,
    gap: 4,
  },
  outdoorBentoCellHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  outdoorBentoCellTitle: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 10,
    color: colors.secondaryText,
    textTransform: "uppercase",
  },
  outdoorBentoCellValue: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 14,
    color: colors.primaryText,
  },
  outdoorBentoCellLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.mutedText,
  },

  // Location
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },

  // Section label with indoor/outdoor badge
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  outdoorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  indoorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: "rgba(215, 255, 67, 0.3)",
  },
  badgeText: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.primaryText,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardLabel: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Hourly strip
  hourlyStrip: {
    gap: 4,
  },
  hourlySlot: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    gap: 6,
    minWidth: 60,
  },
  hourlyTime: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  hourlyTemp: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 15,
    color: colors.primaryText,
  },

  // AQI card
  aqiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aqiBadgeText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.background,
  },
  aqiValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  aqiValue: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 48,
    color: colors.primaryText,
    lineHeight: 52,
  },
  aqiMeta: {
    gap: 4,
    paddingBottom: 4,
  },
  aqiUnit: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.statusGood,
  },

  // Sensor grid (2x2)
  sensorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sensorCell: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  sensorValue: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 20,
    color: colors.primaryText,
  },
  sensorLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },

  // 5-day forecast
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dailyDay: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
    width: 70,
  },
  dailyCondition: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    width: 60,
  },
  dailyHigh: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
    width: 28,
    textAlign: "right",
  },
  dailyTempBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 2,
    overflow: "hidden",
    position: "relative",
  },
  dailyTempFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  dailyLow: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    width: 28,
    textAlign: "right",
  },

  // Bento grid
  bentoRow: {
    flexDirection: "row",
    gap: 12,
  },
  bentoCell: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  bentoCellHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  bentoCellLabel: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bentoCellValue: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 28,
    color: colors.primaryText,
    lineHeight: 32,
  },
  bentoCellSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 4,
  },

  // Advisory
  advisoryText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
    lineHeight: 18,
  },
  advisoryDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  advisoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  advisoryDetailText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    flex: 1,
    lineHeight: 17,
  },

  // Sun & Moon
  sunMoonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sunMoonCell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  sunMoonDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  sunMoonLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  sunMoonValue: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 18,
    color: colors.primaryText,
  },

  // Timeline
  timelineList: {
    gap: 8,
  },
  timelineSlot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  timelineSlotText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
    flex: 1,
  },
  timelineStatus: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
  },
  linkText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.accent,
  },

  // Footer
  footerSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  footerGreeting: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 16,
    color: colors.primaryText,
  },
  footerSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  modalBody: {
    gap: 8,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  modalLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  modalValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.primaryText,
  },
  modalAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  modalActionText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.background,
  },
  forecastGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  forecastCell: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  forecastValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 22,
    color: colors.primaryText,
  },
  forecastChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  forecastChange: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
  },
  forecastLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },
  forecastMeta: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 18,
    color: colors.secondaryText,
  },
  emptyForecastBox: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyForecastTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
    textAlign: "center",
  },
  emptyForecastText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: "center",
  },
  connectPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  connectPromptBtnText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.background,
  },
});
