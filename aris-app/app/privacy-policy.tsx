import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryBadge}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text style={styles.summaryBadgeText}>Local-First Architecture</Text>
          </View>
          <Text style={styles.summaryTitle}>
            Zero Telemetry Off-Device
          </Text>
          <Text style={styles.summaryDesc}>
            ARIS is designed as a direct hardware companion for your Arduino UNO Q sensor hub. Your environmental telemetry is stored exclusively in your local device SQLite database and is never uploaded to cloud servers.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="server-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>1. Data Collection & Processing</Text>
          </View>
          <Text style={styles.paragraph}>
            The application reads telemetry directly from your Sensirion SPS30 particulate sensor and SHT4x temperature/relative humidity sensor.
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                Particulate concentrations (PM1.0, PM2.5, PM4.0, PM10) are sampled at 1 Hz intervals on the microcontroller.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                Raw ADC voltages and compensated values remain on the local network (LAN / BLE) between the companion app and UNO Q.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                No personal identifying information (PII), device serial numbers, or location coordinates are broadcasted externally.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="key-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>2. Wi-Fi & Pairing Security</Text>
          </View>
          <Text style={styles.paragraph}>
            During initial provisioning, Wi-Fi credentials are sent over an encrypted BLE channel directly to the UNO Q board. Credentials are stored securely on the microcontroller firmware and are never synced to any remote service or third-party SDK.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>3. Telemetry Assistant & Analytics</Text>
          </View>
          <Text style={styles.paragraph}>
            Questions asked in the &ldquo;Ask ARIS&rdquo; assistant are evaluated against local sensor readings currently in memory. No queries or responses are used for model training, ad tracking, or external behavioral profiling.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.sectionTitle}>4. Data Retention & Deletion</Text>
          </View>
          <Text style={styles.paragraph}>
            Historical telemetry is retained in rolling 90-day SQLite partitions on the device. Tapping &ldquo;Forget Device&rdquo; in Settings purges all local cache, paired tokens, and telemetry history immediately.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ARIS Hardware Companion • Version 1.0.0
          </Text>
          <Text style={styles.footerSubtext}>
            Effective date: October 2026 • Local-first compliance
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
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  summaryBadgeText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 12,
    color: colors.success,
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
