import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/tokens";

const steps = [
  { label: "Scan for devices", icon: "bluetooth-outline" as const },
  { label: "Authenticate device", icon: "shield-checkmark-outline" as const },
  { label: "Provide Wi-Fi credentials", icon: "wifi-outline" as const },
  { label: "Connect and verify", icon: "checkmark-circle-outline" as const },
];

export default function DeviceScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 px-4 py-4">
        <View className="items-center py-6">
          <Mascot state="welcome" size="large" />
          <Text
            className="text-ink text-xl mt-4 text-center"
            style={{ fontFamily: "Poppins_700Bold" }}
          >
            Connect your UNO Q
          </Text>
          <Text
            className="text-secondary-text text-sm text-center mt-1 px-8"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            ARIS uses Bluetooth to discover your device, then connects over
            your existing Wi-Fi network.
          </Text>
        </View>

        <Card className="mt-2">
          {steps.map((step, i) => (
            <View key={step.label}>
              <View className="flex-row items-center py-3">
                <View className="w-8 h-8 rounded-md bg-surface-lavender items-center justify-center">
                  <Ionicons name={step.icon} size={18} color={colors.lavender} />
                </View>
                <Text
                  className="text-ink text-sm ml-3 flex-1"
                  style={{ fontFamily: "Inter_500Medium" }}
                >
                  {step.label}
                </Text>
                <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_400Regular" }}>
                  Step {i + 1}
                </Text>
              </View>
              {i < steps.length - 1 && <View className="border-b border-border ml-11" />}
            </View>
          ))}
        </Card>

        <Pressable
          className="bg-lavender rounded-lg py-3.5 items-center mt-4 active:bg-lavender-dark"
          accessibilityRole="button"
          accessibilityLabel="Start scanning for devices"
        >
          <Text
            className="text-white text-base"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Start scanning
          </Text>
        </Pressable>

        <Text
          className="text-secondary-text text-xs text-center mt-3"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          Bluetooth permission will be requested when you start scanning.
          Wi-Fi credentials are sent only over an encrypted connection.
        </Text>
      </View>
    </SafeAreaView>
  );
}
