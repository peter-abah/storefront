import { Tabs } from "expo-router";

import { useCart } from "@/lib/cart";
import { fontStyles, palette } from "@/lib/theme";

export default function TabsLayout() {
  const { count } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.bronze,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
        },
        tabBarLabelStyle: {
          ...fontStyles.bodyMedium,
          fontSize: 12,
        },
        sceneStyle: {
          backgroundColor: palette.paper,
        },
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: "Home" }} />
      <Tabs.Screen name="(shop)" options={{ title: "Shop" }} />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: "Cart",
          tabBarBadge: count > 0 ? (count > 99 ? "99+" : count) : undefined,
        }}
      />
      <Tabs.Screen name="(orders)" options={{ title: "Orders" }} />
      <Tabs.Screen name="(account)" options={{ title: "Account" }} />
    </Tabs>
  );
}
