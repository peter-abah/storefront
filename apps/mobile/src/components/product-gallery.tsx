import type { ProductImage } from "@maison/shared";
import { useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { palette, spacing } from "@/lib/theme";

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = Math.round(width * 0.9);

  if (images.length === 0) {
    return (
      <View style={[styles.fallback, { height, width }]}>
        <Text style={styles.fallbackText}>Photography to come</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={images}
        getItemLayout={(_, i) => ({ index: i, length: width, offset: width * i })}
        horizontal
        keyExtractor={(item, i) => `${item.url}-${i}`}
        onMomentumScrollEnd={(event) => {
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
        }}
        pagingEnabled
        renderItem={({ item, index: i }) => (
          <Image
            accessibilityLabel={`${name} — image ${i + 1}`}
            resizeMode="cover"
            source={{ uri: item.url }}
            style={{ height, width }}
          />
        )}
        showsHorizontalScrollIndicator={false}
      />
      {images.length > 1 ? (
        <View pointerEvents="none" style={styles.dots}>
          {images.map((image, i) => (
            <View
              key={`${image.url}-dot-${i}`}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: palette.surface,
    justifyContent: "center",
  },
  fallbackText: {
    color: palette.muted,
    fontSize: 14,
  },
  dots: {
    bottom: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  dot: {
    backgroundColor: palette.surface,
    borderRadius: 4,
    height: 8,
    opacity: 0.55,
    width: 8,
  },
  dotActive: {
    backgroundColor: palette.bronze,
    opacity: 1,
  },
});
