import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CartSync } from "@/lib/cart";
import { CurrencyProvider } from "@/lib/currency";
import { queryClient } from "@/lib/query";
import { palette } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <CartSync />
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
            <Stack.Screen name="checkout" />
            <Stack.Screen name="orders/[id]" />
          </Stack>
        </CurrencyProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
