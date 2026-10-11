import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/Card";
import DemoLabel from "../../components/DemoLabel";
import { colors } from "../../constants/tokens";
import { useConnection } from "../../hooks/useConnection";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
}

function MenuItem({ icon, label, sublabel, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
      <View className="flex-1 ml-3">
        <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
          {label}
        </Text>
        {sublabel && (
          <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_400Regular" }}>
            {sublabel}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const connection = useConnection();
  const { status, isDemo } = useDeviceStatus();
  const isConnected = connection.status === "connected";

  const deviceName = isConnected && status
    ? "UNO Q"
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-4 pb-2 flex-row items-center justify-between">
          <Text
            className="text-ink text-2xl"
            style={{ fontFamily: "Poppins_700Bold" }}
          >
            Profile
          </Text>
          {isDemo && <DemoLabel />}
        </View>

        <Card className="mt-2">
          <Text
            className="text-ink text-base mb-2"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Device
          </Text>
          <View className="bg-surface-lavender rounded-md p-3 flex-row items-center">
            <Ionicons
              name={isConnected ? "hardware-chip" : "hardware-chip-outline"}
              size={24}
              color={isConnected ? colors.lavender : colors.secondaryText}
            />
            <View className="ml-3 flex-1">
              <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
                {deviceName ?? "No device connected"}
              </Text>
              <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_400Regular" }}>
                {isConnected
                  ? `Status: ${connection.status}`
                  : "Connect your UNO Q to get started"}
              </Text>
            </View>
            {isConnected && (
              <View className="w-2 h-2 rounded-full bg-success" />
            )}
          </View>
          {!isConnected && (
            <Pressable
              onPress={() => router.push("/device")}
              className="bg-lavender rounded-md py-2.5 items-center mt-3 active:bg-lavender-dark"
              accessibilityRole="button"
              accessibilityLabel="Connect device"
            >
              <Text className="text-white text-sm" style={{ fontFamily: "Inter_600SemiBold" }}>
                Connect device
              </Text>
            </Pressable>
          )}
          {isConnected && (
            <Pressable
              onPress={() => connection.disconnect()}
              className="border border-danger rounded-md py-2.5 items-center mt-3 active:bg-danger/10"
              accessibilityRole="button"
              accessibilityLabel="Disconnect device"
            >
              <Text className="text-danger text-sm" style={{ fontFamily: "Inter_600SemiBold" }}>
                Disconnect
              </Text>
            </Pressable>
          )}
        </Card>

        <Card className="mt-3">
          <Text
            className="text-ink text-base mb-1"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Settings
          </Text>
          <MenuItem
            icon="options-outline"
            label="Units and display"
            sublabel="Temperature, pressure units"
            onPress={() => router.push("/settings")}
          />
          <View className="border-b border-border" />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            sublabel="Air quality alerts"
            onPress={() => router.push("/settings")}
          />
          <View className="border-b border-border" />
          <MenuItem
            icon="shield-outline"
            label="Privacy"
            sublabel="Data and permissions"
            onPress={() => router.push("/settings")}
          />
        </Card>

        <Card className="mt-3">
          <Text
            className="text-secondary-text text-xs text-center"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            ARIS v1.0.0
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
