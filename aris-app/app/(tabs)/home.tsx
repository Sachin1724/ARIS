import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import SensorRow from "../../components/SensorRow";
import ConnectionBanner from "../../components/ConnectionBanner";
import StaleIndicator from "../../components/StaleIndicator";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { useConnection } from "../../hooks/useConnection";

function formatSensorReadings(sensors: Record<string, { value: number | null; unit: string; calibrated?: boolean }>) {
  const entries = Object.entries(sensors);
  return entries.map(([key, sensor]) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ C$/, "").replace(/ Pct$/, "").replace(/ Adc$/, "").replace(/ V$/, ""),
    value: sensor.value !== null ? String(sensor.value) : null,
    unit: sensor.unit,
    calibrated: sensor.calibrated,
  }));
}

function minutesAgo(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 60000);
}

export default function HomeScreen() {
  const router = useRouter();
  const { status, loading, error, stale, isDemo, lastUpdated, refresh } = useDeviceStatus();
  const connection = useConnection();

  const staleMinutes = stale && lastUpdated
    ? minutesAgo(lastUpdated)
    : null;

  if (loading && !status) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <LoadingState message="Loading device status..." />
      </SafeAreaView>
    );
  }

  if (error && !status) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ErrorState
          title="Cannot reach device"
          message={error}
          action="Retry"
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  const sensors = status?.sensors ?? {};
  const readings = formatSensorReadings(sensors);
  const forecast = status?.forecast_status;
  const mascotState = isDemo
    ? "welcome"
    : stale
      ? "device_disconnected"
      : forecast?.input_ready
        ? "good_conditions"
        : "idle";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mt-3">
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
          <StatusBadge
            status={isDemo ? "demo" : stale ? "stale" : "good"}
            label={isDemo ? "Demo data" : stale ? "Stale" : "Live"}
          />
        </View>

        <ConnectionBanner status={connection.status} />

        {staleMinutes !== null && (
          <StaleIndicator lastUpdated={`${staleMinutes} min ago`} />
        )}

        <View className="items-center py-2">
          <Mascot state={mascotState} size="large" />
        </View>

        <Card elevated>
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
              {isDemo ? "Demo values" : status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : ""}
            </Text>
          </View>
          <SensorRow readings={readings} />
          {Object.values(sensors).some((s) => s.calibrated === false) && (
            <Text
              className="text-secondary-text text-[11px] mt-3"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              Gas sensor values are raw (uncalibrated). Not verified concentrations.
            </Text>
          )}
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
          <View className="bg-surface-lavender rounded-xl p-4 items-center">
            <Mascot state="data_uncertain" size="small" />
            <Text
              className="text-secondary-text text-sm text-center mt-2"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {forecast?.input_ready
                ? "Forecast available"
                : "Still learning from recent readings. Need 24 hourly samples before predictions."}
            </Text>
            <Text
              className="text-secondary-text text-xs mt-1"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {forecast ? `${forecast.hourly_samples} / ${forecast.required_hourly_samples} samples` : ""}
            </Text>
          </View>
        </Card>

        <Pressable
          className="bg-lavender rounded-2xl p-4 items-center active:bg-lavender-dark"
          style={{
            shadowColor: "#7C5CFC",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 5,
          }}
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
