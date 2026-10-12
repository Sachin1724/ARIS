import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Mascot } from "page-mascot";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useConnection } from "../../hooks/useConnection";
import { usePreferences } from "../../context/PreferencesContext";

export default function DeviceIndexScreen() {
  const router = useRouter();
  const connection = useConnection();
  const { customEndpoint, setCustomEndpoint, deviceToken } = usePreferences();

  const [showManualIp, setShowManualIp] = useState(false);
  const [manualHost, setManualHost] = useState(customEndpoint);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualConnect = async () => {
    if (!manualHost.trim()) return;
    setManualLoading(true);
    setManualError(null);

    const parts = manualHost.trim().replace(/^https?:\/\//i, "").split(":");
    const host = parts[0] || "192.168.1.45";
    const port = parts[1] ? parseInt(parts[1], 10) : 8000;

    try {
      const ok = await connection.connect(host, port, deviceToken || undefined);
      if (ok) {
        setCustomEndpoint(manualHost.trim());
        router.replace("/(tabs)/home");
      } else {
        setManualError(
          "Could not reach ARIS on this IP. Ensure the UNO Q is powered and on the same Wi-Fi network."
        );
      }
    } catch (err) {
      setManualError(
        err instanceof Error ? err.message : "Connection failed to endpoint"
      );
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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

        <Text style={styles.headerTitle}>Connect ARIS</Text>

        <Pressable
          style={styles.headerIconButton}
          onPress={() => router.push("/device/diagnostics")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Device diagnostics"
        >
          <Ionicons name="hardware-chip-outline" size={20} color={colors.primaryText} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotHeroCard}>
          <View style={styles.mascotContainer}>
            <Mascot state="welcome" size={110} animated />
          </View>
          <Text style={styles.heroTitle}>Pair your Arduino UNO Q</Text>
          <Text style={styles.heroSubtitle}>
            ARIS uses Bluetooth Low Energy for discovery and authenticated setup, then connects over local Wi-Fi for continuous sensor telemetry.
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.cardHeader}>Onboarding Protocol</Text>

          {[
            { n: "1", title: "Bluetooth Discovery & GATT", desc: "Discovers the dedicated ARIS service UUID and verifies hardware identity." },
            { n: "2", title: "Secure Setup Code", desc: "Authorizes pairing via one-time challenge proof before any credentials are shared." },
            { n: "3", title: "Encrypted Wi-Fi Provisioning", desc: "Transfers local network credentials over protected BLE characteristic." },
            { n: "4", title: "Direct Wi-Fi REST & WebSocket", desc: "Streams live optical particle readings and local forecasts directly without cloud accounts." },
          ].map((step) => (
            <View key={step.n} style={styles.stepItem}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>{step.n}</Text>
              </View>
              <View style={styles.stepTextGroup}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.findButton}
          onPress={() => router.push("/device/scan")}
          accessibilityRole="button"
          accessibilityLabel="Find my device"
        >
          <Ionicons name="bluetooth" size={18} color={colors.background} />
          <Text style={styles.findButtonText}>Find my device</Text>
        </Pressable>

        <Pressable
          style={styles.manualToggle}
          onPress={() => setShowManualIp((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Toggle manual IP configuration"
        >
          <Ionicons
            name={showManualIp ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.secondaryText}
          />
          <Text style={styles.manualToggleText}>
            Manual IP / Network Fallback
          </Text>
        </Pressable>

        {showManualIp && (
          <View style={styles.manualCard}>
            <Text style={styles.manualLabel}>UNO Q Network Endpoint (Host:Port)</Text>
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="192.168.1.45:8000"
                placeholderTextColor={colors.mutedText}
                value={manualHost}
                onChangeText={setManualHost}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[
                  styles.manualConnectButton,
                  manualLoading && styles.buttonDisabled,
                ]}
                onPress={handleManualConnect}
                disabled={manualLoading}
                accessibilityRole="button"
                accessibilityLabel="Connect directly to manual IP"
              >
                {manualLoading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.manualConnectText}>Connect</Text>
                )}
              </Pressable>
            </View>
            {manualError && (
              <Text style={styles.manualErrorText}>{manualError}</Text>
            )}
            <Text style={styles.manualHint}>
              Use this if your router isolates BLE or if you have already provisioned Wi-Fi previously.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 17,
    color: colors.primaryText,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 16,
  },
  mascotHeroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  mascotContainer: {
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 20,
    color: colors.primaryText,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  stepsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
    marginBottom: 2,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.primaryText,
  },
  stepTextGroup: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  stepDescription: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
    lineHeight: 16,
  },
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 48,
  },
  findButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
  },
  manualToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  manualToggleText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.secondaryText,
  },
  manualCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  manualLabel: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.primaryText,
  },
  manualInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 40,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.primaryText,
  },
  manualConnectButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  manualConnectText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  manualErrorText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.danger,
  },
  manualHint: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    lineHeight: 15,
  },
});
