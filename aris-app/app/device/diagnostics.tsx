import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deviceApi } from "../../services/device/deviceApi";
import { useSystemHealth } from "../../hooks/useSystemHealth";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

/** Values are rendered only when the board actually reported them. */
const NO_VALUE = "—";

function formatUptime(seconds: number | null): string {
  if (seconds === null) return NO_VALUE;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return NO_VALUE;
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function pct(value: number | null): string {
  return value === null ? NO_VALUE : `${value}%`;
}

/** Warn before the board is in trouble, not after. */
function usageTone(value: number | null): string {
  if (value === null) return colors.secondaryText;
  if (value >= 90) return colors.danger;
  if (value >= 75) return colors.warning;
  return colors.primaryText;
}

function tempTone(value: number | null): string {
  if (value === null) return colors.secondaryText;
  if (value >= 80) return colors.danger;
  if (value >= 65) return colors.warning;
  return colors.primaryText;
}

export default function DeviceDiagnosticsScreen() {
  const router = useRouter();
  const state = deviceApi.getState();
  const { data, loading, error, stale, lastUpdated, refresh } = useSystemHealth();

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
      ],
    );
  };

  const row = (label: string, value: string, tone?: string) => (
    <View style={styles.diagRow} key={label}>
      <Text style={styles.diagLabel}>{label}</Text>
      <Text style={[styles.diagValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );

  const clients = data?.clients ?? null;

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
          <Text style={styles.headerTitle}>System Monitor</Text>
          <Text style={styles.headerSubtitle}>
            {state.selectedDevice?.name || "Arduino UNO Q"}
          </Text>
        </View>

        <Pressable
          style={styles.headerIconButton}
          onPress={refresh}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Refresh system health"
        >
          <Ionicons name="refresh" size={18} color={colors.secondaryText} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && data !== null}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusIconBox}>
            <Ionicons
              name={data ? "hardware-chip" : "cloud-offline-outline"}
              size={22}
              color={data ? colors.accent : colors.secondaryText}
            />
          </View>
          <View style={styles.statusCol}>
            <Text style={styles.statusTitle}>
              {data ? "Board reachable" : error ? "Board unreachable" : "Reading board…"}
            </Text>
            <Text style={styles.statusSubtitle}>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : "No reading yet"}
            </Text>
          </View>
          {loading && data === null ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : stale ? (
            <View style={styles.staleChip}>
              <Text style={styles.staleChipText}>Stale</Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Compute */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="speedometer-outline" size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>Compute</Text>
          </View>
          {row(
            `CPU load (${data?.cpu?.cores ?? NO_VALUE} cores)`,
            data?.cpu?.load1 === null || data?.cpu?.load1 === undefined
              ? NO_VALUE
              : `${data.cpu.load1.toFixed(2)} · ${pct(data.cpu.load1_pct)}`,
            usageTone(data?.cpu?.load1_pct ?? null),
          )}
          <View style={styles.divider} />
          {row(
            "Memory used",
            data?.memory?.used_pct === null || data?.memory?.used_pct === undefined
              ? NO_VALUE
              : `${pct(data.memory.used_pct)} of ${data.memory.total_mb} MB`,
            usageTone(data?.memory?.used_pct ?? null),
          )}
          <View style={styles.divider} />
          {row(
            "Disk used",
            data?.disk?.used_pct === null || data?.disk?.used_pct === undefined
              ? NO_VALUE
              : `${pct(data.disk.used_pct)} · ${data.disk.free_gb} GB free`,
            usageTone(data?.disk?.used_pct ?? null),
          )}
          <View style={styles.divider} />
          {row(
            "SoC temperature",
            data?.temperature_c === null || data?.temperature_c === undefined
              ? NO_VALUE
              : `${data.temperature_c} °C`,
            tempTone(data?.temperature_c ?? null),
          )}
          <View style={styles.divider} />
          {row("Uptime", formatUptime(data?.uptime_s ?? null))}
        </View>

        {/* Services */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="git-branch-outline" size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>Services</Text>
          </View>
          {data?.services?.length ? (
            data.services.map((service, index) => (
              <React.Fragment key={service.unit}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.diagRow}>
                  <Text style={styles.diagLabel}>{service.unit}</Text>
                  <View style={styles.serviceState}>
                    <View
                      style={[
                        styles.stateDot,
                        { backgroundColor: service.ok ? colors.success : colors.danger },
                      ]}
                    />
                    <Text
                      style={[
                        styles.diagValue,
                        { color: service.ok ? colors.primaryText : colors.danger },
                      ]}
                    >
                      {service.state}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>No service states reported.</Text>
          )}
        </View>

        {/* Data pipeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="pulse-outline" size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>Data pipeline</Text>
          </View>
          {row(
            "Sensor collector",
            data?.collector
              ? `${formatAge(data.collector.age_s)}${data.collector.ok ? "" : " (stalled)"}`
              : NO_VALUE,
            data?.collector && !data.collector.ok ? colors.danger : undefined,
          )}
          <View style={styles.divider} />
          {row(
            "Edge language model",
            data?.slm ? (data.slm.reachable ? `Running on :${data.slm.port}` : "Not reachable") : NO_VALUE,
            data?.slm && !data.slm.reachable ? colors.warning : undefined,
          )}
          <View style={styles.divider} />
          {row(
            "Bluetooth pairing window",
            data?.ble
              ? data.ble.advertising
                ? `Open for ${Math.round(data.ble.pairing_window_s)}s`
                : "Closed — hold D3 for 3s"
              : NO_VALUE,
            data?.ble?.advertising ? colors.accent : undefined,
          )}
        </View>

        {/* Connected devices */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="phone-portrait-outline" size={16} color={colors.accent} />
            <Text style={styles.cardTitle}>Connected devices</Text>
          </View>
          {row(
            "Devices",
            clients ? `${clients.devices} (${clients.sockets} live streams)` : NO_VALUE,
          )}
          {clients?.connections?.length
            ? clients.connections.map((connection) => (
                <React.Fragment key={`${connection.host}:${connection.port}`}>
                  <View style={styles.divider} />
                  <View style={styles.diagRow}>
                    <Text style={styles.diagLabel}>{connection.host}</Text>
                    <Text style={styles.diagValue}>
                      {formatUptime(Math.round(connection.connected_s))}
                    </Text>
                  </View>
                </React.Fragment>
              ))
            : null}
        </View>

        <Pressable
          style={styles.disconnectButton}
          onPress={handleDisconnect}
          accessibilityRole="button"
          accessibilityLabel="Forget device and reset pairing"
        >
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
    gap: 12,
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
  },
  statusCol: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  statusSubtitle: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 2,
  },
  staleChip: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  staleChipText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 10,
    color: colors.warning,
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
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    gap: 12,
  },
  diagLabel: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
  },
  diagValue: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.primaryText,
  },
  serviceState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  emptyText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.mutedText,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  disconnectButton: {
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  disconnectText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.danger,
  },
});
