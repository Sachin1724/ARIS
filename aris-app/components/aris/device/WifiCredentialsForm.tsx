import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WifiCredentials } from "../../../services/device/wifiProvisioning";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";

interface WifiNetwork {
  SSID: string;
  BSSID: string;
  level: number;
  frequency: number;
  capabilities: string;
}

interface WifiCredentialsFormProps {
  onSubmit: (credentials: WifiCredentials) => void;
  loading?: boolean;
  initialSsid?: string;
}

function signalStrength(level: number): { icon: keyof typeof Ionicons.glyphMap; label: string } {
  if (level >= -50) return { icon: "wifi", label: "Strong" };
  if (level >= -70) return { icon: "wifi", label: "Good" };
  return { icon: "wifi-outline", label: "Weak" };
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Wi-Fi scanning requires location permission on Android.",
        buttonPositive: "Allow",
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export default function WifiCredentialsForm({
  onSubmit,
  loading = false,
  initialSsid = "",
}: WifiCredentialsFormProps) {
  const [ssid, setSsid] = useState(initialSsid);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [currentSsid, setCurrentSsid] = useState<string | null>(null);

  useEffect(() => {
    scanNetworks();
  }, []);

  async function scanNetworks() {
    setScanning(true);
    setScanError(null);

    const hasPerm = await requestLocationPermission();
    if (!hasPerm) {
      setScanError("Location permission required for Wi-Fi scanning.");
      setScanning(false);
      setShowManualEntry(true);
      return;
    }

    try {
      const WifiManager = require("react-native-wifi-reborn").default;

      // Get current SSID
      try {
        const current = await WifiManager.getCurrentWifiSSID();
        if (current && current !== "<unknown ssid>") {
          setCurrentSsid(current);
          if (!ssid) setSsid(current);
        }
      } catch {
        // Not connected or permission issue
      }

      // Scan available networks
      const list = await WifiManager.loadWifiList();
      const unique = new Map<string, WifiNetwork>();
      for (const net of list) {
        if (!net.SSID || net.SSID === "") continue;
        const existing = unique.get(net.SSID);
        if (!existing || net.level > existing.level) {
          unique.set(net.SSID, net);
        }
      }
      const sorted = Array.from(unique.values()).sort((a, b) => b.level - a.level);
      setNetworks(sorted);

      if (sorted.length === 0) {
        setScanError("No networks found. Try manual entry.");
        setShowManualEntry(true);
      }
    } catch {
      // Native module not available (Expo Go)
      setScanError("Wi-Fi scanning requires a development build. Enter network name manually.");
      setShowManualEntry(true);

      // NetInfo fallback not available in Expo Go — skip
    } finally {
      setScanning(false);
    }
  }

  const handleSelectNetwork = (networkSsid: string) => {
    setSsid(networkSsid);
    setShowManualEntry(false);
  };

  const handleSubmit = () => {
    if (!ssid.trim() || loading) return;
    onSubmit({
      ssid: ssid.trim(),
      passphrase: password,
      securityType: "WPA2",
    });
  };

  const networkSelected = ssid.trim() !== "";

  return (
    <View style={styles.container}>
      {/* Available Networks */}
      <View style={styles.inputGroup}>
        <View style={styles.networkHeaderRow}>
          <Text style={styles.label}>Available Networks</Text>
          <Pressable
            onPress={scanNetworks}
            disabled={scanning}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Rescan networks"
          >
            {scanning ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            )}
          </Pressable>
        </View>

        {scanning && networks.length === 0 ? (
          <View style={styles.scanningBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.scanningText}>Scanning nearby Wi-Fi networks...</Text>
          </View>
        ) : networks.length > 0 ? (
          <ScrollView
            style={styles.networkList}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {networks.map((net) => {
              const sig = signalStrength(net.level);
              const isSelected = ssid === net.SSID;
              const isCurrent = currentSsid === net.SSID;
              return (
                <Pressable
                  key={`${net.SSID}-${net.BSSID}`}
                  style={[styles.networkRow, isSelected && styles.networkRowSelected]}
                  onPress={() => handleSelectNetwork(net.SSID)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${net.SSID}, signal ${sig.label}${isCurrent ? ", currently connected" : ""}`}
                >
                  <Ionicons
                    name={sig.icon}
                    size={16}
                    color={isSelected ? colors.accent : colors.secondaryText}
                  />
                  <View style={styles.networkInfo}>
                    <Text
                      style={[styles.networkName, isSelected && styles.networkNameSelected]}
                      numberOfLines={1}
                    >
                      {net.SSID}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.networkCurrentTag}>Connected</Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {scanError && !networks.length && (
          <View style={styles.scanErrorBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.secondaryText} />
            <Text style={styles.scanErrorText}>{scanError}</Text>
          </View>
        )}

        {/* Manual Entry Toggle */}
        <Pressable
          style={styles.manualToggle}
          onPress={() => setShowManualEntry(!showManualEntry)}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={14} color={colors.accent} />
          <Text style={styles.manualToggleText}>
            {showManualEntry ? "Hide manual entry" : "Enter network name manually"}
          </Text>
        </Pressable>
      </View>

      {/* Manual SSID Entry (shown when toggled or no scan results) */}
      {showManualEntry && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Network Name (SSID)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="wifi"
              size={18}
              color={colors.secondaryText}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="e.g. Home_Lab_2.4G"
              placeholderTextColor={colors.mutedText}
              value={ssid}
              onChangeText={setSsid}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        </View>
      )}

      {/* Password Field */}
      {networkSelected && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password for "{ssid}"</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.secondaryText}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter Wi-Fi password"
              placeholderTextColor={colors.mutedText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              autoFocus
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.eyeButton}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.secondaryText}
              />
            </Pressable>
          </View>
        </View>
      )}

      {/* Security Advisory */}
      <View style={styles.advisoryBox}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
        <Text style={styles.advisoryText}>
          Credentials are transferred strictly via authenticated, encrypted BLE GATT. Passwords are never saved in logs or transmitted to cloud servers.
        </Text>
      </View>

      {/* Submit */}
      <Pressable
        style={[
          styles.submitButton,
          (!ssid.trim() || loading) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!ssid.trim() || loading}
        accessibilityRole="button"
        accessibilityLabel="Provision Wi-Fi on UNO Q"
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Text style={styles.submitText}>Provision Wi-Fi</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginVertical: 12,
  },
  inputGroup: {
    gap: 6,
  },
  networkHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 13,
    color: colors.primaryText,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 14,
    color: colors.primaryText,
    height: "100%",
  },
  eyeButton: {
    padding: 6,
  },
  // Network list
  scanningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    padding: 16,
  },
  scanningText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
  },
  networkList: {
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  networkRowSelected: {
    backgroundColor: colors.accentGlow,
  },
  networkInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  networkName: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.primaryText,
    flexShrink: 1,
  },
  networkNameSelected: {
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.accent,
  },
  networkCurrentTag: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 10,
    color: colors.accent,
    backgroundColor: colors.accentGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  scanErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    padding: 12,
  },
  scanErrorText: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
  },
  manualToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  manualToggleText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.accent,
  },
  advisoryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
  },
  advisoryText: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
  },
});
