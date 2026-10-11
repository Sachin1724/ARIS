import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useState } from "react";
import Card from "../../components/Card";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/tokens";

export default function SettingsScreen() {
  const [useCelsius, setUseCelsius] = useState(true);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-3"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text
          className="text-ink text-base mb-3"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Display
        </Text>
        <View className="flex-row items-center justify-between py-2">
          <View className="flex-row items-center gap-3">
            <Ionicons name="thermometer-outline" size={20} color={colors.ink} />
            <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
              Temperature in Celsius
            </Text>
          </View>
          <Switch
            value={useCelsius}
            onValueChange={setUseCelsius}
            trackColor={{ false: colors.border, true: colors.lavender }}
            accessibilityLabel="Toggle temperature unit"
          />
        </View>
      </Card>

      <Card>
        <Text
          className="text-ink text-base mb-3"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Privacy
        </Text>
        <Text
          className="text-secondary-text text-sm"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          ARIS operates locally. No data is sent to cloud services. All
          processing happens on your UNO Q device. Provider keys (weather,
          traffic) are stored on the device, not in the app.
        </Text>
      </Card>

      <Card>
        <Text
          className="text-ink text-base mb-3"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          About
        </Text>
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-secondary-text text-sm" style={{ fontFamily: "Inter_400Regular" }}>
              Version
            </Text>
            <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
              1.0.0
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-secondary-text text-sm" style={{ fontFamily: "Inter_400Regular" }}>
              Device
            </Text>
            <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
              Not connected
            </Text>
          </View>
        </View>
      </Card>

      <Pressable
        className="border border-danger rounded-lg py-3 items-center active:bg-danger/10"
        accessibilityRole="button"
        accessibilityLabel="Forget paired device"
      >
        <Text
          className="text-danger text-sm"
          style={{ fontFamily: "Inter_600SemiBold" }}
        >
          Forget device
        </Text>
      </Pressable>
    </ScrollView>
  );
}
