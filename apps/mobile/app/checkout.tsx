import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Money } from "@/components/money";
import { EmptyState, LoadingState } from "@/components/states";
import { useCart } from "@/lib/cart";
import { palette, radius, spacing } from "@/lib/theme";

/**
 * WP7 placeholder: order summary only, no checkout logic. Payment and
 * delivery land in the next work package; the bag itself is already real.
 */
export default function CheckoutScreen() {
  const cart = useCart();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/cart");
  };

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

      <View style={styles.header}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>Order summary</Text>
      </View>

      {cart.isLoading ? (
        <LoadingState label="Loading your order…" />
      ) : cart.lines.length === 0 ? (
        <EmptyState
          actionLabel="Browse the shop"
          message="Add a piece to your cart before checking out."
          onAction={() => router.replace("/shop")}
          title="Your cart is empty"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {cart.lines.map((line) => (
              <View key={line.productId} style={styles.line}>
                <Text numberOfLines={1} style={styles.lineName}>
                  {line.name}
                </Text>
                <Text style={styles.lineQty}>× {line.qty}</Text>
                <Money baseCents={line.lineBaseCents} style={styles.lineTotal} />
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.line}>
              <Text style={styles.subtotalLabel}>
                Subtotal ({cart.count} {cart.count === 1 ? "item" : "items"})
              </Text>
              <Money
                baseCents={cart.subtotalBaseCents}
                style={styles.subtotalValue}
              />
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Payment lands next</Text>
            <Text style={styles.noticeText}>
              Delivery zones, payment options and order placement arrive in the
              next update. Your selection is safe — nothing has been charged.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/cart")}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Back to cart</Text>
          </Pressable>
        </ScrollView>
      )}
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
  header: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  line: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  lineName: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
  },
  lineQty: {
    color: palette.muted,
    fontSize: 14,
  },
  lineTotal: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 72,
    textAlign: "right",
  },
  divider: {
    backgroundColor: palette.line,
    height: 1,
    marginVertical: spacing.sm,
  },
  subtotalLabel: {
    color: palette.muted,
    flex: 1,
    fontSize: 14,
  },
  subtotalValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  notice: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  noticeTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  noticeText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  secondary: {
    alignItems: "center",
    borderColor: palette.bronze,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: palette.bronze,
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
