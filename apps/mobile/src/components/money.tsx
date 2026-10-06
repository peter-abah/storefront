import { Text, type StyleProp, type TextStyle } from "react-native";

import { useMoney } from "@/lib/currency";

export function Money({
  baseCents,
  style,
}: {
  baseCents: number;
  style?: StyleProp<TextStyle>;
}) {
  const format = useMoney();
  return <Text style={style}>{format(baseCents)}</Text>;
}
