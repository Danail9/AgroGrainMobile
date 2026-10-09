import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { colors, fontSize } from "@/theme/tokens";

export type Tone = "ink" | "muted" | "brand" | "danger" | "white" | "up" | "down" | "warn";
export type Variant = "hero" | "title" | "heading" | "body" | "small" | "caption";

const TONE: Record<Tone, string> = {
  ink: colors.ink,
  muted: colors.muted,
  brand: colors.brand[600],
  danger: colors.red600,
  white: colors.white,
  up: colors.up,
  down: colors.down,
  warn: colors.amber700,
};

const VARIANT: Record<Variant, TextStyle> = {
  hero: { fontSize: fontSize.hero, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: fontSize.xxl, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: fontSize.md, fontWeight: "700", letterSpacing: -0.1 },
  body: { fontSize: fontSize.md, fontWeight: "400" },
  small: { fontSize: fontSize.sm, fontWeight: "400" },
  caption: { fontSize: fontSize.xs, fontWeight: "400" },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  bold?: boolean;
  /** Fixed-width digits, so prices and temperatures line up in a column. */
  numeric?: boolean;
  align?: TextStyle["textAlign"];
};

export function AppText({
  variant = "body",
  tone = "ink",
  bold,
  numeric,
  align,
  style,
  ...props
}: AppTextProps) {
  return (
    <RNText
      {...props}
      style={[
        VARIANT[variant],
        { color: TONE[tone] },
        bold && { fontWeight: "700" },
        numeric && { fontVariant: ["tabular-nums"] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
