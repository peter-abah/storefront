import { Stack } from "expo-router";

import { palette } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "orders",
};

export default function OrdersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    />
  );
}
