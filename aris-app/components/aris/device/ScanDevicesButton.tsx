import React from "react";
import { Pressable, Text, ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";

interface ScanDevicesButtonProps {
  scanning: boolean;
  onPress: () => void;
  onStop?: () => void;
  title?: string;
  disabled?: boolean;
}

export default function ScanDevicesButton({
  scanning,
  onPress,
  onStop,
  title = "Scan for Devices",
  disabled = false,
}: ScanDevicesButtonProps) {
  const handlePress = scanning && onStop ? onStop : onPress;

  return (
    <Pressable
      style={[
        styles.button,
        scanning && styles.buttonScanning,
        disabled && styles.buttonDisabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={scanning ? "Stop scanning" : title}
    >
      <View style={styles.contentRow}>
        <Ionicons
          name={scanning ? "stop-circle-outline" : "radio-outline"}
          size={18}
          color={scanning ? colors.danger : colors.background}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.buttonText, scanning && styles.buttonScanningText]}>
          {scanning ? "Stop Scanning" : title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  buttonScanning: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.5,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
  },
  buttonScanningText: {
    color: colors.primaryText,
  },
});
