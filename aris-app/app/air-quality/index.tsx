import { View, Text, ScrollView } from "react-native";
import Card from "../../components/Card";
import SensorRow from "../../components/SensorRow";
import DemoLabel from "../../components/DemoLabel";
import LoadingState from "../../components/LoadingState";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";

export default function AirQualityScreen() {
  const { status, loading, isDemo } = useDeviceStatus();

  if (loading && !status) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="flex-1">
        <LoadingState message="Loading sensor data..." />
      </ScrollView>
    );
  }

  const sensors = status?.sensors ?? {};
  const gasSensors = Object.entries(sensors).filter(
    ([key]) => key.includes("mq") || key.includes("mg"),
  );
  const envSensors = Object.entries(sensors).filter(
    ([key]) => key.includes("temperature") || key.includes("humidity"),
  );
  const hasUncalibrated = Object.values(sensors).some((s) => s.calibrated === false);

  const formatLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/ C$/, "").replace(/ Pct$/, "").replace(/ Adc$/, "").replace(/ V$/, "");

  const toReadings = (entries: [string, typeof sensors[string]][]) =>
    entries.map(([key, s]) => ({
      label: formatLabel(key),
      value: s.value !== null ? String(s.value) : null,
      unit: s.unit,
      calibrated: s.calibrated,
    }));

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-4"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-ink text-lg"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Air Quality Overview
        </Text>
        {isDemo && <DemoLabel />}
      </View>

      {envSensors.length > 0 && (
        <Card>
          <Text
            className="text-ink text-base mb-3"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Environment
          </Text>
          <SensorRow readings={toReadings(envSensors)} />
        </Card>
      )}

      <Card>
        <Text
          className="text-ink text-base mb-3"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Gas sensors
        </Text>
        {gasSensors.length > 0 ? (
          <SensorRow readings={toReadings(gasSensors)} />
        ) : (
          <Text
            className="text-secondary-text text-sm"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            No gas sensor data available.
          </Text>
        )}
        {hasUncalibrated && (
          <Text
            className="text-caution text-xs mt-3"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            These are raw sensor values. Calibration is required before readings
            can be interpreted as gas concentrations (ppm). Do not treat raw
            values as verified air quality measurements.
          </Text>
        )}
      </Card>

      <Card>
        <Text
          className="text-ink text-base mb-1"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          About AQI categories
        </Text>
        <Text
          className="text-secondary-text text-sm"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          AQI thresholds follow documented standards. ARIS will display
          AQI categories once calibrated concentration data is available from
          the device.
        </Text>
      </Card>
    </ScrollView>
  );
}
