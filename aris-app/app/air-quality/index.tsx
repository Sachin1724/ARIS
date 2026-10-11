import { Text, ScrollView } from "react-native";
import Card from "../../components/Card";
import SensorRow from "../../components/SensorRow";

export default function AirQualityScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-4"
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Text
          className="text-ink text-lg mb-1"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Air Quality Overview
        </Text>
        <Text
          className="text-secondary-text text-sm"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          No calibrated air quality data available. Gas sensors are providing
          raw ADC and voltage readings only.
        </Text>
      </Card>

      <Card>
        <Text
          className="text-ink text-base mb-3"
          style={{ fontFamily: "Poppins_600SemiBold" }}
        >
          Sensor readings
        </Text>
        <SensorRow
          readings={[
            { label: "MQ135", value: "422", unit: "ADC", calibrated: false },
            { label: "MG811", value: "0.34", unit: "V", calibrated: false },
          ]}
        />
        <Text
          className="text-caution text-xs mt-3"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          These are raw sensor values. Calibration is required before readings
          can be interpreted as gas concentrations (ppm). Do not treat raw
          values as verified air quality measurements.
        </Text>
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
