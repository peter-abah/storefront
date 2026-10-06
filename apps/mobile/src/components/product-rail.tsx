import type { ProductCardDTO } from "@maison/shared";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { ProductCard } from "@/components/product-card";
import { fontStyles, palette, spacing } from "@/lib/theme";

const CARD_WIDTH = 190;

export function ProductRail({
  title,
  products,
  onPressProduct,
}: {
  title?: string;
  products: ProductCardDTO[];
  onPressProduct: (product: ProductCardDTO) => void;
}) {
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <FlatList
        contentContainerStyle={styles.content}
        data={products}
        horizontal
        ItemSeparatorComponent={Separator}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH }}>
            <ProductCard onPress={() => onPressProduct(item)} product={item} />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  title: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 18,
    paddingHorizontal: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    width: spacing.md,
  },
});
