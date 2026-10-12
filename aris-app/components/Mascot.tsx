/* eslint-disable react-hooks/refs -- PanResponder requires ref access in useMemo (standard RN pattern) */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  PanResponder,
  type ImageSourcePropType,
} from "react-native";

export type MascotMood =
  | "energetic"
  | "happy"
  | "neutral"
  | "sleepy"
  | "tired"
  | "coughing"
  | "alert";

export type MascotProps = {
  directions?: string;
  reactions?: string;
  size?: number | string;
  label?: string;
  state?: string;
  direction?: string;
  reaction?: string | null;
  interactive?: boolean;
  animated?: boolean;
  speechBubble?: string;
  showLabel?: boolean;
  mood?: MascotMood;
  onPress?: () => void;
};

type Direction = "up-left" | "up" | "up-right" | "left" | "center" | "right" | "down-left" | "down" | "down-right";
type Reaction = "blink" | "heart" | "sparkle" | "surprised" | "wink" | "bashful" | "sleepy" | "dizzy" | "delighted";

const CLOCKWISE: Direction[] = [
  "right", "down-right", "down", "down-left",
  "left", "up-left", "up", "up-right",
];

const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE = 24;

const PAYOFFS: Reaction[] = ["heart", "sparkle", "delighted"];
const BOOP_PAYOFF = 120;
const BOOP_END = 560;
const DIZZY_AFTER = 4;
const DIZZY_WINDOW = 1600;
const DIZZY_END = 1100;

const directionImages: Record<Direction, ImageSourcePropType> = {
  center: require("../assets/mascots/dir_center.png"),
  up: require("../assets/mascots/dir_up.png"),
  "up-right": require("../assets/mascots/dir_up-right.png"),
  right: require("../assets/mascots/dir_right.png"),
  "down-right": require("../assets/mascots/dir_down-right.png"),
  down: require("../assets/mascots/dir_down.png"),
  "down-left": require("../assets/mascots/dir_down-left.png"),
  left: require("../assets/mascots/dir_left.png"),
  "up-left": require("../assets/mascots/dir_up-left.png"),
};

const reactionImages: Record<Reaction, ImageSourcePropType> = {
  blink: require("../assets/mascots/react_blink.png"),
  heart: require("../assets/mascots/react_heart.png"),
  sparkle: require("../assets/mascots/react_sparkle.png"),
  surprised: require("../assets/mascots/react_surprised.png"),
  wink: require("../assets/mascots/react_wink.png"),
  bashful: require("../assets/mascots/react_bashful.png"),
  sleepy: require("../assets/mascots/react_sleepy.png"),
  dizzy: require("../assets/mascots/react_dizzy.png"),
  delighted: require("../assets/mascots/react_delighted.png"),
};

const sizePresets: Record<string, number> = {
  avatar: 42,
  small: 56,
  medium: 84,
  large: 124,
  hero: 170,
};

type StateConfig = {
  direction: Direction;
  reaction?: Reaction;
  glow: string;
  phrase: string;
};

const stateDefaults: Record<string, StateConfig> = {
  idle: {
    direction: "center",
    glow: "rgba(215, 255, 67, 0.08)",
    phrase: "Radio online. Sensors active.",
  },
  welcome: {
    direction: "center",
    reaction: "sparkle",
    glow: "rgba(215, 255, 67, 0.15)",
    phrase: "Good morning, Sachi.",
  },
  good_conditions: {
    direction: "center",
    reaction: "delighted",
    glow: "rgba(16, 185, 129, 0.15)",
    phrase: "Air quality is optimal.",
  },
  conditions_changing: {
    direction: "right",
    reaction: "surprised",
    glow: "rgba(245, 158, 11, 0.15)",
    phrase: "Telemetry shift detected.",
  },
  poor_air_quality: {
    direction: "down",
    reaction: "dizzy",
    glow: "rgba(239, 68, 68, 0.15)",
    phrase: "Elevated PM2.5 particulate concentration.",
  },
  thinking: {
    direction: "up-right",
    reaction: "wink",
    glow: "rgba(215, 255, 67, 0.12)",
    phrase: "Analyzing sensor telemetry...",
  },
  device_disconnected: {
    direction: "down",
    reaction: "sleepy",
    glow: "rgba(100, 116, 139, 0.12)",
    phrase: "Hardware device offline.",
  },
  data_uncertain: {
    direction: "up-left",
    reaction: "surprised",
    glow: "rgba(59, 130, 246, 0.14)",
    phrase: "Calibrating optical particulate sensor...",
  },
  hero: {
    direction: "center",
    reaction: "sparkle",
    glow: "rgba(215, 255, 67, 0.12)",
    phrase: "ARIS Environmental Monitor.",
  },
  peek: {
    direction: "right",
    reaction: "wink",
    glow: "rgba(215, 255, 67, 0.15)",
    phrase: "Telemetry stream active.",
  },
  advice: {
    direction: "center",
    reaction: "heart",
    glow: "rgba(215, 255, 67, 0.10)",
    phrase: "Lower particulate levels expected after 20:00.",
  },
  avatar: {
    direction: "center",
    reaction: "delighted",
    glow: "transparent",
    phrase: "Ask an environmental question.",
  },
};

const MOOD_TO_REACTION: Record<MascotMood, Reaction> = {
  energetic: "sparkle",
  happy: "delighted",
  neutral: "wink",
  sleepy: "sleepy",
  tired: "bashful",
  coughing: "dizzy",
  alert: "surprised",
};

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function Mascot(props: MascotProps): React.JSX.Element {
  const {
    size = 140,
    label = "ARIS mascot",
    state = "idle",
    direction: propDirection,
    reaction: propReaction,
    interactive = true,
    speechBubble,
    mood,
    onPress,
  } = props;

  const px = typeof size === "number" ? size : sizePresets[size] || 140;
  const cfg = stateDefaults[state] || stateDefaults.idle;

  const moodReaction = mood ? MOOD_TO_REACTION[mood] : undefined;

  const [direction, setDirection] = useState<Direction>(
    (propDirection as Direction) || cfg.direction
  );
  const [reaction, setReaction] = useState<Reaction | null>(
    propReaction !== undefined
      ? (propReaction as Reaction | null)
      : moodReaction || cfg.reaction || null
  );
  const [bubbleText, setBubbleText] = useState<string | null>(
    speechBubble || null
  );

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boopsRef = useRef({ count: 0, at: 0 });
  const sectorRef = useRef(-1);

  const prevPropDirection = useRef(propDirection);
  if (propDirection !== prevPropDirection.current) {
    prevPropDirection.current = propDirection;
    if (propDirection) setDirection(propDirection as Direction);
  }

  const prevPropReaction = useRef(propReaction);
  if (propReaction !== prevPropReaction.current) {
    prevPropReaction.current = propReaction;
    if (propReaction !== undefined) setReaction(propReaction as Reaction | null);
  }

  const prevMood = useRef(mood);
  if (mood !== prevMood.current) {
    prevMood.current = mood;
    if (mood) setReaction(MOOD_TO_REACTION[mood]);
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const boop = () => {
    if (onPress) onPress();
    if (!interactive) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const later = (ms: number, next: Reaction | null) => {
      timersRef.current.push(setTimeout(() => setReaction(next), ms));
    };

    const now = Date.now();
    const boops = boopsRef.current;
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1;
    boops.at = now;

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0;
      setReaction("dizzy");
      setBubbleText("Input rate limit.");
      later(DIZZY_END, moodReaction || cfg.reaction || null);
    } else {
      setReaction("blink");
      later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length]);
      later(BOOP_END, moodReaction || cfg.reaction || null);
      setBubbleText(cfg.phrase);
    }

    const clearBubble = setTimeout(() => {
      if (!speechBubble) setBubbleText(null);
    }, 2400);
    timersRef.current.push(clearBubble);
  };

  const aim = (dx: number, dy: number) => {
    if (Math.hypot(dx, dy) < DEAD_ZONE) {
      sectorRef.current = -1;
      setDirection("center");
      return;
    }
    const angle = Math.atan2(dy, dx);
    const prevSector = sectorRef.current;
    if (
      prevSector !== -1 &&
      Math.abs(wrap(angle - prevSector * SECTOR)) < SECTOR / 2 + HYSTERESIS
    ) {
      return;
    }
    const sector =
      (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
    sectorRef.current = sector;
    setDirection(CLOCKWISE[sector]);
  };

  const boopRef = useRef(boop);
  boopRef.current = boop;
  const aimRef = useRef(aim);
  aimRef.current = aim;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const dirFallbackRef = useRef((propDirection as Direction) || cfg.direction);
  dirFallbackRef.current = (propDirection as Direction) || cfg.direction;

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactiveRef.current,
        onMoveShouldSetPanResponder: () => interactiveRef.current,
        onPanResponderGrant: (_evt, gesture) => aimRef.current(gesture.dx, gesture.dy),
        onPanResponderMove: (_evt, gesture) => aimRef.current(gesture.dx, gesture.dy),
        onPanResponderRelease: (_evt, gesture) => {
          const dist = Math.hypot(gesture.dx, gesture.dy);
          if (dist < 16) {
            boopRef.current();
          } else {
            sectorRef.current = -1;
            setDirection(dirFallbackRef.current);
          }
        },
      }).panHandlers,
    [],
  );

  const activeImage = reaction
    ? reactionImages[reaction] || reactionImages.blink
    : directionImages[direction] || directionImages.center;

  const glowSize = px * 1.35;

  return (
    <Pressable
      onPress={boop}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...panHandlers}
    >
      {bubbleText && (
        <View style={[styles.bubbleContainer, { bottom: px + 8 }]}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{bubbleText}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
      )}

      {cfg.glow !== "transparent" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: cfg.glow,
            top: (px - glowSize) / 2,
            left: (px - glowSize) / 2,
          }}
        />
      )}

      <View
        style={{
          width: px,
          height: px,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={activeImage}
          style={{ width: px, height: px, resizeMode: "contain" }}
        />
      </View>
    </Pressable>
  );
}

export default Mascot;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bubbleContainer: {
    position: "absolute",
    alignItems: "center",
    zIndex: 99,
  },
  bubble: {
    backgroundColor: "#171E18",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#303630",
    maxWidth: 220,
  },
  bubbleText: {
    color: "#F5F7F2",
    fontSize: 11,
    textAlign: "center",
  },
  bubbleTail: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#171E18",
  },
});
