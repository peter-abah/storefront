import type { ProductDetailDTO } from "@maison/shared";
import { StyleSheet, Text, View } from "react-native";

import { fontStyles, palette, radius, spacing } from "@/lib/theme";

export function SpecsList({ product }: { product: ProductDetailDTO }) {
  const rows: { label: string; value: string }[] = [];

  if (product.materials && product.materials.length > 0) {
    rows.push({ label: "Materials", value: product.materials.join(", ") });
  }
  if (product.dimensions) {
    const { w, d, h, unit } = product.dimensions;
    rows.push({ label: "Dimensions", value: `${w} × ${d} × ${h} ${unit}` });
  }
  if (product.weightKg) {
    rows.push({ label: "Weight", value: `${product.weightKg} kg` });
  }
  if (product.care) {
    rows.push({ label: "Care", value: product.care });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Details</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  title: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  row: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...fontStyles.bodyMedium,
    color: palette.muted,
    fontSize: 13,
    width: 96,
  },
  value: {
    ...fontStyles.body,
    color: palette.ink,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
