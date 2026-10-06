import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { palette, radius, spacing } from "@/lib/theme";

type Feedback = { kind: "success" | "error"; text: string };

/**
 * Product-detail add control (web AddToCart "full" parity): qty stepper +
 * Add, wired to the unified cart hook so guest and signed-in shoppers get
 * the same clamped/OOS feedback. Hidden when the piece is out of stock.
 */
export function AddToCart({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const { add, lines, isMutating, pendingProductId, isSessionPending } =
    useCart();
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((next: Feedback) => {
    setFeedback(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 5000);
  }, []);

  if (stock <= 0) return null;

  const max = Math.min(stock, 99);
  const inBag = lines.find((l) => l.productId === productId)?.qty ?? 0;
  const pending = isMutating && pendingProductId === productId;
  // Session unresolved = auth state unknown; never fire a server mutation
  // until we know whether this is a guest or a signed-in shopper.
  const blocked = isMutating || isSessionPending;

  const onAdd = async () => {
    if (blocked) return;
    setFeedback(null);
    try {
      const result = await add(productId, qty);
      if (result.qty <= 0) {
        show({
          kind: "success",
          text: "That piece just sold out — it's in your bag as unavailable.",
        });
      } else if (result.clamped) {
        show({
          kind: "success",
          text: `Added — only ${result.qty} left, so your bag was trimmed to what's available.`,
        });
      } else {
        show({
          kind: "success",
          text: `Added ${qty === 1 ? "1 piece" : `${qty} pieces`} to your bag.`,
        });
      }
    } catch (cause) {
      show({
        kind: "error",
        text:
          cause instanceof ApiError
            ? cause.message
            : "Couldn't add that piece — please try again.",
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View accessibilityLabel="Quantity" style={styles.stepper}>
          <Pressable
            accessibilityLabel="Decrease quantity"
            accessibilityRole="button"
            disabled={blocked || qty <= 1}
            onPress={() => setQty((q) => Math.max(1, q - 1))}
            style={({ pressed }) => [
              styles.stepButton,
              (blocked || qty <= 1) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.qtyText}>
            {qty}
          </Text>
          <Pressable
            accessibilityLabel="Increase quantity"
            accessibilityRole="button"
            disabled={blocked || qty >= max}
            onPress={() => setQty((q) => Math.min(max, q + 1))}
            style={({ pressed }) => [
              styles.stepButton,
              (blocked || qty >= max) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={blocked}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.addButton,
            blocked && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {pending ? (
            <ActivityIndicator color={palette.onBronze} />
          ) : (
            <Text style={styles.addText}>Add to cart</Text>
          )}
        </Pressable>
      </View>

      {inBag > 0 ? (
        <Text style={styles.inBag}>
          In your bag: {inBag} {inBag === 1 ? "piece" : "pieces"}
        </Text>
      ) : null}

      {feedback ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            feedback.kind === "error" ? styles.feedbackError : styles.feedbackOk,
          ]}
        >
          {feedback.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  stepper: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
  },
  stepButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepText: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  qtyText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "600",
    minWidth: 28,
    textAlign: "center",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: palette.bronze,
    borderRadius: radius.lg,
    minWidth: 140,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  addText: {
    color: palette.onBronze,
    fontSize: 15,
    fontWeight: "700",
  },
  inBag: {
    color: palette.muted,
    fontSize: 13,
  },
  feedback: {
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackOk: {
    color: palette.success,
  },
  feedbackError: {
    color: palette.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});
