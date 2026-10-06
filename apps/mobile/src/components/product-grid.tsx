import type { ProductCardDTO } from "@maison/shared";
import type { ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { ProductCard } from "@/components/product-card";
import { spacing } from "@/lib/theme";

export function ProductGrid({
  products,
  onPressProduct,
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
}: {
  products: ProductCardDTO[];
  onPressProduct: (product: ProductCardDTO) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: ReactElement | null;
  ListFooterComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
}) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  return (
    <FlatList
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={ListHeaderComponent}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <View style={{ width: cellWidth }}>
          <ProductCard onPress={() => onPressProduct(item)} product={item} />
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
