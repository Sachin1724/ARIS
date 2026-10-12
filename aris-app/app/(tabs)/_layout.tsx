import React from "react";
import { Tabs } from "expo-router";
import { ArisBottomNavigation } from "../../components/aris/ArisBottomNavigation";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <ArisBottomNavigation {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="trends" options={{ title: "Book" }} />
      <Tabs.Screen
        name="sim"
        options={{ title: "Sim", href: null }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
