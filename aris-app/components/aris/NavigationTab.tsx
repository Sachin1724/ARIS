import React, { useMemo, useEffect } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { LucideIcon } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

interface NavigationTabProps {
  label: string;
  icon: LucideIcon;
  isSelected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  reducedMotion?: boolean;
}

export const NavigationTab: React.FC<NavigationTabProps> = ({
  label,
  icon: IconComponent,
  isSelected,
  onPress,
  accessibilityLabel,
  reducedMotion = false,
}) => {
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial value only, effect syncs changes
  const activeAnim = useMemo(() => new Animated.Value(isSelected ? 1 : 0), []);

  useEffect(() => {
    if (reducedMotion) {
      activeAnim.setValue(isSelected ? 1 : 0);
    } else {
      Animated.timing(activeAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 180,
        useNativeDriver: Platform.OS !== "web", // Color interpolation is supported with native driver on newer RN or JS fallback
      }).start();
    }
  }, [isSelected, reducedMotion, activeAnim]);

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const iconColor = isSelected ? colors.navSelected : colors.navInactive;
  const labelColor = isSelected ? colors.navSelected : colors.navInactive;

  return (
    <View style={styles.tabContainer}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={accessibilityLabel || `${label} tab`}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      >
        <Animated.View
          style={[
            styles.tabContent,
            isSelected && styles.tabContentSelected,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <IconComponent
              size={22}
              color={iconColor}
              strokeWidth={isSelected ? 2.2 : 1.8}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: labelColor },
              isSelected && styles.labelSelected,
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  pressable: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: {
    width: "92%",
    maxWidth: 92,
    minHeight: 56,
    maxHeight: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  tabContentSelected: {
    backgroundColor: colors.navSelectedBackground,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  label: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  labelSelected: {
    fontFamily: typography.fontFamilies.semiBold,
  },
});
