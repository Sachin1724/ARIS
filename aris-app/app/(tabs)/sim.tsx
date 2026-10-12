import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Cpu, Activity, RefreshCw, Zap, ShieldCheck, ChevronRight } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { usePreferences } from "../../context/PreferencesContext";

type SimScenario = "nominal" | "urban_traffic" | "wildfire_smoke" | "indoor_cooking";

export default function SimulatorScreen() {
  const router = useRouter();
  const { status, refresh } = useDeviceStatus();
  const { station, customEndpoint } = usePreferences();
  const [activeScenario, setActiveScenario] = useState<SimScenario>("nominal");
  const [isSimulatingSpike, setIsSimulatingSpike] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refresh());
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Base telemetry from active device or simulated sensors
  const sensors = status?.sensors ?? {};
  const isConnected = status !== null;
  const pm25Base = sensors.pm25?.value ?? (isSimulatingSpike ? 28.0 : null);
  const tempBase = sensors.temperature_c?.value ?? null;
  const humBase = sensors.humidity_pct?.value ?? null;
  const mq135Val = sensors.mq135_adc?.value ?? null;
  const mg811Val = sensors.mg811_voltage_v?.value ?? null;

  const currentPM25 = isSimulatingSpike
    ? activeScenario === "wildfire_smoke"
      ? 142.5
      : activeScenario === "urban_traffic"
      ? 58.2
      : activeScenario === "indoor_cooking"
      ? 84.0
      : 14.8
    : pm25Base;

  const handleTriggerScenario = (scenario: SimScenario) => {
    setActiveScenario(scenario);
    setIsSimulatingSpike(true);
  };

  const handleResetSimulation = () => {
    setIsSimulatingSpike(false);
    setActiveScenario("nominal");
  };

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
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Hardware Sim</Text>
            <Text style={styles.headerSubtitle}>
              Arduino UNO Q & Environmental Telemetry Engine
            </Text>
          </View>
          <View style={styles.engineBadge}>
            <Activity size={14} color={colors.accent} strokeWidth={2.2} />
            <Text style={styles.engineBadgeText}>
              {isConnected ? "Live Node" : "Offline Node"}
            </Text>
          </View>
        </View>

        {/* Board Status Card */}
        <View style={styles.boardCard}>
          <View style={styles.boardCardHeader}>
            <View style={styles.chipIconBox}>
              <Cpu size={22} color={colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.boardInfoGroup}>
              <Text style={styles.boardName}>Arduino UNO Q (RZ/G2L)</Text>
              <Text style={styles.boardId}>ID: {station.stationId}</Text>
            </View>
            <View
              style={[
                styles.linkPill,
                { backgroundColor: isConnected ? "#1A2E1C" : "#252D1E" },
              ]}
            >
              <Text
                style={[
                  styles.linkPillText,
                  { color: isConnected ? colors.success : colors.secondaryText },
                ]}
              >
                {isConnected ? "Hardware Active" : "Unpaired"}
              </Text>
            </View>
          </View>

          <View style={styles.boardDivider} />

          <View style={styles.specsGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Debian Linux</Text>
              <Text style={styles.specValue}>v12 (Bookworm)</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>BlueZ Stack</Text>
              <Text style={styles.specValue}>v5.66 • BLE 5.1</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Local Endpoint</Text>
              <Text style={styles.specValue}>{customEndpoint || "8000"}</Text>
            </View>
          </View>

          <Pressable
            style={styles.diagnosticsLinkButton}
            onPress={() => router.push("/device/diagnostics")}
            accessibilityRole="button"
            accessibilityLabel="Open hardware diagnostics"
          >
            <ShieldCheck size={16} color={colors.accent} strokeWidth={2} />
            <Text style={styles.diagnosticsLinkText}>View GATT Bus & Sensor Channels</Text>
            <ChevronRight size={16} color={colors.secondaryText} />
          </Pressable>
        </View>

        {/* Sensor Channels Status */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Attached Sensor Channels</Text>

          <View style={styles.channelRow}>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>Sensirion SPS30</Text>
              <Text style={styles.channelDesc}>Laser Particle Counter • PM1.0/2.5/10</Text>
            </View>
            <Text style={styles.channelValue}>
              {currentPM25 != null ? `${currentPM25.toFixed(1)} µg/m³` : "--"}
            </Text>
          </View>

          <View style={styles.channelRow}>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>Sensirion SHT4x</Text>
              <Text style={styles.channelDesc}>Digital Humidity & Temp • I2C 0x44</Text>
            </View>
            <Text style={styles.channelValue}>
              {tempBase != null && humBase != null
                ? `${tempBase.toFixed(1)}°C • ${humBase.toFixed(0)}%`
                : "--"}
            </Text>
          </View>

          <View style={styles.channelRow}>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>MQ-135 Sensor</Text>
              <Text style={styles.channelDesc}>Hazardous Gas ADC • Calibrated</Text>
            </View>
            <Text style={styles.channelValue}>
              {mq135Val != null ? `${mq135Val} ADC` : "--"}
            </Text>
          </View>

          <View style={[styles.channelRow, { borderBottomWidth: 0 }]}>
            <View style={styles.channelInfo}>
              <Text style={styles.channelName}>MG-811 Electrolyte</Text>
              <Text style={styles.channelDesc}>Electrochemical CO2 Cell</Text>
            </View>
            <Text style={styles.channelValue}>
              {mg811Val != null ? `${mg811Val.toFixed(3)} V` : "--"}
            </Text>
          </View>
        </View>

        {/* Scenario Injection Controls */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Scenario Stress Testing</Text>
            {isSimulatingSpike && (
              <Pressable
                style={styles.resetButton}
                onPress={handleResetSimulation}
                accessibilityRole="button"
                accessibilityLabel="Reset scenario simulation"
              >
                <RefreshCw size={13} color={colors.accent} strokeWidth={2} />
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            Inject environmental event spikes into the local prediction model to verify notification thresholds.
          </Text>

          <View style={styles.scenariosGrid}>
            <Pressable
              style={[
                styles.scenarioButton,
                activeScenario === "nominal" && isSimulatingSpike && styles.scenarioButtonActive,
              ]}
              onPress={() => handleTriggerScenario("nominal")}
              accessibilityRole="button"
              accessibilityLabel="Trigger clean air scenario"
            >
              <Text style={styles.scenarioButtonTitle}>Clean Air</Text>
              <Text style={styles.scenarioButtonSub}>14.8 µg/m³ (Nominal)</Text>
            </Pressable>

            <Pressable
              style={[
                styles.scenarioButton,
                activeScenario === "urban_traffic" && isSimulatingSpike && styles.scenarioButtonActive,
              ]}
              onPress={() => handleTriggerScenario("urban_traffic")}
              accessibilityRole="button"
              accessibilityLabel="Trigger urban traffic scenario"
            >
              <Text style={styles.scenarioButtonTitle}>Traffic Influx</Text>
              <Text style={styles.scenarioButtonSub}>58.2 µg/m³ (Sensitive)</Text>
            </Pressable>

            <Pressable
              style={[
                styles.scenarioButton,
                activeScenario === "indoor_cooking" && isSimulatingSpike && styles.scenarioButtonActive,
              ]}
              onPress={() => handleTriggerScenario("indoor_cooking")}
              accessibilityRole="button"
              accessibilityLabel="Trigger indoor cooking scenario"
            >
              <Text style={styles.scenarioButtonTitle}>Indoor Cooking</Text>
              <Text style={styles.scenarioButtonSub}>84.0 µg/m³ (Spike)</Text>
            </Pressable>

            <Pressable
              style={[
                styles.scenarioButton,
                activeScenario === "wildfire_smoke" && isSimulatingSpike && styles.scenarioButtonActive,
              ]}
              onPress={() => handleTriggerScenario("wildfire_smoke")}
              accessibilityRole="button"
              accessibilityLabel="Trigger wildfire smoke scenario"
            >
              <Text style={styles.scenarioButtonTitle}>Wildfire Smoke</Text>
              <Text style={styles.scenarioButtonSub}>142.5 µg/m³ (Hazardous)</Text>
            </Pressable>
          </View>
        </View>

        {/* Pairing Re-entry */}
        <Pressable
          style={styles.reconnectButton}
          onPress={() => router.push("/device")}
          accessibilityRole="button"
          accessibilityLabel="Connect physical UNO Q"
        >
          <Zap size={16} color="#0D110E" strokeWidth={2.4} />
          <Text style={styles.reconnectButtonText}>Pair Physical Arduino UNO Q via BLE</Text>
        </Pressable>
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
    paddingTop: 12,
    paddingBottom: 110, // Breathing space above custom bottom navigation bar
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 22,
    color: colors.primaryText,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
  },
  engineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#252D1E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  engineBadgeText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.accent,
  },
  boardCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  boardCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#252D1E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(215, 255, 67, 0.2)",
  },
  boardInfoGroup: {
    flex: 1,
  },
  boardName: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  boardId: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 1,
  },
  linkPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkPillText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
  },
  boardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 14,
  },
  specsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  specItem: {
    flex: 1,
  },
  specLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },
  specValue: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.primaryText,
    marginTop: 2,
  },
  diagnosticsLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 8,
  },
  diagnosticsLinkText: {
    flex: 1,
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.accent,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#252D1E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resetButtonText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.accent,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
  },
  channelDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 1,
  },
  channelValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.accent,
  },
  scenariosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scenarioButton: {
    width: "48%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  scenarioButtonActive: {
    backgroundColor: "#252D1E",
    borderColor: colors.accent,
  },
  scenarioButtonTitle: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
  },
  scenarioButtonSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 2,
  },
  reconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  reconnectButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: "#0D110E",
  },
});
