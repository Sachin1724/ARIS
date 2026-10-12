import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import WifiCredentialsForm from "../../components/aris/device/WifiCredentialsForm";
import { WifiCredentials } from "../../services/device/wifiProvisioning";
import { deviceApi } from "../../services/device/deviceApi";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export default function DeviceWifiSetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = deviceApi.getState();
  const device = state.selectedDevice;

  const handleProvision = async (credentials: WifiCredentials) => {
    setLoading(true);
    setError(null);

    try {
      router.push({
        pathname: "/device/connecting",
        params: {
          ssid: credentials.ssid,
          password: credentials.passphrase || "",
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wi-Fi provisioning failed");
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
          <Text style={styles.headerTitle}>Wi-Fi Setup</Text>
          <Text style={styles.headerSubtitle}>
            Step 4 of 5 — Encrypted Provisioning
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contextBanner}>
          <Ionicons name="bluetooth" size={18} color={colors.accent} />
          <Text style={styles.contextText}>
            Authorized BLE Session with {device?.name || "ARIS UNO Q (8F4C)"}
          </Text>
        </View>

        <View style={styles.introGroup}>
          <Text style={styles.introTitle}>Connect UNO Q to Local Wi-Fi</Text>
          <Text style={styles.introSubtitle}>
            Provide the credentials for the 2.4 GHz or 5 GHz Wi-Fi network your mobile device is currently using.
          </Text>
        </View>

        <WifiCredentialsForm
          onSubmit={handleProvision}
          loading={loading}
        />

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
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
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contextText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.info,
  },
  introGroup: {
    gap: 4,
    marginTop: 4,
  },
  introTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 18,
    color: colors.primaryText,
  },
  introSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.danger,
  },
});
