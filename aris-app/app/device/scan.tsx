import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DeviceCard from "../../components/aris/device/DeviceCard";
import ScanDevicesButton from "../../components/aris/device/ScanDevicesButton";
import {
  scanForAris,
  getScanDiagnostics,
  ARIS_SERVICE_UUID,
  type ScanDiagnostics,
} from "../../services/device/bleScanner";
import { deviceApi } from "../../services/device/deviceApi";
import { ArisDiscoveredDevice } from "../../services/device/bleProtocol";
import { useConnection } from "../../hooks/useConnection";
import { usePreferences } from "../../context/PreferencesContext";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export default function DeviceScanScreen() {
  const router = useRouter();
  const connection = useConnection();
  const { customEndpoint, setCustomEndpoint, station, setStation, deviceToken, setDeviceToken } = usePreferences();

  const [scanning, setScanning] = useState(true);
  const [devices, setDevices] = useState<ArisDiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ArisDiscoveredDevice | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScanDiagnostics | null>(null);

  const [ipInput, setIpInput] = useState(customEndpoint || "192.168.31.46:8000");
  const [tokenInput, setTokenInput] = useState(deviceToken || "test123");
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);

  const stopScanRef = React.useRef<(() => void) | null>(null);

  const stopScan = useCallback(() => {
    if (stopScanRef.current) {
      stopScanRef.current();
      stopScanRef.current = null;
    }
    setScanning(false);
  }, []);

  const doScan = useCallback(() => {
    const stopper = scanForAris(
      (device) => {
        setDevices((prev) => {
          const exists = prev.some((d) => d.id === device.id);
          if (exists) return prev;
          return [...prev, device];
        });
      },
      (err) => {
        // Bluetooth problems no longer end the scan: the Wi-Fi sweep still runs,
        // and that is the path that works without the pairing window open.
        setScanError(err);
      },
      {
        savedEndpoint: customEndpoint || null,
        token: deviceToken || tokenInput.trim() || null,
      }
    );

    stopScanRef.current = stopper;

    const timeout = setTimeout(() => {
      setScanning(false);
      setDiagnostics(getScanDiagnostics());
      stopper();
    }, 12000);

    return () => {
      clearTimeout(timeout);
      stopper();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customEndpoint, deviceToken]);

  const startScan = useCallback(() => {
    setScanning(true);
    setScanError(null);
    setDevices([]);
    doScan();
  }, [doScan]);

  useEffect(() => {
    const cleanup = doScan();
    return () => cleanup();
  }, [doScan]);

  const handleSelectDevice = async (device: ArisDiscoveredDevice) => {
    setSelectedDevice(device);
    deviceApi.selectDevice(device);

    if (device.id.startsWith("http")) {
      const parts = device.id.replace(/^https?:\/\//i, "").split(":");
      const host = parts[0];
      const port = parts[1] ? parseInt(parts[1], 10) : 8000;
      const ok = await connection.connect(host, port, deviceToken || undefined);
      if (ok) {
        setCustomEndpoint(device.id.replace(/^https?:\/\//i, ""));
        router.replace("/(tabs)/home");
        return;
      }
    }
    router.push("/device/pair");
  };

  const handleDirectConnect = async () => {
    const target = ipInput.trim();
    if (!target) return;

    setIpLoading(true);
    setIpError(null);

    const parts = target.replace(/^https?:\/\//i, "").split(":");
    const host = parts[0];
    const port = parts[1] ? parseInt(parts[1], 10) : 8000;

    try {
      const token = tokenInput.trim() || undefined;
      const ok = await connection.connect(host, port, token);
      if (ok) {
        if (token) setDeviceToken(token);
        setCustomEndpoint(target);
        setStation({
          ...station,
          name: "Arduino UNO Q",
          stationId: `UNOQ-${host.split(".").pop() || "LIVE"}`,
        });
        router.replace("/(tabs)/home");
      } else {
        setIpError(
          `Could not reach UNO Q at ${host}:${port}. Verify board is powered and on the same Wi-Fi.`
        );
      }
    } catch (err) {
      setIpError(
        err instanceof Error ? err.message : "Connection failed to endpoint"
      );
    } finally {
      setIpLoading(false);
    }
  };

  const isDevBuildNotice =
    scanError != null && scanError.toLowerCase().includes("development build");

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
          <Text style={styles.headerTitle}>Scan Nearby Devices</Text>
          <Text style={styles.headerSubtitle}>
            Arduino UNO Q & Environmental Nodes
          </Text>
        </View>

        <Pressable
          style={styles.headerIconButton}
          onPress={() => router.push("/device/diagnostics")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Diagnostics"
        >
          <Ionicons name="hardware-chip-outline" size={18} color={colors.secondaryText} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.scrollView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={startScan}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Pairing window hint: the board only advertises on demand */}
        <View style={styles.serviceFilterCard}>
          <View style={styles.serviceFilterHeader}>
            <Ionicons name="radio-outline" size={16} color={colors.accent} />
            <Text style={styles.serviceFilterTitle}>Before scanning over Bluetooth</Text>
          </View>
          <Text style={styles.serviceFilterDesc}>
            Hold the D3 button on the UNO Q for about 3 seconds. It stays discoverable
            for 3 minutes. If the board is already on your Wi-Fi, it is found below
            without Bluetooth.
          </Text>
        </View>

        {/* GATT Service Filter Info */}
        <View style={styles.serviceFilterCard}>
          <View style={styles.serviceFilterHeader}>
            <Ionicons name="funnel-outline" size={16} color={colors.accent} />
            <Text style={styles.serviceFilterTitle}>GATT Service Filter</Text>
          </View>
          <Text style={styles.uuidText}>{ARIS_SERVICE_UUID}</Text>
          <Text style={styles.serviceFilterDesc}>
            Only verified ARIS hardware nodes broadcasting this UUID or local network service are listed.
          </Text>
        </View>

        {/* Expo Go Notice (if applicable) */}
        {isDevBuildNotice ? (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Expo Go Client Active</Text>
              <Text style={styles.noticeText}>
                Bluetooth LE hardware scanning requires an Android Development Client. You can connect directly over local Wi-Fi / IP below:
              </Text>
            </View>
          </View>
        ) : scanError ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{scanError}</Text>
          </View>
        ) : null}

        {/* Direct Wi-Fi / IP Link Card */}
        <View style={styles.quickIpCard}>
          <View style={styles.quickIpHeader}>
            <Ionicons name="wifi-outline" size={18} color={colors.accent} />
            <Text style={styles.quickIpTitle}>Direct Wi-Fi / IP Link</Text>
          </View>
          <Text style={styles.quickIpSub}>
            Connect directly to UNO Q on port 8000 without requiring Bluetooth:
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.ipInput}
              value={ipInput}
              onChangeText={setIpInput}
              placeholder="192.168.31.95:8000"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.connectBtn, ipLoading && styles.btnDisabled]}
              onPress={handleDirectConnect}
              disabled={ipLoading}
              accessibilityRole="button"
              accessibilityLabel="Connect to IP"
            >
              {ipLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.connectBtnText}>Connect</Text>
              )}
            </Pressable>
          </View>

          <TextInput
            style={styles.tokenInput}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Auth token (from device credentials)"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {ipError && <Text style={styles.ipErrorText}>{ipError}</Text>}
        </View>

        {!scanning && devices.length === 0 && diagnostics ? (
          <View style={styles.serviceFilterCard}>
            <View style={styles.serviceFilterHeader}>
              <Ionicons name="pulse-outline" size={16} color={colors.accent} />
              <Text style={styles.serviceFilterTitle}>Scan report</Text>
            </View>
            <Text style={styles.serviceFilterDesc}>
              Bluetooth: {diagnostics.nativeBleAvailable ? diagnostics.adapterState : "not available in this build"}
              {diagnostics.nativeBleAvailable && !diagnostics.permissionsGranted ? " (permission denied)" : ""}
              {"\n"}Location permission: {diagnostics.locationPermissionGranted ? "granted" : "denied"}
              {"\n"}Wi-Fi sweep: {diagnostics.wifiSubnetScanned ?? "no Wi-Fi address"} ({diagnostics.endpointsProbed} addresses)
              {diagnostics.notes.length > 0 ? "\n" + diagnostics.notes.join("\n") : ""}
            </Text>
          </View>
        ) : null}

        {/* Discovered Nodes Section */}
        <View style={styles.statusRow}>
          <Text style={styles.sectionTitle}>
            Discovered Nodes ({devices.length})
          </Text>
          {scanning && (
            <View style={styles.scanningIndicator}>
              <View style={styles.activeDot} />
              <Text style={styles.scanningText}>Scanning Subnet & BLE</Text>
            </View>
          )}
        </View>

        {devices.length > 0 ? (
          devices.map((dev) => (
            <DeviceCard
              key={dev.id}
              device={dev}
              selected={selectedDevice?.id === dev.id}
              onSelect={handleSelectDevice}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name={scanning ? "radio-outline" : "alert-circle-outline"}
              size={36}
              color={scanning ? colors.accent : colors.secondaryText}
            />
            <Text style={styles.emptyTitle}>
              {scanning ? "Searching for UNO Q..." : "No Devices Discovered"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {scanning
                ? "Listening for nearby Bluetooth advertisements and probing local network..."
                : "Ensure your UNO Q is powered and connected to the same Wi-Fi, or enter its IP address above."}
            </Text>
          </View>
        )}

        <ScanDevicesButton
          scanning={scanning}
          onPress={startScan}
          onStop={stopScan}
          title={devices.length > 0 ? "Scan Again" : "Scan for Devices"}
        />
      </ScrollView>
      </KeyboardAvoidingView>
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
  serviceFilterCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  serviceFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  serviceFilterTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  uuidText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  serviceFilterDesc: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  noticeTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.accent,
  },
  noticeText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
    marginTop: 2,
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
  quickIpCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  quickIpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickIpTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  quickIpSub: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  ipInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 14,
    color: colors.primaryText,
  },
  connectBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  connectBtnText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.background,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  tokenInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.primaryText,
  },
  ipErrorText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  scanningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  scanningText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.primaryText,
    marginTop: 4,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 17,
  },
});
