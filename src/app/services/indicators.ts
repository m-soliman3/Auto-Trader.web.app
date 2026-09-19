/**
 * The handful of indicator functions the strategy explainer charts draw.
 *
 * These are deliberately the same formulas the chart generator
 * (`scripts/generate-strategy-charts.mjs`) uses to place the entry/exit markers,
 * so a line drawn here always agrees with the marker sitting on it.
 *
 * All of them return a value for every input index — early indices use a partial
 * window rather than `null`, which keeps the drawn line unbroken.
 */

/** Exponential moving average, seeded with the first value. */
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  return values.map((v, i) => (prev = i === 0 ? v : v * k + prev * (1 - k)));
}

/** Simple moving average over a trailing window. */
export function sma(values: number[], period: number): number[] {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - period + 1), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
}

/** Population standard deviation over the same trailing window as `sma`. */
export function stdev(values: number[], period: number): number[] {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - period + 1), i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
  });
}

/**
 * Session VWAP — the running average price since the session opened.
 *
 * The illustrative series carry no volume, so every bar is weighted equally;
 * with equal volume per bar that is exactly what VWAP reduces to.
 */
export function vwap(values: number[]): number[] {
  let sum = 0;
  return values.map((v, i) => (sum += v) / (i + 1));
}

/** Bollinger Bands: a `period` SMA with ±`mult` standard deviations around it. */
export function bollinger(
  values: number[],
  period: number,
  mult = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const sd = stdev(values, period);
  return {
    middle,
    upper: middle.map((m, i) => m + mult * sd[i]),
    lower: middle.map((m, i) => m - mult * sd[i]),
  };
}
