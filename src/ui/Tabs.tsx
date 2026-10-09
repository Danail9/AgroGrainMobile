import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, shadowCard } from "@/theme/tokens";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type TabItem = {
  key: string;
  label: string;
  content: ReactNode;
  /** Shown as a small count next to the label; hidden when 0 or missing. */
  count?: number;
};

/**
 * In-screen tabs, a port of the portal's `components/tabs.tsx`. `segmented`
 * keeps every tab on one row in an iOS-style track instead of wrapping pills.
 */
export function Tabs({
  items,
  variant = "pills",
  onChange,
  initial,
}: {
  items: TabItem[];
  variant?: "pills" | "segmented";
  onChange?: (key: string) => void;
  /** Key of the tab to open first; unknown keys fall back to the first tab. */
  initial?: string;
}) {
  const [active, setActive] = useState(initial ?? items[0]?.key);
  const current = items.find((item) => item.key === active) ?? items[0];
  const segmented = variant === "segmented";

  return (
    <View style={{ gap: 14 }}>
      <View accessibilityRole="tablist" style={segmented ? styles.track : styles.row}>
        {items.map((item) => {
          const selected = item.key === current?.key;
          const color = segmented
            ? selected ? colors.brand[700] : colors.muted
            : selected ? colors.white : colors.muted;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.count ? `${item.label}, ${item.count}` : item.label}
              onPress={() => {
                setActive(item.key);
                onChange?.(item.key);
              }}
              style={({ pressed }) => [
                segmented ? styles.segment : styles.tab,
                selected && (segmented ? styles.segmentSelected : styles.tabSelected),
                pressed && pressedStyle,
              ]}
            >
              <AppText
                variant="small"
                bold
                numberOfLines={1}
                adjustsFontSizeToFit={segmented}
                minimumFontScale={0.8}
                style={{ color, flexShrink: 1 }}
              >
                {item.label}
              </AppText>
              {item.count ? (
                <View
                  style={[
                    styles.count,
                    { backgroundColor: selected ? (segmented ? colors.brand[600] : colors.white) : colors.line },
                  ]}
                >
                  <AppText
                    variant="caption"
                    bold
                    numeric
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      color: selected ? (segmented ? colors.white : colors.brand[700]) : colors.muted,
                    }}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </AppText>
                </View>
              ) : null}
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabSelected: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  track: {
    flexDirection: "row",
    backgroundColor: colors.line,
    borderRadius: radius.lg,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.lg - 3,
    paddingHorizontal: 4,
    paddingVertical: 9,
  },
  segmentSelected: { backgroundColor: colors.white, ...shadowCard },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
});
