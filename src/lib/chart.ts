export const CHART_HEIGHT = 112;
const PADDING_Y = 12;
// Keeps the end marker fully inside the box at any width.
const PADDING_X = 6;

export type ChartGeometry = {
  line: string;
  area: string;
  end: { x: number; y: number };
  min: number;
  max: number;
  rising: boolean;
};

/**
 * Sparkline geometry for a price series, ported from the portal's
 * `components/price-chart.tsx`. Pure arithmetic, so it is tested without a
 * renderer and the mobile chart cannot drift from the web one.
 *
 * Returns `null` below two points: a single price is not a trend.
 */
export function buildChart(
  prices: number[],
  width: number,
  height: number = CHART_HEIGHT,
): ChartGeometry | null {
  if (prices.length < 2 || width <= 0) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // A flat series would divide by zero, so keep a nominal band around the value.
  const span = max - min || max * 0.05 || 1;

  const innerWidth = width - PADDING_X * 2;
  const coords = prices.map((price, index) => ({
    x: PADDING_X + (index / (prices.length - 1)) * innerWidth,
    y: height - PADDING_Y - ((price - min) / span) * (height - PADDING_Y * 2),
  }));

  const line = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L${last.x},${height} L${coords[0].x},${height} Z`;

  return {
    line,
    area,
    end: last,
    min,
    max,
    rising: prices[prices.length - 1] >= prices[0],
  };
}
