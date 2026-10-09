import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

/** A titled card of settings rows, like the grouped lists in iOS Settings. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {title ? (
        <AppText variant="caption" tone="muted" bold style={styles.groupTitle}>
          {title}
        </AppText>
      ) : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

/**
 * One row: icon, title and a one-line summary of the current value. With
 * `children` it expands in place to show its form; otherwise it runs `onPress`.
 */
export function SettingsRow({
  icon,
  title,
  summary,
  open = false,
  onPress,
  danger = false,
  first = false,
  children,
}: {
  icon: IconName;
  title: string;
  summary?: string;
  open?: boolean;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
  children?: ReactNode;
}) {
  const expandable = children !== undefined;
  const tint = danger ? colors.red600 : colors.brand[600];

  return (
    <View style={[!first && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        accessibilityState={expandable ? { expanded: open } : undefined}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && pressedStyle]}
      >
        <View style={[styles.icon, { backgroundColor: danger ? colors.red50 : colors.brand[50] }]}>
          <Icon name={icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" bold style={danger ? { color: colors.red600 } : undefined}>
            {title}
          </AppText>
          {summary ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
        </View>
        <Icon
          name={expandable ? (open ? "chevron-up" : "chevron-down") : "chevron-forward"}
          size={18}
          color={colors.muted}
        />
      </Pressable>
      {expandable && open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 4 },
  group: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: "hidden",
    ...shadowCard,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: 60,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
});
