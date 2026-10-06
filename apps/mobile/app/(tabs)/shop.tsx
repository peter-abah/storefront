import type { ProductCardDTO } from "@maison/shared";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  DEFAULT_FILTERS,
  FilterBar,
  type CatalogFilters,
} from "@/components/filter-bar";
import { ProductGrid } from "@/components/product-grid";
import { Screen } from "@/components/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { getFilters, listProducts, type ProductListQuery } from "@/lib/api";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

function toQuery(filters: CatalogFilters, page: number): ProductListQuery {
  return {
    q: filters.q.trim() || undefined,
    room: filters.room ?? undefined,
    category: filters.category ?? undefined,
    minPriceCents: filters.minPriceCents ?? undefined,
    maxPriceCents: filters.maxPriceCents ?? undefined,
    inStock: filters.inStock || undefined,
    sort: filters.sort,
    page,
  };
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export default function ShopScreen() {
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);

  const metaQuery = useQuery({ queryKey: ["filters"], queryFn: getFilters });

  const catalogQuery = useInfiniteQuery({
    queryKey: ["products", filters],
    queryFn: ({ pageParam }) => listProducts(toQuery(filters, pageParam)),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return lastPage.items.length > 0 && loaded < lastPage.total
        ? allPages.length + 1
        : undefined;
    },
  });

  const products = useMemo(
    () => catalogQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [catalogQuery.data],
  );
  const total = catalogQuery.data?.pages[0]?.total ?? 0;

  const openProduct = useCallback((product: ProductCardDTO) => {
    router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
  }, []);

  const loadingFirstPage = catalogQuery.isPending && products.length === 0;

  return (
    <Screen title="Shop" subtitle="Browse the collection">
      <View style={styles.filters}>
        <FilterBar meta={metaQuery.data} onChange={setFilters} value={filters} />
      </View>

      {loadingFirstPage ? (
        <View style={styles.stateWrap}>
          <LoadingState label="Loading the collection…" />
        </View>
      ) : catalogQuery.isError && products.length === 0 ? (
        <View style={styles.stateWrap}>
          <ErrorState
            message={errorMessage(catalogQuery.error)}
            onRetry={() => catalogQuery.refetch()}
            retrying={catalogQuery.isRefetching}
          />
        </View>
      ) : (
        <ProductGrid
          ListEmptyComponent={
            <EmptyState
              actionLabel="Reset filters"
              message="Try clearing a filter or two."
              onAction={() => setFilters(DEFAULT_FILTERS)}
              title="No pieces match"
            />
          }
          ListFooterComponent={
            products.length > 0 ? (
              <View style={styles.footer}>
                {catalogQuery.isFetchingNextPage ? (
                  <ActivityIndicator color={palette.bronze} />
                ) : catalogQuery.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => catalogQuery.fetchNextPage()}
                    style={({ pressed }) => [
                      styles.loadMore,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.loadMoreText}>
                      {catalogQuery.isFetchNextPageError
                        ? "Retry loading more"
                        : "Load more"}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.count}>
                    {total} {total === 1 ? "piece" : "pieces"} — end of the
                    collection
                  </Text>
                )}
              </View>
            ) : null
          }
          ListHeaderComponent={
            products.length > 0 ? (
              <Text style={styles.count}>
                {total} {total === 1 ? "piece" : "pieces"}
              </Text>
            ) : null
          }
          onPressProduct={openProduct}
          onRefresh={() => catalogQuery.refetch()}
          products={products}
          refreshing={
            catalogQuery.isRefetching &&
            !catalogQuery.isPlaceholderData &&
            !catalogQuery.isFetchingNextPage
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: spacing.lg,
  },
  stateWrap: {
    flex: 1,
    justifyContent: "center",
  },
  count: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    paddingBottom: spacing.sm,
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  loadMore: {
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  loadMoreText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
});
