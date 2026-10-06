import { Stack } from "expo-router";

import { palette } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    />
  );
}
