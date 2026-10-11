import { View, Text } from "react-native";

export default function DemoLabel() {
  return (
    <View
      className="bg-info/10 border border-info/30 rounded-md px-2 py-0.5"
      accessibilityLabel="This data is for demonstration only"
    >
      <Text
        className="text-info text-[10px]"
        style={{ fontFamily: "Inter_600SemiBold" }}
      >
        DEMO
      </Text>
    </View>
  );
}
