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
import { View, Text } from "react-native";
import { colors } from "../constants/tokens";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (fontError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="font-body text-ink">Failed to load fonts</Text>
      </View>
    );
  }

  return (
    <GluestackUIProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: "Poppins_600SemiBold", color: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="air-quality/index"
          options={{ headerShown: true, title: "Air Quality" }}
        />
        <Stack.Screen
          name="ask-aris/index"
          options={{ headerShown: true, title: "Ask ARIS" }}
        />
        <Stack.Screen
          name="device/index"
          options={{ headerShown: true, title: "Connect Device" }}
        />
        <Stack.Screen
          name="settings/index"
          options={{ headerShown: true, title: "Settings" }}
        />
      </Stack>
      <StatusBar style="dark" />
    </GluestackUIProvider>
  );
}
