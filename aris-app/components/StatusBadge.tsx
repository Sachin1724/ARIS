import { View, Text } from "react-native";

type Status = "good" | "moderate" | "poor" | "unhealthy" | "unknown" | "stale" | "live";

interface StatusBadgeProps {
  status: Status;
  label: string;
  size?: "small" | "medium";
}

const statusThemes: Record<
  Status,
  { bg: string; text: string; dot: string; border: string }
> = {
  good: {
    bg: "#ECFDF5",
    text: "#065F46",
    dot: "#10B981",
    border: "#A7F3D0",
  },
  moderate: {
    bg: "#FFFBEB",
    text: "#92400E",
    dot: "#F59E0B",
    border: "#FDE68A",
  },
  poor: {
    bg: "#FEF2F2",
    text: "#991B1B",
    dot: "#EF4444",
    border: "#FECACA",
  },
  unhealthy: {
    bg: "#FEF2F2",
    text: "#991B1B",
    dot: "#EF4444",
    border: "#FECACA",
  },
  live: {
    bg: "#EFF6FF",
    text: "#1E40AF",
    dot: "#2563EB",
    border: "#BFDBFE",
  },

  stale: {
    bg: "#FFF7ED",
    text: "#9A3412",
    dot: "#EA580C",
    border: "#FED7AA",
  },
  unknown: {
    bg: "#F8FAFC",
    text: "#475569",
    dot: "#94A3B8",
    border: "#E2E8F0",
  },
};

export default function StatusBadge({
  status,
  label,
  size = "medium",
}: StatusBadgeProps) {
  const theme = statusThemes[status] || statusThemes.unknown;
  const isSmall = size === "small";

  return (
    <View
      style={{
        backgroundColor: theme.bg,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 4, // Clean technical badge, NOT a pill shape
        paddingHorizontal: isSmall ? 7 : 10,
        paddingVertical: isSmall ? 3 : 5,
        flexDirection: "row",
        alignItems: "center",
      }}
      accessibilityLabel={`${label}: ${status}`}
      accessibilityRole="text"
    >
      <View
        style={{
          width: isSmall ? 5 : 6,
          height: isSmall ? 5 : 6,
          borderRadius: 3,
          backgroundColor: theme.dot,
          marginRight: 6,
        }}
      />
      <Text
        style={{
          color: theme.text,
          fontSize: isSmall ? 11 : 12,
          fontFamily: "Inter_500Medium",
          letterSpacing: 0.1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
