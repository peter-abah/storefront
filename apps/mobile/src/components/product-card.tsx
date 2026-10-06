import type { ProductCardDTO } from "@maison/shared";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Money } from "@/components/money";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

export function ProductCard({
  product,
  onPress,
  style,
}: {
  product: ProductCardDTO;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const image = product.images[0];
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;

  return (
    <Pressable
      accessibilityLabel={product.name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        {image ? (
          <Image
            accessibilityLabel={`${product.name} — image 1`}
            resizeMode="cover"
            source={{ uri: image.url }}
            style={styles.image}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.imageFallbackText}>Photography to come</Text>
          </View>
        )}
        {out ? (
          <View style={[styles.badge, styles.badgeOut]}>
            <Text style={styles.badgeText}>Out of stock</Text>
          </View>
        ) : product.featured ? (
          <View style={[styles.badge, styles.badgeFeatured]}>
            <Text style={styles.badgeText}>Featured</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>
          {product.room} · {product.category}
        </Text>
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        {product.tagline ? (
          <Text numberOfLines={1} style={styles.tagline}>
            {product.tagline}
          </Text>
        ) : null}
        <Money baseCents={product.priceBaseCents} style={styles.price} />
        <Text
          style={[
            styles.stock,
            out ? styles.stockOut : low ? styles.stockLow : styles.stockIn,
          ]}
        >
          {out ? "Out of stock" : low ? `Only ${product.stock} left` : "In stock"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.9,
  },
  imageWrap: {
    aspectRatio: 4 / 3,
    backgroundColor: palette.paper,
    position: "relative",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  imageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  imageFallbackText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
  },
  badge: {
    borderRadius: radius.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    position: "absolute",
    top: spacing.sm,
  },
  badgeOut: {
    backgroundColor: palette.ink,
  },
  badgeFeatured: {
    backgroundColor: palette.bronze,
  },
  badgeText: {
    ...fontStyles.bodySemiBold,
    color: palette.onBronze,
    fontSize: 11,
  },
  body: {
    gap: 2,
    padding: spacing.md,
  },
  eyebrow: {
    ...fontStyles.bodyMedium,
    color: palette.muted,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  name: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 16,
    lineHeight: 21,
  },
  tagline: {
    ...fontStyles.displayItalic,
    color: palette.muted,
    fontSize: 13,
  },
  price: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  stock: {
    ...fontStyles.bodyMedium,
    fontSize: 12,
  },
  stockIn: {
    color: palette.success,
  },
  stockLow: {
    color: palette.bronze,
  },
  stockOut: {
    color: palette.danger,
  },
});
