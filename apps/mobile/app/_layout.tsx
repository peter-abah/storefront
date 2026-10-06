import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CurrencyProvider } from "@/lib/currency";
import { queryClient } from "@/lib/query";
import { palette } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.paper },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
          </Stack>
        </CurrencyProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
