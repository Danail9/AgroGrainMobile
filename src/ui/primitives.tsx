import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { formatPercent } from "@/lib/format";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

/* -------------------------------------------------------------- containers */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

/** A card whose rows are separated by hairlines, like the portal's `divide-y`. */
export function RowList({ children }: { children: ReactNode }) {
  return <View style={[styles.card, styles.rowList]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SectionHeader({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: Href;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" style={{ flex: 1 }}>
        {title}
      </AppText>
      {action && href ? (
        <Pressable onPress={() => router.push(href)} hitSlop={8} accessibilityRole="link">
          <AppText variant="small" tone="brand" bold>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="small" tone="muted" align="center" style={{ marginTop: 4 }}>
        {description}
      </AppText>
    </Card>
  );
}

/* ------------------------------------------------------------- small bits */

/** Day-over-day change; a neutral dash when there is nothing to compare. */
export function ChangeBadge({
  value,
  variant = "pill",
}: {
  value: number | null;
  variant?: "pill" | "plain";
}) {
  if (value === null) {
    return (
      <AppText variant="small" tone="muted" bold numeric>
        –
      </AppText>
    );
  }

  const up = value >= 0;
  const tone = up ? "up" : "down";

  if (variant === "plain") {
    return (
      <AppText variant="small" tone={tone} bold numeric>
        {up ? "↑" : "↓"} {formatPercent(value)}
      </AppText>
    );
  }

  return (
    <View style={[styles.changePill, { backgroundColor: up ? "#ecfdf5" : colors.red50 }]}>
      <Icon name={up ? "trending-up" : "trending-down"} size={12} color={up ? colors.up : colors.down} />
      <AppText variant="caption" tone={tone} bold numeric>
        {formatPercent(value)}
      </AppText>
    </View>
  );
}

type TileTone = "neutral" | "brand" | "solid" | "warn" | "sky";

const TILE: Record<TileTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.soft, fg: colors.ink },
  brand: { bg: colors.brand[50], fg: colors.brand[700] },
  solid: { bg: colors.brand[600], fg: colors.white },
  warn: { bg: colors.amber50, fg: colors.amber700 },
  sky: { bg: "#f0f9ff", fg: "#0369a1" },
};

const TILE_SIZE = { sm: 32, md: 40, lg: 48 } as const;

/** Rounded container for an icon or emoji. */
export function IconTile({
  children,
  tone = "neutral",
  size = "md",
}: {
  children: ReactNode;
  tone?: TileTone;
  size?: keyof typeof TILE_SIZE;
}) {
  const box = TILE_SIZE[size];
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: size === "lg" ? radius.lg : radius.md,
        backgroundColor: TILE[tone].bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** The foreground colour an icon should take on a given tile tone. */
export const tileColor = (tone: TileTone) => TILE[tone].fg;

export function StatChip({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.statChip}>
      {icon}
      <AppText variant="small" bold numeric>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

type PillTone = "neutral" | "brand" | "warn" | "danger" | "sky";

const PILL: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.soft, fg: colors.muted },
  brand: { bg: colors.brand[50], fg: colors.brand[700] },
  warn: { bg: colors.amber50, fg: colors.amber700 },
  danger: { bg: colors.red50, fg: colors.red600 },
  sky: { bg: "#f0f9ff", fg: "#0369a1" },
};

export function Pill({ children, tone = "neutral" }: { children: string; tone?: PillTone }) {
  return (
    <View style={[styles.pill, { backgroundColor: PILL[tone].bg }]}>
      <AppText variant="caption" bold style={{ color: PILL[tone].fg }}>
        {children}
      </AppText>
    </View>
  );
}

/** Red unread counter capped at "9+" so the badge keeps a fixed width. */
export function UnreadBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <View style={styles.unread}>
      <AppText variant="caption" tone="white" bold style={{ fontSize: 10, lineHeight: 14 }}>
        {count > 9 ? "9+" : String(count)}
      </AppText>
    </View>
  );
}

/** Grain sample analysis chips; nothing when the seller declared none. */
export function SampleSpecs({
  hectolitre,
  protein,
  gluten,
}: {
  hectolitre: number | null;
  protein: number | null;
  gluten: number | null;
}) {
  const specs = [
    { label: "Хектолитър", value: hectolitre, unit: " кг/хл" },
    { label: "Протеин", value: protein, unit: "%" },
    { label: "Глутен", value: gluten, unit: "%" },
  ].filter((spec) => spec.value !== null);

  if (!specs.length) return null;

  return (
    <View style={styles.specs}>
      {specs.map((spec) => (
        <View key={spec.label} style={styles.spec}>
          <AppText variant="caption" tone="muted">
            {spec.label}{" "}
            <AppText variant="caption" bold numeric>
              {spec.value}
              {spec.unit}
            </AppText>
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Horizontal bars sized relative to the largest value. */
export function BarList({
  rows,
  unit,
}: {
  rows: { label: string; value: number }[];
  unit: string;
}) {
  if (!rows.length) {
    return (
      <AppText variant="small" tone="muted" align="center" style={{ padding: space.xl }}>
        Няма данни за периода.
      </AppText>
    );
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <View>
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <Divider /> : null}
          <View style={{ padding: space.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <AppText variant="small" bold style={{ flex: 1 }} numberOfLines={1}>
                {row.label}
              </AppText>
              <AppText variant="small" bold numeric>
                {row.value} {unit}
              </AppText>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${Math.round((row.value / max) * 100)}%` }]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A tappable card row with a chevron, like the portal's `LinkRow`. */
export function LinkRow({
  href,
  title,
  subtitle,
  icon,
  tone = "neutral",
  onPress,
}: {
  href?: Href;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: "neutral" | "brand" | "warn";
  onPress?: () => void;
}) {
  const border = tone === "brand" ? colors.brand[200] : tone === "warn" ? "#fde68a" : colors.line;
  const bg = tone === "brand" ? colors.brand[50] : tone === "warn" ? colors.amber50 : colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (onPress ? onPress() : href ? router.push(href) : undefined)}
      style={({ pressed }) => [
        styles.linkRow,
        { borderColor: border, backgroundColor: bg },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <AppText variant="small" bold>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export const pressedStyle = { opacity: 0.7 } as const;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadowCard,
  },
  cardPadded: { padding: space.lg },
  rowList: { overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: 10,
  },
  changePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.soft,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unread: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  specs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  spec: {
    backgroundColor: colors.soft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.soft,
  },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.brand[500] },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    ...shadowCard,
  },
  pressed: pressedStyle,
});
