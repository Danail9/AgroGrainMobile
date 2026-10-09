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

export type DatedPrice = { date: string; price: number };

export type ComparisonGeometry = ChartGeometry & {
  /** Last year's series on the same axes, or null when there is too little of it. */
  compareLine: string | null;
};

/**
 * Like `buildChart`, but places points by date and shares one price scale with
 * a comparison series (last year, already shifted onto this year's dates), so
 * gaps in recording and the two lines stay honest relative to each other.
 */
export function buildComparisonChart(
  series: DatedPrice[],
  compare: DatedPrice[],
  width: number,
  height: number = CHART_HEIGHT,
): ComparisonGeometry | null {
  if (series.length < 2 || width <= 0) return null;

  const time = (point: DatedPrice) => new Date(point.date).getTime();
  const start = time(series[0]);
  const end = time(series[series.length - 1]);
  // Only the part of last year that overlaps this year's window is drawn.
  const overlap = compare.filter((point) => time(point) >= start && time(point) <= end);
  const prices = [...series, ...overlap].map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || max * 0.05 || 1;
  const range = end - start || 1;
  const innerWidth = width - PADDING_X * 2;

  const project = (point: DatedPrice) => ({
    x: PADDING_X + ((time(point) - start) / range) * innerWidth,
    y: height - PADDING_Y - ((point.price - min) / span) * (height - PADDING_Y * 2),
  });
  const path = (coords: { x: number; y: number }[]) =>
    coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`).join(" ");

  const coords = series.map(project);
  const line = path(coords);
  const last = coords[coords.length - 1];

  return {
    line,
    area: `${line} L${last.x},${height} L${coords[0].x},${height} Z`,
    end: last,
    min,
    max,
    rising: series[series.length - 1].price >= series[0].price,
    compareLine: overlap.length >= 2 ? path(overlap.map(project)) : null,
  };
}

/** Change from last year's price nearest to the latest date, in percent. */
/** True when last year has at least two points inside this window, i.e. a line to draw. */
export function canCompare(series: DatedPrice[], compare: DatedPrice[] | undefined) {
  if (series.length < 2 || !compare?.length) return false;
  const start = new Date(series[0].date).getTime();
  const end = new Date(series[series.length - 1].date).getTime();
  let inside = 0;
  for (const point of compare) {
    const time = new Date(point.date).getTime();
    if (time >= start && time <= end && ++inside >= 2) return true;
  }
  return false;
}

export function yearOverYear(series: DatedPrice[], previousYear: DatedPrice[]) {
  const latest = series[series.length - 1];
  if (!latest || !previousYear.length) return null;
  const target = new Date(latest.date).getTime();
  let closest = previousYear[0];
  for (const point of previousYear) {
    if (Math.abs(new Date(point.date).getTime() - target) < Math.abs(new Date(closest.date).getTime() - target)) {
      closest = point;
    }
  }
  // A match more than two weeks away is not a like-for-like comparison.
  if (Math.abs(new Date(closest.date).getTime() - target) > 14 * 86_400_000 || !closest.price) return null;
  return ((latest.price - closest.price) / closest.price) * 100;
}
