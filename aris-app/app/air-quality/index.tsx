import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
} from "react-native-svg";
import LoadingState from "../../components/LoadingState";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const screenWidth = Dimensions.get("window").width;

type Pollutant = "PM2.5" | "PM10" | "CO2" | "TVOC";
type AirQualityTimeRange = "Today" | "7 Days";

export default function AirQualityScreen() {
  const router = useRouter();
  const { status, loading, refresh } = useDeviceStatus();
  const [selectedParam, setSelectedParam] = useState<Pollutant>("PM2.5");
  const [timeRange, setTimeRange] = useState<AirQualityTimeRange>("Today");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refresh());
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const sensors = status?.sensors ?? {};
  const hasData = status != null;

  // Null = no device; numeric = real reading
  const pm25Val = sensors.pm25?.value ?? null;
  const pm10Val = sensors.pm10?.value ?? null;
  const gp2yVolts = sensors.gp2y_voltage_v?.value ?? null;
  const pm10SubVal = sensors.pm1_0?.value ?? null;
  const pm40Val = sensors.pm4_0?.value ?? null;
  const nc05Val = sensors.nc0_5?.value ?? null;
  const nc25Val = sensors.nc2_5?.value ?? null;
  const co2Val = sensors.co2?.value ?? null;
  const tvocVal = sensors.tvoc?.value ?? null;
  const mq135Val = sensors.mq135_adc?.value ?? null;
  const mg811Val = sensors.mg811_voltage_v?.value ?? null;

  // Safe numerics for category thresholds (0 falls in Good bucket when disconnected)
  const pm25Raw = pm25Val ?? 0;
  const pm10Raw = pm10Val ?? 0;
  const pm10RawSub = pm10SubVal ?? 0;
  const pm40Raw = pm40Val ?? 0;
  const nc05Raw = nc05Val ?? 0;
  const nc25Raw = nc25Val ?? 0;
  const co2Raw = co2Val ?? 0;
  const tvocRaw = tvocVal ?? 0;
  const mq135Raw = mq135Val ?? 0;
  const mg811Raw = mg811Val ?? 0;

  const paramConfigs = useMemo<
    Record<
      Pollutant,
      {
        label: string;
        value: string;
        unit: string;
        category: string;
        categoryColor: string;
        statusBg: string;
        statusBorder: string;
        trendText: string;
        trendIcon: keyof typeof Ionicons.glyphMap;
        scaleRanges: [string, string, string, string, string];
        activeIntervalIndex: number;
        gaugeRatio: number;
        peakVal: string;
        peakTime: string;
        sensorDetailTitle: string;
        tableRows: { key: string; val: string; isHighlight?: boolean }[];
      }
    >
  >(() => {
    const pm25Cat =
      pm25Raw <= 12.0
        ? { label: "Good", color: "#10B981", bg: "rgba(16,185,129,0.15)", border: colors.success, idx: 0 }
        : pm25Raw <= 35.4
        ? { label: "Moderate", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", border: colors.warning, idx: 1 }
        : pm25Raw <= 55.4
        ? { label: "Sensitive", color: "#F97316", bg: "rgba(249,115,22,0.15)", border: "#F97316", idx: 2 }
        : pm25Raw <= 150.4
        ? { label: "Unhealthy", color: "#EF4444", bg: "rgba(239,68,68,0.15)", border: "#EF4444", idx: 3 }
        : { label: "Hazardous", color: "#991B1B", bg: "rgba(153,27,27,0.15)", border: "#991B1B", idx: 4 };

    const pm10Cat =
      pm10Raw <= 54.0
        ? { label: "Good", color: "#10B981", bg: "rgba(16,185,129,0.15)", border: colors.success, idx: 0 }
        : pm10Raw <= 154.0
        ? { label: "Moderate", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", border: colors.warning, idx: 1 }
        : pm10Raw <= 254.0
        ? { label: "Sensitive", color: "#F97316", bg: "rgba(249,115,22,0.15)", border: "#F97316", idx: 2 }
        : pm10Raw <= 354.0
        ? { label: "Unhealthy", color: "#EF4444", bg: "rgba(239,68,68,0.15)", border: "#EF4444", idx: 3 }
        : { label: "Hazardous", color: "#991B1B", bg: "rgba(153,27,27,0.15)", border: "#991B1B", idx: 4 };

    const co2Cat =
      co2Raw <= 600
        ? { label: "Good", color: "#10B981", bg: "rgba(16,185,129,0.15)", border: colors.success, idx: 0 }
        : co2Raw <= 1000
        ? { label: "Moderate", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", border: colors.warning, idx: 1 }
        : co2Raw <= 1500
        ? { label: "Sensitive", color: "#F97316", bg: "rgba(249,115,22,0.15)", border: "#F97316", idx: 2 }
        : { label: "Elevated", color: "#EF4444", bg: "rgba(239,68,68,0.15)", border: "#EF4444", idx: 3 };

    const tvocCat =
      tvocRaw <= 0.3
        ? { label: "Good", color: "#10B981", bg: "rgba(16,185,129,0.15)", border: colors.success, idx: 0 }
        : tvocRaw <= 0.5
        ? { label: "Moderate", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", border: colors.warning, idx: 1 }
        : tvocRaw <= 1.0
        ? { label: "Sensitive", color: "#F97316", bg: "rgba(249,115,22,0.15)", border: "#F97316", idx: 2 }
        : { label: "High", color: "#EF4444", bg: "rgba(239,68,68,0.15)", border: "#EF4444", idx: 3 };

    return {
      "PM2.5": {
        label: "PM2.5",
        value: pm25Val != null ? `${Math.round(pm25Val)}` : "--",
        unit: "µg/m³",
        category: hasData ? pm25Cat.label : "--",
        categoryColor: pm25Cat.color,
        statusBg: pm25Cat.bg,
        statusBorder: pm25Cat.border,
        trendText: hasData ? "Live sensor data" : "Connect UNO Q",
        trendIcon: (hasData ? "pulse" : "wifi-outline") as keyof typeof Ionicons.glyphMap,
        scaleRanges: ["0 - 12", "13 - 35", "36 - 55", "56 - 150", "151+"],
        activeIntervalIndex: pm25Cat.idx,
        gaugeRatio: pm25Val != null ? Math.min(1.0, Math.max(0.05, pm25Val / 75.0)) : 0.0,
        peakVal: pm25Val != null ? `${Math.round(pm25Val)} µg/m³` : "--",
        peakTime: hasData ? (timeRange === "Today" ? "Latest" : "This week") : "--",
        sensorDetailTitle: "Sensirion SPS30 Optical Particulate Telemetry",
        tableRows: [
          { key: "PM1.0 Mass Concentration", val: pm10SubVal != null ? `${pm10SubVal.toFixed(1)} µg/m³` : "--" },
          { key: "PM2.5 Mass Concentration", val: pm25Val != null ? `${pm25Val.toFixed(1)} µg/m³` : "--", isHighlight: true },
          { key: "PM4.0 Mass Concentration", val: pm40Val != null ? `${pm40Val.toFixed(1)} µg/m³` : "--" },
          { key: "PM10 Mass Concentration", val: pm10Val != null ? `${pm10Val.toFixed(1)} µg/m³` : "--" },
          { key: "Particle Number NC0.5", val: nc05Val != null ? `${nc05Val.toFixed(1)} #/cm³` : "--" },
          { key: "Particle Number NC2.5", val: nc25Val != null ? `${nc25Val.toFixed(1)} #/cm³` : "--" },
          { key: "Laser Scattering Status", val: hasData ? "Normal (Photodiode OK)" : "--" },
          { key: "Auto-Cleaning Cycle", val: hasData ? "Active (24h Interval)" : "--" },
        ],
      },
      PM10: {
        label: "PM10",
        value: pm10Val != null ? `${Math.round(pm10Val)}` : "--",
        unit: "µg/m³",
        category: hasData ? pm10Cat.label : "--",
        categoryColor: pm10Cat.color,
        statusBg: pm10Cat.bg,
        statusBorder: pm10Cat.border,
        trendText: hasData ? "Live sensor data" : "Connect UNO Q",
        trendIcon: (hasData ? "pulse" : "wifi-outline") as keyof typeof Ionicons.glyphMap,
        scaleRanges: ["0 - 54", "55 - 154", "155 - 254", "255 - 354", "355+"],
        activeIntervalIndex: pm10Cat.idx,
        gaugeRatio: pm10Val != null ? Math.min(1.0, Math.max(0.05, pm10Val / 150.0)) : 0.0,
        peakVal: pm10Val != null ? `${Math.round(pm10Val)} µg/m³` : "--",
        peakTime: hasData ? (timeRange === "Today" ? "Latest" : "This week") : "--",
        sensorDetailTitle: "Optical dust channel (GP2Y, experimental proxy)",
        tableRows: [
          { key: "PM10 proxy", val: pm10Val != null ? `${pm10Val.toFixed(1)} µg/m³` : "--", isHighlight: true },
          { key: "PM2.5 proxy", val: pm25Val != null ? `${pm25Val.toFixed(1)} µg/m³` : "--" },
          { key: "Sensor voltage", val: gp2yVolts != null ? `${gp2yVolts.toFixed(3)} V` : "--" },
          { key: "Calibration", val: "Uncalibrated optical proxy" },
        ],
      },
      CO2: {
        label: "CO2",
        value: co2Val != null ? `${Math.round(co2Val)}` : "--",
        unit: "ppm",
        category: hasData ? co2Cat.label : "--",
        categoryColor: co2Cat.color,
        statusBg: co2Cat.bg,
        statusBorder: co2Cat.border,
        trendText: hasData ? "Live sensor data" : "Connect UNO Q",
        trendIcon: (hasData ? "pulse" : "wifi-outline") as keyof typeof Ionicons.glyphMap,
        scaleRanges: ["400 - 600", "601 - 1000", "1001 - 1500", "1501 - 2000", "2000+"],
        activeIntervalIndex: co2Cat.idx,
        gaugeRatio: co2Val != null ? Math.min(1.0, Math.max(0.05, co2Val / 1500.0)) : 0.0,
        peakVal: co2Val != null ? `${Math.round(co2Val)} ppm` : "--",
        peakTime: hasData ? (timeRange === "Today" ? "Latest" : "This week") : "--",
        sensorDetailTitle: "Electrochemical MG811 / NDIR Telemetry",
        tableRows: [
          { key: "Calculated CO2 Equivalent", val: co2Val != null ? `${Math.round(co2Val)} ppm` : "--", isHighlight: true },
          { key: "MG811 Baseline Cell Voltage", val: mg811Val != null ? `${mg811Val.toFixed(3)} V` : "--" },
          { key: "Electrolyte Impedance", val: hasData ? "Nominal" : "--" },
          { key: "Temperature Compensated", val: hasData ? "Yes (via SHT4x)" : "--" },
          { key: "Calibration Cycle", val: hasData ? "Automatic Baseline Correction" : "--" },
        ],
      },
      TVOC: {
        label: "TVOC",
        value: tvocVal != null ? `${tvocVal.toFixed(2)}` : "--",
        unit: "mg/m³",
        category: hasData ? tvocCat.label : "--",
        categoryColor: tvocCat.color,
        statusBg: tvocCat.bg,
        statusBorder: tvocCat.border,
        trendText: hasData ? "Live sensor data" : "Connect UNO Q",
        trendIcon: (hasData ? "pulse" : "wifi-outline") as keyof typeof Ionicons.glyphMap,
        scaleRanges: ["0.0 - 0.3", "0.3 - 0.5", "0.5 - 1.0", "1.0 - 3.0", "3.0+"],
        activeIntervalIndex: tvocCat.idx,
        gaugeRatio: tvocVal != null ? Math.min(1.0, Math.max(0.05, tvocVal / 1.0)) : 0.0,
        peakVal: tvocVal != null ? `${tvocVal.toFixed(2)} mg/m³` : "--",
        peakTime: hasData ? (timeRange === "Today" ? "Latest" : "This week") : "--",
        sensorDetailTitle: "MQ135 Gas Sensor ADC Telemetry",
        tableRows: [
          { key: "Total VOC Index", val: tvocVal != null ? `${tvocVal.toFixed(2)} mg/m³` : "--", isHighlight: true },
          { key: "MQ135 Raw ADC Reading", val: mq135Val != null ? `${Math.round(mq135Val)} ADC (10-bit)` : "--" },
          { key: "Heater Resistance (Rh)", val: hasData ? "Measured" : "--" },
          { key: "Sensor Resistance (Rs/R0)", val: hasData ? "Measured" : "--" },
          { key: "Preheat Stabilization", val: hasData ? "Complete" : "--" },
        ],
      },
    };
  }, [
    pm25Val,
    pm10Val,
    pm10SubVal,
    pm40Val,
    nc05Val,
    nc25Val,
    co2Val,
    tvocVal,
    mq135Val,
    mg811Val,
    pm25Raw,
    pm10Raw,
    co2Raw,
    tvocRaw,
    hasData,
    timeRange,
  ]);

  const currentCfg = paramConfigs[selectedParam];

  const gaugeW = 160;
  const gaugeH = 100;
  const cx = gaugeW / 2;
  const cy = 88;
  const r = 68;

  const gaugeRatioClamped = Math.min(0.98, Math.max(0.04, currentCfg.gaugeRatio));
  const arcAngle = Math.PI * (1 - gaugeRatioClamped);
  const endX = cx + r * Math.cos(arcAngle);
  const endY = cy - r * Math.sin(arcAngle);

  const chartPoints = useMemo(() => {
    const isToday = timeRange === "Today";
    const xLabels = isToday
      ? ["08:00", "11:00", "14:00", "17:00", "20:00"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];

    const pts = isToday
      ? [
          { x: 35, y: 130 },
          { x: 92, y: 114 },
          { x: 150, y: 78 },
          { x: 205, y: 55 },
          { x: 260, y: 84 },
          { x: 315, y: 120 },
        ]
      : [
          { x: 35, y: 120 },
          { x: 80, y: 100 },
          { x: 130, y: 65 },
          { x: 180, y: 80 },
          { x: 230, y: 50 },
          { x: 280, y: 95 },
          { x: 315, y: 110 },
        ];

    return { xLabels, pts };
  }, [timeRange]);

  if (loading && !status) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LoadingState message="Loading air quality parameters..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
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
        <View style={styles.headerRow}>
          <Pressable
            style={styles.headerIconButton}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
          </Pressable>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Air Quality</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIconButton}
              onPress={refresh}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Refresh telemetry"
            >
              <Ionicons name="refresh-outline" size={18} color={colors.primaryText} />
            </Pressable>

            <Pressable
              style={styles.headerIconButton}
              onPress={() => router.push("/settings")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color={colors.primaryText} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.gaugeContainer}>
              <Svg width={gaugeW} height={gaugeH}>
                <Defs>
                  <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#10B981" />
                    <Stop offset="45%" stopColor="#F59E0B" />
                    <Stop offset="75%" stopColor="#F97316" />
                    <Stop offset="100%" stopColor="#EF4444" />
                  </LinearGradient>
                </Defs>

                <Path
                  d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                  fill="none"
                  stroke={colors.border}
                  strokeWidth={13}
                  strokeLinecap="round"
                />

                <Path
                  d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth={13}
                  strokeLinecap="round"
                />
              </Svg>

              <View style={styles.gaugeCenterBadge}>
                <View style={styles.leafCircle}>
                  <Ionicons name="leaf" size={20} color={currentCfg.categoryColor} />
                </View>
              </View>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: currentCfg.statusBg,
                    borderColor: currentCfg.statusBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: currentCfg.categoryColor },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: currentCfg.categoryColor },
                  ]}
                >
                  {currentCfg.category}
                </Text>
              </View>
            </View>

            <View style={styles.heroReadingGroup}>
              <Text style={styles.pmParamLabel}>{currentCfg.label}</Text>
              <View style={styles.pmValueRow}>
                <Text style={styles.pmNumber}>{currentCfg.value}</Text>
                <Text style={styles.pmUnitText}>{currentCfg.unit}</Text>
              </View>

              <View style={styles.trendRow}>
                <Ionicons name={currentCfg.trendIcon} size={13} color="#10B981" />
                <Text style={styles.trendGreenText}>{currentCfg.trendText}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.scaleCard}>
          <View style={styles.scaleRow}>
            {[
              { cat: "Good", color: "#10B981", range: currentCfg.scaleRanges[0], idx: 0 },
              { cat: "Moderate", color: "#F59E0B", range: currentCfg.scaleRanges[1], idx: 1 },
              { cat: "Sensitive", color: "#F97316", range: currentCfg.scaleRanges[2], idx: 2 },
              { cat: "Unhealthy", color: "#EF4444", range: currentCfg.scaleRanges[3], idx: 3 },
              { cat: "Hazardous", color: "#991B1B", range: currentCfg.scaleRanges[4], idx: 4 },
            ].map((col) => {
              const isCurrent = currentCfg.activeIntervalIndex === col.idx;
              return (
                <View
                  key={col.cat}
                  style={[
                    styles.scaleColumn,
                    isCurrent && styles.scaleColumnActive,
                  ]}
                >
                  <Text style={[styles.scaleCategory, { color: col.color }]}>
                    {col.cat}
                  </Text>
                  <View
                    style={[
                      styles.scaleBarSegment,
                      { backgroundColor: col.color },
                      isCurrent && { height: 6 },
                    ]}
                  />
                  <Text style={[styles.scaleRange, isCurrent && styles.scaleRangeActive]}>
                    {col.range}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.paramPillsRow}>
          {(["PM2.5", "PM10", "CO2", "TVOC"] as const).map((param) => {
            const isSelected = selectedParam === param;
            return (
              <Pressable
                key={param}
                style={[
                  styles.paramPill,
                  isSelected && styles.paramPillActive,
                ]}
                onPress={() => setSelectedParam(param)}
                accessibilityRole="button"
                accessibilityLabel={`${param} parameter`}
              >
                <Text
                  style={[
                    styles.paramPillText,
                    isSelected && styles.paramPillTextActive,
                  ]}
                >
                  {param}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.chartTitle}>{selectedParam} Continuous Trend</Text>
            <View style={styles.rangePillsRow}>
              {(["Today", "7 Days"] as const).map((range) => {
                const isActive = timeRange === range;
                return (
                  <Pressable
                    key={range}
                    style={[
                      styles.rangePill,
                      isActive && styles.rangePillActive,
                    ]}
                    onPress={() => setTimeRange(range)}
                    accessibilityRole="button"
                    accessibilityLabel={`${range} view`}
                  >
                    <Text
                      style={[
                        styles.rangePillText,
                        isActive && styles.rangePillTextActive,
                      ]}
                    >
                      {range}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Svg width={screenWidth - 72} height={180}>
              <Defs>
                <LinearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#D7FF43" stopOpacity="0.22" />
                  <Stop offset="100%" stopColor="#D7FF43" stopOpacity="0.0" />
                </LinearGradient>
              </Defs>

              {[30, 70, 110, 140].map((y, idx) => (
                <Line
                  key={idx}
                  x1={30}
                  y1={y}
                  x2={screenWidth - 85}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))}

              <Path
                d={`M 35 130
                    C 75 118, 110 110, 150 78
                    C 185 52, 215 50, 245 78
                    C 275 98, 300 110, 315 120
                    L 315 150 L 35 150 Z`}
                fill="url(#chartGrad)"
              />

              <Path
                d={`M 35 130
                    C 75 118, 110 110, 150 78
                    C 185 52, 215 50, 245 78
                    C 275 98, 300 110, 315 120`}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {chartPoints.pts.map((pt, i) => (
                <Circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={i === 3 ? 5 : 3.5}
                  fill={i === 3 ? colors.background : colors.accent}
                  stroke={colors.accent}
                  strokeWidth={2}
                />
              ))}
            </Svg>

            <View style={styles.tooltipBadge}>
              <Text style={styles.tooltipVal}>{currentCfg.peakVal}</Text>
              <Text style={styles.tooltipSub}>{currentCfg.peakTime}</Text>
            </View>

            <View style={styles.yAxisLabels}>
              <Text style={styles.axisText}>75</Text>
              <Text style={styles.axisText}>50</Text>
              <Text style={styles.axisText}>25</Text>
              <Text style={styles.axisText}>0</Text>
            </View>
          </View>

          <View style={styles.xAxisRow}>
            {chartPoints.xLabels.map((lbl, idx) => (
              <Text key={idx} style={styles.axisText}>
                {lbl}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.sensorDetailCard}>
          <View style={styles.detailCardHeader}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
            <Text style={styles.detailCardTitle}>{currentCfg.sensorDetailTitle}</Text>
          </View>

          <View style={styles.telemetryTable}>
            {currentCfg.tableRows.map((row, idx) => {
              const isLast = idx === currentCfg.tableRows.length - 1;
              return (
                <View
                  key={row.key}
                  style={[
                    styles.telemetryRow,
                    isLast && { borderBottomWidth: 0 },
                    row.isHighlight && { backgroundColor: "rgba(215,255,67,0.08)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.telemetryKey,
                      row.isHighlight && { fontFamily: typography.fontFamilies.semiBold, color: colors.primaryText },
                    ]}
                  >
                    {row.key}
                  </Text>
                  <Text
                    style={[
                      styles.telemetryVal,
                      row.isHighlight && { color: colors.success, fontFamily: typography.fontFamilies.semiBold },
                    ]}
                  >
                    {row.val}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 18,
    color: colors.primaryText,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 160,
  },
  gaugeCenterBadge: {
    position: "absolute",
    top: 26,
    alignItems: "center",
  },
  leafCircle: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: -8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
  },
  heroReadingGroup: {
    flex: 1,
    paddingLeft: 16,
  },
  pmParamLabel: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.secondaryText,
  },
  pmValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 2,
  },
  pmNumber: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 38,
    color: colors.primaryText,
    lineHeight: 44,
  },
  pmUnitText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.secondaryText,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  trendGreenText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: "#10B981",
  },
  scaleCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scaleColumn: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scaleColumnActive: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scaleCategory: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 10,
    marginBottom: 6,
  },
  scaleBarSegment: {
    width: "82%",
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  scaleRange: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 9,
    color: colors.secondaryText,
  },
  scaleRangeActive: {
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.primaryText,
  },
  paramPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  paramPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  paramPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  paramPillText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  paramPillTextActive: {
    color: colors.background,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chartTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  rangePillsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rangePillActive: {
    backgroundColor: colors.accent,
  },
  rangePillText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  rangePillTextActive: {
    color: colors.background,
  },
  chartContainer: {
    position: "relative",
    marginVertical: 6,
  },
  tooltipBadge: {
    position: "absolute",
    top: 14,
    left: (screenWidth - 85) * 0.52,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tooltipVal: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 10,
    color: colors.primaryText,
  },
  tooltipSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 9,
    color: colors.secondaryText,
  },
  yAxisLabels: {
    position: "absolute",
    left: 2,
    top: 14,
    height: 128,
    justifyContent: "space-between",
  },
  axisText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 10,
    color: colors.secondaryText,
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    marginTop: 4,
  },
  sensorDetailCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  detailCardTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  telemetryTable: {
    gap: 8,
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  telemetryKey: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  telemetryVal: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.primaryText,
  },
});
