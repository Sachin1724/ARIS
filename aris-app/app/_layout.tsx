import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { LogBox } from "react-native";
import { colors } from "../theme/colors";
import { PreferencesProvider } from "../context/PreferencesContext";
import "../global.css";

LogBox.ignoreLogs(["SafeAreaView has been deprecated", "Support for defaultProps"]);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  return (
    <PreferencesProvider>
      <GluestackUIProvider>
        <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primaryText,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Poppins_600SemiBold", color: colors.primaryText },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="air-quality/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ask-aris/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/scan"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/pair"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/wifi-setup"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/connecting"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="device/diagnostics"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="settings/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="welcome/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="privacy-policy"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="terms"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="light" />
    </GluestackUIProvider>
  </PreferencesProvider>
  );
}
