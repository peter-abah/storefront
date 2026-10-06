import Ionicons from "@expo/vector-icons/Ionicons";
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
        tabBarInactiveTintColor: palette.inkSoft,
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
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(shop)"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="storefront" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: "Cart",
          tabBarBadge: count > 0 ? (count > 99 ? "99+" : count) : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="cart" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(orders)"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="receipt" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="(account)"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="person" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
