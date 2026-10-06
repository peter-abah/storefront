import type { ProductCardDTO } from "@maison/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductRail } from "@/components/product-rail";
import { Screen } from "@/components/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { getFilters, listProducts } from "@/lib/api";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

function roomLabel(room: string): string {
  return room.charAt(0).toUpperCase() + room.slice(1);
}

export default function HomeScreen() {
  const arrivalsQuery = useQuery({
    queryKey: ["products", { sort: "newest", page: 1 }],
    queryFn: () => listProducts({ sort: "newest", page: 1 }),
  });
  const filtersQuery = useQuery({ queryKey: ["filters"], queryFn: getFilters });

  const openProduct = useCallback((product: ProductCardDTO) => {
    router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
  }, []);

  const arrivals = arrivalsQuery.data?.items.slice(0, 8) ?? [];
  const rooms = filtersQuery.data?.rooms ?? [];

  return (
    <Screen title="Maison">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>The Maison collection</Text>
          <Text style={styles.heroTitle}>Furniture and objects for the home</Text>
          <Text style={styles.heroSubtitle}>
            Considered pieces for every room — order now, pay on delivery.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/shop")}
            style={({ pressed }) => [
              styles.heroButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.heroButtonText}>Shop the collection</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New arrivals</Text>
          {arrivalsQuery.isPending ? (
            <LoadingState label="Loading arrivals…" />
          ) : arrivalsQuery.isError ? (
            <ErrorState
              message={
                arrivalsQuery.error instanceof Error
                  ? arrivalsQuery.error.message
                  : undefined
              }
              onRetry={() => arrivalsQuery.refetch()}
              retrying={arrivalsQuery.isRefetching}
              title="Could not load new arrivals"
            />
          ) : arrivals.length === 0 ? (
            <EmptyState
              message="New pieces will appear here as they land."
              title="Nothing new yet"
            />
          ) : (
            <ProductRail onPressProduct={openProduct} products={arrivals} />
          )}
        </View>

        {rooms.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop by room</Text>
            <ScrollView
              contentContainerStyle={styles.roomRail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {rooms.map((room) => (
                <Pressable
                  accessibilityRole="button"
                  key={room}
                  onPress={() =>
                    router.navigate({ pathname: "/shop", params: { room } })
                  }
                  style={({ pressed }) => [
                    styles.roomCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.roomName}>{roomLabel(room)}</Text>
                  <Text style={styles.roomHint}>Shop →</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  hero: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  heroEyebrow: {
    ...fontStyles.bodySemiBold,
    color: palette.bronzeSoft,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  heroTitle: {
    ...fontStyles.display,
    color: palette.cream,
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitle: {
    ...fontStyles.body,
    color: palette.linen,
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  heroButtonText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 14,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 20,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  roomRail: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roomCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: 128,
    padding: spacing.md,
  },
  roomName: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 16,
  },
  roomHint: {
    ...fontStyles.body,
    color: palette.bronze,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
