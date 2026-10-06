import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "@/components/screen";
import { apiHost, bootstrap } from "@/lib/api";
import { palette, radius, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: bootstrap,
  });

  return (
    <Screen title="Maison" subtitle="Furniture and objects for the home">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API status</Text>

          {isPending ? (
            <View style={styles.row}>
              <ActivityIndicator color={palette.bronze} />
              <Text style={styles.mutedText}>Connecting to the shop…</Text>
            </View>
          ) : null}

          {isError ? (
            <View style={styles.stack}>
              <Text style={styles.errorTitle}>Could not load the shop</Text>
              <Text style={styles.mutedText}>
                {error instanceof Error
                  ? error.message
                  : "Something went wrong. Please try again."}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={isRefetching}
                onPress={() => refetch()}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>
                  {isRefetching ? "Retrying…" : "Retry"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {data ? (
            <View style={styles.stack}>
              <StatusRow
                label="Currencies"
                value={String(data.currencies.length)}
              />
              <StatusRow
                label="Delivery zones"
                value={String(data.checkout.zones.length)}
              />
              <StatusRow
                label="Contact email"
                value={data.contact.email || "Not set"}
              />
              <StatusRow
                label="Contact phone"
                value={data.contact.phone || "Not set"}
              />
              <StatusRow label="API host" value={apiHost()} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
    marginBottom: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    color: palette.muted,
    fontSize: 14,
  },
  statusValue: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: spacing.md,
  },
  mutedText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: "700",
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
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
