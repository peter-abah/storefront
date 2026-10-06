import type { ProductCardDTO } from "@maison/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductRail } from "@/components/product-rail";
import { Screen } from "@/components/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { apiHost, bootstrap, listProducts } from "@/lib/api";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const bootstrapQuery = useQuery({ queryKey: ["bootstrap"], queryFn: bootstrap });
  const arrivalsQuery = useQuery({
    queryKey: ["products", { sort: "newest", page: 1 }],
    queryFn: () => listProducts({ sort: "newest", page: 1 }),
  });

  const openProduct = useCallback((product: ProductCardDTO) => {
    router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
  }, []);

  const arrivals = arrivalsQuery.data?.items.slice(0, 8) ?? [];

  return (
    <Screen title="Maison" subtitle="Furniture and objects for the home">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.block}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>API status</Text>

            {bootstrapQuery.isPending ? (
              <LoadingState label="Connecting to the shop…" />
            ) : null}

            {bootstrapQuery.isError ? (
              <ErrorState
                message={
                  bootstrapQuery.error instanceof Error
                    ? bootstrapQuery.error.message
                    : undefined
                }
                onRetry={() => bootstrapQuery.refetch()}
                retrying={bootstrapQuery.isRefetching}
                title="Could not load the shop"
              />
            ) : null}

            {bootstrapQuery.data ? (
              <View style={styles.stack}>
                <StatusRow
                  label="Currencies"
                  value={String(bootstrapQuery.data.currencies.length)}
                />
                <StatusRow
                  label="Delivery zones"
                  value={String(bootstrapQuery.data.checkout.zones.length)}
                />
                <StatusRow
                  label="Contact email"
                  value={bootstrapQuery.data.contact.email || "Not set"}
                />
                <StatusRow
                  label="Contact phone"
                  value={bootstrapQuery.data.contact.phone || "Not set"}
                />
                <StatusRow label="API host" value={apiHost()} />
              </View>
            ) : null}
          </View>
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
      </ScrollView>
    </Screen>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statusValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  block: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  statusRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
  },
  statusValue: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    flexShrink: 1,
    fontSize: 14,
    marginLeft: spacing.md,
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
});
