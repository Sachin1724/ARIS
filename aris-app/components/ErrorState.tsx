import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/tokens";

interface ErrorStateProps {
  title: string;
  message: string;
  action?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title, message, action, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-12 px-6">
      <View className="w-12 h-12 rounded-md bg-danger/10 items-center justify-center mb-3">
        <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
      </View>
      <Text
        className="text-ink text-base text-center"
        style={{ fontFamily: "Poppins_600SemiBold" }}
      >
        {title}
      </Text>
      <Text
        className="text-secondary-text text-sm text-center mt-1"
        style={{ fontFamily: "Inter_400Regular" }}
      >
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-4 bg-lavender rounded-md px-5 py-2.5 active:bg-lavender-dark"
          accessibilityRole="button"
          accessibilityLabel={action ?? "Retry"}
        >
          <Text
            className="text-white text-sm"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            {action ?? "Retry"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
