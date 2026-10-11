import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import Card from "../../components/Card";
import Mascot from "../../components/Mascot";
import LineChart from "../../components/LineChart";
import DemoLabel from "../../components/DemoLabel";
import LoadingState from "../../components/LoadingState";
import { useHistory } from "../../hooks/useHistory";
import { useForecast } from "../../hooks/useForecast";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";

const metrics = ["Temperature", "Humidity", "MQ135", "MG811"] as const;
const timeRanges = ["6h", "24h", "7d"] as const;

const metricToApi: Record<string, string> = {
  Temperature: "temperature_c",
  Humidity: "humidity_pct",
  MQ135: "mq135_adc",
  MG811: "mg811_voltage_v",
};

const rangeToHours: Record<string, number> = { "6h": 6, "24h": 24, "7d": 168 };

export default function TrendsScreen() {
  const [selectedMetric, setSelectedMetric] = useState<typeof metrics[number]>("Temperature");
  const [selectedRange, setSelectedRange] = useState<typeof timeRanges[number]>("24h");
  const { width: screenWidth } = useWindowDimensions();

  const history = useHistory();
  const forecast = useForecast();
  const { status: deviceStatus, isDemo } = useDeviceStatus();
  const forecastStatus = deviceStatus?.forecast_status;

  const fetchHistory = history.fetch;
  const fetchForecast = forecast.fetch;

  useEffect(() => {
    const apiMetric = metricToApi[selectedMetric];
    const hours = rangeToHours[selectedRange];
    fetchHistory(apiMetric, hours);
    fetchForecast(apiMetric);
  }, [selectedMetric, selectedRange, fetchHistory, fetchForecast]);

  const chartWidth = screenWidth - 32;
  const hasData = history.data && history.data.points.length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View>
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
        {isDemo && <DemoLabel />}
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
        {history.loading ? (
          <Card className="flex-1 items-center justify-center">
            <LoadingState message={`Loading ${selectedMetric.toLowerCase()} data...`} />
          </Card>
        ) : hasData ? (
          <Card className="flex-1">
            <Text
              className="text-ink text-sm mb-2"
              style={{ fontFamily: "Poppins_600SemiBold" }}
            >
              {selectedMetric} — last {selectedRange}
            </Text>
            <LineChart
              points={history.data!.points}
              width={chartWidth - 32}
              height={180}
            />
            {forecast.data && forecast.data.points.length > 0 && (
              <View className="flex-row items-center gap-3 mt-2">
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-0.5 bg-lavender rounded-full" />
                  <Text className="text-secondary-text text-[10px]" style={{ fontFamily: "Inter_400Regular" }}>
                    Observed
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-0.5 bg-sky rounded-full" style={{ borderStyle: "dashed" }} />
                  <Text className="text-secondary-text text-[10px]" style={{ fontFamily: "Inter_400Regular" }}>
                    Predicted
                  </Text>
                </View>
              </View>
            )}
            {(selectedMetric === "MQ135" || selectedMetric === "MG811") && (
              <Text
                className="text-caution text-xs mt-2"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Uncalibrated. Values are raw ADC/voltage, not verified concentrations.
              </Text>
            )}
          </Card>
        ) : (
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
          </Card>
        )}
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
          {forecastStatus?.input_ready
            ? "Forecast model ready. Predictions available."
            : `Need ${forecastStatus?.required_hourly_samples ?? 24} hourly samples. Currently ${forecastStatus?.hourly_samples ?? 0} collected.`}
        </Text>
      </Card>
    </SafeAreaView>
  );
}
