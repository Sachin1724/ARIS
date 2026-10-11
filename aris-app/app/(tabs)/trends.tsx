import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Card from "../../components/Card";
import Mascot from "../../components/Mascot";

const metrics = ["Temperature", "Humidity", "MQ135", "MG811"] as const;
const timeRanges = ["6h", "24h", "7d"] as const;

export default function TrendsScreen() {
  const [selectedMetric, setSelectedMetric] = useState<typeof metrics[number]>("Temperature");
  const [selectedRange, setSelectedRange] = useState<typeof timeRanges[number]>("24h");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pt-4 pb-2">
        <Text
          className="text-ink text-2xl"
          style={{ fontFamily: "Poppins_700Bold" }}
        >
          Trends
        </Text>
        <Text
          className="text-secondary-text text-sm"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          History and forecast
        </Text>
      </View>

      <View className="flex-row px-4 gap-2 mb-3">
        {metrics.map((metric) => (
          <Pressable
            key={metric}
            onPress={() => setSelectedMetric(metric)}
            className={`px-3 py-1.5 rounded-md border ${
              selectedMetric === metric
                ? "bg-lavender border-lavender"
                : "bg-surface border-border"
            }`}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedMetric === metric }}
          >
            <Text
              className={`text-xs ${
                selectedMetric === metric ? "text-white" : "text-ink"
              }`}
              style={{ fontFamily: "Inter_500Medium" }}
            >
              {metric}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {timeRanges.map((range) => (
          <Pressable
            key={range}
            onPress={() => setSelectedRange(range)}
            className={`px-3 py-1 rounded-md ${
              selectedRange === range
                ? "bg-surface-lavender"
                : "bg-transparent"
            }`}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedRange === range }}
          >
            <Text
              className={`text-sm ${
                selectedRange === range ? "text-lavender" : "text-secondary-text"
              }`}
              style={{ fontFamily: "Inter_500Medium" }}
            >
              {range}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-1 px-4">
        <Card className="flex-1 items-center justify-center">
          <Mascot state="thinking" size="medium" />
          <Text
            className="text-ink text-base mt-4 text-center"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            No {selectedMetric.toLowerCase()} data yet
          </Text>
          <Text
            className="text-secondary-text text-sm text-center mt-1 px-4"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Connect your UNO Q device to see {selectedRange} of {selectedMetric.toLowerCase()} history.
          </Text>
          {(selectedMetric === "MQ135" || selectedMetric === "MG811") && (
            <Text
              className="text-caution text-xs text-center mt-2 px-4"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              This sensor is uncalibrated. Values shown as raw ADC/voltage.
            </Text>
          )}
        </Card>
      </View>

      <Card className="mx-4 mb-4 mt-3">
        <Text
          className="text-ink text-sm"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Forecast status
        </Text>
        <Text
          className="text-secondary-text text-sm mt-1"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          Model not loaded. Requires connected device with 24+ hourly samples.
        </Text>
      </Card>
    </SafeAreaView>
  );
}
