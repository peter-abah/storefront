import { Stack } from "expo-router";

import { palette } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "shop",
};

export default function ShopStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    />
  );
}
