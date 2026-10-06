import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "@/components/screen";
import { palette, radius, spacing } from "@/lib/theme";
import { signInWithGoogle, signOut, useSession } from "@/lib/session";

export default function AccountScreen() {
  const { data: session, isPending, error, refetch } = useSession();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      </ScrollView>
    </Screen>
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
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
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
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
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
    color: palette.surface,
    fontSize: 28,
    fontWeight: "700",
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
    color: palette.onBronze,
    fontSize: 15,
    fontWeight: "700",
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
