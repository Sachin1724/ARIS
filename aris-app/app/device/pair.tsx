import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deviceApi } from "../../services/device/deviceApi";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export default function DevicePairScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoConnecting, setAutoConnecting] = useState(true);

  const state = deviceApi.getState();
  const device = state.selectedDevice;

  useEffect(() => {
    if (!device) {
      deviceApi.selectDevice({
        id: "UNOQ-8F4C-0082",
        name: "ARIS UNO Q (8F4C)",
        rssi: -58,
        isArisGatt: true,
        macAddress: "DC:54:75:A8:8F:4C",
      });
    }
  }, [device]);

  useEffect(() => {
    if (autoConnecting && device) {
      handlePair();
      setAutoConnecting(false);
    }
  }, [device, autoConnecting]);

  const handlePair = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await deviceApi.authorizeDevice("");
      router.push("/device/wifi-setup");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Pairing failed. Is D3 button pressed?"
      );
    } finally {
      setLoading(false);
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

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Pair Device</Text>
          <Text style={styles.headerSubtitle}>
            Step 3 of 5 — Physical Confirmation
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.deviceCard}>
          <View style={styles.deviceHeader}>
            <View style={styles.chipIcon}>
              <Ionicons name="hardware-chip-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.deviceTitleCol}>
              <Text style={styles.deviceName}>
                {device?.name || "ARIS UNO Q"}
              </Text>
              <Text style={styles.deviceId}>
                ID: {device?.id || "UNOQ-8F4C-0082"}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified GATT</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Bluetooth</Text>
              <Text style={styles.specValue}>v5.1 BLE</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Signal RSSI</Text>
              <Text style={styles.specValue}>{device?.rssi ?? -58} dBm</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Security</Text>
              <Text style={styles.specValue}>Physical D3</Text>
            </View>
          </View>
        </View>

        <View style={styles.instructionCard}>
          <View style={styles.instructionIcon}>
            <Ionicons name="finger-print-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.instructionTitle}>
            {loading ? "Connecting..." : "Press D3 on UNO Q"}
          </Text>
          <Text style={styles.instructionSubtitle}>
            {loading
              ? "Establishing secure BLE connection with your device."
              : "Hold the D3 button on your Arduino UNO Q for 3 seconds to open the pairing window. The OLED will confirm pairing mode is active."}
          </Text>

          {loading && (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 12 }} />
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Pairing Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        {!loading && (
          <Pressable
            style={styles.pairButton}
            onPress={handlePair}
            accessibilityRole="button"
            accessibilityLabel="Pair with device"
          >
            <Ionicons name="bluetooth" size={18} color={colors.background} />
            <Text style={styles.pairButtonText}>Pair Now</Text>
          </Pressable>
        )}

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.secondaryText} />
          <Text style={styles.securityText}>
            Physical button press on the device confirms you have access to the hardware.
            No codes or passwords required.
          </Text>
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
  headerTitleGroup: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 16,
    color: colors.primaryText,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
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
  deviceCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  deviceTitleCol: {
    flex: 1,
  },
  deviceName: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  deviceId: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 1,
  },
  verifiedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verifiedText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 10,
    color: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  specsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  specItem: {
    alignItems: "center",
  },
  specLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },
  specValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.primaryText,
    marginTop: 2,
  },
  instructionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  instructionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  instructionTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 17,
    color: colors.primaryText,
    textAlign: "center",
  },
  instructionSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: 14,
    alignItems: "flex-start",
  },
  errorTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.danger,
  },
  errorText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
    lineHeight: 16,
  },
  pairButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pairButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  securityText: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    lineHeight: 15,
  },
});
