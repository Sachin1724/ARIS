import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Keyboard,
  AccessibilityInfo,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import {
  Home,
  Compass,
  BookOpen,
  User,
  Mic,
  LucideIcon,
} from "lucide-react-native";
import { colors } from "../../theme/colors";
import { NavigationTab } from "./NavigationTab";

export interface TabConfig {
  key: string;
  name: string;
  label: string;
  icon: LucideIcon;
  accessibilityLabel: string;
}

const LEFT_TABS: TabConfig[] = [
  {
    key: "home",
    name: "home",
    label: "Home",
    icon: Home,
    accessibilityLabel: "Home tab, environmental dashboard",
  },
  {
    key: "explore",
    name: "explore",
    label: "Explore",
    icon: Compass,
    accessibilityLabel: "Explore tab, weather and environmental context",
  },
];

const RIGHT_TABS: TabConfig[] = [
  {
    key: "trends",
    name: "trends",
    label: "Book",
    icon: BookOpen,
    accessibilityLabel: "Book tab, environmental history and saved insights",
  },
  {
    key: "profile",
    name: "profile",
    label: "Profile",
    icon: User,
    accessibilityLabel: "Profile tab, user preferences and hardware settings",
  },
];

export const ARIS_NAV_TABS: TabConfig[] = [...LEFT_TABS, ...RIGHT_TABS];

export interface ArisBottomNavigationProps {
  state?: any;
  navigation?: any;
  descriptors?: any;
  insets?: any;
  activeRouteName?: string;
}

export const ArisBottomNavigation: React.FC<ArisBottomNavigationProps> = ({
  state,
  navigation,
  activeRouteName,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const motionSub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion
    );
    return () => motionSub.remove();
  }, []);

  if (keyboardVisible) return null;

  const currentRouteName =
    activeRouteName ||
    (state ? state.routes[state.index]?.name : "") ||
    (() => {
      if (!pathname) return "home";
      const clean = pathname.replace(/^\/\(tabs\)\//, "").replace(/^\//, "");
      if (clean === "" || clean === "index") return "home";
      return clean.split("/")[0];
    })();

  const handleTabPress = (tab: TabConfig) => {
    if (state && navigation) {
      const isFocused = state.routes[state.index]?.name === tab.name;
      const event = navigation.emit({
        type: "tabPress",
        target: tab.name,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(tab.name);
      }
    } else {
      router.push(`/(tabs)/${tab.name}` as any);
    }
  };

  const handleMicPress = () => {
    router.push("/ask-aris" as any);
  };

  const bottomInset =
    insets.bottom > 0 ? insets.bottom : Platform.OS === "ios" ? 20 : 10;

  return (
    <View
      style={[
        styles.navBarContainer,
        { paddingBottom: bottomInset, height: 68 + bottomInset },
      ]}
      accessibilityRole="tablist"
    >
      <View style={styles.tabsRow}>
        {LEFT_TABS.map((tab) => (
          <NavigationTab
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            isSelected={currentRouteName === tab.name}
            onPress={() => handleTabPress(tab)}
            accessibilityLabel={tab.accessibilityLabel}
            reducedMotion={reducedMotion}
          />
        ))}

        <View style={styles.micContainer}>
          <Pressable
            style={styles.micButton}
            onPress={handleMicPress}
            accessibilityRole="button"
            accessibilityLabel="Talk to ARIS voice assistant"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Mic size={24} color={colors.background} strokeWidth={2.2} />
          </Pressable>
        </View>

        {RIGHT_TABS.map((tab) => (
          <NavigationTab
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            isSelected={currentRouteName === tab.name}
            onPress={() => handleTabPress(tab)}
            accessibilityLabel={tab.accessibilityLabel}
            reducedMotion={reducedMotion}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBarContainer: {
    backgroundColor: colors.navBackground,
    borderTopWidth: 1,
    borderTopColor: colors.navBorder,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: 60,
  },
  micContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    elevation: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
