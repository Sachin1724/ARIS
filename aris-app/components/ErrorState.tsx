import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/tokens";

interface ErrorStateProps {
  title: string;
  message: string;
  action?: string;
  onRetry?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
  tertiaryAction?: string;
  onTertiaryAction?: () => void;
}

export default function ErrorState({
  title,
  message,
  action,
  onRetry,
  secondaryAction,
  onSecondaryAction,
  tertiaryAction,
  onTertiaryAction,
}: ErrorStateProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
      </View>
      <Text
        style={{
          fontFamily: "Poppins_600SemiBold",
          fontSize: 18,
          color: colors.ink,
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: "center",
          lineHeight: 18,
          maxWidth: 320,
          marginBottom: 20,
        }}
      >
        {message}
      </Text>

      <View style={{ width: "100%", maxWidth: 320, gap: 10 }}>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primaryDark : colors.primary,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignItems: "center",
              justifyContent: "center",
            })}
            accessibilityRole="button"
            accessibilityLabel={action ?? "Retry"}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                color: "#FFFFFF",
                fontSize: 14,
              }}
            >
              {action ?? "Retry"}
            </Text>
          </Pressable>
        )}

        {onSecondaryAction && secondaryAction && (
          <Pressable
            onPress={onSecondaryAction}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            })}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                color: colors.ink,
                fontSize: 14,
              }}
            >
              {secondaryAction}
            </Text>
          </Pressable>
        )}

        {onTertiaryAction && tertiaryAction && (
          <Pressable
            onPress={onTertiaryAction}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={tertiaryAction}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                color: colors.accent,
                fontSize: 13,
              }}
            >
              {tertiaryAction}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
