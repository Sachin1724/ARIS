import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { Mascot } from "page-mascot";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.headerGroup}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>ARIS</Text>
          <Text style={styles.brandSubtitle}>Arduino Environmental Companion</Text>
        </View>

        <View style={styles.mascotAuraContainer}>
          <View style={styles.ambientCircleGlow} />
          <Mascot
            state="hero"
            size={200}
            animated
          />
        </View>

        <View style={styles.taglineSection}>
          <Text style={styles.taglineHeading}>
            Local Air Quality & Telemetry
          </Text>
          <Text style={styles.taglineBody}>
            Direct particulate monitoring, temperature, and atmospheric trends from your Arduino UNO Q sensor hub. Local-first, private, and precise.
          </Text>

          <View style={styles.specChipsRow}>
            <View style={styles.specChip}>
              <Text style={styles.specChipText}>Sensirion SPS30</Text>
            </View>
            <View style={styles.specChip}>
              <Text style={styles.specChipText}>SHT4x Temp/RH</Text>
            </View>
            <View style={styles.specChip}>
              <Text style={styles.specChipText}>Local SQLite</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.ctaButton}
          onPress={() => router.replace("/(tabs)/home")}
          accessibilityRole="button"
          accessibilityLabel="Open Environmental Dashboard"
        >
          <Text style={styles.ctaButtonText}>Open Environmental Dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerGroup: {
    alignItems: "center",
    marginTop: 16,
  },
  brandLogo: {
    width: 68,
    height: 68,
    borderRadius: 16,
    marginBottom: 8,
  },
  brandTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 36,
    color: colors.accent,
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 2,
  },
  mascotAuraContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginVertical: 10,
  },
  ambientCircleGlow: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.accentGlow,
  },
  taglineSection: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  taglineHeading: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 19,
    color: colors.primaryText,
    textAlign: "center",
    lineHeight: 26,
  },
  taglineBody: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 320,
  },
  specChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  specChip: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  specChipText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 11,
    color: colors.secondaryText,
  },
  ctaButton: {
    width: "100%",
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  ctaButtonText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 15,
    color: colors.background,
    letterSpacing: 0.3,
  },
});
