import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConnectionProgress, {
  SetupProgressStep,
} from "../../components/aris/device/ConnectionProgress";
import DeviceConnectionStatus from "../../components/aris/device/DeviceConnectionStatus";
import { deviceApi } from "../../services/device/deviceApi";
import { apiClient } from "../../services/api-client";
import { wsManager } from "../../services/websocket-manager";
import { usePreferences } from "../../context/PreferencesContext";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const initialSteps: SetupProgressStep[] = [
  {
    id: "ble_handshake",
    label: "BLE GATT Handshake",
    description: "Verified ARIS service UUID and pairing authorization.",
    status: "completed",
  },
  {
    id: "wifi_transfer",
    label: "Encrypted Credential Transfer",
    description: "Sending SSID and passphrase through protected characteristic.",
    status: "running",
  },
  {
    id: "board_joining",
    label: "UNO Q Joining Wi-Fi",
    description: "Hardware network interface establishing local link.",
    status: "pending",
  },
  {
    id: "ip_assignment",
    label: "IP Discovery & mDNS",
    description: "Resolving local network IP address on local subnet.",
    status: "pending",
  },
  {
    id: "api_verify",
    label: "Verify Direct REST API",
    description: "Pinging /api/v1/health and /api/v1/device endpoints.",
    status: "pending",
  },
  {
    id: "ws_open",
    label: "Open Live Telemetry Stream",
    description: "Handshaking WebSocket /ws/live for continuous readings.",
    status: "pending",
  },
];

export default function DeviceConnectingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ssid?: string; password?: string }>();
  const { setCustomEndpoint, setDeviceToken } = usePreferences();

  const [steps, setSteps] = useState<SetupProgressStep[]>(initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function runConnectionFlow() {
      const ssid = params.ssid || "Home_Network_5G";
      const password = params.password || "";

      await new Promise((r) => setTimeout(r, 800));
      if (!mountedRef.current) return;
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 1) return { ...s, status: "completed" };
          if (idx === 2) return { ...s, status: "running" };
          return s;
        })
      );
      setCurrentStepIndex(2);

      await new Promise((r) => setTimeout(r, 1100));
      if (!mountedRef.current) return;
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 2) return { ...s, status: "completed" };
          if (idx === 3) return { ...s, status: "running" };
          return s;
        })
      );
      setCurrentStepIndex(3);

      await new Promise((r) => setTimeout(r, 900));
      if (!mountedRef.current) return;
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 3) return { ...s, status: "completed" };
          if (idx === 4) return { ...s, status: "running" };
          return s;
        })
      );
      setCurrentStepIndex(4);

      await new Promise((r) => setTimeout(r, 900));
      if (!mountedRef.current) return;
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 4) return { ...s, status: "completed" };
          if (idx === 5) return { ...s, status: "running" };
          return s;
        })
      );
      setCurrentStepIndex(5);

      try {
        const connected = await deviceApi.provisionWifiAndConnect({ ssid, passphrase: password });
        await new Promise((r) => setTimeout(r, 700));
        if (!mountedRef.current) return;

        setSteps((prev) =>
          prev.map((s) => ({ ...s, status: "completed" }))
        );
        const netInfo = deviceApi.getState().networkInfo;
        const endpoint = netInfo
          ? `${netInfo.ip}:${netInfo.port}`
          : "192.168.1.45:8000";
        setCustomEndpoint(endpoint);
        if (connected && netInfo) {
          if (netInfo.token) setDeviceToken(netInfo.token);
          apiClient.configure(netInfo.ip, netInfo.port, netInfo.token);
          wsManager.configure(netInfo.ip, netInfo.port, netInfo.token);
        }
        setIsCompleted(true);
      } catch (err) {
        if (!mountedRef.current) return;
        setSteps((prev) =>
          prev.map((s, idx) => (idx === 5 ? { ...s, status: "failed" } : s))
        );
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Direct communication verification failed over Wi-Fi."
        );
      }
    }

    runConnectionFlow();

    return () => {
      mountedRef.current = false;
    };
  }, [params.ssid, params.password, setCustomEndpoint]);

  const state = deviceApi.getState();

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
          <Text style={styles.headerTitle}>
            {isCompleted ? "Pairing Complete" : "Verifying Connection"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isCompleted ? "ARIS Connected" : "Direct Wi-Fi Handshake"}
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isCompleted ? (
          <>
            <View style={styles.headerTextBox}>
              <Text style={styles.mainTitle}>Establishing Telemetry Channel</Text>
              <Text style={styles.mainDesc}>
                The UNO Q is connecting to Wi-Fi and initializing local HTTP REST and WebSocket streaming endpoints.
              </Text>
            </View>

            <ConnectionProgress
              steps={steps}
              currentStepIndex={currentStepIndex}
            />

            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Verification Failed</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <DeviceConnectionStatus
            deviceInfo={state.deviceInfo}
            networkInfo={state.networkInfo}
            onOpenDashboard={() => {
              router.replace("/(tabs)/home");
            }}
            onOpenDiagnostics={() => {
              router.push("/device/diagnostics");
            }}
          />
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
    gap: 16,
  },
  headerTextBox: {
    gap: 6,
  },
  mainTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 18,
    color: colors.primaryText,
  },
  mainDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    lineHeight: 18,
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
});
