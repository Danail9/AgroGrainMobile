import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius } from "@/theme/tokens";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type TabItem = { key: string; label: string; content: ReactNode };

/** In-screen segmented tabs, a port of the portal's `components/tabs.tsx`. */
export function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(items[0]?.key);
  const current = items.find((item) => item.key === active) ?? items[0];

  return (
    <View style={{ gap: 14 }}>
      <View accessibilityRole="tablist" style={styles.row}>
        {items.map((item) => {
          const selected = item.key === current?.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActive(item.key)}
              style={({ pressed }) => [
                styles.tab,
                selected && styles.tabSelected,
                pressed && pressedStyle,
              ]}
            >
              <AppText
                variant="small"
                bold
                numberOfLines={1}
                style={{ color: selected ? colors.white : colors.muted }}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View key={current?.key}>{current?.content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabSelected: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
});
