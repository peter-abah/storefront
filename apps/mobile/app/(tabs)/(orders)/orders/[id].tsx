import { formatPrice, type OrderDetailDTO } from "@maison/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { OrderStatusPill } from "@/components/order-status-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ApiError,
  cancelOrder,
  getOrderDetail,
  verifyPaystackOrder,
} from "@/lib/api";
import {
  canRequestCancel,
  formatOrderDate,
  OFF_TIMELINE_STATUSES,
  orderStatusLabel,
  timelineFor,
} from "@/lib/order-status";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  paystack: "Pay now with Paystack",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Not yet paid",
  awaiting: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["orders", id],
    queryFn: () => getOrderDetail(id),
    enabled: Boolean(id),
  });

  const notFound =
    query.error instanceof ApiError &&
    (query.error.code === "NOT_FOUND" || query.error.code === "FORBIDDEN");

  const runCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    setCancelNotice(null);
    try {
      await cancelOrder(id);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await query.refetch();
      setCancelNotice("Order cancelled — nothing was charged.");
    } catch (cause) {
      setCancelError(
        cause instanceof ApiError
          ? cause.message
          : "Could not cancel the order — please try again.",
      );
    } finally {
      setCancelling(false);
    }
  }, [id, queryClient, query]);

  /**
   * Manual payment recovery: confirm an awaiting-payment Paystack order
   * server-side. Safe to call repeatedly (verify is idempotent by
   * reference); the gateway/webhook may have already settled the payment.
   */
  const runVerify = useCallback(async () => {
    const order = query.data?.order;
    if (!order) return;
    if (!order.paystackRef) {
      setVerifyNotice(null);
      setVerifyError(
        "This order has no payment reference yet — contact the shop and we will help.",
      );
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    setVerifyNotice(null);
    try {
      await verifyPaystackOrder({
        orderId: order.id,
        reference: order.paystackRef,
      });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await query.refetch();
      setVerifyNotice("Payment confirmed — this order is now paid.");
    } catch (cause) {
      // VERIFY_FAILED / PAYMENT_FAILED / AMOUNT_MISMATCH / GATEWAY_* arrive
      // as ApiError; surface the server's message verbatim, then refresh so
      // any state verify wrote (e.g. failed) is visible.
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await query.refetch();
      setVerifyError(
        cause instanceof ApiError
          ? cause.message
          : "Could not check the payment status — please try again.",
      );
    } finally {
      setVerifying(false);
    }
  }, [query, queryClient]);

  const confirmCancel = useCallback(() => {
    Alert.alert(
      "Cancel order",
      "Cancel this order? This cannot be undone.",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: () => {
            void runCancel();
          },
        },
      ],
    );
  }, [runCancel]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/orders");
  }, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Orders</Text>
        </Pressable>
      </View>

      {notFound ? (
        <View style={styles.stateWrap}>
          <EmptyState
            actionLabel="Back to orders"
            message="This order does not exist or belongs to another account."
            onAction={() => router.dismissTo("/orders")}
            title="Order not found"
          />
        </View>
      ) : query.isPending ? (
        <View style={styles.stateWrap}>
          <LoadingState label="Loading this order…" />
        </View>
      ) : query.isError ? (
        <View style={styles.stateWrap}>
          <ErrorState
            message={
              query.error instanceof Error ? query.error.message : undefined
            }
            onRetry={() => query.refetch()}
            retrying={query.isRefetching}
            title="Order unavailable"
          />
        </View>
      ) : query.data ? (
        <OrderBody
          cancelError={cancelError}
          cancelNotice={cancelNotice}
          cancelling={cancelling}
          data={query.data}
          onCancel={confirmCancel}
          onVerify={runVerify}
          verifying={verifying}
          verifyError={verifyError}
          verifyNotice={verifyNotice}
        />
      ) : null}
    </SafeAreaView>
  );
}

function OrderBody({
  data,
  onCancel,
  cancelling,
  cancelError,
  cancelNotice,
  onVerify,
  verifying,
  verifyError,
  verifyNotice,
}: {
  data: OrderDetailDTO;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: string | null;
  cancelNotice: string | null;
  onVerify: () => void;
  verifying: boolean;
  verifyError: string | null;
  verifyNotice: string | null;
}) {
  const { order, items, zoneName, currency } = data;
  const price = (baseCents: number) =>
    formatPrice(baseCents, {
      code: order.currencyCode,
      symbol: currency.symbol,
      rateToBase: order.fxRateSnapshot,
    });

  const address = order.address;
  const steps = timelineFor(order.paymentMethod);
  const currentIndex = steps.findIndex((step) => step.status === order.status);
  const offTimeline =
    currentIndex === -1 && OFF_TIMELINE_STATUSES.includes(order.status);
  const cancellable = canRequestCancel({
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
  });
  // Recovery for a lost Paystack popup result: the order is awaiting
  // payment, so let the owner re-run the server-side verify on demand.
  const awaitingPaystack =
    order.paymentMethod === "paystack" && order.status === "awaiting_payment";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.number}>{order.number}</Text>
          <OrderStatusPill status={order.status} />
        </View>
        <Text style={styles.date}>Placed {formatOrderDate(order.createdAt)}</Text>
        {order.paidAt ? (
          <Text style={styles.date}>Paid {formatOrderDate(order.paidAt)}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress</Text>
        {offTimeline ? (
          <View style={styles.offTimeline}>
            <Text style={styles.offTimelineTitle}>
              {orderStatusLabel(order.status)}
            </Text>
            <Text style={styles.mutedText}>
              {order.status === "cancelled"
                ? "This order was cancelled. Nothing is due."
                : order.status === "refunded"
                  ? "This order was refunded — the shop will be in touch if anything else is needed."
                  : "The payment did not complete. You can start a new checkout any time."}
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {steps.map((step, index) => {
              const reached = index <= currentIndex;
              const current = index === currentIndex;
              return (
                <View key={step.status} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        reached && styles.timelineDotReached,
                        current && styles.timelineDotCurrent,
                      ]}
                    />
                    {index < steps.length - 1 ? (
                      <View
                        style={[
                          styles.timelineLine,
                          index < currentIndex && styles.timelineLineReached,
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      reached && styles.timelineLabelReached,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {items.map((item) => (
          <View key={item.productId} style={styles.itemRow}>
            <View style={styles.thumb}>
              {item.image ? (
                <Image
                  accessibilityIgnoresInvertColors
                  source={{ uri: item.image }}
                  style={styles.thumbImage}
                />
              ) : (
                <Text style={styles.thumbFallback}>—</Text>
              )}
            </View>
            <View style={styles.itemBody}>
              <Text numberOfLines={2} style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={styles.mutedText}>
                {item.qty} × {price(item.unitBaseCents)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {price(item.qty * item.unitBaseCents)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery</Text>
        <Text style={styles.bodyStrong}>{address.name}</Text>
        <Text style={styles.bodyText}>{address.phone}</Text>
        <Text style={styles.bodyText}>
          {address.street}, {address.city}, {address.state} {address.postal},{" "}
          {address.country}
        </Text>
        {zoneName ? <Text style={styles.bodyText}>Zone: {zoneName}</Text> : null}
        {address.notes ? (
          <Text style={styles.bodyText}>Note: {address.notes}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment</Text>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Method</Text>
          <Text style={styles.summaryValue}>
            {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
          </Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Status</Text>
          <Text style={styles.summaryValue}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </Text>
        </View>
        {order.paystackRef ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Reference</Text>
            <Text style={styles.summaryValue}>{order.paystackRef}</Text>
          </View>
        ) : null}

        {awaitingPaystack ? (
          <View style={styles.verifyBlock}>
            <Text style={styles.mutedText}>
              If money left your account, this payment can still confirm
              automatically. Check its current status now.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={verifying || !order.paystackRef}
              onPress={onVerify}
              style={({ pressed }) => [
                styles.verifyButton,
                (verifying || !order.paystackRef) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {verifying ? (
                <ActivityIndicator color={palette.bronze} />
              ) : (
                <Text style={styles.verifyText}>Check payment status</Text>
              )}
            </Pressable>
            {verifyNotice ? (
              <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                {verifyNotice}
              </Text>
            ) : null}
            {verifyError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {verifyError}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Totals</Text>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {price(order.subtotalBaseCents)}
          </Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>
            Delivery{zoneName ? ` (${zoneName})` : ""}
          </Text>
          <Text style={styles.summaryValue}>
            {price(order.shippingBaseCents)}
          </Text>
        </View>
        <View style={[styles.summaryLine, styles.totalLine]}>
          <Text style={styles.totalLabel}>
            {order.paymentMethod === "paystack"
              ? "Charged online"
              : "Due on delivery"}
          </Text>
          <Text style={styles.totalValue}>{price(order.totalBaseCents)}</Text>
        </View>
      </View>

      {cancelNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
          {cancelNotice}
        </Text>
      ) : null}
      {cancelError ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {cancelError}
        </Text>
      ) : null}

      {cancellable ? (
        <Pressable
          accessibilityRole="button"
          disabled={cancelling}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            cancelling && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {cancelling ? (
            <ActivityIndicator color={palette.danger} />
          ) : (
            <Text style={styles.cancelText}>Cancel order</Text>
          )}
        </Pressable>
      ) : order.status === "pending" || order.status === "awaiting_payment" ? (
        <Text style={styles.hint}>
          The 12-hour free-cancel window has passed — contact the shop and we
          will help.
        </Text>
      ) : null}
    </ScrollView>
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
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 15,
  },
  stateWrap: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  number: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 22,
  },
  date: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
  },
  timeline: {
    gap: spacing.xs,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timelineRail: {
    alignItems: "center",
    width: 18,
  },
  timelineDot: {
    backgroundColor: palette.line,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  timelineDotReached: {
    backgroundColor: palette.bronzeSoft,
  },
  timelineDotCurrent: {
    backgroundColor: palette.bronze,
    height: 14,
    width: 14,
  },
  timelineLine: {
    backgroundColor: palette.line,
    flex: 1,
    minHeight: 18,
    width: 2,
  },
  timelineLineReached: {
    backgroundColor: palette.bronzeSoft,
  },
  timelineLabel: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    paddingBottom: spacing.sm,
  },
  timelineLabelReached: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
  },
  offTimeline: {
    gap: spacing.xs,
  },
  offTimelineTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 15,
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  thumb: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: radius.sm,
    height: 52,
    justifyContent: "center",
    overflow: "hidden",
    width: 52,
  },
  thumbImage: {
    height: "100%",
    width: "100%",
  },
  thumbFallback: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 18,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 14,
  },
  itemTotal: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    fontSize: 14,
  },
  bodyStrong: {
    ...fontStyles.bodyBold,
    color: palette.ink,
    fontSize: 15,
  },
  bodyText: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  mutedText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryLine: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  summaryLabel: {
    ...fontStyles.body,
    color: palette.muted,
    flexShrink: 1,
    fontSize: 14,
  },
  summaryValue: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    flexShrink: 1,
    fontSize: 14,
    textAlign: "right",
  },
  totalLine: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    flex: 1,
    fontSize: 15,
  },
  totalValue: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 18,
  },
  verifyBlock: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  verifyButton: {
    alignItems: "center",
    borderColor: palette.bronze,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  verifyText: {
    ...fontStyles.bodyBold,
    color: palette.bronze,
    fontSize: 15,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: palette.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  cancelText: {
    ...fontStyles.bodyBold,
    color: palette.danger,
    fontSize: 15,
  },
  noticeText: {
    ...fontStyles.body,
    color: palette.success,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    ...fontStyles.body,
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  hint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
