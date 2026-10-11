import { View, Text } from "react-native";

interface SensorReading {
  label: string;
  value: string | null;
  unit: string;
  calibrated?: boolean;
}

interface SensorRowProps {
  readings: SensorReading[];
}

export default function SensorRow({ readings }: SensorRowProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {readings.map((reading) => (
        <View
          key={reading.label}
          className="flex-1 min-w-[80px] bg-surface-lavender rounded-md p-3 items-center"
          accessibilityLabel={`${reading.label}: ${reading.value ?? "unavailable"} ${reading.unit}`}
        >
          <Text
            className="text-secondary-text text-[10px] mb-1"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {reading.label}
          </Text>
          <Text
            className="text-ink text-lg"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            {reading.value ?? "--"}
          </Text>
          <Text
            className="text-secondary-text text-[10px]"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            {reading.unit}
            {reading.calibrated === false && " (raw)"}
          </Text>
        </View>
      ))}
    </View>
  );
}
