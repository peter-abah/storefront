import type { MyOrderDTO } from "@maison/shared";
import { formatPrice } from "@maison/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { OrderStatusPill } from "@/components/order-status-pill";
import { Screen } from "@/components/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { getOrders } from "@/lib/api";
import { formatOrderDate } from "@/lib/order-status";
import { signInWithGoogle, useSession } from "@/lib/session";
import { palette, radius, spacing } from "@/lib/theme";

export default function OrdersScreen() {
  const session = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const userId = session.data?.user?.id ?? null;

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: Boolean(userId),
  });

  const handleSignIn = useCallback(async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
      await session.refetch();
    } catch (cause) {
      setSignInError(
        cause instanceof Error
          ? cause.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setSigningIn(false);
    }
  }, [session]);

  if (session.isPending) {
    return (
      <Screen title="Orders" subtitle="Your order history">
        <LoadingState label="Checking your session…" />
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen title="Orders" subtitle="Your order history">
        <View style={styles.stateWrap}>
          {signInError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {signInError}
            </Text>
          ) : null}
          <EmptyState
            actionLabel={signingIn ? undefined : "Continue with Google"}
            message="Sign in with Google to see your orders and follow every delivery."
            onAction={signingIn ? undefined : handleSignIn}
            title="Sign in to see your orders"
          />
          {signingIn ? (
            <ActivityIndicator color={palette.bronze} />
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Orders" subtitle="Your order history">
      {ordersQuery.isPending ? (
        <LoadingState label="Loading your orders…" />
      ) : ordersQuery.isError ? (
        <View style={styles.stateWrap}>
          <ErrorState
            message={
              ordersQuery.error instanceof Error
                ? ordersQuery.error.message
                : undefined
            }
            onRetry={() => ordersQuery.refetch()}
            retrying={ordersQuery.isRefetching}
            title="Orders unavailable"
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={
            ordersQuery.data.length === 0
              ? styles.emptyContent
              : styles.listContent
          }
          data={ordersQuery.data}
          keyExtractor={(order) => order.id}
          ListEmptyComponent={
            <EmptyState
              actionLabel="Browse the shop"
              message="Your first order will appear here with live status updates."
              onAction={() => router.push("/shop")}
              title="No orders yet"
            />
          }
          refreshControl={
            <RefreshControl
              colors={[palette.bronze]}
              onRefresh={() => ordersQuery.refetch()}
              refreshing={ordersQuery.isRefetching}
              tintColor={palette.bronze}
            />
          }
          renderItem={({ item }) => <OrderRow order={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function OrderRow({ order }: { order: MyOrderDTO }) {
  const total = formatPrice(order.totalBaseCents, {
    code: order.currencyCode,
    symbol: order.currencySymbol,
    rateToBase: order.fxRateSnapshot,
  });

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() =>
        router.push({ pathname: "/orders/[id]", params: { id: order.id } })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.number}>{order.number}</Text>
        <OrderStatusPill status={order.status} />
      </View>
      <Text style={styles.date}>{formatOrderDate(order.createdAt)}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.items}>
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </Text>
        <Text style={styles.total}>{total}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  listContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
  },
  row: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  number: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  date: {
    color: palette.muted,
    fontSize: 13,
  },
  rowBottom: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  items: {
    color: palette.muted,
    fontSize: 14,
  },
  total: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
