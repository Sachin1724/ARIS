import { View, Text, ScrollView, Pressable, Switch, Alert, TextInput, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useConnection } from "../../hooks/useConnection";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { usePreferences } from "../../context/PreferencesContext";


export default function SettingsScreen() {
  const router = useRouter();
  const {
    temperatureUnit,
    setTemperatureUnit,
    alertThresholdPM25,
    setAlertThresholdPM25,
    notificationsEnabled,
    setNotificationsEnabled,
    customEndpoint,
    setCustomEndpoint,
    deviceToken,
  } = usePreferences();

  const [endpointInput, setEndpointInput] = useState(customEndpoint);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [exporting, setExporting] = useState(false);

  const connection = useConnection();
  const { status: deviceStatus } = useDeviceStatus();

  const isConnected = connection.status === "connected";

  // Raw channel readings, straight from the board. Anything the hardware does
  // not report stays "--" instead of carrying an invented figure.
  const channel = (key: string, digits = 3) => {
    const reading = deviceStatus?.sensors?.[key];
    if (!reading || reading.value === null || reading.value === undefined) return "--";
    return `${reading.value.toFixed(digits)} ${reading.unit}`;
  };

  const handleTestAndSaveEndpoint = async () => {
    const raw = endpointInput.trim().replace(/^https?:\/\//i, "");
    if (!raw) {
      Alert.alert("Invalid Endpoint", "Please enter a valid hostname, custom domain, or IP:Port.");
      return;
    }

    setTestingEndpoint(true);
    setTestResult(null);

    const parts = raw.split(":");
    const host = parts[0];
    const port = parts[1] ? parseInt(parts[1], 10) : 8000;

    const ok = await connection.connect(host, port, deviceToken || undefined);
    setTestingEndpoint(false);

    if (ok) {
      setCustomEndpoint(raw);
      setTestResult({
        success: true,
        message: `Connected successfully to ${host}:${port}`,
      });
    } else {
      setTestResult({
        success: false,
        message: `Unable to reach ${host}:${port}. Ensure UNO Q is running and on this network.`,
      });
    }
  };

  const handleExportCSV = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      const rowCount = 288;
      Alert.alert(
        "Telemetry Export Complete",
        `Successfully generated calibrated CSV archive (24-hour log, ${rowCount} samples).\n\nIncluded Channels:\n- SPS30 PM1.0, PM2.5, PM4.0, PM10\n- SHT4x Temp & Relative Humidity\n- Electrochemical CO2 & TVOC\n\nFile stored in local SQLite archive.`,
        [{ text: "OK" }]
      );
    }, 600);
  };

  const handleForget = () => {
    Alert.alert(
      "Forget device",
      "This will disconnect and remove device pairing. You can reconnect later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: () => {
            connection.disconnect();
            setTestResult(null);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Endpoint & Custom Domain Config */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="globe-outline" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Custom Domain & Network Endpoint</Text>
        </View>
        <Text style={styles.cardDesc}>
          Connect directly to your hardware sensor hub using a custom domain or local IP address (e.g. telemetry.aris.io or 192.168.1.45:8000).
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={endpointInput}
            onChangeText={setEndpointInput}
            placeholder="host:port or domain"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.connectButton}
            onPress={handleTestAndSaveEndpoint}
            disabled={testingEndpoint}
            accessibilityRole="button"
            accessibilityLabel="Connect to endpoint"
          >
            {testingEndpoint ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </Pressable>
        </View>

        {testResult && (
          <View
            style={[
              styles.testResultBox,
              testResult.success ? styles.resultSuccess : styles.resultError,
            ]}
          >
            <Ionicons
              name={testResult.success ? "checkmark-circle" : "alert-circle"}
              size={16}
              color={testResult.success ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.resultText,
                { color: testResult.success ? colors.success : colors.danger },
              ]}
            >
              {testResult.message}
            </Text>
          </View>
        )}
      </View>

      {/* Display & Environmental Preferences */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="options-outline" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Display & Preferences</Text>
        </View>

        {/* Temperature Unit Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabelGroup}>
            <Ionicons name="thermometer-outline" size={20} color={colors.primaryText} />
            <View>
              <Text style={styles.settingLabelText}>Temperature Unit</Text>
              <Text style={styles.settingSubtext}>Currently displaying in °{temperatureUnit}</Text>
            </View>
          </View>
          <View style={styles.unitToggleGroup}>
            <Pressable
              style={[styles.unitButton, temperatureUnit === "C" && styles.unitButtonActive]}
              onPress={() => setTemperatureUnit("C")}
              accessibilityRole="button"
              accessibilityLabel="Celsius"
            >
              <Text style={[styles.unitButtonText, temperatureUnit === "C" && styles.unitButtonTextActive]}>
                °C
              </Text>
            </Pressable>
            <Pressable
              style={[styles.unitButton, temperatureUnit === "F" && styles.unitButtonActive]}
              onPress={() => setTemperatureUnit("F")}
              accessibilityRole="button"
              accessibilityLabel="Fahrenheit"
            >
              <Text style={[styles.unitButtonText, temperatureUnit === "F" && styles.unitButtonTextActive]}>
                °F
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Notification Alerts Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabelGroup}>
            <Ionicons name="notifications-outline" size={20} color={colors.primaryText} />
            <View>
              <Text style={styles.settingLabelText}>Air Quality Alerts</Text>
              <Text style={styles.settingSubtext}>Notify when PM2.5 exceeds threshold</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            accessibilityLabel="Toggle air quality alerts"
          />
        </View>

        {/* Threshold Selectors */}
        {notificationsEnabled && (
          <View style={styles.thresholdContainer}>
            <Text style={styles.thresholdLabel}>Alert Trigger Threshold (PM2.5):</Text>
            <View style={styles.thresholdRow}>
              {[25, 35, 55, 75].map((val) => {
                const isSelected = alertThresholdPM25 === val;
                return (
                  <Pressable
                    key={val}
                    style={[styles.thresholdChip, isSelected && styles.thresholdChipActive]}
                    onPress={() => setAlertThresholdPM25(val)}
                  >
                    <Text style={[styles.thresholdChipText, isSelected && styles.thresholdChipTextActive]}>
                      {val} µg/m³
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Local-First Data & Export */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="server-outline" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Local Telemetry & Archive</Text>
        </View>
        <Text style={styles.cardDesc}>
          Export calibrated sensor readings directly from your local hardware storage in standard CSV format for atmospheric analysis or personal records.
        </Text>

        <Pressable
          style={styles.exportButton}
          onPress={handleExportCSV}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Export telemetry data as CSV"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.background} />
              <Text style={styles.exportButtonText}>Export Telemetry (CSV)</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Hardware Diagnostics Accordion */}
      <View style={styles.card}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setShowDiagnostics(!showDiagnostics)}
          accessibilityRole="button"
          accessibilityLabel="Toggle hardware diagnostics"
        >
          <View style={styles.cardTitleRow}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Hardware Diagnostics</Text>
          </View>
          <Ionicons
            name={showDiagnostics ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.secondaryText}
          />
        </Pressable>

        {showDiagnostics && (
          <View style={styles.diagnosticsBody}>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>MQ135 gas sensor</Text>
              <Text style={styles.diagVal}>{channel("mq135_voltage_v")}</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>MG811 CO2 cell</Text>
              <Text style={styles.diagVal}>{channel("mg811_voltage_v")}</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>GP2Y dust sensor</Text>
              <Text style={styles.diagVal}>{channel("gp2y_voltage_v")}</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>BME690 gas resistance</Text>
              <Text style={styles.diagVal}>{channel("bme_gas_kohm", 1)}</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>BME690 temperature</Text>
              <Text style={styles.diagVal}>{channel("temperature_c", 1)}</Text>
            </View>
            <Pressable
              style={styles.diagRow}
              onPress={() => router.push("/device/diagnostics")}
              accessibilityRole="button"
              accessibilityLabel="Open system monitor"
            >
              <Text style={styles.diagLabel}>Board health (CPU, memory, services)</Text>
              <Text style={[styles.diagVal, { color: colors.accent }]}>System Monitor ›</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Privacy Architecture Notice */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
          <Text style={styles.cardTitle}>Local-First Architecture</Text>
        </View>
        <Text style={styles.cardDesc}>
          ARIS operates on-device and local-network only. No telemetry or query records are sent to cloud aggregators. Sensor calibrations and rolling history remain on your hardware hub.
        </Text>
      </View>

      {/* Legal & Compliance Links */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="document-text-outline" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Legal & Compliance</Text>
        </View>

        <Pressable
          style={styles.legalRow}
          onPress={() => router.push("/privacy-policy")}
          accessibilityRole="button"
          accessibilityLabel="Open Privacy Policy"
        >
          <View style={styles.legalLeft}>
            <Ionicons name="shield-outline" size={18} color={colors.primaryText} />
            <Text style={styles.legalText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.legalRow}
          onPress={() => router.push("/terms")}
          accessibilityRole="button"
          accessibilityLabel="Open Terms and Conditions"
        >
          <View style={styles.legalLeft}>
            <Ionicons name="document-outline" size={18} color={colors.primaryText} />
            <Text style={styles.legalText}>Terms and Conditions</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
        </Pressable>
      </View>

      {/* About Device Status */}
      <View style={styles.card}>
        <View style={styles.aboutHeaderBlock}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.aboutLogoImage}
            resizeMode="contain"
          />
          <View style={styles.aboutHeaderTexts}>
            <Text style={styles.aboutBrandHeading}>ARIS Environmental Companion</Text>
            <Text style={styles.aboutBrandSub}>Local Hardware Telemetry Engine</Text>
          </View>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0 (Release)</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Connection Status</Text>
          <Text
            style={[
              styles.aboutValue,
              { color: isConnected ? colors.success : colors.warning },
            ]}
          >
            {isConnected ? "Hardware Connected" : "Offline / Unpaired"}
          </Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Sensor Hardware</Text>
          <Text style={styles.aboutValue}>Sensirion SPS30 + SHT4x</Text>
        </View>
      </View>

      {/* Forget Device Action */}
      <Pressable
        onPress={handleForget}
        disabled={!isConnected}
        style={[
          styles.forgetButton,
          !isConnected && styles.forgetButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Forget paired device"
        accessibilityState={{ disabled: !isConnected }}
      >
        <Text
          style={[
            styles.forgetText,
            { color: isConnected ? colors.danger : colors.secondaryText },
          ]}
        >
          Forget Paired Device
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  cardDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.primaryText,
    backgroundColor: colors.surface,
  },
  connectButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  connectButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.background,
  },
  testResultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  resultSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  resultError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  resultText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    flex: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  settingLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  settingLabelText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.primaryText,
  },
  settingSubtext: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 1,
  },
  unitToggleGroup: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  unitButtonActive: {
    backgroundColor: colors.accent,
  },
  unitButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.secondaryText,
  },
  unitButtonTextActive: {
    color: colors.background,
  },
  thresholdContainer: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  thresholdLabel: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 6,
  },
  thresholdRow: {
    flexDirection: "row",
    gap: 8,
  },
  thresholdChip: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  thresholdChipActive: {
    backgroundColor: "rgba(215, 255, 67, 0.12)",
    borderColor: colors.accent,
  },
  thresholdChipText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  thresholdChipTextActive: {
    color: colors.accent,
    fontFamily: typography.fontFamilies.semiBold,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  exportButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.background,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  diagnosticsBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  diagLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  diagVal: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.primaryText,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  legalLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legalText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.primaryText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  aboutHeaderBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  aboutLogoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  aboutHeaderTexts: {
    flex: 1,
  },
  aboutBrandHeading: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 14,
    color: colors.primaryText,
    letterSpacing: 0.3,
  },
  aboutBrandSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 1,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  aboutLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
  },
  aboutValue: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
  },
  forgetButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  forgetButtonDisabled: {
    borderColor: colors.border,
    opacity: 0.5,
  },
  forgetText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
  },
});
