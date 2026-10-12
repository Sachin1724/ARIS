import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onReconnect?: () => void;
}

const config: Record<
  ConnectionStatus,
  {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  connected: {
    icon: "checkmark-circle",
    label: "Connected to UNO Q",
    color: colors.success,
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
  },
  reconnecting: {
    icon: "sync-outline",
    label: "Reconnecting to UNO Q...",
    color: colors.statusModerate,
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.25)",
  },
  disconnected: {
    icon: "cloud-offline-outline",
    label: "No UNO Q Connected",
    color: colors.statusModerate,
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.25)",
  },
};

export default function ConnectionBanner({ status, onReconnect }: ConnectionBannerProps) {
  const c = config[status];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Ionicons name={c.icon} size={15} color={c.color} />
      <Text
        style={[styles.bannerText, { color: c.color }]}
        accessibilityLabel={c.label}
      >
        {c.label}
      </Text>
      {status === "disconnected" && onReconnect && (
        <Pressable
          onPress={onReconnect}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Try reconnecting"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  bannerText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  retryText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.statusSensitive,
  },
});
