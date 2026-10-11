import { View, Text, Pressable } from "react-native";
import Mascot from "./Mascot";

interface EmptyStateProps {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, message, action, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-12 px-6">
      <Mascot state="data_uncertain" size="medium" />
      <Text
        className="text-ink text-base text-center mt-4"
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
      {onAction && action && (
        <Pressable
          onPress={onAction}
          className="mt-4 bg-lavender rounded-md px-5 py-2.5 active:bg-lavender-dark"
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text
            className="text-white text-sm"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
