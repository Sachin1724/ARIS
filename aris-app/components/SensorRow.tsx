import { View, Text } from "react-native";
import { colors } from "../constants/tokens";

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
      {readings.map((reading, i) => {
        const isPrimary = i < 2 && reading.calibrated !== false;
        return (
          <View
            key={reading.label}
            className="flex-1 min-w-[80px] rounded-xl p-3 items-center"
            style={{
              backgroundColor: isPrimary ? colors.surfaceLavender : "#F5F4F8",
              borderWidth: isPrimary ? 1 : 0,
              borderColor: isPrimary ? "rgba(124,92,252,0.15)" : "transparent",
            }}
            accessibilityLabel={`${reading.label}: ${reading.value ?? "unavailable"} ${reading.unit}`}
          >
            <Text
              className="text-[10px] mb-0.5"
              style={{ fontFamily: "Inter_500Medium", color: colors.secondaryText }}
            >
              {reading.label}
            </Text>
            <Text
              className="text-xl"
              style={{
                fontFamily: "Poppins_600SemiBold",
                color: reading.value ? colors.ink : colors.secondaryText,
              }}
            >
              {reading.value ?? "--"}
            </Text>
            <Text
              className="text-[10px]"
              style={{ fontFamily: "Inter_400Regular", color: colors.secondaryText }}
            >
              {reading.unit}
              {reading.calibrated === false && " (raw)"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
