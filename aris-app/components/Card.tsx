import { View } from "react-native";
import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
  elevated?: boolean;
}

export default function Card({ children, className = "", elevated = false }: CardProps) {
  return (
    <View
      className={`bg-surface rounded-2xl border border-border p-4 ${className}`}
      style={elevated ? {
        shadowColor: "#191936",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      } : {
        shadowColor: "#191936",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      {children}
    </View>
  );
}
