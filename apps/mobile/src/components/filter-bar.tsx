import type {
  Category,
  FilterMetaDTO,
  ProductSort,
  Room,
} from "@maison/shared";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { fontStyles, palette, radius, spacing } from "@/lib/theme";

export type CatalogFilters = {
  q: string;
  room: Room | null;
  category: Category | null;
  inStock: boolean;
  sort: ProductSort;
  minPriceCents: number | null;
  maxPriceCents: number | null;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  room: null,
  category: null,
  inStock: false,
  sort: "featured",
  minPriceCents: null,
  maxPriceCents: null,
};

const SORTS: ProductSort[] = ["featured", "newest", "price_asc", "price_desc"];

const SORT_LABELS: Record<ProductSort, string> = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
};

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseCents(input: string): number | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

export function FilterBar({
  value,
  meta,
  onChange,
}: {
  value: CatalogFilters;
  meta?: FilterMetaDTO;
  onChange: (next: CatalogFilters) => void;
}) {
  const [search, setSearch] = useState(value.q);
  const [priceOpen, setPriceOpen] = useState(false);
  const [minInput, setMinInput] = useState(
    value.minPriceCents === null ? "" : String(value.minPriceCents),
  );
  const [maxInput, setMaxInput] = useState(
    value.maxPriceCents === null ? "" : String(value.maxPriceCents),
  );

  useEffect(() => {
    setSearch(value.q);
  }, [value.q]);

  useEffect(() => {
    setMinInput(value.minPriceCents === null ? "" : String(value.minPriceCents));
    setMaxInput(value.maxPriceCents === null ? "" : String(value.maxPriceCents));
  }, [value.minPriceCents, value.maxPriceCents]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== value.q) onChange({ ...value, q: search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  const priceActive = value.minPriceCents !== null || value.maxPriceCents !== null;
  const active =
    value.q !== "" ||
    value.room !== null ||
    value.category !== null ||
    value.inStock ||
    value.sort !== DEFAULT_FILTERS.sort ||
    priceActive;

  const applyPrice = () => {
    let min = parseCents(minInput);
    let max = parseCents(maxInput);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    onChange({ ...value, minPriceCents: min, maxPriceCents: max });
  };

  const clearPrice = () => {
    setMinInput("");
    setMaxInput("");
    onChange({ ...value, minPriceCents: null, maxPriceCents: null });
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        accessibilityLabel="Search products"
        autoCorrect={false}
        onChangeText={setSearch}
        placeholder="Search pieces…"
        placeholderTextColor={palette.muted}
        returnKeyType="search"
        style={styles.search}
        value={search}
      />

      {meta && meta.rooms.length > 0 ? (
        <ChipRow
          allLabel="All rooms"
          onSelect={(room) =>
            onChange({
              ...value,
              room: room === "" || room === value.room ? null : (room as Room),
            })
          }
          options={meta.rooms.map((room) => ({ value: room, label: label(room) }))}
          selected={value.room}
        />
      ) : null}

      {meta && meta.categories.length > 0 ? (
        <ChipRow
          allLabel="All categories"
          onSelect={(category) =>
            onChange({
              ...value,
              category:
                category === "" || category === value.category
                  ? null
                  : (category as Category),
            })
          }
          options={meta.categories.map((category) => ({
            value: category,
            label: label(category),
          }))}
          selected={value.category}
        />
      ) : null}

      <ChipRow
        allLabel={null}
        onSelect={(sort) => onChange({ ...value, sort: sort as ProductSort })}
        options={SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort] }))}
        selected={value.sort}
      />

      <View style={styles.controls}>
        <Chip
          label="In stock"
          onPress={() => onChange({ ...value, inStock: !value.inStock })}
          selected={value.inStock}
        />
        <Chip
          label={priceActive ? "Price ▴" : "Price ▾"}
          onPress={() => setPriceOpen((open) => !open)}
          selected={priceActive}
        />
        {active ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(DEFAULT_FILTERS)}
            style={styles.reset}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {priceOpen ? (
        <View style={styles.pricePanel}>
          <Text style={styles.priceHint}>
            Price range in base cents (kobo) — e.g. 50000 = ₦500.00
          </Text>
          <View style={styles.priceRow}>
            <TextInput
              accessibilityLabel="Minimum price in base cents"
              keyboardType="number-pad"
              onChangeText={setMinInput}
              placeholder="Min"
              placeholderTextColor={palette.muted}
              style={styles.priceInput}
              value={minInput}
            />
            <Text style={styles.priceDash}>–</Text>
            <TextInput
              accessibilityLabel="Maximum price in base cents"
              keyboardType="number-pad"
              onChangeText={setMaxInput}
              placeholder="Max"
              placeholderTextColor={palette.muted}
              style={styles.priceInput}
              value={maxInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={applyPrice}
              style={({ pressed }) => [styles.apply, pressed && styles.pressed]}
            >
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={clearPrice}>
            <Text style={styles.clearText}>Clear price</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
  allLabel,
}: {
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  allLabel: string | null;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.chipRow}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {allLabel ? (
        <Chip
          label={allLabel}
          onPress={() => onSelect("")}
          selected={selected === null}
        />
      ) : null}
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          onPress={() => onSelect(option.value)}
          selected={selected === option.value}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label: text,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  search: {
    ...fontStyles.body,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: palette.surface,
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
    color: palette.onBronze,
    ...fontStyles.bodySemiBold,
  },
  pressed: {
    opacity: 0.85,
  },
  reset: {
    marginLeft: "auto",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  resetText: {
    ...fontStyles.bodySemiBold,
    color: palette.bronze,
    fontSize: 13,
  },
  pricePanel: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  priceHint: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  priceInput: {
    ...fontStyles.body,
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  priceDash: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 14,
  },
  apply: {
    backgroundColor: palette.bronze,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  applyText: {
    ...fontStyles.bodyBold,
    color: palette.onBronze,
    fontSize: 13,
  },
  clearText: {
    ...fontStyles.body,
    color: palette.muted,
    fontSize: 13,
    paddingVertical: 2,
  },
});
