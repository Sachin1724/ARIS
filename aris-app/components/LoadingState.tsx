import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "../constants/tokens";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <View
      className="flex-1 items-center justify-center py-12"
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <ActivityIndicator size="large" color={colors.lavender} />
      <Text
        className="text-secondary-text text-sm mt-3"
        style={{ fontFamily: "Inter_400Regular" }}
      >
        {message}
      </Text>
    </View>
  );
}
