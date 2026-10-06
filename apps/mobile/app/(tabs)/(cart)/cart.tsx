import type { CartLineDTO } from "@maison/shared";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Money } from "@/components/money";
import { Screen } from "@/components/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useMoney } from "@/lib/currency";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

function mutationMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "UNAUTHENTICATED") {
      return "Your session expired — sign in again to edit your cart.";
    }
    return cause.message;
  }
  return "Something went wrong — please try again.";
}

function removedLabel(names: string[]): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? ` (${shown} and ${names.length - 3} more)` : ` (${shown})`;
}

export default function CartScreen() {
  const cart = useCart();
  const [actionError, setActionError] = useState<string | null>(null);
  const [removedDismissed, setRemovedDismissed] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(mutationMessage(cause));
    }
  };

  const confirmClear = () => {
    Alert.alert("Clear cart", "Remove everything from your bag?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          void run(() => cart.clear());
        },
      },
    ]);
  };

  if (cart.isLoading) {
    return (
      <Screen title="Cart" subtitle="Your selection">
        <LoadingState label="Loading your cart…" />
      </Screen>
    );
  }

  if (cart.error && cart.lines.length === 0 && cart.removedCount === 0) {
    return (
      <Screen title="Cart" subtitle="Your selection">
        <View style={styles.stateWrap}>
          <ErrorState
            message={cart.error.message}
            onRetry={cart.refetch}
            title="Cart unavailable"
          />
        </View>
      </Screen>
    );
  }

  const guestNotice = cart.isGuest ? (
    <View style={styles.guestCard}>
      <Text style={styles.guestTitle}>Shopping as a guest</Text>
      <Text style={styles.guestText}>
        Your bag is saved on this device. Sign in to sync it across devices
        and check out faster.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate("/account")}
        style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
      >
        <Text style={styles.guestButtonText}>Sign in</Text>
      </Pressable>
    </View>
  ) : null;

  if (cart.lines.length === 0 && cart.removedCount === 0) {
    return (
      <Screen title="Cart" subtitle="Your selection">
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {guestNotice}
          <EmptyState
            actionLabel="Browse the shop"
            message="Every room starts with one piece. Explore the collection and pay on delivery when your order arrives."
            onAction={() => router.navigate("/shop")}
            title="Your cart is empty"
          />
        </ScrollView>
      </Screen>
    );
  }

  const someOos = cart.outOfStockCount > 0;
  const someClamped = cart.lines.some((l) => l.clamped && l.stock > 0);

  return (
    <Screen
      title="Cart"
      subtitle={
        cart.isGuest
          ? "Saved on this device — sign in to sync"
          : "Synced to your account"
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {guestNotice}

        {cart.removedCount > 0 && !removedDismissed ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {cart.removedCount}{" "}
              {cart.removedCount === 1 ? "item was" : "items were"} removed — no
              longer available
              {removedLabel(cart.removedNames)}.
            </Text>
            <View style={styles.bannerActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate("/shop")}
              >
                <Text style={styles.bannerLink}>Continue shopping</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRemovedDismissed(true)}
              >
                <Text style={styles.bannerLink}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {someOos ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {cart.outOfStockCount}{" "}
              {cart.outOfStockCount === 1 ? "item is" : "items are"} out of stock
              and can&rsquo;t be checked out.
            </Text>
          </View>
        ) : null}

        {someClamped ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Stock shifted while you browsed — we&rsquo;ve kept only what&rsquo;s
              available.
            </Text>
          </View>
        ) : null}

        {actionError ? (
          <View style={[styles.banner, styles.errorBanner]}>
            <Text style={[styles.bannerText, styles.errorText]}>
              {actionError}
            </Text>
            {actionError.includes("sign in") ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate("/account")}
              >
                <Text style={styles.bannerLink}>Go to Account</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {cart.lines.length === 0 ? (
          <View style={styles.onlyUnavailable}>
            <Text style={styles.onlyUnavailableTitle}>Unavailable only</Text>
            <Text style={styles.onlyUnavailableText}>
              Everything left in your bag is unavailable right now. Remove it to
              start fresh, or keep browsing for available pieces.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/shop")}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Continue shopping</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.lines}>
            {cart.lines.map((line) => (
              <CartLineRow
                busy={cart.isMutating}
                key={line.productId}
                line={line}
                onRemove={() => {
                  void run(() => cart.remove(line.productId));
                }}
                onUpdate={(qty) => {
                  void run(() => cart.update(line.productId, qty));
                }}
              />
            ))}
          </View>
        )}

        {cart.lines.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Subtotal ({cart.count} {cart.count === 1 ? "item" : "items"})
              </Text>
              <Money baseCents={cart.subtotalBaseCents} style={styles.summaryValue} />
            </View>
            <Text style={styles.summaryNote}>
              Delivery calculated at checkout by area.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={cart.count === 0 || cart.isMutating}
              onPress={() => router.push("/checkout")}
              style={({ pressed }) => [
                styles.primary,
                (cart.count === 0 || cart.isMutating) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Proceed to checkout</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={cart.isMutating}
              onPress={confirmClear}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.clearText}>Clear cart</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footerLinks}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/shop")}
          >
            <Text style={styles.bannerLink}>Continue shopping</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function CartLineRow({
  line,
  busy,
  onUpdate,
  onRemove,
}: {
  line: CartLineDTO;
  busy: boolean;
  onUpdate: (qty: number) => void;
  onRemove: () => void;
}) {
  const format = useMoney();
  const out = line.stock <= 0;
  const max = Math.min(Math.max(line.stock, 0), 99);
  const showBusy = busy;

  return (
    <View style={styles.line}>
      <View style={styles.thumb}>
        {line.image ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: line.image }}
            style={styles.thumbImage}
          />
        ) : (
          <Text style={styles.thumbFallback}>—</Text>
        )}
      </View>

      <View style={styles.lineBody}>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            router.push({
              pathname: "/product/[slug]",
              params: { slug: line.slug },
            })
          }
        >
          <Text numberOfLines={1} style={styles.lineName}>
            {line.name}
          </Text>
        </Pressable>
        <Text style={styles.lineUnit}>{format(line.unitBaseCents)} each</Text>

        {out ? (
          <Text style={styles.lineAlert}>
            Out of stock — remove to check out.
          </Text>
        ) : line.clamped ? (
          <Text style={styles.lineAlert}>
            Only {line.stock} available right now.
          </Text>
        ) : null}

        <View style={styles.lineControls}>
          <View
            accessibilityLabel={`Quantity for ${line.name}`}
            style={styles.stepper}
          >
            <Pressable
              accessibilityLabel="Decrease quantity"
              accessibilityRole="button"
              disabled={showBusy || out || line.qty <= 1}
              onPress={() => onUpdate(line.qty - 1)}
              style={({ pressed }) => [
                styles.stepButton,
                (showBusy || out || line.qty <= 1) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.qtyText}>
              {line.qty}
            </Text>
            <Pressable
              accessibilityLabel="Increase quantity"
              accessibilityRole="button"
              disabled={showBusy || out || line.qty >= max}
              onPress={() => onUpdate(line.qty + 1)}
              style={({ pressed }) => [
                styles.stepButton,
                (showBusy || out || line.qty >= max) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.lineTotal}>{format(line.lineBaseCents)}</Text>
        </View>

        <View style={styles.lineFooter}>
          <Text style={styles.stockHint}>
            {out
              ? "Out of stock"
              : line.stock <= 5
                ? `Only ${line.stock} left`
                : "In stock"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={showBusy}
            onPress={onRemove}
            style={({ pressed }) => [
              showBusy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {showBusy ? (
              <ActivityIndicator color={palette.muted} size="small" />
            ) : (
              <Text style={styles.removeText}>Remove</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  stateWrap: {
    flex: 1,
    justifyContent: "center",
  },
  guestCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  guestTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 16,
  },
  guestText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  guestButton: {
    alignSelf: "flex-start",
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  guestButtonText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 14,
  },
  banner: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorBanner: {
    borderColor: palette.danger,
  },
  bannerText: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: palette.danger,
  },
  bannerActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bannerLink: {
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  lines: {
    gap: spacing.md,
  },
  line: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  thumb: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: radius.md,
    height: 84,
    justifyContent: "center",
    overflow: "hidden",
    width: 84,
  },
  thumbImage: {
    height: "100%",
    width: "100%",
  },
  thumbFallback: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 22,
  },
  lineBody: {
    flex: 1,
    gap: spacing.xs,
  },
  lineName: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 15,
  },
  lineUnit: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
  },
  lineAlert: {
    ...fontStyles.bodySemiBold,
    color: palette.danger,
    fontSize: 12,
  },
  lineControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  stepper: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
  },
  stepButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  stepText: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  qtyText: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    fontSize: 14,
    minWidth: 24,
    textAlign: "center",
  },
  lineTotal: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 15,
  },
  lineFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  stockHint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 11,
  },
  removeText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  onlyUnavailable: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  onlyUnavailableTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 16,
  },
  onlyUnavailableText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  summary: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
  },
  summaryValue: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 20,
  },
  summaryNote: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  primary: {
    alignItems: "center",
    backgroundColor: palette.bronze,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 15,
  },
  secondary: {
    alignItems: "center",
    borderColor: palette.bronze,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 14,
  },
  clearButton: {
    alignItems: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  footerLinks: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
