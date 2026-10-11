import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../../components/Card";
import Mascot from "../../components/Mascot";
import DemoLabel from "../../components/DemoLabel";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";

export default function ExploreScreen() {
  const { status, isDemo } = useDeviceStatus();
  const sensors = status?.sensors ?? {};

  const weatherSensors = Object.entries(sensors).filter(
    ([, s]) => s.source === "weather_provider",
  );
  const trafficSensors = Object.entries(sensors).filter(
    ([, s]) => s.source === "traffic_provider",
  );

  const temp = sensors.temperature_c;
  const humidity = sensors.humidity_pct;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text
              className="text-ink text-2xl"
              style={{ fontFamily: "Poppins_700Bold" }}
            >
              Explore
            </Text>
            <Text
              className="text-secondary-text text-sm"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Weather and environmental context
            </Text>
          </View>
          {isDemo && <DemoLabel />}
        </View>

        <Card className="mt-2">
          <Text
            className="text-ink text-base mb-3"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Local conditions
          </Text>
          {temp || humidity ? (
            <View className="flex-row gap-4">
              {temp && (
                <View className="flex-1 bg-surface-lavender rounded-md p-3 items-center">
                  <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                    Temperature
                  </Text>
                  <Text className="text-ink text-lg" style={{ fontFamily: "Poppins_600SemiBold" }}>
                    {temp.value !== null ? `${temp.value}${temp.unit}` : "--"}
                  </Text>
                </View>
              )}
              {humidity && (
                <View className="flex-1 bg-surface-lavender rounded-md p-3 items-center">
                  <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_500Medium" }}>
                    Humidity
                  </Text>
                  <Text className="text-ink text-lg" style={{ fontFamily: "Poppins_600SemiBold" }}>
                    {humidity.value !== null ? `${humidity.value}${humidity.unit}` : "--"}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="items-center py-6">
              <Mascot state="idle" size="medium" />
              <Text
                className="text-secondary-text text-sm text-center mt-3"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                No sensor data available. Connect your UNO Q device.
              </Text>
            </View>
          )}
        </Card>

        <Card className="mt-3">
          <Text
            className="text-ink text-base mb-3"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Weather context
          </Text>
          {weatherSensors.length > 0 ? (
            <View className="gap-2">
              {weatherSensors.map(([key, sensor]) => (
                <View key={key} className="flex-row justify-between items-center py-1">
                  <Text className="text-ink text-sm" style={{ fontFamily: "Inter_400Regular" }}>
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
                    {sensor.value !== null ? `${sensor.value} ${sensor.unit}` : "--"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-row gap-4">
              <View className="flex-1 bg-surface-lavender rounded-md p-3 items-center">
                <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_500Medium" }}>Wind</Text>
                <Text className="text-ink text-lg" style={{ fontFamily: "Poppins_600SemiBold" }}>--</Text>
              </View>
              <View className="flex-1 bg-surface-lavender rounded-md p-3 items-center">
                <Text className="text-secondary-text text-xs" style={{ fontFamily: "Inter_500Medium" }}>Rain</Text>
                <Text className="text-ink text-lg" style={{ fontFamily: "Poppins_600SemiBold" }}>--</Text>
              </View>
            </View>
          )}
          <Text
            className="text-secondary-text text-xs mt-2"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Weather data is optional and provided by the device backend when configured.
          </Text>
        </Card>

        <Card className="mt-3">
          <Text
            className="text-ink text-base mb-1"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Traffic context
          </Text>
          {trafficSensors.length > 0 ? (
            <View className="gap-2 mt-1">
              {trafficSensors.map(([key, sensor]) => (
                <View key={key} className="flex-row justify-between items-center py-1">
                  <Text className="text-ink text-sm" style={{ fontFamily: "Inter_400Regular" }}>
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text className="text-ink text-sm" style={{ fontFamily: "Inter_500Medium" }}>
                    {sensor.value !== null ? `${sensor.value} ${sensor.unit}` : "--"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text
              className="text-secondary-text text-sm mt-1"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Traffic context is optional and provided by the device. Correlation
              with air quality does not prove causation.
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
