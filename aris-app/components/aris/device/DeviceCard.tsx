import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArisDiscoveredDevice } from "../../../services/device/bleProtocol";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";

interface DeviceCardProps {
  device: ArisDiscoveredDevice;
  selected?: boolean;
  onSelect: (device: ArisDiscoveredDevice) => void;
}

export default function DeviceCard({
  device,
  selected = false,
  onSelect,
}: DeviceCardProps) {
  const signalIcon =
    device.rssi > -60
      ? "cellular"
      : device.rssi > -75
      ? "cellular-outline"
      : "cellular-outline";

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={() => onSelect(device)}
      accessibilityRole="button"
      accessibilityLabel={`Select device ${device.name}, signal ${device.rssi} dBm`}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="hardware-chip-outline"
          size={24}
          color={selected ? colors.accent : colors.secondaryText}
        />
      </View>

      <View style={styles.infoCol}>
        <View style={styles.titleRow}>
          <Text style={styles.deviceName}>{device.name}</Text>
        </View>

        <View style={styles.badgeRow}>
          <Text style={styles.deviceId}>ID: {device.id}</Text>
          {device.isArisGatt && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>GATT Verified</Text>
            </View>
          )}
        </View>

        {device.macAddress && (
          <Text style={styles.deviceMac}>MAC: {device.macAddress}</Text>
        )}
      </View>

      <View style={styles.rightCol}>
        <View style={styles.rssiBadge}>
          <Ionicons name={signalIcon} size={14} color={colors.secondaryText} />
          <Text style={styles.rssiText}>{device.rssi} dBm</Text>
        </View>

        <View
          style={[
            styles.selectionIndicator,
            selected && styles.selectionIndicatorActive,
          ]}
        >
          {selected && (
            <Ionicons name="checkmark" size={14} color={colors.background} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: "#1A2E1C",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  deviceName: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  verifiedBadge: {
    backgroundColor: colors.accentGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 10,
    color: colors.accent,
  },
  deviceId: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
  },
  deviceMac: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 1,
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 8,
    marginLeft: 8,
  },
  rssiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rssiText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },
  selectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  selectionIndicatorActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
