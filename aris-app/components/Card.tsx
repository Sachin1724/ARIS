import { View, ViewStyle, StyleProp } from "react-native";
import type { PropsWithChildren } from "react";
import { colors } from "../constants/tokens";

interface CardProps extends PropsWithChildren {
  className?: string;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  tint?: "default" | "lavender" | "mint" | "amber" | "sky";
}

const tintStyles = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  lavender: { backgroundColor: colors.accentLight, borderColor: "#BFDBFE" },
  mint: { backgroundColor: "#F0FAF5", borderColor: "#D1F2E2" },
  amber: { backgroundColor: "#FFF9EE", borderColor: "#FDE68A" },
  sky: { backgroundColor: "#F0F8FF", borderColor: "#BAE6FD" },
};

export default function Card({
  children,
  className = "",
  elevated = false,
  style,
  tint = "default",
}: CardProps) {
  const t = tintStyles[tint] || tintStyles.default;

  return (
    <View
      className={`rounded-xl border p-4 ${className}`}
      style={[
        {
          backgroundColor: t.backgroundColor,
          borderColor: t.borderColor,
          borderRadius: 12,
          padding: 16,
        },
        elevated
          ? {
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }
          : {
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            },
        style,
      ]}
    >
      {children}
    </View>
  );
}
