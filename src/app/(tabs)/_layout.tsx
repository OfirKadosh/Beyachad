import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../components/ui";
const icons = {
  index: "home-outline",
  tasks: "checkbox-outline",
  budget: "wallet-outline",
  guests: "people-outline",
  vendors: "briefcase-outline",
} as const;
export default function Layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icons[route.name as keyof typeof icons]}
            color={typeof color === "string" ? color : colors.green}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "בית" }} />
      <Tabs.Screen name="tasks" options={{ title: "משימות" }} />
      <Tabs.Screen name="budget" options={{ title: "תקציב" }} />
      <Tabs.Screen name="guests" options={{ title: "מוזמנים" }} />
      <Tabs.Screen name="vendors" options={{ title: "ספקים" }} />
    </Tabs>
  );
}
