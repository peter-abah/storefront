import { Stack } from "expo-router";

import { palette } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "cart",
};

export default function CartStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    />
  );
}
