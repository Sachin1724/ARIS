import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../../components/Card";
import Mascot from "../../components/Mascot";

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-4 pb-2">
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

        <Card className="mt-2">
          <Text
            className="text-ink text-base mb-3"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Weather
          </Text>
          <View className="items-center py-6">
            <Mascot state="idle" size="medium" />
            <Text
              className="text-secondary-text text-sm text-center mt-3"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              No weather data available. Connect your UNO Q device to enable
              optional weather context from the device provider.
            </Text>
          </View>
        </Card>

        <Card className="mt-3">
          <Text
            className="text-ink text-base mb-3"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Wind and precipitation
          </Text>
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
        </Card>

        <Card className="mt-3">
          <Text
            className="text-ink text-base mb-1"
            style={{ fontFamily: "Poppins_600SemiBold" }}
          >
            Traffic (optional)
          </Text>
          <Text
            className="text-secondary-text text-sm"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            Traffic context is optional and provided by the device. Correlation
            with air quality does not prove causation.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
