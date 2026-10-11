import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/tokens";

interface StaleIndicatorProps {
  lastUpdated: string;
}

export default function StaleIndicator({ lastUpdated }: StaleIndicatorProps) {
  return (
    <View
      className="flex-row items-center gap-1.5 bg-caution/10 border border-caution/30 rounded-md px-3 py-2"
      accessibilityLabel={`Data may be stale. Last updated ${lastUpdated}`}
    >
      <Ionicons name="time-outline" size={14} color={colors.caution} />
      <Text
        className="text-caution text-xs flex-1"
        style={{ fontFamily: "Inter_500Medium" }}
      >
        Last updated {lastUpdated}
      </Text>
    </View>
  );
}
