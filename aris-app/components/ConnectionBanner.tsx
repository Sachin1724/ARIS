import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/tokens";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected" | "demo";

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onReconnect?: () => void;
}

const config: Record<ConnectionStatus, { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; bg: string; text: string }> = {
  connected: { icon: "checkmark-circle", label: "Connected", bg: "bg-success/10", text: "text-success" },
  reconnecting: { icon: "sync-outline", label: "Reconnecting...", bg: "bg-caution/10", text: "text-caution" },
  disconnected: { icon: "cloud-offline-outline", label: "Disconnected", bg: "bg-danger/10", text: "text-danger" },
  demo: { icon: "flask-outline", label: "Demo mode", bg: "bg-info/10", text: "text-info" },
};

export default function ConnectionBanner({ status, onReconnect }: ConnectionBannerProps) {
  const c = config[status];
  return (
    <View className={`flex-row items-center gap-2 ${c.bg} rounded-md px-3 py-2`}>
      <Ionicons name={c.icon} size={16} color={colors[status === "connected" ? "success" : status === "reconnecting" ? "caution" : status === "disconnected" ? "danger" : "info"]} />
      <Text
        className={`text-xs flex-1 ${c.text}`}
        style={{ fontFamily: "Inter_500Medium" }}
        accessibilityLabel={c.label}
      >
        {c.label}
      </Text>
      {status === "disconnected" && onReconnect && (
        <Pressable onPress={onReconnect} accessibilityRole="button" accessibilityLabel="Try reconnecting">
          <Text className="text-danger text-xs" style={{ fontFamily: "Inter_600SemiBold" }}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
