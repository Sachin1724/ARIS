import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryBadge}>
            <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            <Text style={styles.summaryBadgeText}>Hardware Telemetry Terms</Text>
          </View>
          <Text style={styles.summaryTitle}>
            Operational Terms & Sensor Notice
          </Text>
          <Text style={styles.summaryDesc}>
            These terms govern your use of the ARIS companion software and its communication with Arduino UNO Q hardware sensor hubs.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="pulse-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>1. Sensor Readings & Environmental Data</Text>
          </View>
          <Text style={styles.paragraph}>
            ARIS displays real-time atmospheric measurements acquired by Sensirion SPS30 and Sensirion SHT4x sensors.
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                Measurements reflect localized micro-climates immediately adjacent to the sensor inlet and may differ from regional municipal monitoring stations.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                Raw ADC voltages and optical scattering counts are converted into mass concentration using standard factory calibration coefficients.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="medkit-outline" size={18} color={colors.warning} />
            </View>
            <Text style={styles.sectionTitle}>2. Not a Medical or Certified Safety Device</Text>
          </View>
          <Text style={styles.paragraph}>
            ARIS is an environmental awareness instrument. It is not certified as an industrial life-safety alarm, smoke detector, hazardous gas detector, or medical diagnostic tool.
          </Text>
          <Text style={styles.paragraph}>
            Do not rely on ARIS readings to protect life or property in emergency fire, industrial toxic spill, or hazardous gas situations.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>3. Local Network & Firmware Connectivity</Text>
          </View>
          <Text style={styles.paragraph}>
            The app communicates over standard local Wi-Fi (HTTP/WebSocket) and Bluetooth Low Energy (BLE). Connectivity depends upon local network stability, router configuration, and microcontroller power supply integrity.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="code-slash-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>4. Open Protocols & Modifications</Text>
          </View>
          <Text style={styles.paragraph}>
            The UNO Q REST API and WebSocket schemas are open protocols. Users modifying firmware or sensor payloads are responsible for verifying schema compatibility and calibration integrity.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ARIS Hardware Companion • Version 1.0.0
          </Text>
          <Text style={styles.footerSubtext}>
            Last updated: October 2026
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 16,
    color: colors.primaryText,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentGlow,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  summaryBadgeText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.accent,
  },
  summaryTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 18,
    color: colors.primaryText,
    marginBottom: 6,
  },
  summaryDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondaryText,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
    flex: 1,
  },
  paragraph: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondaryText,
    marginBottom: 8,
  },
  bulletList: {
    gap: 8,
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
  bulletText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.primaryText,
    flex: 1,
  },
  footer: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 12,
  },
  footerText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.secondaryText,
  },
  footerSubtext: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
});
