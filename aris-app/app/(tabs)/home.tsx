import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import SensorRow from "../../components/SensorRow";

const demoReadings = [
  { label: "Temp", value: "29.6", unit: "°C", calibrated: true },
  { label: "Humidity", value: "66.5", unit: "%", calibrated: true },
  { label: "MQ135", value: "422", unit: "ADC", calibrated: false },
  { label: "MG811", value: "0.34", unit: "V", calibrated: false },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mt-2">
          <View>
            <Text
              className="text-ink text-2xl"
              style={{ fontFamily: "Poppins_700Bold" }}
            >
              ARIS
            </Text>
            <Text
              className="text-secondary-text text-sm"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Air quality companion
            </Text>
          </View>
          <StatusBadge status="demo" label="Demo data" />
        </View>

        <View className="items-center py-4">
          <Mascot state="welcome" size="large" />
        </View>

        <Card>
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-ink text-base"
              style={{ fontFamily: "Poppins_600SemiBold" }}
            >
              Current readings
            </Text>
            <Text
              className="text-secondary-text text-xs"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Demo values
            </Text>
          </View>
          <SensorRow readings={demoReadings} />
          <Text
            className="text-secondary-text text-[11px] mt-2"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Gas sensor values are raw (uncalibrated). Not verified concentrations.
          </Text>
        </Card>

        <Card>
          <Text
            className="text-ink text-base mb-2"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Recommendation
          </Text>
          <Text
            className="text-ink text-sm leading-5"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Temperature and humidity are in a comfortable range. Gas sensor
            readings are uncalibrated and cannot be interpreted as air quality
            measurements yet.
          </Text>
          <Pressable
            className="mt-2 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Why this recommendation"
          >
            <Text
              className="text-lavender text-sm"
              style={{ fontFamily: "Inter_500Medium" }}
            >
              Why?
            </Text>
          </Pressable>
        </Card>

        <Card>
          <Text
            className="text-ink text-base mb-1"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Forecast
          </Text>
          <View className="bg-surface-lavender rounded-md p-3 items-center">
            <Mascot state="data_uncertain" size="small" />
            <Text
              className="text-secondary-text text-sm text-center mt-2"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Still learning the pattern from recent readings. Need 24 hourly
              samples before predictions are available.
            </Text>
            <Text
              className="text-secondary-text text-xs mt-1"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              2 / 24 samples collected
            </Text>
          </View>
        </Card>

        <Pressable
          className="bg-lavender rounded-lg p-4 items-center active:bg-lavender-dark"
          onPress={() => router.push("/ask-aris")}
          accessibilityRole="button"
          accessibilityLabel="Ask ARIS a question"
        >
          <Text
            className="text-white text-base"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Ask ARIS
          </Text>
          <Text
            className="text-white/80 text-xs mt-0.5"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Ask about your air quality
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
