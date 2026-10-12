import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";
import { ArisDeviceInfo, NetworkInfoPayload } from "../../../services/device/bleProtocol";

interface DeviceConnectionStatusProps {
  deviceInfo: ArisDeviceInfo | null;
  networkInfo: NetworkInfoPayload | null;
  onOpenDashboard: () => void;
  onOpenDiagnostics: () => void;
}

export default function DeviceConnectionStatus({
  deviceInfo,
  networkInfo,
  onOpenDashboard,
  onOpenDiagnostics,
}: DeviceConnectionStatusProps) {
  return (
    <View style={styles.container}>
      {/* Success Hero Header */}
      <View style={styles.heroBox}>
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark-sharp" size={28} color={colors.background} />
        </View>
        <Text style={styles.heroTitle}>Connected to ARIS</Text>
        <Text style={styles.heroSubtitle}>
          Direct local Wi-Fi link verified and live WebSocket stream active.
        </Text>
      </View>

      {/* Hardware Telemetry Card */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Hardware Target</Text>
          <Text style={styles.detailValue}>
            {deviceInfo?.deviceId || "ARIS UNO Q (8F4C)"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Firmware</Text>
          <Text style={styles.detailValue}>
            {deviceInfo?.firmwareVersion || "—"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Local API Address</Text>
          <Text style={styles.detailValue}>
            {networkInfo ? `${networkInfo.ip}:${networkInfo.port}` : "aris-unoq.local:8000"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>WebSocket Channel</Text>
          <View style={styles.statusChip}>
            <View style={styles.liveDot} />
            <Text style={styles.statusChipText}>Active /ws/live</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Telemetry Sensors</Text>
          <Text style={styles.detailValue}>SPS30 • SHT4x • MQ135</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsGroup}>
        <Pressable
          style={styles.primaryButton}
          onPress={onOpenDashboard}
          accessibilityRole="button"
          accessibilityLabel="Open live environmental dashboard"
        >
          <Text style={styles.primaryButtonText}>Open Live Dashboard</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.background} />
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={onOpenDiagnostics}
          accessibilityRole="button"
          accessibilityLabel="View device diagnostics"
        >
          <Ionicons name="hardware-chip-outline" size={16} color={colors.primaryText} />
          <Text style={styles.secondaryButtonText}>Hardware Diagnostics</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginVertical: 12,
  },
  heroBox: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 8,
  },
  checkBadge: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 22,
    color: colors.primaryText,
  },
  heroSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
  },
  detailValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentGlow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statusChipText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.accent,
  },
  actionsGroup: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 48,
  },
  primaryButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 48,
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
});
