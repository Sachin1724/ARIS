import { View } from "react-native";
import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <View
      className={`bg-surface rounded-lg border border-border p-4 ${className}`}
    >
      {children}
    </View>
  );
}
