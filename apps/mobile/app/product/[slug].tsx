import type { ProductCardDTO } from "@maison/shared";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddToCart } from "@/components/add-to-cart";
import { Money } from "@/components/money";
import { ProductGallery } from "@/components/product-gallery";
import { ProductRail } from "@/components/product-rail";
import { SpecsList } from "@/components/specs-list";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ApiError, getProduct } from "@/lib/api";
import { palette, radius, spacing } from "@/lib/theme";

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const query = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug),
    enabled: Boolean(slug),
  });

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/shop");
  }, []);

  const openProduct = useCallback((product: ProductCardDTO) => {
    router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
  }, []);

  const notFound =
    query.error instanceof ApiError && query.error.code === "NOT_FOUND";

  const product = query.data?.product;
  const out = product ? product.stock <= 0 : false;
  const low = product ? !out && product.stock <= 5 : false;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      {notFound ? (
        <View style={styles.stateWrap}>
          <EmptyState
            actionLabel="Browse the shop"
            message="This piece may have sold out or moved."
            onAction={() => router.replace("/shop")}
            title="Product not found"
          />
        </View>
      ) : query.isPending ? (
        <View style={styles.stateWrap}>
          <LoadingState label="Loading this piece…" />
        </View>
      ) : query.isError ? (
        <View style={styles.stateWrap}>
          <ErrorState
            message={
              query.error instanceof Error ? query.error.message : undefined
            }
            onRetry={() => query.refetch()}
            retrying={query.isRefetching}
          />
        </View>
      ) : query.data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ProductGallery
            images={query.data.product.images}
            name={query.data.product.name}
          />
          <View style={styles.info}>
            <Text style={styles.eyebrow}>
              {query.data.product.room} · {query.data.product.category}
            </Text>
            <Text style={styles.name}>{query.data.product.name}</Text>
            {query.data.product.tagline ? (
              <Text style={styles.tagline}>{query.data.product.tagline}</Text>
            ) : null}

            <View style={styles.priceRow}>
              <Money
                baseCents={query.data.product.priceBaseCents}
                style={styles.price}
              />
              <View
                style={[
                  styles.stockBadge,
                  out
                    ? styles.badgeOut
                    : low
                      ? styles.badgeLow
                      : styles.badgeIn,
                ]}
              >
                <Text
                  style={[
                    styles.stockText,
                    out
                      ? styles.stockOut
                      : low
                        ? styles.stockLow
                        : styles.stockIn,
                  ]}
                >
                  {out
                    ? "Out of stock"
                    : low
                      ? `Only ${query.data.product.stock} left`
                      : "In stock"}
                </Text>
              </View>
            </View>

            <AddToCart
              productId={query.data.product.id}
              stock={query.data.product.stock}
            />

            {query.data.product.story ? (
              <View style={styles.storyBlock}>
                <Text style={styles.labelInline}>Story</Text>
                <Text style={styles.story}>{query.data.product.story}</Text>
              </View>
            ) : null}

            <View style={styles.specs}>
              <SpecsList product={query.data.product} />
            </View>
          </View>

          {query.data.related.length > 0 ? (
            <View style={styles.related}>
              <Text style={styles.sectionLabel}>Pairs well with</Text>
              <ProductRail
                onPressProduct={openProduct}
                products={query.data.related}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  back: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  backText: {
    color: palette.bronze,
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
  stateWrap: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingBottom: spacing.xl,
  },
  info: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  eyebrow: {
    color: palette.bronze,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  name: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 36,
  },
  tagline: {
    color: palette.muted,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 22,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  price: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "700",
  },
  stockBadge: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeOut: {
    backgroundColor: palette.ink,
  },
  badgeLow: {
    backgroundColor: palette.paper,
    borderColor: palette.bronze,
    borderWidth: 1,
  },
  badgeIn: {
    backgroundColor: palette.surface,
    borderColor: palette.success,
    borderWidth: 1,
  },
  stockText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stockOut: {
    color: palette.onBronze,
  },
  stockLow: {
    color: palette.bronze,
  },
  stockIn: {
    color: palette.success,
  },
  storyBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  specs: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    color: palette.bronze,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    textTransform: "uppercase",
  },
  labelInline: {
    color: palette.bronze,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  story: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  related: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
