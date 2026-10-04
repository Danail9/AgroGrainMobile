import { Platform, type ViewStyle } from "react-native";

/**
 * Design tokens, copied value-for-value from the portal's `app/globals.css`
 * `@theme` block so the app and the web look like one product.
 */
export const colors = {
  brand: {
    50: "#eef7f0",
    100: "#d6ecdb",
    200: "#b0dcbb",
    300: "#7fc593",
    400: "#4da96c",
    500: "#2f8f4f",
    600: "#22733e",
    700: "#1b5c32",
    800: "#164a29",
    900: "#123c22",
  },
  surface: "#ffffff",
  canvas: "#f3f5f2",
  ink: "#12200f",
  muted: "#6b7864",
  line: "#e6ebe3",
  soft: "#f4f7f2",
  up: "#16a34a",
  down: "#dc2626",
  warn: "#d97706",
  // Tailwind palette values the portal uses for weather and status accents.
  sky: "#0ea5e9",
  slate: "#64748b",
  amber50: "#fffbeb",
  amber700: "#b45309",
  red50: "#fef2f2",
  red600: "#dc2626",
  white: "#ffffff",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  hero: 30,
} as const;

/** The portal's `shadow-card`, translated to each platform's shadow model. */
export const shadowCard: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 2 },
})!;

/** The Android status bar and splash colour used by the portal's native shell. */
export const brandBar = colors.brand[700];
