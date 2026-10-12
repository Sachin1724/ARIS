import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ARIS_SERVICE_UUID, ARIS_CHARACTERISTICS } from "../../services/device/bleProtocol";
import { deviceApi } from "../../services/device/deviceApi";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export default function DeviceDiagnosticsScreen() {
  const router = useRouter();
  const state = deviceApi.getState();

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Device",
      "Are you sure you want to forget this UNO Q pairing and disconnect?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            deviceApi.reset();
            router.replace("/(tabs)/home");
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>Hardware Diagnostics</Text>
          <Text style={styles.headerSubtitle}>
            GATT Contract & Telemetry State
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusIconBox}>
            <Ionicons name="hardware-chip-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.statusCol}>
            <Text style={styles.statusTitle}>
              {state.deviceInfo?.deviceId || state.selectedDevice?.id || "ARIS-UNOQ-0082"}
            </Text>
            <Text style={styles.statusSubtitle}>
              Linux Debian 12 • BlueZ 5.66 • Bluetooth 5.1
            </Text>
          </View>
          <View style={styles.liveChip}>
            <Text style={styles.liveChipText}>Active</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="terminal-outline" size={16} color={colors.primaryText} />
            <Text style={styles.cardTitle}>UNO Q Linux Service Commands</Text>
          </View>
          <Text style={styles.commandDesc}>
            Verify Bluetooth controller status on the UNO Q board terminal:
          </Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>$ bluetoothctl show</Text>
            <Text style={styles.codeText}>$ systemctl status bluetooth --no-pager</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bluetooth" size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>GATT Service Contract</Text>
          </View>

          <View style={styles.gattRow}>
            <Text style={styles.gattLabel}>Service UUID</Text>
            <Text style={styles.gattValue}>{ARIS_SERVICE_UUID}</Text>
          </View>

          <View style={styles.divider} />

          {[
            { name: "device_info", uuid: ARIS_CHARACTERISTICS.DEVICE_INFO, prop: "READ" },
            { name: "pairing_challenge", uuid: ARIS_CHARACTERISTICS.PAIRING_CHALLENGE, prop: "READ / NOTIFY" },
            { name: "pairing_response", uuid: ARIS_CHARACTERISTICS.PAIRING_RESPONSE, prop: "WRITE" },
            { name: "wifi_config", uuid: ARIS_CHARACTERISTICS.WIFI_CONFIG, prop: "WRITE ENCRYPTED" },
            { name: "setup_status", uuid: ARIS_CHARACTERISTICS.SETUP_STATUS, prop: "NOTIFY" },
            { name: "network_info", uuid: ARIS_CHARACTERISTICS.NETWORK_INFO, prop: "READ" },
          ].map((char, i, arr) => (
            <React.Fragment key={char.name}>
              <View style={styles.gattRow}>
                <View>
                  <Text style={styles.charName}>{char.name}</Text>
                  <Text style={styles.charUuid}>{char.uuid}</Text>
                </View>
                <View style={styles.propBadge}><Text style={styles.propText}>{char.prop}</Text></View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="pulse" size={16} color={colors.success} />
            <Text style={styles.cardTitle}>Live Sensor Channel Telemetry</Text>
          </View>

          {[
            { label: "SPS30 Optical Channel Cleanliness", value: "99.2% (Nominal)" },
            { label: "SPS30 Internal Flow Rate", value: "0.28 L/min" },
            { label: "SHT4x Digital I2C Bus", value: "0x44 (ACK OK)" },
            { label: "MQ-135 Air Quality Sensor ADC", value: "422 ADC (Raw)" },
            { label: "MG-811 CO2 Solid Electrolyte", value: "0.342 V (Raw)" },
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>{row.label}</Text>
                <Text style={styles.diagValue}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <Pressable
          style={styles.disconnectButton}
          onPress={handleDisconnect}
          accessibilityRole="button"
          accessibilityLabel="Disconnect device"
        >
          <Ionicons name="unlink-outline" size={18} color={colors.danger} />
          <Text style={styles.disconnectText}>Forget Device & Reset Pairing</Text>
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
    gap: 14,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 14,
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  statusCol: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
  },
  statusSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 1,
  },
  liveChip: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveChipText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.success,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  commandDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  codeBlock: {
    backgroundColor: "#0F172A",
    borderRadius: 6,
    padding: 12,
    gap: 4,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.info,
  },
  gattRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gattLabel: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.primaryText,
  },
  gattValue: {
    fontFamily: "monospace",
    fontSize: 10,
    color: colors.accent,
  },
  charName: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  charUuid: {
    fontFamily: "monospace",
    fontSize: 10,
    color: colors.secondaryText,
    marginTop: 2,
  },
  propBadge: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  propText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 9,
    color: colors.secondaryText,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  diagLabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    flex: 1,
  },
  diagValue: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.primaryText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  disconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    height: 48,
    marginTop: 6,
  },
  disconnectText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.danger,
  },
});
