import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { palette, radius, spacing } from "@/lib/theme";

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  message: string;
};

export function PlaceholderScreen({
  title,
  subtitle,
  message,
}: PlaceholderScreenProps) {
  return (
    <Screen title={title} subtitle={subtitle}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming soon</Text>
          <Text style={styles.cardText}>{message}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
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
  cardText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
});
