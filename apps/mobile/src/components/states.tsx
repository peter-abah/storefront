import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { palette, radius, spacing } from "@/lib/theme";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={palette.bronze} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            (pressed || retrying) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{retrying ? "Retrying…" : "Retry"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  muted: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  button: {
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: palette.onBronze,
    fontSize: 14,
    fontWeight: "700",
  },
});
