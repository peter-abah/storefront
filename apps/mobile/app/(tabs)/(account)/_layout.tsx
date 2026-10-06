import { Stack } from "expo-router";

import { palette } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: "account",
};

export default function AccountStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    />
  );
}
