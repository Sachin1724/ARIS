import { View, Text } from "react-native";

type Status = "good" | "moderate" | "poor" | "unknown" | "stale" | "demo";

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const statusColors: Record<Status, { bg: string; text: string; border: string }> = {
  good: { bg: "bg-success/10", text: "text-success", border: "border-success/30" },
  moderate: { bg: "bg-caution/10", text: "text-caution", border: "border-caution/30" },
  poor: { bg: "bg-danger/10", text: "text-danger", border: "border-danger/30" },
  unknown: { bg: "bg-secondary-text/10", text: "text-secondary-text", border: "border-secondary-text/30" },
  stale: { bg: "bg-caution/10", text: "text-caution", border: "border-caution/30" },
  demo: { bg: "bg-info/10", text: "text-info", border: "border-info/30" },
};

const statusIcons: Record<Status, string> = {
  good: "●",
  moderate: "▲",
  poor: "■",
  unknown: "○",
  stale: "◒",
  demo: "◇",
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const c = statusColors[status];
  return (
    <View
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-md border ${c.bg} ${c.border}`}
      accessibilityLabel={`${label}: ${status}`}
      accessibilityRole="text"
    >
      <Text className={c.text} style={{ fontSize: 8 }}>{statusIcons[status]}</Text>
      <Text
        className={`text-xs ${c.text}`}
        style={{ fontFamily: "Inter_500Medium" }}
      >
        {label}
      </Text>
    </View>
  );
}
