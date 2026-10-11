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

const sizeMap = { small: 48, medium: 80, large: 120 };

const stateConfig: Record<MascotState, {
  face: string;
  label: string;
  glow: string;
  faceColor: string;
  bodyColor: string;
  borderColor: string;
}> = {
  idle: {
    face: "◠‿◠",
    label: "ARIS is here",
    glow: "rgba(124,92,252,0.12)",
    faceColor: colors.lavender,
    bodyColor: colors.surfaceLavender,
    borderColor: colors.lavender,
  },
  welcome: {
    face: "◠◡◠",
    label: "Welcome!",
    glow: "rgba(124,92,252,0.18)",
    faceColor: colors.lavender,
    bodyColor: colors.surfaceLavender,
    borderColor: colors.lavender,
  },
  good_conditions: {
    face: "◠ᴗ◠",
    label: "Air quality is good",
    glow: "rgba(26,168,121,0.15)",
    faceColor: colors.success,
    bodyColor: "#E8F8F0",
    borderColor: colors.success,
  },
  conditions_changing: {
    face: "◑_◑",
    label: "Conditions are changing",
    glow: "rgba(233,154,34,0.15)",
    faceColor: colors.caution,
    bodyColor: "#FFF5E6",
    borderColor: colors.caution,
  },
  poor_air_quality: {
    face: "◠︵◠",
    label: "Air quality concern",
    glow: "rgba(230,91,101,0.15)",
    faceColor: colors.danger,
    bodyColor: "#FEECEE",
    borderColor: colors.danger,
  },
  thinking: {
    face: "◠ · ◠",
    label: "Thinking...",
    glow: "rgba(124,92,252,0.10)",
    faceColor: colors.lavender,
    bodyColor: colors.surfaceLavender,
    borderColor: colors.lavender,
  },
  device_disconnected: {
    face: "◠_◠",
    label: "Device disconnected",
    glow: "rgba(104,105,133,0.10)",
    faceColor: colors.secondaryText,
    bodyColor: "#F0EFF4",
    borderColor: colors.border,
  },
  data_uncertain: {
    face: "◠?◠",
    label: "Data uncertain",
    glow: "rgba(68,141,235,0.12)",
    faceColor: colors.info,
    bodyColor: "#EBF3FD",
    borderColor: colors.info,
  },
};

export default function Mascot({ state = "idle", size = "medium" }: MascotProps) {
  const px = sizeMap[size];
  const cfg = stateConfig[state];
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const glowSize = px * 1.5;
  const eyeSize = Math.max(px * 0.09, 4);

  return (
    <View className="items-center gap-1">
      <View
        style={{
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: cfg.glow,
          position: "absolute",
          top: -(glowSize - px) / 2 + 4,
        }}
      />
      <Animated.View
        style={[
          {
            width: px,
            height: px,
            borderRadius: px * 0.38,
            backgroundColor: cfg.bodyColor,
            borderWidth: 2.5,
            borderColor: cfg.borderColor,
            shadowColor: cfg.borderColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          },
          animatedStyle,
        ]}
        className="items-center justify-center"
        accessibilityLabel={cfg.label}
        accessibilityRole="image"
      >
        <View className="items-center" style={{ gap: px * 0.08 }}>
          <View className="flex-row" style={{ gap: px * 0.22 }}>
            <View style={{
              width: eyeSize,
              height: eyeSize,
              borderRadius: eyeSize / 2,
              backgroundColor: cfg.faceColor,
            }} />
            <View style={{
              width: eyeSize,
              height: eyeSize,
              borderRadius: eyeSize / 2,
              backgroundColor: cfg.faceColor,
            }} />
          </View>
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: px * 0.15,
              color: cfg.faceColor,
              lineHeight: px * 0.18,
            }}
          >
            {cfg.face}
          </Text>
        </View>
      </Animated.View>
      {size === "large" && (
        <Text
          className="text-xs mt-1"
          style={{ fontFamily: "Inter_500Medium", color: cfg.faceColor }}
        >
          {cfg.label}
        </Text>
      )}
    </View>
  );
}
