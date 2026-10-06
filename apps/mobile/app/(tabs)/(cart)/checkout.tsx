import type { MobileBootstrapDTO } from "@maison/shared";
import { checkoutSchema, formatPrice } from "@maison/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PaystackProvider, usePaystack } from "react-native-paystack-webview";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ApiError,
  bootstrap,
  createCodOrder,
  initPaystackOrder,
  isPriceChangedError,
  verifyPaystackOrder,
} from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import {
  fontStyles,
  palette,
  radius,
  spacing,
} from "@/lib/theme";
import { signInWithGoogle, useSession } from "@/lib/session";

type CheckoutContext = MobileBootstrapDTO["checkout"];
type ShippingZone = CheckoutContext["zones"][number];
type CurrencyOption = CheckoutContext["currencies"][number];
type PaymentMethodCode = "cod" | "paystack";

type AddressForm = {
  name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  street: string;
  postal: string;
  zoneId: string;
  notes: string;
};

type Snapshot = {
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  currencyCode: string;
  rateToBase: string;
};

const EMPTY_ADDRESS: AddressForm = {
  name: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  street: "",
  postal: "",
  zoneId: "",
  notes: "",
};

/** Same tier pick as web feeFor / the server's re-price: the highest
 *  minSubtotalCents at or below the subtotal; below the first tier, use it. */
function feeFor(
  zone: ShippingZone | undefined,
  subtotalBaseCents: number,
): { fee: number; eta: string | null } {
  if (!zone || zone.rates.length === 0) return { fee: 0, eta: null };
  const sorted = [...zone.rates].sort(
    (a, b) => a.minSubtotalCents - b.minSubtotalCents,
  );
  let fee = sorted[0]!.feeCents;
  let eta: string | null = sorted[0]!.etaDays;
  for (const rate of sorted) {
    if (subtotalBaseCents >= rate.minSubtotalCents) {
      fee = rate.feeCents;
      eta = rate.etaDays;
    }
  }
  return { fee, eta };
}

/**
 * Paystack popup watchdog deadline. react-native-paystack-webview@5.1.0's
 * `handlePaystackMessage` `case "error"` (utils.js) only calls `close()` and
 * never invokes the caller's `onError`, and `validateParams` alerts and
 * returns without opening the popup. Without a deadline `pending` could stay
 * true forever with an `awaiting_payment` order on the server. Ten minutes is
 * comfortably longer than any real Paystack flow.
 */
const PAYSTACK_POPUP_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Kobo → explicit naira display for the confirm step, mirroring the web
 * `formatKobo` (base cents are kobo while the base currency is NGN). Avoids
 * `Intl` so the exact same output renders on Hermes and on web.
 */
function formatNaira(kobo: number): string {
  const [whole = "0", decimals = ""] = (kobo / 100).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = decimals.replace(/0+$/, "");
  return fraction ? `₦${grouped}.${fraction}` : `₦${grouped}`;
}

/** UUID v4 checkout token — crypto.randomUUID when present, web-fallback otherwise. */
function newClientToken(): string {
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    return (char === "x" ? rand : (rand & 0x3) | 0x8).toString(16);
  });
}

/**
 * Drops the finished checkout screen from the Cart stack before leaving for
 * another tab. `dismissAll` is an untargeted POP_TO_TOP, so expo-router applies
 * it to the focused stack (Cart); without it the Cart tab would keep an empty
 * checkout screen under a cross-tab `replace`/`navigate`.
 */
function resetCartStack() {
  if (router.canDismiss()) router.dismissAll();
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/cart");
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>Delivery &amp; payment</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

export default function CheckoutScreen() {
  const session = useSession();
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: bootstrap,
  });

  const user = session.data?.user;

  if (session.isPending || (bootstrapQuery.isPending && !bootstrapQuery.data)) {
    return (
      <Shell>
        <LoadingState label="Preparing checkout…" />
      </Shell>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <Shell>
        <View style={styles.stateWrap}>
          <ErrorState
            message={
              bootstrapQuery.error instanceof Error
                ? bootstrapQuery.error.message
                : undefined
            }
            onRetry={() => bootstrapQuery.refetch()}
            retrying={bootstrapQuery.isRefetching}
            title="Checkout unavailable"
          />
        </View>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <SignedOutGate />
      </Shell>
    );
  }

  return (
    <Shell>
      <PaystackProvider
        currency="NGN"
        // The payment UI promises "Card, transfer or USSD"; the package
        // defaults to ['card'] only. Values are the package's PaymentChannels
        // union (types.d.ts): 'card' | 'bank_transfer' | 'ussd' | ...
        defaultChannels={["card", "bank_transfer", "ussd"]}
        publicKey={bootstrapQuery.data?.checkout.paystackPublicKey ?? ""}
      >
        <CheckoutBody
          email={user.email}
          name={user.name ?? ""}
          checkout={bootstrapQuery.data!.checkout}
        />
      </PaystackProvider>
    </Shell>
  );
}

function SignedOutGate() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      await session.refetch();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [session]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign in to check out</Text>
        <Text style={styles.cardText}>
          Your bag is saved on this device. Sign in with Google to place your
          order and follow it from your account.
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.primary,
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={palette.onBronze} />
          ) : (
            <Text style={styles.primaryText}>Continue with Google</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/shop")}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Browse the shop</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function CheckoutBody({
  email,
  name,
  checkout,
}: {
  email: string;
  name: string;
  checkout: CheckoutContext;
}) {
  const cart = useCart();
  const queryClient = useQueryClient();
  const { popup } = usePaystack();
  const { currency, currencies, setCurrency } = useCurrency();

  const zones = checkout.zones;
  const enabledMethods = useMemo(
    () => checkout.paymentMethods.filter((m) => m.enabled),
    [checkout.paymentMethods],
  );
  const defaultMethod: PaymentMethodCode =
    enabledMethods.length === 1 && enabledMethods[0]!.code === "paystack"
      ? "paystack"
      : "cod";

  const [form, setForm] = useState<AddressForm>({
    ...EMPTY_ADDRESS,
    name,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [payPhase, setPayPhase] = useState<
    "idle" | "starting" | "popup" | "verifying"
  >("idle");
  const [showConfirm, setShowConfirm] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodCode>(defaultMethod);
  const [clientToken, setClientToken] = useState(newClientToken);
  const [drift, setDrift] = useState<{
    old: Snapshot;
    new: Snapshot;
  } | null>(null);
  // Set only by the popup watchdog: the order exists in awaiting_payment and
  // the modal offers navigation to it (manual recovery path).
  const [recoveryOrder, setRecoveryOrder] = useState<{
    orderId: string;
    number: string;
  } | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPopupWatchdog = useCallback(() => {
    if (popupTimerRef.current !== null) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  // Unmount safety: a pending timer must never touch state after teardown.
  useEffect(() => clearPopupWatchdog, [clearPopupWatchdog]);

  const armPopupWatchdog = useCallback(
    (orderId: string, number: string) => {
      clearPopupWatchdog();
      popupTimerRef.current = setTimeout(() => {
        popupTimerRef.current = null;
        setPending(false);
        setPayPhase("idle");
        setRecoveryOrder({ orderId, number });
        setModalError(
          "We did not hear back from Paystack — the order below is safe and awaiting payment.",
        );
      }, PAYSTACK_POPUP_TIMEOUT_MS);
    },
    [clearPopupWatchdog],
  );

  // The wire currency must be one the server offers; the context selection
  // wins when valid so the checkout price matches what the shopper browsed.
  const wireCurrency: CurrencyOption | null = useMemo(() => {
    const selected = checkout.currencies.find(
      (c) => c.code === currency?.code,
    );
    if (selected) return selected;
    return (
      checkout.currencies.find(
        (c) => c.code === checkout.defaultCurrencyCode,
      ) ??
      checkout.currencies[0] ??
      null
    );
  }, [checkout, currency]);

  const zone = zones.find((z) => z.id === form.zoneId);
  const hasZone = Boolean(zone && form.zoneId);
  const { fee, eta } = feeFor(zone, cart.subtotalBaseCents);

  // After a PRICE_CHANGED round-trip the server snapshot is the honest figure
  // until the shopper edits zone/currency (same rule as the web form).
  const shownSubtotal = drift?.new.subtotalBaseCents ?? cart.subtotalBaseCents;
  const shownFee = drift?.new.shippingBaseCents ?? fee;
  const shownTotal = drift?.new.totalBaseCents ?? cart.subtotalBaseCents + fee;
  const shownRate = drift?.new.rateToBase ?? wireCurrency?.rateToBase ?? "1";
  const shownCode = drift?.new.currencyCode ?? wireCurrency?.code ?? "";
  const shownSymbol = wireCurrency?.symbol ?? shownCode;

  const price = useCallback(
    (baseCents: number) =>
      formatPrice(baseCents, {
        code: shownCode,
        symbol: shownSymbol,
        rateToBase: shownRate,
      }),
    [shownCode, shownSymbol, shownRate],
  );

  const priceWith = useCallback(
    (baseCents: number, rate: string, code: string) =>
      formatPrice(baseCents, {
        code,
        symbol:
          currencies.find((c) => c.code === code)?.symbol ?? code,
        rateToBase: rate,
      }),
    [currencies],
  );

  const set = useCallback(
    <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  // Any zone/currency edit invalidates the last server re-price.
  const pickZone = useCallback((zoneId: string) => {
    setDrift(null);
    set("zoneId", zoneId);
  }, [set]);
  const pickCurrency = useCallback(
    (code: string) => {
      setDrift(null);
      setCurrency(code);
    },
    [setCurrency],
  );
  // Idempotency is scoped by (clientToken, paymentMethod): switching methods
  // mints a fresh token so a stale cross-method token can never be replayed.
  const switchMethod = useCallback(
    (next: PaymentMethodCode) => {
      if (next === paymentMethod) return;
      setPaymentMethod(next);
      setClientToken(newClientToken());
      setDrift(null);
    },
    [paymentMethod],
  );

  const buildPayload = useCallback(() => {
    return {
      address: {
        name: form.name,
        phone: form.phone,
        country: form.country,
        state: form.state,
        city: form.city,
        street: form.street,
        postal: form.postal,
        zoneId: form.zoneId,
        notes: form.notes.trim() ? form.notes : undefined,
      },
      currencyCode: shownCode,
      clientToken,
      zoneId: form.zoneId,
      paymentMethod,
      expectedSubtotalBaseCents: shownSubtotal,
      expectedShippingBaseCents: shownFee,
      expectedTotalBaseCents: shownTotal,
      expectedRateToBase: String(shownRate),
    };
  }, [
    form,
    shownCode,
    clientToken,
    paymentMethod,
    shownSubtotal,
    shownFee,
    shownTotal,
    shownRate,
  ]);

  const applyValidationErrors = useCallback(
    (issues: { path: PropertyKey[]; message: string }[]) => {
      const next: Record<string, string> = {};
      for (const issue of issues) {
        const path = issue.path.join(".").replace(/^address\./, "");
        if (!next[path]) next[path] = issue.message;
      }
      setFieldErrors(next);
    },
    [],
  );

  const openReview = useCallback(() => {
    setFormError(null);
    setModalError(null);
    setSessionExpired(false);
    setRecoveryOrder(null);
    const check = checkoutSchema.safeParse(buildPayload());
    if (!check.success) {
      applyValidationErrors(check.error.issues);
      setFormError("Check the highlighted fields and try again.");
      return;
    }
    // Fresh token per attempt — retries never reuse a consumed token.
    setClientToken(newClientToken());
    setShowConfirm(true);
  }, [buildPayload, applyValidationErrors]);

  const finishSuccess = useCallback(
    (orderId: string) => {
      clearPopupWatchdog();
      setRecoveryOrder(null);
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowConfirm(false);
      setPending(false);
      setPayPhase("idle");
      resetCartStack();
      router.navigate({ pathname: "/orders/[id]", params: { id: orderId } });
    },
    [clearPopupWatchdog, queryClient],
  );

  const handleFailure = useCallback(
    (cause: unknown) => {
      clearPopupWatchdog();
      setPending(false);
      setPayPhase("idle");
      if (isPriceChangedError(cause)) {
        setDrift({ old: cause.details.old, new: cause.details.new });
        setClientToken(newClientToken());
        setModalError(
          `${cause.message} Review the new total and confirm again to accept it.`,
        );
        return;
      }
      // F4 client-side mitigation: createOrder is idempotent by clientToken
      // regardless of the prior order's status, so a token consumed by ANY
      // failure (OUT_OF_STOCK, NOT_FOUND, RATE_LIMITED, generic, ...) must
      // never be reused — a retry would replay the dead order as success.
      // PRICE_CHANGED above already mints its own fresh token.
      setClientToken(newClientToken());
      if (cause instanceof ApiError) {
        if (cause.code === "PAYMENT_METHOD_MISMATCH") {
          setModalError(`${cause.message} A fresh checkout is ready — confirm again.`);
          return;
        }
        if (cause.code === "UNAUTHENTICATED") {
          setSessionExpired(true);
          setModalError(cause.message);
          setFormError(cause.message);
          return;
        }
        if (cause.code === "RATE_LIMITED") {
          setModalError(
            "Too many checkout attempts — wait a minute and try again.",
          );
          setFormError("Too many checkout attempts — wait a minute and try again.");
          return;
        }
        if (cause.code === "PAYSTACK_DISABLED") {
          setModalError(
            `${cause.message} Choose cash on delivery instead.`,
          );
          return;
        }
        setModalError(cause.message);
        setFormError(cause.message);
        return;
      }
      setModalError("Something went wrong — please try again.");
    },
    [clearPopupWatchdog],
  );

  const verifyPayment = useCallback(
    async (orderId: string, reference: string) => {
      setPayPhase("verifying");
      try {
        const result = await verifyPaystackOrder({ orderId, reference });
        finishSuccess(result.orderId);
      } catch (cause) {
        handleFailure(cause);
      }
    },
    [finishSuccess, handleFailure],
  );

  const openPaystackPopup = useCallback(
    (init: {
      orderId: string;
      number: string;
      reference: string;
      kobo: number;
      email: string;
    }) => {
      // Mirror the package's `validateParams` locally. That path alerts and
      // returns without opening the popup and without calling any callback;
      // onSuccess/onCancel are always functions here, so email + amount are
      // the only values that can fail. Pre-empting it means `pending` is
      // released immediately instead of waiting out the watchdog.
      if (!init.email || !Number.isFinite(init.kobo) || init.kobo <= 0) {
        setPending(false);
        setPayPhase("idle");
        setModalError(
          "The payment amount is not ready — choose cash on delivery or try again.",
        );
        return;
      }
      setPayPhase("popup");
      setRecoveryOrder(null);
      try {
        popup.checkout({
          email: init.email,
          // The package works in major units and multiplies by 100 for the
          // inline API; the server quote is integer kobo.
          amount: init.kobo / 100,
          reference: init.reference,
          metadata: {
            custom_fields: [
              {
                display_name: "Order",
                variable_name: "order_id",
                value: init.orderId,
              },
            ],
          },
          onSuccess: (data) => {
            // The watchdog stays armed through verify so a hung verify call
            // cannot strand `pending` either; finishSuccess/handleFailure
            // clear it.
            void verifyPayment(init.orderId, data?.reference ?? init.reference);
          },
          onCancel: () => {
            clearPopupWatchdog();
            setPending(false);
            setPayPhase("idle");
            setModalError(
              "Payment window closed — no confirmation yet. If money left your account, your order will confirm automatically; otherwise try again.",
            );
          },
          onError: (err) => {
            // react-native-paystack-webview@5.1.0 never delivers this: its
            // `case "error"` handler only calls close(). Wired for forward
            // compatibility; the watchdog covers today's silent close.
            clearPopupWatchdog();
            setPending(false);
            setPayPhase("idle");
            setModalError(
              err?.message ??
                "Could not open the payment window — check your connection and try again.",
            );
          },
        });
        armPopupWatchdog(init.orderId, init.number);
      } catch {
        clearPopupWatchdog();
        setPending(false);
        setPayPhase("idle");
        setModalError("Could not open the payment window — try again.");
      }
    },
    [armPopupWatchdog, clearPopupWatchdog, popup, verifyPayment],
  );

  const confirmPlaceOrder = useCallback(async () => {
    const check = checkoutSchema.safeParse(buildPayload());
    if (!check.success) {
      applyValidationErrors(check.error.issues);
      setShowConfirm(false);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setPending(true);
    setModalError(null);

    if (paymentMethod === "paystack") {
      setPayPhase("starting");
      try {
        const init = await initPaystackOrder(buildPayload());
        if (init.paid) {
          finishSuccess(init.orderId);
          return;
        }
        if (!init.publicKey) {
          setPending(false);
          setPayPhase("idle");
          setModalError(
            "Online payment is not configured yet — choose cash on delivery instead.",
          );
          return;
        }
        openPaystackPopup({
          orderId: init.orderId,
          number: init.number,
          reference: init.reference,
          kobo: init.kobo,
          email: init.email,
        });
      } catch (cause) {
        handleFailure(cause);
      }
      return;
    }

    try {
      const result = await createCodOrder(buildPayload());
      finishSuccess(result.orderId);
    } catch (cause) {
      handleFailure(cause);
    } finally {
      setPending(false);
    }
  }, [
    buildPayload,
    paymentMethod,
    applyValidationErrors,
    finishSuccess,
    openPaystackPopup,
    handleFailure,
  ]);

  if (enabledMethods.length === 0) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState
          message="No payment method is available right now. Please try again shortly."
          onRetry={cart.refetch}
          title="Checkout unavailable"
        />
      </View>
    );
  }

  if (cart.isLoading) {
    return <LoadingState label="Loading your order…" />;
  }

  if (cart.error && cart.lines.length === 0) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState
          message={cart.error.message}
          onRetry={cart.refetch}
          title="Cart unavailable"
        />
      </View>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        actionLabel="Browse the shop"
        message="Add a piece to your cart before checking out."
        onAction={() => {
          resetCartStack();
          router.navigate("/shop");
        }}
        title="Your cart is empty"
      />
    );
  }

  const unavailable = cart.lines.filter((l) => l.qty <= 0);
  const canSubmit =
    hasZone &&
    !pending &&
    unavailable.length === 0 &&
    cart.lines.length > 0 &&
    Boolean(shownCode);

  const submitLabel = !hasZone
    ? "Choose your delivery area to continue"
    : pending
      ? payPhase === "verifying"
        ? "Confirming payment…"
        : payPhase === "popup"
          ? "Waiting for Paystack…"
          : paymentMethod === "paystack"
            ? "Starting secure payment…"
            : "Placing order…"
      : paymentMethod === "paystack"
        ? `Review order · ${price(shownTotal)} — pay now`
        : `Review order · ${price(shownTotal)} — pay on delivery`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {unavailable.length > 0 ? (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={[styles.bannerText, styles.errorText]}>
              {unavailable.length === 1
                ? `${unavailable[0]!.name} is out of stock — remove it from your cart to check out.`
                : `${unavailable.length} items are out of stock — remove them from your cart to check out.`}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.dismissTo("/cart")}
            >
              <Text style={styles.bannerLink}>Go to cart</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          <Field
            autoComplete="name"
            error={fieldErrors.name}
            label="Full name"
            onChangeText={(v) => set("name", v)}
            value={form.name}
          />
          <Field
            autoComplete="tel"
            error={fieldErrors.phone}
            keyboardType="phone-pad"
            label="Phone (rider calls this)"
            onChangeText={(v) => set("phone", v)}
            placeholder="+234 …"
            value={form.phone}
          />
          <Field
            editable={false}
            label="Email (from your Google sign-in)"
            value={email}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          <Field
            autoComplete="country"
            error={fieldErrors.country}
            label="Country"
            onChangeText={(v) => set("country", v)}
            value={form.country}
          />
          <Field
            autoComplete="address-line1"
            error={fieldErrors.state}
            label="State / region"
            onChangeText={(v) => set("state", v)}
            value={form.state}
          />
          <Field
            autoComplete="address-line2"
            error={fieldErrors.city}
            label="City"
            onChangeText={(v) => set("city", v)}
            value={form.city}
          />
          <Field
            autoComplete="postal-code"
            error={fieldErrors.postal}
            label="Postal code"
            onChangeText={(v) => set("postal", v)}
            value={form.postal}
          />
          <Field
            error={fieldErrors.street}
            label="Street address"
            onChangeText={(v) => set("street", v)}
            placeholder="House, street, landmark"
            value={form.street}
          />
          <Field
            error={fieldErrors.notes}
            label="Delivery notes (optional)"
            maxLength={500}
            multiline
            onChangeText={(v) => set("notes", v)}
            placeholder="Gate code, landmark, best time to call…"
            value={form.notes}
          />

          <Text style={styles.fieldLabel}>
            Delivery zone <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.choiceList}>
            {zones.map((option) => {
              const selected = option.id === form.zoneId;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => pickZone(option.id)}
                  style={({ pressed }) => [
                    styles.choiceRow,
                    selected && styles.choiceRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                  >
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.choiceText}>{option.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {fieldErrors.zoneId ? (
            <Text style={styles.fieldError}>{fieldErrors.zoneId}</Text>
          ) : null}
          {hasZone && zone ? (
            <Text style={styles.zoneHint}>
              Fee {price(shownFee)}
              {eta ? ` · arrives in ${eta}` : ""}
              {shownFee === 0 ? " · free delivery on this order" : ""}
            </Text>
          ) : (
            <Text style={styles.zoneHint}>
              Choose your delivery area to see the fee.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Currency</Text>
          <View style={styles.choiceList}>
            {checkout.currencies.map((option) => {
              const selected = option.code === shownCode && !drift;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.code}
                  onPress={() => pickCurrency(option.code)}
                  style={({ pressed }) => [
                    styles.choiceRow,
                    selected && styles.choiceRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                  >
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.choiceText}>
                    {option.symbol} {option.code} — {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Priced at today&rsquo;s rate — frozen on your order, never changes
            after checkout.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          {enabledMethods.length > 1 ? (
            <View style={styles.choiceList}>
              {enabledMethods.map((method) => {
                const selected = paymentMethod === method.code;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={method.code}
                    onPress={() =>
                      switchMethod(method.code as PaymentMethodCode)
                    }
                    style={({ pressed }) => [
                      styles.choiceRow,
                      selected && styles.choiceRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[styles.radio, selected && styles.radioSelected]}
                    >
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.choiceBody}>
                      <Text style={styles.choiceText}>
                        {method.code === "paystack"
                          ? "Pay now with Paystack"
                          : method.label}
                      </Text>
                      <Text style={styles.choiceHint}>
                        {method.code === "paystack"
                          ? "Card, transfer or USSD — charged immediately in naira."
                          : "Cash or transfer when the rider arrives — they call first."}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.hint}>
              {paymentMethod === "paystack"
                ? "Pay now online with Paystack — charged immediately in naira."
                : "Pay on delivery — cash or transfer when the rider arrives."}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review order</Text>
          {cart.lines.map((line) => (
            <View key={line.productId} style={styles.summaryLine}>
              <Text numberOfLines={1} style={styles.summaryLineName}>
                {line.name} <Text style={styles.mutedText}>× {line.qty}</Text>
              </Text>
              <Text style={styles.summaryLineTotal}>
                {price(line.lineBaseCents)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{price(shownSubtotal)}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>
              Delivery{hasZone && zone ? ` (${zone.name})` : ""}
            </Text>
            <Text style={styles.summaryValue}>
              {hasZone ? price(shownFee) : "Choose your delivery area"}
            </Text>
          </View>
          <View style={[styles.summaryLine, styles.totalLine]}>
            <Text style={styles.totalLabel}>
              {paymentMethod === "paystack"
                ? "Total charged now"
                : "Total due on delivery"}
            </Text>
            <Text style={styles.totalValue}>
              {hasZone ? price(shownTotal) : `${price(shownSubtotal)} + ?`}
            </Text>
          </View>

          {paymentMethod === "paystack" && hasZone ? (
            <Text style={styles.nairaQuote}>
              Paystack quote: {formatNaira(shownTotal)} — charged in naira,
              nothing due to the rider.
            </Text>
          ) : null}

          {drift ? (
            <View style={styles.driftBox}>
              <Text style={styles.driftTitle}>
                Prices changed since you reviewed
              </Text>
              <Text style={styles.driftText}>
                Old total{" "}
                {priceWith(
                  drift.old.totalBaseCents,
                  drift.old.rateToBase,
                  drift.old.currencyCode,
                )}{" "}
                → new total{" "}
                {priceWith(
                  drift.new.totalBaseCents,
                  drift.new.rateToBase,
                  drift.new.currencyCode,
                )}
                . Confirm again to accept the new total.
              </Text>
            </View>
          ) : null}

          {formError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {formError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={openReview}
            style={({ pressed }) => [
              styles.primary,
              !canSubmit && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>{submitLabel}</Text>
          </Pressable>
          <Text style={styles.terms}>
            By placing your order you agree to the shop&rsquo;s terms. Change
            your mind within 12 hours while the order is pending — cancel free
            from your orders page.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!pending) setShowConfirm(false);
        }}
        transparent
        visible={showConfirm}
      >
        <View style={styles.modalBackdrop}>
          <View
            accessibilityViewIsModal
            style={styles.modalCard}
          >
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Confirm your order</Text>
              <Text style={styles.modalSubtitle}>
                {paymentMethod === "paystack"
                  ? "Check everything once — Paystack charges immediately in naira."
                  : "Check everything once — nothing is charged until the rider arrives."}
              </Text>

              {modalError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.errorText}
                >
                  {modalError}
                </Text>
              ) : null}

              {recoveryOrder ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>
                    {recoveryOrder.number} was created and is awaiting payment.
                    If money left your account it will confirm automatically —
                    otherwise check the order before trying again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const target = recoveryOrder;
                      clearPopupWatchdog();
                      setRecoveryOrder(null);
                      setShowConfirm(false);
                      setPending(false);
                      setPayPhase("idle");
                      resetCartStack();
                      router.navigate({
                        pathname: "/orders/[id]",
                        params: { id: target.orderId },
                      });
                    }}
                  >
                    <Text style={styles.bannerLink}>View order</Text>
                  </Pressable>
                </View>
              ) : null}

              {sessionExpired ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>
                    Your session expired — sign in again to place your order.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.navigate("/account")}
                  >
                    <Text style={styles.bannerLink}>Go to Account</Text>
                  </Pressable>
                </View>
              ) : null}

              {drift ? (
                <View style={styles.driftBox}>
                  <Text style={styles.driftTitle}>
                    Prices changed since you reviewed
                  </Text>
                  <Text style={styles.driftText}>
                    Old total{" "}
                    {priceWith(
                      drift.old.totalBaseCents,
                      drift.old.rateToBase,
                      drift.old.currencyCode,
                    )}{" "}
                    → new total{" "}
                    {priceWith(
                      drift.new.totalBaseCents,
                      drift.new.rateToBase,
                      drift.new.currencyCode,
                    )}
                    . Subtotal{" "}
                    {priceWith(
                      drift.old.subtotalBaseCents,
                      drift.old.rateToBase,
                      drift.old.currencyCode,
                    )}{" "}
                    →{" "}
                    {priceWith(
                      drift.new.subtotalBaseCents,
                      drift.new.rateToBase,
                      drift.new.currencyCode,
                    )}
                    , delivery{" "}
                    {priceWith(
                      drift.old.shippingBaseCents,
                      drift.old.rateToBase,
                      drift.old.currencyCode,
                    )}{" "}
                    →{" "}
                    {priceWith(
                      drift.new.shippingBaseCents,
                      drift.new.rateToBase,
                      drift.new.currencyCode,
                    )}
                    . Confirm again to accept the new total.
                  </Text>
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Deliver to</Text>
                <Text style={styles.modalValue}>
                  <Text style={styles.strong}>{form.name}</Text> ·{" "}
                  {form.phone}
                  {"\n"}
                  {form.street}, {form.city}, {form.state} {form.postal},{" "}
                  {form.country}
                  {form.notes.trim() ? `\nNote: ${form.notes.trim()}` : ""}
                </Text>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Delivery zone</Text>
                <Text style={styles.modalValue}>
                  {zone?.name ?? "—"} · {price(shownFee)}
                  {eta ? ` · arrives in ${eta}` : ""}
                </Text>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Payment method</Text>
                <Text style={styles.modalValue}>
                  {paymentMethod === "paystack"
                    ? "Pay now with Paystack"
                    : "Cash on delivery"}
                </Text>
                {paymentMethod === "paystack" ? (
                  <Text style={styles.nairaQuote}>
                    Paystack quote: {formatNaira(shownTotal)} — charged now in
                    naira, nothing due to the rider.
                  </Text>
                ) : null}
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Currency</Text>
                <Text style={styles.modalValue}>
                  {shownSymbol} {shownCode}
                </Text>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>
                  Items ({cart.lines.length})
                </Text>
                {cart.lines.map((line) => (
                  <View key={line.productId} style={styles.summaryLine}>
                    <Text numberOfLines={1} style={styles.summaryLineName}>
                      {line.name}{" "}
                      <Text style={styles.mutedText}>× {line.qty}</Text>
                    </Text>
                    <Text style={styles.summaryLineTotal}>
                      {price(line.lineBaseCents)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={[styles.modalSection, styles.modalTotals]}>
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>{price(shownSubtotal)}</Text>
                </View>
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>
                    Delivery{zone ? ` (${zone.name})` : ""}
                  </Text>
                  <Text style={styles.summaryValue}>{price(shownFee)}</Text>
                </View>
                <View style={[styles.summaryLine, styles.totalLine]}>
                  <Text style={styles.totalLabel}>
                    {paymentMethod === "paystack"
                      ? shownCode === "NGN"
                        ? "Total charged now"
                        : `Converted total (${shownCode}) — not the charge`
                      : "Total due on delivery"}
                  </Text>
                  <Text style={styles.totalValue}>{price(shownTotal)}</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending}
                  onPress={() => setShowConfirm(false)}
                  style={({ pressed }) => [
                    styles.secondary,
                    pending && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>Back to edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending}
                  onPress={() => {
                    void confirmPlaceOrder();
                  }}
                  style={({ pressed }) => [
                    styles.primary,
                    styles.modalConfirm,
                    pending && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {pending ? (
                    <ActivityIndicator color={palette.onBronze} />
                  ) : (
                    <Text style={styles.primaryText}>
                      {paymentMethod === "paystack"
                        ? `Pay ${formatNaira(shownTotal)} now`
                        : `Place order · ${price(shownTotal)}`}
                    </Text>
                  )}
                </Pressable>
              </View>
              {pending ? (
                <Text style={styles.modalPending}>
                  {payPhase === "verifying"
                    ? "Confirming payment…"
                    : payPhase === "popup"
                      ? "Waiting for Paystack…"
                      : paymentMethod === "paystack"
                        ? "Starting secure payment…"
                        : "Placing your order…"}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  autoComplete,
  multiline,
  maxLength,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  autoComplete?:
    | "name"
    | "tel"
    | "country"
    | "address-line1"
    | "address-line2"
    | "postal-code";
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoComplete === "name" ? "words" : "sentences"}
        autoComplete={autoComplete}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          !editable && styles.inputDisabled,
          error ? styles.inputError : null,
        ]}
        value={value}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  flex: {
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
  header: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 28,
  },
  subtitle: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    marginTop: spacing.xs,
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
  cardText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...fontStyles.bodyMedium,
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  required: {
    color: palette.danger,
  },
  input: {
    ...fontStyles.body,
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputDisabled: {
    backgroundColor: palette.paper,
    color: palette.muted,
  },
  inputError: {
    borderColor: palette.danger,
  },
  fieldError: {
    ...fontStyles.body,
    color: palette.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  choiceList: {
    gap: spacing.sm,
  },
  choiceRow: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  choiceRowSelected: {
    backgroundColor: palette.paper,
    borderColor: palette.bronze,
  },
  radio: {
    alignItems: "center",
    borderColor: palette.muted,
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  radioSelected: {
    borderColor: palette.bronze,
  },
  radioDot: {
    backgroundColor: palette.bronze,
    borderRadius: 4.5,
    height: 9,
    width: 9,
  },
  choiceBody: {
    flex: 1,
    gap: 2,
  },
  choiceText: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    flexShrink: 1,
    fontSize: 15,
  },
  choiceHint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  hint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  zoneHint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  nairaQuote: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  summaryLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLineName: {
    ...fontStyles.body,
    color: palette.ink,
    flex: 1,
    fontSize: 14,
  },
  summaryLineTotal: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    fontSize: 14,
  },
  summaryLabel: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
  },
  summaryValue: {
    ...fontStyles.bodySemiBold,
    color: palette.ink,
    fontSize: 14,
  },
  mutedText: {
    color: palette.muted,
  },
  divider: {
    backgroundColor: palette.line,
    height: 1,
    marginVertical: spacing.sm,
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
  banner: {
    backgroundColor: palette.paper,
    borderColor: palette.bronzeSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  bannerError: {
    borderColor: palette.danger,
  },
  bannerText: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerLink: {
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  driftBox: {
    backgroundColor: palette.paper,
    borderColor: palette.bronzeSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  driftTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 14,
  },
  driftText: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    ...fontStyles.body,
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    alignItems: "center",
    backgroundColor: palette.bronze,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 15,
    textAlign: "center",
  },
  secondary: {
    alignItems: "center",
    borderColor: palette.bronze,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 15,
  },
  terms: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    backgroundColor: "rgba(25, 23, 20, 0.6)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: palette.paper,
    borderRadius: radius.lg,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalContent: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  modalTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 24,
  },
  modalSubtitle: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalSection: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  modalLabel: {
    ...fontStyles.bodyBold,
    color: palette.muted,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modalValue: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  strong: {
    ...fontStyles.bodyBold,
  },
  modalTotals: {
    gap: 0,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  modalConfirm: {
    flex: 1,
  },
  modalPending: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
