import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "@/components/screen";
import { ErrorState, LoadingState } from "@/components/states";
import { bootstrap } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";
import { signInWithGoogle, signOut, useSession } from "@/lib/session";

export default function AccountScreen() {
  const { data: session, isPending, error, refetch } = useSession();
  const {
    currencies,
    currency,
    setCurrency,
    isPending: currenciesPending,
    error: currenciesError,
    refetch: refetchCurrencies,
  } = useCurrency();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const contactQuery = useQuery({ queryKey: ["bootstrap"], queryFn: bootstrap });
  const contact = contactQuery.data?.contact;

  const handleSignIn = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await signInWithGoogle();
      await refetch();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await signOut();
      await refetch();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Sign-out failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  const user = session?.user;

  return (
    <Screen title="Account" subtitle="Your Maison profile">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {isPending ? (
            <View style={styles.row}>
              <ActivityIndicator color={palette.bronze} />
              <Text style={styles.mutedText}>Checking your session…</Text>
            </View>
          ) : null}

          {!isPending && !user ? (
            <View style={styles.stack}>
              <Text style={styles.cardTitle}>Sign in</Text>
              <Text style={styles.mutedText}>
                Sign in with Google to sync your cart and follow your orders.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSignIn}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={palette.onBronze} />
                ) : (
                  <Text style={styles.buttonText}>Continue with Google</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {user ? (
            <View style={styles.stack}>
              {user.image ? (
                <Image
                  accessibilityLabel="Profile photo"
                  source={{ uri: user.image }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.cardTitle}>{user.name ?? "Maison shopper"}</Text>
              <Text style={styles.mutedText}>{user.email}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={palette.bronze} />
                ) : (
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Sign out
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <Text style={styles.errorText}>
              {error.message ?? "Your session could not be loaded."}
            </Text>
          ) : null}
          {actionError ? (
            <Text style={styles.errorText}>{actionError}</Text>
          ) : null}
        </View>

        <View style={[styles.card, styles.currencyCard]}>
          <Text style={styles.cardTitle}>Currency</Text>
          <Text style={styles.mutedText}>
            Prices convert at today&rsquo;s rate and freeze when you order.
          </Text>

          {currenciesPending ? (
            <LoadingState label="Loading currencies…" />
          ) : null}

          {currenciesError && currencies.length === 0 ? (
            <ErrorState
              message={currenciesError.message}
              onRetry={() => refetchCurrencies()}
              title="Currencies unavailable"
            />
          ) : null}

          {currencies.length > 0 ? (
            <View style={styles.chipRow}>
              {currencies.map((option) => {
                const selected = option.code === currency?.code;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.code}
                    onPress={() => setCurrency(option.code)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {option.symbol} {option.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.contactCard]}>
          <Text style={styles.cardTitle}>Contact</Text>
          {contactQuery.isPending ? (
            <LoadingState label="Loading contact details…" />
          ) : contact ? (
            <View style={styles.contactRows}>
              {contact.email ? (
                <ContactRow
                  label="Email"
                  onPress={() => openLink(`mailto:${contact.email}`)}
                  value={contact.email}
                />
              ) : null}
              {contact.phone ? (
                <ContactRow
                  label="Phone"
                  onPress={() =>
                    openLink(contact.phoneHref || `tel:${contact.phone}`)
                  }
                  value={contact.phone}
                />
              ) : null}
              {contact.whatsapp ? (
                <ContactRow
                  label="WhatsApp"
                  onPress={
                    contact.whatsappUrl
                      ? () => openLink(contact.whatsappUrl)
                      : undefined
                  }
                  value={contact.whatsapp}
                />
              ) : null}
              {contact.address ? (
                <ContactRow label="Address" value={contact.address} />
              ) : null}
              {contact.hours ? (
                <ContactRow label="Hours" value={contact.hours} />
              ) : null}
            </View>
          ) : (
            <Text style={styles.mutedText}>
              Contact details are unavailable right now.
            </Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function openLink(url: string) {
  void Linking.openURL(url).catch(() => {});
}

function ContactRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={[styles.contactValue, onPress ? styles.contactLink : null]}>
        {value}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.contactRow}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactRow,
        pressed && styles.buttonPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  currencyCard: {
    marginTop: spacing.lg,
  },
  contactCard: {
    marginTop: spacing.lg,
  },
  contactRows: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contactRow: {
    gap: 2,
  },
  contactLabel: {
    ...fontStyles.bodyMedium,
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  contactValue: {
    ...fontStyles.body,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  contactLink: {
    color: palette.bronze,
    textDecorationLine: "underline",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: palette.bronze,
    borderColor: palette.bronze,
  },
  chipText: {
    ...fontStyles.bodyMedium,
    color: palette.ink,
    fontSize: 13,
  },
  chipTextSelected: {
    ...fontStyles.bodySemiBold,
    color: palette.onBronze,
  },
  cardTitle: {
    ...fontStyles.display,
    color: palette.ink,
    fontSize: 18,
  },
  stack: {
    gap: spacing.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  mutedText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    ...fontStyles.body,
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  avatar: {
    borderRadius: 36,
    height: 72,
    width: 72,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: palette.bronzeSoft,
    justifyContent: "center",
  },
  avatarInitial: {
    ...fontStyles.display,
    color: palette.surface,
    fontSize: 28,
  },
  button: {
    alignItems: "center",
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: palette.paper,
    borderColor: palette.bronze,
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: palette.bronze,
  },
});
