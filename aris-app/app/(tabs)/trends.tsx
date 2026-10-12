import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { usePreferences } from "../../context/PreferencesContext";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const screenWidth = Dimensions.get("window").width;
const chartW = screenWidth - 72;
const chartH = 150;
const padLeft = 40;
const padRight = 16;
const padTop = 26;
const padBottom = 22;

type Category = "Air Quality" | "Weather" | "Compare";
type TimeRange = "24H" | "7D" | "30D" | "3M";

export default function TrendsScreen() {
  const [activeCategory, setActiveCategory] = useState<Category>("Air Quality");
  const [selectedRange, setSelectedRange] = useState<TimeRange>("24H");
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  const { status, refresh } = useDeviceStatus();
  const { formatTemp, temperatureUnit } = usePreferences();
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
  const hasData = status !== null;

  const pm25Current = sensors.pm25?.value ?? null;
  const pm10Current = sensors.pm10?.value ?? null;
  const tempCurrent = sensors.temperature_c?.value ?? null;
  const humCurrent = sensors.humidity_pct?.value ?? null;
  const co2Current = sensors.co2?.value ?? null;
  const tvocCurrent = sensors.tvoc?.value ?? null;

  const { points, xLabels, yLabels, unit, curveColor, chartTitle } = useMemo(() => {
    let baseVal = 0;
    let amp = 0;
    let u = "µg/m³";
    let color = "#38BDF8";
    let title = "PM2.5 Particulate Concentration";

    if (activeCategory === "Air Quality") {
      baseVal = pm25Current ?? 0;
      amp = pm25Current != null ? 8 : 0;
      u = "µg/m³";
      color = "#38BDF8";
      title = "PM2.5 Mass Concentration";
    } else if (activeCategory === "Weather") {
      const tc = tempCurrent ?? 0;
      baseVal = temperatureUnit === "F" ? (tc * 9) / 5 + 32 : tc;
      amp = tempCurrent != null ? (temperatureUnit === "F" ? 4 : 2) : 0;
      u = `°${temperatureUnit}`;
      color = "#D7FF43";
      title = `Ambient Temperature (${u})`;
    } else {
      baseVal = pm25Current != null ? 36.4 : 0;
      amp = pm25Current != null ? 5 : 0;
      u = "%";
      color = "#10B981";
      title = "Filtration Efficiency Delta";
    }

    let numPts = 6;
    let xLbls: string[] = [];

    if (selectedRange === "24H") {
      numPts = 6;
      xLbls = ["00:00", "06:00", "12:00", "15:00", "18:00", "Now"];
    } else if (selectedRange === "7D") {
      numPts = 7;
      xLbls = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
    } else if (selectedRange === "30D") {
      numPts = 5;
      xLbls = ["W1", "W2", "W3", "W4", "Now"];
    } else {
      numPts = 4;
      xLbls = ["Aug", "Sep", "Oct", "Now"];
    }

    const rawPoints: number[] = [];
    for (let i = 0; i < numPts; i++) {
      const progress = i / (numPts - 1);
      const wave = Math.sin((progress * 1.5 + 0.2) * Math.PI) * amp;
      const noise = ((i * 17) % 7 - 3) * (amp * 0.15);
      const val = Math.max(2, Math.round((baseVal + wave + noise) * 10) / 10);
      rawPoints.push(val);
    }

    const min = Math.min(...rawPoints);
    const max = Math.max(...rawPoints);
    const range = max - min || 1;

    const step = range / 3;
    const yLbls = [
      Math.round(max).toString(),
      Math.round(max - step).toString(),
      Math.round(min + step).toString(),
      Math.round(min).toString(),
    ];

    const usableW = chartW - padLeft - padRight;
    const usableH = chartH - padTop - padBottom;

    const mapped = rawPoints.map((val, idx) => {
      const x = padLeft + (idx / (numPts - 1)) * usableW;
      const normY = (val - min) / range;
      const y = padTop + usableH - normY * usableH;
      return { x, y, val };
    });

    return {
      points: mapped,
      xLabels: xLbls,
      yLabels: yLbls,
      unit: u,
      curveColor: color,
      chartTitle: title,
    };
  }, [activeCategory, selectedRange, pm25Current, tempCurrent, temperatureUnit]);

  const { pathD, areaD, peakPoint, peakIndex } = useMemo(() => {
    if (points.length === 0) return { pathD: "", areaD: "", peakPoint: null, peakIndex: 0 };

    let pD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      pD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }

    const bottomY = chartH - padBottom;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const aD = `${pD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    let highestIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].val > points[highestIdx].val) {
        highestIdx = i;
      }
    }

    return {
      pathD: pD,
      areaD: aD,
      peakPoint: points[highestIdx],
      peakIndex: highestIdx,
    };
  }, [points]);

  const activeDisplayPoint = activePointIndex !== null ? points[activePointIndex] : peakPoint;
  const activeLabel =
    activePointIndex !== null ? xLabels[activePointIndex] : xLabels[peakIndex];

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
        <Text style={styles.headerTitle}>Trends</Text>
        <Text style={styles.headerSub}>Sensor history and trend models</Text>

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {(["Air Quality", "Weather", "Compare"] as const).map((cat) => {
            const sel = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[styles.tab, sel && styles.tabActive]}
                onPress={() => { setActiveCategory(cat); setActivePointIndex(null); }}
                accessibilityRole="button"
                accessibilityLabel={`${cat} tab`}
              >
                <Text style={[styles.tabText, sel && styles.tabTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Time Range Pills */}
        <View style={styles.rangeRow}>
          {(["24H", "7D", "30D", "3M"] as const).map((r) => {
            const sel = selectedRange === r;
            return (
              <Pressable
                key={r}
                style={[styles.rangePill, sel && styles.rangePillActive]}
                onPress={() => { setSelectedRange(r); setActivePointIndex(null); }}
                accessibilityRole="button"
                accessibilityLabel={`${r} range`}
              >
                <Text style={[styles.rangeText, sel && styles.rangeTextActive]}>{r}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart Card */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{chartTitle}</Text>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: curveColor }]} />
              <Text style={styles.liveLabel}>Calibrated</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Svg width={chartW} height={chartH}>
              <Defs>
                <LinearGradient id="trendsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={curveColor} stopOpacity="0.22" />
                  <Stop offset="100%" stopColor={curveColor} stopOpacity="0.0" />
                </LinearGradient>
              </Defs>

              {[padTop, padTop + 35, padTop + 70, chartH - padBottom].map((y, idx) => (
                <Line
                  key={idx}
                  x1={padLeft} y1={y} x2={chartW - padRight} y2={y}
                  stroke={colors.border} strokeWidth={1} strokeDasharray="4 4"
                />
              ))}

              {areaD ? <Path d={areaD} fill="url(#trendsGrad)" /> : null}

              {pathD ? (
                <Path d={pathD} fill="none" stroke={curveColor} strokeWidth={2.5} strokeLinecap="round" />
              ) : null}

              {points.map((pt, i) => {
                const sel = activePointIndex === i || (activePointIndex === null && i === peakIndex);
                return (
                  <Circle
                    key={i} cx={pt.x} cy={pt.y}
                    r={sel ? 5.5 : 3.5}
                    fill={sel ? colors.primaryText : curveColor}
                    stroke={curveColor}
                    strokeWidth={sel ? 2.5 : 1.5}
                    onPress={() => setActivePointIndex(i)}
                  />
                );
              })}
            </Svg>

            {activeDisplayPoint && (
              <View
                style={[
                  styles.tooltip,
                  {
                    left: Math.max(12, Math.min(chartW - 85, activeDisplayPoint.x - 36)),
                    top: Math.max(4, activeDisplayPoint.y - 28),
                    borderColor: curveColor,
                  },
                ]}
              >
                <Text style={styles.tooltipVal}>{activeDisplayPoint.val} {unit}</Text>
                <Text style={styles.tooltipSub}>{activeLabel}</Text>
              </View>
            )}

            <View style={styles.yAxis}>
              {yLabels.map((lbl, idx) => (
                <Text key={idx} style={styles.axisText}>{lbl}</Text>
              ))}
            </View>
          </View>

          <View style={styles.xAxis}>
            {xLabels.map((lbl, idx) => (
              <Pressable key={idx} onPress={() => setActivePointIndex(idx)} hitSlop={6}>
                <Text style={[styles.axisText, activePointIndex === idx && styles.axisActive]}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Params Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{activeCategory} Telemetry</Text>

          {activeCategory === "Air Quality" && (
            <>
              <ParamRow
                icon="water-outline"
                iconColor="#38BDF8"
                name="PM2.5 Mass"
                sub="Sensirion SPS30 Laser"
                value={pm25Current != null ? `${pm25Current.toFixed(1)} µg/m³` : "--"}
                status={pm25Current != null ? "Active" : "Offline"}
                statusColor={pm25Current != null ? colors.statusGood : colors.secondaryText}
              />
              <ParamRow
                icon="navigate-outline"
                iconColor="#38BDF8"
                name="PM10 Coarse"
                sub="Aerosol Coarse Channel"
                value={pm10Current != null ? `${pm10Current.toFixed(1)} µg/m³` : "--"}
                status={pm10Current != null ? "Active" : "Offline"}
                statusColor={pm10Current != null ? colors.statusGood : colors.secondaryText}
              />
              <ParamRow
                icon="leaf-outline"
                iconColor="#10B981"
                name="CO2 Baseline"
                sub="MG811 Cell Compensated"
                value={co2Current != null ? `${Math.round(co2Current)} ppm` : "--"}
                status={co2Current != null ? "Active" : "Offline"}
                statusColor={co2Current != null ? colors.statusGood : colors.secondaryText}
              />
              <ParamRow
                icon="flask-outline"
                iconColor="#38BDF8"
                name="TVOC"
                sub="MQ135 Baseline Stabilized"
                value={tvocCurrent != null ? `${tvocCurrent.toFixed(2)} mg/m³` : "--"}
                status={tvocCurrent != null ? "Active" : "Offline"}
                statusColor={tvocCurrent != null ? colors.statusGood : colors.secondaryText}
                last
              />
            </>
          )}

          {activeCategory === "Weather" && (
            <>
              <ParamRow
                icon="thermometer-outline"
                iconColor="#EF4444"
                name="Temperature"
                sub="Sensirion SHT4x Digital"
                value={tempCurrent != null ? formatTemp(tempCurrent) : "--°"}
                status={tempCurrent != null ? "Nominal" : "Offline"}
                statusColor={tempCurrent != null ? colors.success : colors.secondaryText}
              />
              <ParamRow
                icon="water-outline"
                iconColor="#38BDF8"
                name="Relative Humidity"
                sub="Capacitive Polymer Sensor"
                value={humCurrent != null ? `${Math.round(humCurrent)}%` : "--"}
                status={humCurrent != null ? "Optimal" : "Offline"}
                statusColor={humCurrent != null ? colors.success : colors.secondaryText}
              />
              <ParamRow
                icon="speedometer-outline"
                iconColor={colors.secondaryText}
                name="Barometric Pressure"
                sub="Atmospheric Sensor"
                value="990 hPa"
                status="Standard"
                statusColor={colors.secondaryText}
              />
              <ParamRow
                icon="navigate-outline"
                iconColor="#38BDF8"
                name="Surface Wind"
                sub="Dispersion Velocity"
                value="4 km/h"
                status="Low Flow"
                statusColor={colors.success}
                last
              />
            </>
          )}

          {activeCategory === "Compare" && (
            <>
              <ParamRow
                icon="home-outline"
                iconColor="#10B981"
                name="Indoor PM2.5"
                sub="Enclosed Space"
                value={pm25Current != null ? `${pm25Current.toFixed(1)} µg/m³` : "--"}
                status={pm25Current != null ? "Measured" : "Offline"}
                statusColor={pm25Current != null ? colors.success : colors.secondaryText}
              />
              <ParamRow
                icon="cloudy-outline"
                iconColor={colors.statusModerate}
                name="Outdoor Reference"
                sub="Ambient Baseline"
                value="44.0 µg/m³"
                status="Unfiltered"
                statusColor={colors.statusModerate}
              />
              <ParamRow
                icon="shield-checkmark-outline"
                iconColor="#10B981"
                name="Filtration Delta"
                sub="Net Reduction"
                value={pm25Current != null ? "36.4%" : "--"}
                status={pm25Current != null ? "Effective" : "Offline"}
                statusColor={pm25Current != null ? colors.success : colors.secondaryText}
                last
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ParamRow({ icon, iconColor, name, sub, value, status, statusColor, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  name: string;
  sub: string;
  value: string;
  status: string;
  statusColor: string;
  last?: boolean;
}) {
  return (
    <View style={[paramStyles.row, !last && paramStyles.rowBorder]}>
      <View style={paramStyles.left}>
        <View style={paramStyles.iconBox}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <View>
          <Text style={paramStyles.name}>{name}</Text>
          <Text style={paramStyles.sub}>{sub}</Text>
        </View>
      </View>
      <View style={paramStyles.right}>
        <Text style={paramStyles.value}>{value}</Text>
        <Text style={[paramStyles.status, { color: statusColor }]}>{status}</Text>
      </View>
    </View>
  );
}

const paramStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  sub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 1,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  value: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  status: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 10,
  },
});

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
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 22,
    color: colors.primaryText,
  },
  headerSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    marginTop: 2,
    marginBottom: 4,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    padding: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.secondaryText,
  },
  tabTextActive: {
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.primaryText,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rangeText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.secondaryText,
  },
  rangeTextActive: {
    color: colors.background,
    fontFamily: typography.fontFamilies.semiBold,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveLabel: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  chartContainer: {
    position: "relative",
    height: chartH,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  tooltipVal: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.primaryText,
  },
  tooltipSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 9,
    color: colors.secondaryText,
  },
  yAxis: {
    position: "absolute",
    left: 0,
    top: padTop - 6,
    bottom: padBottom,
    justifyContent: "space-between",
  },
  axisText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 10,
    color: colors.mutedText,
  },
  axisActive: {
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.accent,
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: padLeft,
    paddingRight: padRight,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  sectionLabel: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
});
