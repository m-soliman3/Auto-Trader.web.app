/**
 * generate-hq-charts.mjs
 * Generates high-quality candlestick chart images for all 34 trading strategies.
 * Output:
 *   public/images/strategies/light/<slug>.png  (white background)
 *   public/images/strategies/dark/<slug>.png   (black background)
 *
 * Usage:
 *   node scripts/generate-hq-charts.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_LIGHT = resolve(ROOT, "public/images/strategies/light");
const OUT_DARK = resolve(ROOT, "public/images/strategies/dark");

// ── Canvas dimensions ────────────────────────────────────────────────────────
const W = 1200, H = 630;
const ML = 72, MR = 40, MT = 50, MB = 55; // margins
const CW = W - ML - MR; // chart width  = 1088
const CH = H - MT - MB; // chart height = 525

// ── Colour themes ────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0d1117", panelBg: "#161b22", grid: "#21262d",
  text: "#8b949e", label: "#e6edf3", border: "#30363d",
  bull: "#26a69a", bear: "#ef5350",
  ma1: "#f7cc50", ma2: "#5b9cf6", ma3: "#b57bff",
  band: "#5b9cf6", bandFill: "rgba(91,156,246,0.12)",
  rsiLine: "#f7cc50", rsiOB: "rgba(239,83,80,0.25)", rsiOS: "rgba(38,166,154,0.25)",
  macdLine: "#5b9cf6", signalLine: "#f7cc50", histUp: "#26a69a", histDown: "#ef5350",
  zone1: "rgba(38,166,154,0.18)", zone2: "rgba(239,83,80,0.18)",
  fib1: "#f7cc50", fib2: "#5b9cf6", fib3: "#b57bff",
  cloud1: "rgba(38,166,154,0.20)", cloud2: "rgba(239,83,80,0.20)",
  vol: "rgba(91,156,246,0.45)",
};
const LIGHT = {
  bg: "#ffffff", panelBg: "#f6f8fa", grid: "#e1e4e8",
  text: "#57606a", label: "#24292f", border: "#d0d7de",
  bull: "#089981", bear: "#f23645",
  ma1: "#d69e2e", ma2: "#2563eb", ma3: "#7c3aed",
  band: "#2563eb", bandFill: "rgba(37,99,235,0.08)",
  rsiLine: "#d69e2e", rsiOB: "rgba(242,54,69,0.15)", rsiOS: "rgba(8,153,129,0.15)",
  macdLine: "#2563eb", signalLine: "#d69e2e", histUp: "#089981", histDown: "#f23645",
  zone1: "rgba(8,153,129,0.14)", zone2: "rgba(242,54,69,0.14)",
  fib1: "#d69e2e", fib2: "#2563eb", fib3: "#7c3aed",
  cloud1: "rgba(8,153,129,0.18)", cloud2: "rgba(242,54,69,0.18)",
  vol: "rgba(37,99,235,0.35)",
};

// ── OHLCV data generator ─────────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateOHLCV(n, seed, { trend = 0.0003, vol = 0.018, startPrice = 150 } = {}) {
  const rand = seededRand(seed);
  const candles = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const move = (rand() - 0.49 + trend) * vol * price;
    const open = price;
    const close = price + move;
    const range = Math.abs(move) * (1 + rand() * 1.5);
    const high = Math.max(open, close) + range * rand() * 0.8;
    const low = Math.min(open, close) - range * rand() * 0.8;
    const volume = 500 + rand() * 1500 + Math.abs(move / price) * 5000;
    candles.push({ o: open, h: high, l: low, c: close, v: volume });
    price = close;
  }
  return candles;
}

// ── Indicator calculations ───────────────────────────────────────────────────
function sma(arr, period) {
  return arr.map((_, i) => i < period - 1 ? null : arr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period);
}

function ema(arr, period) {
  const k = 2 / (period + 1);
  const result = [];
  let prev = null;
  for (const v of arr) {
    if (prev === null) { result.push(v); prev = v; }
    else { const e = v * k + prev * (1 - k); result.push(e); prev = e; }
  }
  return result;
}

function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  return mid.map((m, i) => {
    if (m === null) return { mid: null, upper: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    return { mid: m, upper: m + mult * sd, lower: m - mult * sd };
  });
}

function rsi(closes, period = 14) {
  const gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const result = [null];
  let avgG = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgL = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result.push(...Array(period - 1).fill(null));
  result.push(100 - 100 / (1 + avgG / (avgL || 0.0001)));
  for (let i = period; i < gains.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
    result.push(100 - 100 / (1 + avgG / (avgL || 0.0001)));
  }
  return result;
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((m, i) => m - signalLine[i]);
  return { macdLine, signalLine, hist };
}

function atr(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.h - c.l;
    return Math.max(c.h - c.l, Math.abs(c.h - candles[i-1].c), Math.abs(c.l - candles[i-1].c));
  });
  return sma(tr, period);
}

// ── SVG helpers ──────────────────────────────────────────────────────────────
function px(x) { return (ML + x).toFixed(1); }
function py(y) { return (MT + y).toFixed(1); }

function scaleY(val, min, max, h = CH) { return h - ((val - min) / (max - min)) * h; }

function buildPolyline(vals, min, max, panelTop = 0, panelH = CH) {
  const pts = [];
  const step = CW / (vals.length - 1);
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === null) continue;
    const x = +px(i * step);
    const y = +(panelTop + MT + scaleY(vals[i], min, max, panelH)).toFixed(1);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
}

function priceRange(candles, pad = 0.08) {
  const lo = Math.min(...candles.map(c => c.l));
  const hi = Math.max(...candles.map(c => c.h));
  const pad_ = (hi - lo) * pad;
  return { min: lo - pad_, max: hi + pad_ };
}

// ── Candles SVG ──────────────────────────────────────────────────────────────
function candlesSvg(candles, min, max, t) {
  const step = CW / candles.length;
  const W_BODY = Math.max(2, step * 0.6);
  let svg = "";
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = ML + i * step + step / 2;
    const isBull = c.c >= c.o;
    const color = isBull ? t.bull : t.bear;
    const yH = MT + scaleY(c.h, min, max);
    const yL = MT + scaleY(c.l, min, max);
    const yO = MT + scaleY(c.o, min, max);
    const yC = MT + scaleY(c.c, min, max);
    const bodyTop = Math.min(yO, yC);
    const bodyH = Math.max(1.5, Math.abs(yO - yC));
    svg += `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${color}" stroke-width="1.2"/>`;
    svg += `<rect x="${(x - W_BODY / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${W_BODY.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${color}" rx="0.5"/>`;
  }
  return svg;
}

// ── Volume bars ──────────────────────────────────────────────────────────────
function volumeSvg(candles, panelTop, panelH, t) {
  const step = CW / candles.length;
  const maxVol = Math.max(...candles.map(c => c.v));
  let svg = "";
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = ML + i * step;
    const barH = (c.v / maxVol) * panelH;
    const color = c.c >= c.o ? t.bull : t.bear;
    svg += `<rect x="${x.toFixed(1)}" y="${(MT + panelTop + panelH - barH).toFixed(1)}" width="${(step * 0.8).toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" opacity="0.4"/>`;
  }
  return svg;
}

// ── Grid + axes ──────────────────────────────────────────────────────────────
function gridSvg(min, max, steps, t, panelTop = 0, panelH = CH) {
  let svg = "";
  for (let i = 0; i <= steps; i++) {
    const val = min + (max - min) * (i / steps);
    const y = MT + panelTop + scaleY(val, min, max, panelH);
    svg += `<line x1="${ML}" y1="${y.toFixed(1)}" x2="${(ML + CW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${t.grid}" stroke-width="0.7"/>`;
    svg += `<text x="${(ML - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">${val.toFixed(2)}</text>`;
  }
  return svg;
}

function timeAxisSvg(n, t) {
  let svg = "";
  const ticks = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const step = CW / n;
  for (let i = 0; i < ticks.length; i++) {
    const idx = ticks[i];
    const x = ML + idx * step + step / 2;
    const label = months[(i + 2) % 12] + " " + (24 + Math.floor(i * 3));
    svg += `<text x="${x.toFixed(1)}" y="${(H - 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">${label}</text>`;
  }
  return svg;
}

// ── Chart frame ──────────────────────────────────────────────────────────────
function frameSvg(t, title, subtitle = "") {
  return `
    <rect width="${W}" height="${H}" fill="${t.bg}"/>
    <rect x="${ML}" y="${MT}" width="${CW}" height="${CH}" fill="none" stroke="${t.border}" stroke-width="0.8"/>
    <text x="${ML}" y="28" font-size="15" font-weight="700" fill="${t.label}" font-family="'Inter','Segoe UI',sans-serif">${escXml(title)}</text>
    ${subtitle ? `<text x="${ML}" y="45" font-size="11" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">${escXml(subtitle)}</text>` : ""}
    <text x="${W - MR}" y="28" text-anchor="end" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">invest-begin.com</text>`;
}

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function legend(items, t) {
  let svg = "";
  let x = ML;
  const y = MT - 10;
  for (const { color, label } of items) {
    svg += `<line x1="${x}" y1="${y}" x2="${x + 18}" y2="${y}" stroke="${color}" stroke-width="2"/>`;
    svg += `<text x="${x + 22}" y="${y + 4}" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">${escXml(label)}</text>`;
    x += 22 + label.length * 6.5 + 12;
  }
  return svg;
}

// ── Strategy chart type map ──────────────────────────────────────────────────
// Types: MA2, BAND, RSI, MACD, ZONE, FIB, CLOUD, ATR, MULTI, RANGE, VOL_CHART
const STRAT = {
  "moving-average-crossover":  { type: "MA2",    p1: 20, p2: 50, title: "Moving Average Crossover", subtitle: "SMA 20 / SMA 50" },
  "fair-value-gap":            { type: "ZONE",   title: "Fair Value Gap Strategy", subtitle: "FVG zones highlighted" },
  "smart-money-concepts":      { type: "ZONE",   title: "Smart Money Concepts", subtitle: "Order blocks + liquidity" },
  "order-blocks":              { type: "ZONE",   title: "Order Blocks Strategy", subtitle: "Bullish & bearish order blocks" },
  "liquidity-sweeps":          { type: "SWEEP",  title: "Liquidity Sweeps", subtitle: "Stop hunt zones" },
  "breaker-blocks":            { type: "ZONE",   title: "Breaker Blocks Strategy", subtitle: "Broken order blocks flip" },
  "trend-following":           { type: "MA2",    p1: 50, p2: 200, title: "Trend Following Strategy", subtitle: "SMA 50 / SMA 200" },
  "mean-reversion":            { type: "BAND",   title: "Mean Reversion Strategy", subtitle: "Bollinger Bands mean reversion" },
  "breakout-strategy":         { type: "RANGE",  title: "Breakout Strategy", subtitle: "Support & resistance breakout" },
  "scalping-strategy":         { type: "MA2",    p1: 8, p2: 21, title: "Scalping Strategy", subtitle: "EMA 8 / EMA 21" },
  "swing-trading":             { type: "SWING",  title: "Swing Trading Strategy", subtitle: "Swing high / swing low" },
  "fibonacci-retracement":     { type: "FIB",    title: "Fibonacci Retracement", subtitle: "0.236 · 0.382 · 0.618 · 0.786" },
  "price-action-strategy":     { type: "PA",     title: "Price Action Strategy", subtitle: "Key levels & candlestick patterns" },
  "grid-trading":              { type: "GRID",   title: "Grid Trading Strategy", subtitle: "Equal-spaced grid levels" },
  "dollar-cost-averaging":     { type: "DCA",    title: "Dollar-Cost Averaging", subtitle: "Periodic buy entries" },
  "arbitrage-strategy":        { type: "ARB",    title: "Arbitrage Strategy", subtitle: "Correlated asset spread" },
  "supply-demand-zones":       { type: "ZONE",   title: "Supply & Demand Zones", subtitle: "Institutional supply & demand" },
  "wyckoff-method":            { type: "WYCK",   title: "Wyckoff Method", subtitle: "Accumulation · Markup · Distribution" },
  "elliott-wave":              { type: "ELLIOTT",title: "Elliott Wave Theory", subtitle: "5-wave impulse + 3-wave correction" },
  "position-trading":          { type: "MA2",    p1: 100, p2: 200, title: "Position Trading", subtitle: "SMA 100 / SMA 200" },
  "pairs-trading":             { type: "ARB",    title: "Pairs Trading", subtitle: "Mean-reverting price spread" },
  "momentum-trading":          { type: "RSI",    title: "Momentum Trading", subtitle: "RSI momentum filter" },
  "range-trading":             { type: "RANGE",  title: "Range Trading", subtitle: "Buy support · Sell resistance" },
  "news-trading":              { type: "NEWS",   title: "News Trading Strategy", subtitle: "Event-driven volatility spikes" },
  "harmonic-patterns":         { type: "FIB",    title: "Harmonic Patterns", subtitle: "Gartley · Bat · Butterfly · Crab" },
  "chart-patterns":            { type: "PA",     title: "Chart Patterns", subtitle: "H&S · Triangles · Double Top/Bottom" },
  "carry-trade":               { type: "ARB",    title: "Carry Trade Strategy", subtitle: "Interest rate differential" },
  "gap-trading":               { type: "GAP",    title: "Gap Trading Strategy", subtitle: "Open gaps & fill probability" },
  "triple-screen-strategy":    { type: "TRIPLE", title: "Triple Screen Strategy", subtitle: "Weekly · Daily · Intraday" },
  "volatility-trading":        { type: "ATR",    title: "Volatility Trading", subtitle: "ATR-based entries & stops" },
  "market-making-strategy":    { type: "RANGE",  title: "Market Making Strategy", subtitle: "Bid/ask spread capture" },
  "counter-trend-strategy":    { type: "RSI",    title: "Counter-Trend Strategy", subtitle: "RSI extremes reversal" },
  "machine-learning-strategy": { type: "BAND",   title: "Machine Learning Strategy", subtitle: "Prediction confidence band" },
  "rebalancing-strategy":      { type: "DCA",    title: "Rebalancing Strategy", subtitle: "Periodic portfolio rebalancing" },
};

// ── Renderers ─────────────────────────────────────────────────────────────────
function renderMA2(candles, cfg, t) {
  const closes = candles.map(c => c.c);
  const { min, max } = priceRange(candles);
  const fn = cfg.p1 <= 21 ? ema : sma;
  const m1 = fn(closes, cfg.p1);
  const m2 = fn(closes, cfg.p2 || 50);
  const step = CW / candles.length;

  const buildLine = (vals) => {
    const pts = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === null) continue;
      const x = ML + i * step + step / 2;
      const y = MT + scaleY(vals[i], min, max);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  return [
    gridSvg(min, max, 5, t),
    candlesSvg(candles, min, max, t),
    `<polyline points="${buildLine(m1)}" fill="none" stroke="${t.ma1}" stroke-width="1.8"/>`,
    `<polyline points="${buildLine(m2)}" fill="none" stroke="${t.ma2}" stroke-width="1.8"/>`,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma1, label: cfg.p1 <= 21 ? `EMA ${cfg.p1}` : `SMA ${cfg.p1}` }, { color: t.ma2, label: cfg.p1 <= 21 ? `EMA ${cfg.p2 || 50}` : `SMA ${cfg.p2 || 50}` }], t),
  ].join("");
}

function renderBAND(candles, cfg, t) {
  const closes = candles.map(c => c.c);
  const { min: rMin, max: rMax } = priceRange(candles);
  const bb = bollingerBands(closes, 20);
  const step = CW / candles.length;

  const buildBand = (key) => {
    const pts = [];
    for (let i = 0; i < bb.length; i++) {
      if (bb[i][key] === null) continue;
      const x = (ML + i * step + step / 2).toFixed(1);
      const y = (MT + scaleY(bb[i][key], rMin, rMax)).toFixed(1);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  const upperPts = bb.map((b, i) => b.upper === null ? null : `${(ML + i * step + step / 2).toFixed(1)},${(MT + scaleY(b.upper, rMin, rMax)).toFixed(1)}`).filter(Boolean);
  const lowerPts = bb.map((b, i) => b.lower === null ? null : `${(ML + i * step + step / 2).toFixed(1)},${(MT + scaleY(b.lower, rMin, rMax)).toFixed(1)}`).filter(Boolean);
  const fillPath = `M ${upperPts.join(" L ")} L ${[...lowerPts].reverse().join(" L ")} Z`;

  return [
    gridSvg(rMin, rMax, 5, t),
    `<path d="${fillPath}" fill="${t.bandFill}"/>`,
    candlesSvg(candles, rMin, rMax, t),
    `<polyline points="${buildBand("upper")}" fill="none" stroke="${t.band}" stroke-width="1.5" stroke-dasharray="5,3"/>`,
    `<polyline points="${buildBand("mid")}" fill="none" stroke="${t.ma1}" stroke-width="1.8"/>`,
    `<polyline points="${buildBand("lower")}" fill="none" stroke="${t.band}" stroke-width="1.5" stroke-dasharray="5,3"/>`,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma1, label: "BB Mid (SMA 20)" }, { color: t.band, label: "Upper/Lower Bands" }], t),
  ].join("");
}

function renderRSI(candles, cfg, t) {
  const MAIN_H = CH * 0.67;
  const RSI_GAP = 10;
  const RSI_H = CH - MAIN_H - RSI_GAP;
  const RSI_TOP = MAIN_H + RSI_GAP;

  const closes = candles.map(c => c.c);
  const { min, max } = priceRange(candles);
  const rsiVals = rsi(closes);
  const step = CW / candles.length;

  const buildRsiLine = () => {
    const pts = [];
    for (let i = 0; i < rsiVals.length; i++) {
      if (rsiVals[i] === null) continue;
      const x = (ML + i * step + step / 2).toFixed(1);
      const y = (MT + RSI_TOP + scaleY(rsiVals[i], 0, 100, RSI_H)).toFixed(1);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  const rsiOBY = (MT + RSI_TOP + scaleY(70, 0, 100, RSI_H)).toFixed(1);
  const rsiOSY = (MT + RSI_TOP + scaleY(30, 0, 100, RSI_H)).toFixed(1);
  const rsiBottomY = (MT + RSI_TOP + RSI_H).toFixed(1);

  return [
    gridSvg(min, max, 5, t, 0, MAIN_H),
    candlesSvg(candles, min, max, t),
    // RSI panel background
    `<rect x="${ML}" y="${(MT + RSI_TOP).toFixed(1)}" width="${CW}" height="${RSI_H}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.5"/>`,
    // RSI OB/OS zones
    `<rect x="${ML}" y="${rsiOBY}" width="${CW}" height="${(rsiBottomY - rsiOBY)}" fill="${t.rsiOB}"/>`,
    `<rect x="${ML}" y="${(MT + RSI_TOP).toFixed(1)}" width="${CW}" height="${(rsiOSY - MT - RSI_TOP)}" fill="${t.rsiOS}"/>`,
    // RSI level lines
    `<line x1="${ML}" y1="${rsiOBY}" x2="${ML + CW}" y2="${rsiOBY}" stroke="${t.bear}" stroke-width="0.8" stroke-dasharray="3,2"/>`,
    `<line x1="${ML}" y1="${rsiOSY}" x2="${ML + CW}" y2="${rsiOSY}" stroke="${t.bull}" stroke-width="0.8" stroke-dasharray="3,2"/>`,
    // RSI labels
    `<text x="${(ML - 4).toFixed(1)}" y="${(+rsiOBY + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">70</text>`,
    `<text x="${(ML - 4).toFixed(1)}" y="${(+rsiOSY + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">30</text>`,
    // RSI line
    `<polyline points="${buildRsiLine()}" fill="none" stroke="${t.rsiLine}" stroke-width="1.8"/>`,
    `<text x="${ML}" y="${(MT + RSI_TOP - 4).toFixed(1)}" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">RSI (14)</text>`,
    timeAxisSvg(candles.length, t),
  ].join("");
}

function renderMACD(candles, cfg, t) {
  const MAIN_H = CH * 0.65;
  const MACD_GAP = 10;
  const MACD_H = CH - MAIN_H - MACD_GAP;
  const MACD_TOP = MAIN_H + MACD_GAP;

  const closes = candles.map(c => c.c);
  const { min, max } = priceRange(candles);
  const { macdLine, signalLine, hist } = macd(closes);
  const step = CW / candles.length;

  const macdMin = Math.min(...hist, ...macdLine, ...signalLine);
  const macdMax = Math.max(...hist, ...macdLine, ...signalLine);

  const buildLine = (vals) => {
    const pts = [];
    for (let i = 0; i < vals.length; i++) {
      const x = (ML + i * step + step / 2).toFixed(1);
      const y = (MT + MACD_TOP + scaleY(vals[i], macdMin, macdMax, MACD_H)).toFixed(1);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  let histBars = "";
  const zeroY = MT + MACD_TOP + scaleY(0, macdMin, macdMax, MACD_H);
  for (let i = 0; i < hist.length; i++) {
    const x = ML + i * step;
    const y = MT + MACD_TOP + scaleY(hist[i], macdMin, macdMax, MACD_H);
    const color = hist[i] >= 0 ? t.histUp : t.histDown;
    histBars += `<rect x="${x.toFixed(1)}" y="${Math.min(y, zeroY).toFixed(1)}" width="${(step * 0.8).toFixed(1)}" height="${Math.abs(zeroY - y).toFixed(1)}" fill="${color}" opacity="0.7"/>`;
  }

  return [
    gridSvg(min, max, 5, t, 0, MAIN_H),
    candlesSvg(candles, min, max, t),
    `<rect x="${ML}" y="${(MT + MACD_TOP).toFixed(1)}" width="${CW}" height="${MACD_H}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.5"/>`,
    histBars,
    `<polyline points="${buildLine(macdLine)}" fill="none" stroke="${t.macdLine}" stroke-width="1.6"/>`,
    `<polyline points="${buildLine(signalLine)}" fill="none" stroke="${t.signalLine}" stroke-width="1.4" stroke-dasharray="4,2"/>`,
    `<text x="${ML}" y="${(MT + MACD_TOP - 4).toFixed(1)}" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">MACD (12,26,9)</text>`,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.macdLine, label: "MACD" }, { color: t.signalLine, label: "Signal" }], t),
  ].join("");
}

function renderZONE(candles, cfg, t) {
  const closes = candles.map(c => c.c);
  const { min, max } = priceRange(candles);
  const rand = seededRand(cfg.title.length * 7);
  const step = CW / candles.length;

  // Place 3-4 zone rectangles at swing points
  let zones = "";
  const numZones = 3 + Math.floor(rand() * 2);
  for (let z = 0; z < numZones; z++) {
    const idx = 5 + Math.floor(rand() * (candles.length - 10));
    const zoneH = (max - min) * (0.025 + rand() * 0.035);
    const zoneBase = candles[idx].c;
    const isBull = candles[idx].c > candles[idx].o;
    const x1 = ML + idx * step;
    const x2 = ML + CW;
    const y1 = MT + scaleY(zoneBase + zoneH, min, max);
    const y2 = MT + scaleY(zoneBase - zoneH, min, max);
    const color = isBull ? t.zone1 : t.zone2;
    zones += `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(y2 - y1).toFixed(1)}" fill="${color}" stroke="${isBull ? t.bull : t.bear}" stroke-width="0.6" stroke-dasharray="3,2"/>`;
  }

  return [
    gridSvg(min, max, 5, t),
    zones,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bull, label: "Demand Zone" }, { color: t.bear, label: "Supply Zone" }], t),
  ].join("");
}

function renderFIB(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const high = max, low = min;
  const range = high - low;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const colors = [t.fib1, t.fib2, t.fib3, t.ma1, t.fib3, t.fib2, t.fib1];

  let fibLines = "";
  for (let i = 0; i < levels.length; i++) {
    const price = low + range * (1 - levels[i]);
    const y = (MT + scaleY(price, min, max)).toFixed(1);
    fibLines += `<line x1="${ML}" y1="${y}" x2="${ML + CW}" y2="${y}" stroke="${colors[i]}" stroke-width="${i === 0 || i === levels.length - 1 ? 1.5 : 1}" stroke-dasharray="${i === 0 || i === levels.length - 1 ? "" : "4,3"}"/>`;
    fibLines += `<text x="${(ML + CW + 4).toFixed(1)}" y="${(+y + 4).toFixed(1)}" font-size="9" fill="${colors[i]}" font-family="'Inter','Segoe UI',sans-serif">${(levels[i] * 100).toFixed(1)}%</text>`;
  }

  return [
    gridSvg(min, max, 0, t),
    fibLines,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.fib1, label: "Fib 0% / 100%" }, { color: t.fib2, label: "Fib 23.6% / 78.6%" }, { color: t.fib3, label: "Fib 38.2% / 61.8%" }], t),
  ].join("");
}

function renderRANGE(candles, cfg, t) {
  const closes = candles.map(c => c.c);
  const { min, max } = priceRange(candles);
  const lookback = Math.floor(candles.length * 0.4);
  const resLevel = Math.max(...candles.slice(0, lookback).map(c => c.h));
  const supLevel = Math.min(...candles.slice(0, lookback).map(c => c.l));

  const resY = (MT + scaleY(resLevel, min, max)).toFixed(1);
  const supY = (MT + scaleY(supLevel, min, max)).toFixed(1);

  return [
    gridSvg(min, max, 5, t),
    `<rect x="${ML}" y="${resY}" width="${CW}" height="${(+supY - +resY)}" fill="${t.bandFill}"/>`,
    `<line x1="${ML}" y1="${resY}" x2="${ML + CW}" y2="${resY}" stroke="${t.bear}" stroke-width="2" stroke-dasharray="6,3"/>`,
    `<line x1="${ML}" y1="${supY}" x2="${ML + CW}" y2="${supY}" stroke="${t.bull}" stroke-width="2" stroke-dasharray="6,3"/>`,
    `<text x="${(ML + 6).toFixed(1)}" y="${(+resY - 5).toFixed(1)}" font-size="10" fill="${t.bear}" font-family="'Inter','Segoe UI',sans-serif">Resistance</text>`,
    `<text x="${(ML + 6).toFixed(1)}" y="${(+supY + 14).toFixed(1)}" font-size="10" fill="${t.bull}" font-family="'Inter','Segoe UI',sans-serif">Support</text>`,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
  ].join("");
}

function renderATR(candles, cfg, t) {
  const MAIN_H = CH * 0.67;
  const ATR_GAP = 10;
  const ATR_H = CH - MAIN_H - ATR_GAP;
  const ATR_TOP = MAIN_H + ATR_GAP;

  const { min, max } = priceRange(candles);
  const atrVals = atr(candles);
  const atrMin = 0;
  const atrMax = Math.max(...atrVals.filter(Boolean)) * 1.1;
  const step = CW / candles.length;

  const buildLine = (vals) => {
    const pts = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === null) continue;
      const x = (ML + i * step + step / 2).toFixed(1);
      const y = (MT + ATR_TOP + scaleY(vals[i], atrMin, atrMax, ATR_H)).toFixed(1);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  return [
    gridSvg(min, max, 5, t, 0, MAIN_H),
    candlesSvg(candles, min, max, t),
    `<rect x="${ML}" y="${(MT + ATR_TOP).toFixed(1)}" width="${CW}" height="${ATR_H}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.5"/>`,
    `<polyline points="${buildLine(atrVals)}" fill="none" stroke="${t.ma3}" stroke-width="1.8"/>`,
    `<text x="${ML}" y="${(MT + ATR_TOP - 4).toFixed(1)}" font-size="10" fill="${t.text}" font-family="'Inter','Segoe UI',sans-serif">ATR (14)</text>`,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma3, label: "ATR (14)" }], t),
  ].join("");
}

function renderARB(candles, cfg, t) {
  const closes1 = candles.map(c => c.c);
  const rand = seededRand(cfg.title.length * 13);
  // Generate correlated second series
  const closes2 = closes1.map(v => v * (0.7 + rand() * 0.08) + (rand() - 0.5) * 5);

  const allVals = [...closes1, ...closes2];
  const min = Math.min(...allVals) * 0.99;
  const max = Math.max(...allVals) * 1.01;
  const step = CW / closes1.length;

  const buildLine = (vals) => {
    return vals.map((v, i) => `${(ML + i * step + step / 2).toFixed(1)},${(MT + scaleY(v, min, max)).toFixed(1)}`).join(" ");
  };

  return [
    gridSvg(min, max, 5, t),
    `<polyline points="${buildLine(closes1)}" fill="none" stroke="${t.ma1}" stroke-width="1.8"/>`,
    `<polyline points="${buildLine(closes2)}" fill="none" stroke="${t.ma2}" stroke-width="1.8"/>`,
    timeAxisSvg(closes1.length, t),
    legend([{ color: t.ma1, label: "Asset A" }, { color: t.ma2, label: "Asset B (correlated)" }], t),
  ].join("");
}

function renderGRID(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const numLines = 7;
  let gridLines = "";
  for (let i = 0; i <= numLines; i++) {
    const price = min + (max - min) * (i / numLines);
    const y = (MT + scaleY(price, min, max)).toFixed(1);
    gridLines += `<line x1="${ML}" y1="${y}" x2="${ML + CW}" y2="${y}" stroke="${t.ma2}" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>`;
    gridLines += `<text x="${(ML - 4).toFixed(1)}" y="${(+y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="${t.ma2}" font-family="'Inter','Segoe UI',sans-serif">${price.toFixed(2)}</text>`;
  }
  return [
    gridSvg(min, max, 0, t),
    gridLines,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma2, label: "Grid Levels" }], t),
  ].join("");
}

function renderDCA(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const step = CW / candles.length;
  const entryInterval = Math.floor(candles.length / 8);

  let entries = "";
  for (let i = entryInterval; i < candles.length; i += entryInterval) {
    const x = (ML + i * step + step / 2).toFixed(1);
    const y = (MT + scaleY(candles[i].c, min, max)).toFixed(1);
    entries += `<line x1="${x}" y1="${MT + 5}" x2="${x}" y2="${H - MB - 5}" stroke="${t.bull}" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"/>`;
    entries += `<circle cx="${x}" cy="${y}" r="5" fill="${t.bull}" opacity="0.9"/>`;
    entries += `<text x="${x}" y="${(MT + 20).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.bull}" font-family="'Inter','Segoe UI',sans-serif">BUY</text>`;
  }

  return [
    gridSvg(min, max, 5, t),
    entries,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bull, label: "DCA Entry" }], t),
  ].join("");
}

function renderSWING(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const step = CW / candles.length;

  // Find swing highs and lows
  let swingMarkers = "";
  for (let i = 3; i < candles.length - 3; i++) {
    const isSwingHigh = candles[i].h > candles[i-1].h && candles[i].h > candles[i-2].h &&
                        candles[i].h > candles[i+1].h && candles[i].h > candles[i+2].h;
    const isSwingLow  = candles[i].l < candles[i-1].l && candles[i].l < candles[i-2].l &&
                        candles[i].l < candles[i+1].l && candles[i].l < candles[i+2].l;
    const x = (ML + i * step + step / 2).toFixed(1);
    if (isSwingHigh) {
      const y = (MT + scaleY(candles[i].h, min, max) - 8).toFixed(1);
      swingMarkers += `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="${t.bear}">▼</text>`;
    }
    if (isSwingLow) {
      const y = (MT + scaleY(candles[i].l, min, max) + 18).toFixed(1);
      swingMarkers += `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="${t.bull}">▲</text>`;
    }
  }

  return [
    gridSvg(min, max, 5, t),
    candlesSvg(candles, min, max, t),
    swingMarkers,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bull, label: "Swing Low" }, { color: t.bear, label: "Swing High" }], t),
  ].join("");
}

function renderPA(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const closes = candles.map(c => c.c);
  const m20 = sma(closes, 20);
  const step = CW / candles.length;

  const buildLine = (vals) => {
    const pts = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === null) continue;
      pts.push(`${(ML + i * step + step / 2).toFixed(1)},${(MT + scaleY(vals[i], min, max)).toFixed(1)}`);
    }
    return pts.join(" ");
  };

  return [
    gridSvg(min, max, 5, t),
    candlesSvg(candles, min, max, t),
    `<polyline points="${buildLine(m20)}" fill="none" stroke="${t.ma1}" stroke-width="1.6" stroke-dasharray="5,3"/>`,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma1, label: "SMA 20 (key level)" }], t),
  ].join("");
}

function renderWYCK(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const n = candles.length;
  const q = Math.floor(n / 4);

  // Label the four phases
  const phases = [
    { label: "Accumulation", x: ML + q * 0.5 * CW / n, color: t.bull },
    { label: "Markup", x: ML + q * 1.5 * CW / n, color: t.ma1 },
    { label: "Distribution", x: ML + q * 2.5 * CW / n, color: t.bear },
    { label: "Markdown", x: ML + q * 3.5 * CW / n, color: t.ma2 },
  ];

  let phaseLabels = "";
  for (const ph of phases) {
    phaseLabels += `<text x="${ph.x.toFixed(1)}" y="${(MT + 20).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${ph.color}" font-family="'Inter','Segoe UI',sans-serif">${ph.label}</text>`;
    phaseLabels += `<line x1="${ph.x.toFixed(1)}" y1="${(MT + 25).toFixed(1)}" x2="${ph.x.toFixed(1)}" y2="${(MT + CH).toFixed(1)}" stroke="${ph.color}" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.5"/>`;
  }

  return [
    gridSvg(min, max, 5, t),
    phaseLabels,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
  ].join("");
}

function renderELLIOTT(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const n = candles.length;
  const step = CW / n;

  // Place 5-wave impulse + 3-wave correction
  const wavePts = [0, 10, 20, 32, 44, 55, 63, 70, 77].map(p => Math.floor(p * n / 80));
  const waveLabels = ["0", "1", "2", "3", "4", "5", "A", "B", "C"];
  const waveColors = [t.ma2, t.bull, t.ma1, t.bull, t.ma1, t.bull, t.bear, t.bear, t.bear];

  let lines = "";
  let labels_ = "";
  for (let i = 1; i < wavePts.length; i++) {
    const x1 = (ML + wavePts[i-1] * step + step / 2).toFixed(1);
    const y1 = (MT + scaleY(candles[wavePts[i-1]].c, min, max)).toFixed(1);
    const x2 = (ML + wavePts[i] * step + step / 2).toFixed(1);
    const y2 = (MT + scaleY(candles[wavePts[i]].c, min, max)).toFixed(1);
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${waveColors[i]}" stroke-width="2"/>`;
  }
  for (let i = 0; i < wavePts.length; i++) {
    const x = (ML + wavePts[i] * step + step / 2).toFixed(1);
    const y = (MT + scaleY(candles[wavePts[i]].c, min, max) - 12).toFixed(1);
    labels_ += `<circle cx="${x}" cy="${(+y + 5).toFixed(1)}" r="10" fill="${waveColors[Math.min(i, waveColors.length-1)]}" opacity="0.9"/>`;
    labels_ += `<text x="${x}" y="${(+y + 9).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.bg}" font-family="'Inter','Segoe UI',sans-serif">${waveLabels[i]}</text>`;
  }

  return [
    gridSvg(min, max, 5, t),
    candlesSvg(candles, min, max, t),
    lines,
    labels_,
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bull, label: "Impulse Wave" }, { color: t.bear, label: "Corrective Wave" }], t),
  ].join("");
}

function renderNEWS(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const rand = seededRand(42);
  const step = CW / candles.length;

  const eventIdxs = [12, 28, 45, 60];
  let events = "";
  for (const idx of eventIdxs) {
    if (idx >= candles.length) continue;
    const x = (ML + idx * step + step / 2).toFixed(1);
    events += `<rect x="${(+x - 0.5).toFixed(1)}" y="${MT}" width="1" height="${CH}" fill="${t.ma1}" opacity="0.6"/>`;
    events += `<text x="${x}" y="${(MT + 15).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.ma1}" font-family="'Inter','Segoe UI',sans-serif">📰</text>`;
  }

  return [
    gridSvg(min, max, 5, t),
    events,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.ma1, label: "News Event" }], t),
  ].join("");
}

function renderGAP(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const step = CW / candles.length;

  // Find gaps between close[i] and open[i+1]
  let gaps = "";
  for (let i = 1; i < candles.length; i++) {
    const gapSize = Math.abs(candles[i].o - candles[i-1].c);
    if (gapSize > (max - min) * 0.018) {
      const x = (ML + i * step).toFixed(1);
      const y1 = (MT + scaleY(Math.max(candles[i].o, candles[i-1].c), min, max)).toFixed(1);
      const y2 = (MT + scaleY(Math.min(candles[i].o, candles[i-1].c), min, max)).toFixed(1);
      const color = candles[i].o > candles[i-1].c ? t.zone1 : t.zone2;
      gaps += `<rect x="${x}" y="${y1}" width="${(step * 3).toFixed(1)}" height="${(+y2 - +y1).toFixed(1)}" fill="${color}" stroke="${candles[i].o > candles[i-1].c ? t.bull : t.bear}" stroke-width="0.8" stroke-dasharray="3,2"/>`;
    }
  }

  return [
    gridSvg(min, max, 5, t),
    gaps,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bull, label: "Up Gap" }, { color: t.bear, label: "Down Gap" }], t),
  ].join("");
}

function renderTRIPLE(candles, cfg, t) {
  // Three side-by-side mini charts
  const n = candles.length;
  const panelW = Math.floor(CW / 3) - 8;
  const labels = ["Weekly Trend", "Daily Oscillator", "Intraday Entry"];
  const decimate = [3, 1, 0.5]; // different timeframe zoom levels
  const { min, max } = priceRange(candles);

  let svgContent = gridSvg(min, max, 5, t);

  for (let p = 0; p < 3; p++) {
    const pxOff = ML + p * (panelW + 12);
    const subset = candles.filter((_, i) => i % (p === 0 ? 3 : 1) === 0).slice(0, panelW > 80 ? 40 : 20);
    const pMin = Math.min(...subset.map(c => c.l)) * 0.995;
    const pMax = Math.max(...subset.map(c => c.h)) * 1.005;
    const pStep = panelW / subset.length;

    // mini frame
    svgContent += `<rect x="${pxOff}" y="${MT}" width="${panelW}" height="${CH}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.8"/>`;
    svgContent += `<text x="${(pxOff + panelW / 2).toFixed(1)}" y="${(MT + 14).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${t.label}" font-family="'Inter','Segoe UI',sans-serif">${labels[p]}</text>`;

    for (let i = 0; i < subset.length; i++) {
      const c = subset[i];
      const x = pxOff + i * pStep + pStep / 2;
      const isBull = c.c >= c.o;
      const color = isBull ? t.bull : t.bear;
      const yH = MT + scaleY(c.h, pMin, pMax);
      const yL = MT + scaleY(c.l, pMin, pMax);
      const yO = MT + scaleY(c.o, pMin, pMax);
      const yC = MT + scaleY(c.c, pMin, pMax);
      const bW = Math.max(1.5, pStep * 0.55);
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(1, Math.abs(yO - yC));
      svgContent += `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${color}" stroke-width="1"/>`;
      svgContent += `<rect x="${(x - bW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${bW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${color}"/>`;
    }
  }

  return svgContent + timeAxisSvg(candles.length, t);
}

function renderSWEEP(candles, cfg, t) {
  const { min, max } = priceRange(candles);
  const step = CW / candles.length;

  // Find local highs/lows and show sweep
  let sweeps = "";
  for (let i = 5; i < candles.length - 5; i++) {
    const localHigh = Math.max(...candles.slice(i - 4, i).map(c => c.h));
    const localLow  = Math.min(...candles.slice(i - 4, i).map(c => c.l));
    if (candles[i].h > localHigh * 1.003 && candles[i].c < localHigh) {
      // Bearish liquidity sweep
      const x = (ML + i * step + step / 2).toFixed(1);
      const y = (MT + scaleY(localHigh, min, max)).toFixed(1);
      sweeps += `<line x1="${ML}" y1="${y}" x2="${ML + CW}" y2="${y}" stroke="${t.bear}" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>`;
      sweeps += `<text x="${x}" y="${(+y - 6).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.bear}" font-family="'Inter','Segoe UI',sans-serif">sweep</text>`;
    }
  }

  return [
    gridSvg(min, max, 5, t),
    sweeps,
    candlesSvg(candles, min, max, t),
    timeAxisSvg(candles.length, t),
    legend([{ color: t.bear, label: "Liquidity Sweep" }], t),
  ].join("");
}

// ── Chart type dispatcher ────────────────────────────────────────────────────
const RENDERERS = {
  MA2: renderMA2, BAND: renderBAND, RSI: renderRSI, MACD: renderMACD,
  ZONE: renderZONE, FIB: renderFIB, RANGE: renderRANGE, ATR: renderATR,
  ARB: renderARB, GRID: renderGRID, DCA: renderDCA, SWING: renderSWING,
  PA: renderPA, WYCK: renderWYCK, ELLIOTT: renderELLIOTT, NEWS: renderNEWS,
  GAP: renderGAP, TRIPLE: renderTRIPLE, SWEEP: renderSWEEP,
};

function buildSvg(slug, cfg, theme) {
  const t = theme === "dark" ? DARK : LIGHT;
  const seed = slug.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const trendBias = (seed % 3 === 0) ? 0.0005 : (seed % 3 === 1) ? -0.0003 : 0.0001;
  const candles = generateOHLCV(80, seed, { trend: trendBias, vol: 0.016 });
  const renderer = RENDERERS[cfg.type] || renderMA2;
  const inner = renderer(candles, cfg, t);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${frameSvg(t, cfg.title, cfg.subtitle)}
  ${inner}
</svg>`;
}

function generatePng(svgString) {
  const resvg = new Resvg(svgString, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

// ── Main ─────────────────────────────────────────────────────────────────────
mkdirSync(OUT_LIGHT, { recursive: true });
mkdirSync(OUT_DARK,  { recursive: true });

console.log(`\n🎨  Generating ${Object.keys(STRAT).length * 2} chart images (light + dark)...\n`);
let ok = 0;
for (const [slug, cfg] of Object.entries(STRAT)) {
  for (const theme of ["light", "dark"]) {
    const svg = buildSvg(slug, cfg, theme);
    const png = generatePng(svg);
    const outDir = theme === "light" ? OUT_LIGHT : OUT_DARK;
    const outPath = resolve(outDir, `${slug}.png`);
    writeFileSync(outPath, png);
    ok++;
  }
  process.stdout.write(`  ✅  ${slug} (light + dark)\n`);
}
console.log(`\n✅  ${ok} images saved.`);
console.log(`   Light → public/images/strategies/light/`);
console.log(`   Dark  → public/images/strategies/dark/\n`);
