import Svg, { Path } from "react-native-svg";

const CATEGORY_PATHS: Record<string, string> = {
  MILL: "M12 22V3 M12 8C7 8 5 5 5 2C9 2 12 4 12 8Z M12 13C7 13 5 10 5 7C9 7 12 9 12 13Z M12 18C7 18 5 15 5 12C9 12 12 14 12 18Z M12 10C17 10 19 7 19 4C15 4 12 6 12 10Z M12 15C17 15 19 12 19 9C15 9 12 11 12 15Z",
  OIL_MILL: "M12 2C10 6 5 11 5 15A7 7 0 0 0 19 15C19 11 14 6 12 2Z M8 15C8 18 10 19 12 19",
  FEED_PLANT: "M3 21V11L9 7V11L15 7V13H21V21Z M17 13V3H20V13 M6 16H8 M11 16H13 M16 16H18",
  BREWERY: "M5 8H17V21H5Z M17 10H20C23 10 23 17 20 17H17 M5 8C2 5 5 2 8 4C9 1 14 1 15 4C19 2 21 6 17 8 M9 11V18 M13 11V18",
  PORT_TERMINAL: "M12 6V21 M9 4A3 3 0 1 0 15 4A3 3 0 1 0 9 4 M6 10H18 M3 14C3 19 7 22 12 22C17 22 21 19 21 14 M3 14L1 17 M21 14L23 17",
};
const FALLBACK = "M3 8L12 3L21 8V18L12 23L3 18Z M3 8L12 13L21 8 M12 13V23";

export function LogisticsCategoryIcon({ type, color, size = 24 }: { type?: string; color: string; size?: number }) {
  const category = type && CATEGORY_PATHS[type] ? type : "OTHER";
  return <Svg testID={`category-icon-${category}`} width={size} height={size} viewBox="0 0 24 24"
    accessible={false}>
    <Path d={CATEGORY_PATHS[category] ?? FALLBACK} fill="none" stroke={color} strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
