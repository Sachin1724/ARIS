import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Mascot } from "page-mascot";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useConnection } from "../../hooks/useConnection";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { usePreferences } from "../../context/PreferencesContext";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  color?: string;
}

function MenuItem({
  icon,
  label,
  sublabel,
  onPress,
  color = colors.primaryText,
}: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.menuItemPressable}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
    >
      <View style={styles.menuIconCircle}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.menuTextGroup}>
        <Text style={styles.menuItemLabel}>{label}</Text>
        {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const connection = useConnection();
  const { refresh } = useDeviceStatus();
  const { alertThresholdPM25, customEndpoint } = usePreferences();
  const isConnected = connection.status === "connected";
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refresh());
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <Text style={styles.headerTitle}>Profile</Text>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.userCardLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>S</Text>
            </View>
            <View>
              <Text style={styles.userName}>Sachi</Text>
              <Text style={styles.userRole}>ARIS Companion Explorer</Text>
            </View>
          </View>
          <View style={styles.mascotPeekWrapper}>
            <Mascot
              state="hero"
              mood="happy"
              size={54}
            />
          </View>
        </View>

        {/* Hardware */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Hardware Companion</Text>
          <MenuItem
            icon="hardware-chip-outline"
            label="UNO Q Sensor Hub"
            sublabel={
              isConnected
                ? `Connected • ${customEndpoint}`
                : "Offline • Tap to connect"
            }
            color={isConnected ? colors.success : colors.accent}
            onPress={() => router.push("/device")}
          />
          <MenuItem
            icon="leaf-outline"
            label="Air Quality Monitor"
            sublabel="Sensirion SPS30 & SHT4x sensors active"
            color={colors.success}
            onPress={() => router.push("/air-quality")}
          />
        </View>

        {/* Assistant */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>ARIS Assistant</Text>
          <MenuItem
            icon="chatbubbles-outline"
            label="Chat with ARIS"
            sublabel="Environmental advice and telemetry queries"
            color={colors.accent}
            onPress={() => router.push("/ask-aris")}
          />
          <MenuItem
            icon="compass-outline"
            label="Welcome & Sensor Overview"
            sublabel="Sensor specifications and mascot guide"
            color={colors.statusModerate}
            onPress={() => router.push("/welcome")}
          />
        </View>

        {/* Preferences */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Preferences</Text>
          <MenuItem
            icon="notifications-outline"
            label="Air Quality Alerts"
            sublabel={`Notify when PM2.5 exceeds ${alertThresholdPM25} µg/m³`}
            color={colors.info}
            onPress={() => router.push("/settings")}
          />
          <MenuItem
            icon="settings-outline"
            label="System Settings"
            sublabel="Custom domain and device IP config"
            onPress={() => router.push("/settings")}
          />
        </View>

        {/* Legal */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Legal & Compliance</Text>
          <MenuItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            sublabel="Local-first data guarantee & zero cloud tracking"
            color={colors.success}
            onPress={() => router.push("/privacy-policy")}
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms and Conditions"
            sublabel="Hardware telemetry usage & sensor guidelines"
            color={colors.accent}
            onPress={() => router.push("/terms")}
          />
        </View>

        {/* ARIS App Platform Info */}
        <View style={styles.aboutPlatformCard}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.aboutPlatformLogo}
            resizeMode="contain"
          />
          <Text style={styles.aboutPlatformTitle}>ARIS Environmental Companion</Text>
          <Text style={styles.aboutPlatformVersion}>
            Version 1.0.0 • Arduino UNO Q Sensor System
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
    gap: 12,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 20,
    color: colors.primaryText,
    marginBottom: 4,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: typography.fontFamilies.bold,
    color: colors.accent,
    fontSize: 20,
  },
  userName: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 16,
    color: colors.primaryText,
  },
  userRole: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
  },
  mascotPeekWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSectionTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.secondaryText,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItemPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  menuTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemLabel: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  menuItemSublabel: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 2,
  },
  aboutPlatformCard: {
    alignItems: "center",
    paddingVertical: 20,
    marginTop: 8,
    gap: 6,
  },
  aboutPlatformLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginBottom: 4,
  },
  aboutPlatformTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 14,
    color: colors.primaryText,
    letterSpacing: 0.5,
  },
  aboutPlatformVersion: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 11,
    color: colors.secondaryText,
  },
});
