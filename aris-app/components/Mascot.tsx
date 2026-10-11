import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors } from "../constants/tokens";

type MascotState =
  | "idle"
  | "welcome"
  | "good_conditions"
  | "conditions_changing"
  | "poor_air_quality"
  | "thinking"
  | "device_disconnected"
  | "data_uncertain";

interface MascotProps {
  state?: MascotState;
  size?: "small" | "medium" | "large";
}

const sizeMap = {
  small: 48,
  medium: 80,
  large: 120,
};

const expressionMap: Record<MascotState, string> = {
  idle: "^_^",
  welcome: "^o^",
  good_conditions: "^u^",
  conditions_changing: "o_O",
  poor_air_quality: ">_<",
  thinking: "._.",
  device_disconnected: "T_T",
  data_uncertain: "?_?",
};

const labelMap: Record<MascotState, string> = {
  idle: "ARIS is here",
  welcome: "Welcome!",
  good_conditions: "Air is good",
  conditions_changing: "Conditions changing",
  poor_air_quality: "Air quality concern",
  thinking: "Thinking...",
  device_disconnected: "Device disconnected",
  data_uncertain: "Data uncertain",
};

export default function Mascot({ state = "idle", size = "medium" }: MascotProps) {
  const px = sizeMap[size];
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="items-center gap-1">
      <Animated.View
        style={[
          {
            width: px,
            height: px,
            borderRadius: px * 0.35,
            backgroundColor: colors.surfaceLavender,
            borderWidth: 2,
            borderColor: colors.lavender,
          },
          animatedStyle,
        ]}
        className="items-center justify-center"
        accessibilityLabel={labelMap[state]}
        accessibilityRole="image"
      >
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: px * 0.22,
            color: colors.lavender,
          }}
        >
          {expressionMap[state]}
        </Text>
      </Animated.View>
      {size === "large" && (
        <Text
          className="text-secondary-text text-xs"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {labelMap[state]}
        </Text>
      )}
    </View>
  );
}
