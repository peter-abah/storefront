import { StyleSheet, Text, View } from "react-native";

import { orderStatusLabel, orderStatusTone } from "@/lib/order-status";
import { fontStyles, palette, radius, spacing } from "@/lib/theme";

const TONE_STYLES: Record<
  ReturnType<typeof orderStatusTone>,
  { bg: string; text: string }
> = {
  progress: { bg: palette.paper, text: palette.bronze },
  done: { bg: "#E8F0E9", text: palette.success },
  attention: { bg: "#F6E4E1", text: palette.danger },
  neutral: { bg: palette.paper, text: palette.muted },
};

export function OrderStatusPill({ status }: { status: string }) {
  const tone = TONE_STYLES[orderStatusTone(status)];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.text }]}>
        {orderStatusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  text: {
    ...fontStyles.bodySemiBold,
    fontSize: 12,
  },
});
