import { Candle } from "../types/domain";
import { buildMarketContext, MarketContext } from "./indicators";

/**
 * Read-only technical analysis over a single instrument.
 *
 * Every condition below is expressed with the *same* comparisons the live
 * trading evaluator in `signals.ts` uses, so an answer surfaced through the MCP
 * server never contradicts what a user's bot would actually do. This module
 * only reads and reports — it never places an order.
 */

export type Stance = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

export interface TemplateVerdict {
  templateId: string;
  name: string;
  category: string;
  /** The side this template would take right now, or null when it is quiet. */
  side: "buy" | "sell" | null;
  reason: string;
}

export interface AnalysisConditions {
  emaBullCross: boolean;
  emaBearCross: boolean;
  emaFastAbove: boolean;
  macdBullCross: boolean;
  macdBearCross: boolean;
  macdAboveZero: boolean;
  rsiOversoldCross: boolean;
  rsiOverboughtCross: boolean;
  rsiOversold: boolean;
  rsiOverbought: boolean;
  breakoutUp: boolean;
  breakoutDown: boolean;
  aboveUpperBand: boolean;
  belowLowerBand: boolean;
  vwapDeviationPct: number;
  atrPct: number;
  highVol: boolean;
  lowVol: boolean;
  relativeVolume: number;
}

export interface AnalysisIndicators {
  price: number;
  previousPrice: number;
  ema9: number;
  ema21: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  rsi14: number;
  rsi14Previous: number;
  bbUpper: number;
  bbBasis: number;
  bbLower: number;
  percentB: number;
  roc14: number;
  vwap30: number;
  atr14: number;
  priorHigh20: number;
  priorLow20: number;
  volume: number;
  volumeAverage: number;
}

export interface AnalysisSnapshot {
  symbol: string;
  timeframe: string;
  ranAt: string;
  marketOpen: boolean;
  marketStatusReason: string;
  candleCount: number;
  firstCandleAt: string;
  lastCandleAt: string;
  changePct: number;
  indicators: AnalysisIndicators;
  conditions: AnalysisConditions;
  verdicts: TemplateVerdict[];
  stance: Stance;
  /** -1 (max bearish) .. +1 (max bullish). */
  score: number;
  rationale: string[];
  /** Plain-language notes a model can quote directly to a user. */
  summary: string;
}

interface TemplateMeta {
  name: string;
  category: string;
}

/** Mirrors STRATEGY_TEMPLATES in the frontend so names stay consistent. */
const TEMPLATE_META: Record<string, TemplateMeta> = {
  "ema-crossover": { name: "EMA Crossover", category: "trend" },
  "macd-trend": { name: "MACD Trend Rider", category: "trend" },
  supertrend: { name: "Supertrend Scalper", category: "trend" },
  "rsi-reversal": { name: "RSI Reversal", category: "mean-reversion" },
  "bollinger-bounce": { name: "Bollinger Bounce", category: "mean-reversion" },
  "vwap-reversion": { name: "VWAP Reversion", category: "mean-reversion" },
  breakout: { name: "Breakout Momentum", category: "momentum" },
  "momentum-roc": { name: "ROC Momentum", category: "momentum" },
  grid: { name: "Grid Trading", category: "volatility" },
  scalping: { name: "High-Frequency Scalping", category: "momentum" },
};

function round(value: number, places = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function deriveConditions(market: MarketContext): AnalysisConditions {
  const vwapDeviation = market.vwap30 > 0 ? (market.current - market.vwap30) / market.vwap30 : 0;
  const atrPct = market.current > 0 && market.atr14 > 0 ? (market.atr14 / market.current) * 100 : 0;

  return {
    emaBullCross: market.ema9Previous <= market.ema21Previous && market.ema9Current > market.ema21Current,
    emaBearCross: market.ema9Previous >= market.ema21Previous && market.ema9Current < market.ema21Current,
    emaFastAbove: market.ema9Current > market.ema21Current,
    macdBullCross: market.macdPrevious <= market.macdSignalPrevious && market.macdCurrent > market.macdSignalCurrent,
    macdBearCross: market.macdPrevious >= market.macdSignalPrevious && market.macdCurrent < market.macdSignalCurrent,
    macdAboveZero: market.macdCurrent > 0,
    rsiOversoldCross: market.rsiPrevious <= 30 && market.rsiCurrent > 30,
    rsiOverboughtCross: market.rsiPrevious >= 70 && market.rsiCurrent < 70,
    rsiOversold: market.rsiCurrent < 30,
    rsiOverbought: market.rsiCurrent > 70,
    breakoutUp: market.current > market.priorHigh20 && market.currentVolume >= market.volumeAverage * 1.15,
    breakoutDown: market.current < market.priorLow20 && market.currentVolume >= market.volumeAverage * 1.15,
    aboveUpperBand: market.current >= market.bbUpper,
    belowLowerBand: market.current <= market.bbLower,
    vwapDeviationPct: round(vwapDeviation * 100, 3),
    atrPct: round(atrPct, 3),
    highVol: atrPct > 0.8,
    lowVol: atrPct > 0 && atrPct < 0.5,
    relativeVolume: market.volumeAverage > 0 ? round(market.currentVolume / market.volumeAverage, 3) : 0,
  };
}

/**
 * Runs every strategy template against the current bar and reports which would
 * fire. A template that is quiet is still returned, with side null, so a user
 * can see what was considered rather than only what triggered.
 */
export function evaluateTemplates(market: MarketContext, c: AnalysisConditions): TemplateVerdict[] {
  const verdict = (templateId: string, side: "buy" | "sell" | null, reason: string): TemplateVerdict => ({
    templateId,
    name: TEMPLATE_META[templateId]?.name || templateId,
    category: TEMPLATE_META[templateId]?.category || "other",
    side,
    reason,
  });

  return [
    c.emaBullCross
      ? verdict("ema-crossover", "buy", "EMA9 crossed above EMA21")
      : c.emaBearCross
        ? verdict("ema-crossover", "sell", "EMA9 crossed below EMA21")
        : verdict("ema-crossover", null, `No cross; EMA9 is ${c.emaFastAbove ? "above" : "below"} EMA21`),

    c.macdBullCross && c.macdAboveZero
      ? verdict("macd-trend", "buy", "MACD bullish crossover above zero")
      : c.macdBearCross && !c.macdAboveZero
        ? verdict("macd-trend", "sell", "MACD bearish crossover below zero")
        : verdict("macd-trend", null, `MACD ${round(market.macdCurrent, 4)} vs signal ${round(market.macdSignalCurrent, 4)}; no qualifying cross`),

    c.rsiOversoldCross
      ? verdict("rsi-reversal", "buy", "RSI recovered from oversold")
      : c.rsiOverboughtCross
        ? verdict("rsi-reversal", "sell", "RSI faded from overbought")
        : verdict("rsi-reversal", null, `RSI ${round(market.rsiCurrent, 2)} is inside the 30–70 band`),

    c.breakoutUp
      ? verdict("breakout", "buy", "Upside breakout with volume")
      : c.breakoutDown
        ? verdict("breakout", "sell", "Downside breakout with volume")
        : verdict("breakout", null, `Holding the ${round(market.priorLow20, 2)}–${round(market.priorHigh20, 2)} range`),

    c.belowLowerBand
      ? verdict("bollinger-bounce", "buy", "Price tagged the lower Bollinger Band")
      : c.aboveUpperBand
        ? verdict("bollinger-bounce", "sell", "Price tagged the upper Bollinger Band")
        : verdict("bollinger-bounce", null, "Price is inside the Bollinger Bands"),

    c.vwapDeviationPct <= -1.5 && market.current > market.previous
      ? verdict("vwap-reversion", "buy", "Mean reversion up toward VWAP")
      : c.vwapDeviationPct >= 1.5 && market.current < market.previous
        ? verdict("vwap-reversion", "sell", "Mean reversion down toward VWAP")
        : verdict("vwap-reversion", null, `Price is ${c.vwapDeviationPct}% from the 30-bar VWAP`),

    c.emaBullCross && c.highVol
      ? verdict("supertrend", "buy", "Bullish trend flip in high volatility")
      : c.emaBearCross && c.highVol
        ? verdict("supertrend", "sell", "Bearish trend flip in high volatility")
        : verdict("supertrend", null, `ATR is ${c.atrPct}% of price; no qualifying flip`),

    c.emaBullCross && c.relativeVolume >= 1
      ? verdict("scalping", "buy", "Short-term bullish impulse on volume")
      : c.emaBearCross && c.relativeVolume >= 1
        ? verdict("scalping", "sell", "Short-term bearish impulse on volume")
        : verdict("scalping", null, `Relative volume ${c.relativeVolume}x; no impulse`),

    c.belowLowerBand && c.lowVol
      ? verdict("grid", "buy", "Grid lower band fill")
      : c.aboveUpperBand && c.lowVol
        ? verdict("grid", "sell", "Grid upper band reduce")
        : verdict("grid", null, "Outside grid fill conditions"),

    market.roc14 >= 3
      ? verdict("momentum-roc", "buy", `ROC(14) is +${round(market.roc14, 2)}%`)
      : market.roc14 <= -3
        ? verdict("momentum-roc", "sell", `ROC(14) is ${round(market.roc14, 2)}%`)
        : verdict("momentum-roc", null, `ROC(14) is ${round(market.roc14, 2)}%, below the ±3% threshold`),
  ];
}

/**
 * Blends triggered templates with standing trend/momentum readings.
 *
 * Fired templates dominate because they are the same events the bots trade on;
 * the standing readings only break ties, so a quiet tape reports as neutral
 * instead of manufacturing a signal.
 */
function scoreStance(
  market: MarketContext,
  c: AnalysisConditions,
  verdicts: TemplateVerdict[],
): { stance: Stance; score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;

  const buys = verdicts.filter((v) => v.side === "buy");
  const sells = verdicts.filter((v) => v.side === "sell");
  score += (buys.length - sells.length) * 0.22;
  for (const v of [...buys, ...sells]) rationale.push(`${v.name}: ${v.reason}`);

  if (c.emaFastAbove) {
    score += 0.12;
    rationale.push("EMA9 is above EMA21 — short-term trend is up");
  } else {
    score -= 0.12;
    rationale.push("EMA9 is below EMA21 — short-term trend is down");
  }

  if (c.macdAboveZero) {
    score += 0.08;
    rationale.push(`MACD is positive (${round(market.macdCurrent, 4)})`);
  } else {
    score -= 0.08;
    rationale.push(`MACD is negative (${round(market.macdCurrent, 4)})`);
  }

  if (c.rsiOverbought) {
    score -= 0.1;
    rationale.push(`RSI ${round(market.rsiCurrent, 1)} is overbought`);
  } else if (c.rsiOversold) {
    score += 0.1;
    rationale.push(`RSI ${round(market.rsiCurrent, 1)} is oversold`);
  }

  if (market.roc14 >= 1) rationale.push(`Momentum positive: ROC(14) +${round(market.roc14, 2)}%`);
  else if (market.roc14 <= -1) rationale.push(`Momentum negative: ROC(14) ${round(market.roc14, 2)}%`);

  const clamped = Math.max(-1, Math.min(1, round(score, 3)));
  const stance: Stance =
    clamped >= 0.5 ? "strong_buy"
    : clamped >= 0.2 ? "buy"
    : clamped <= -0.5 ? "strong_sell"
    : clamped <= -0.2 ? "sell"
    : "neutral";

  return { stance, score: clamped, rationale };
}

const STANCE_TEXT: Record<Stance, string> = {
  strong_buy: "strongly bullish",
  buy: "bullish",
  neutral: "mixed / no clear edge",
  sell: "bearish",
  strong_sell: "strongly bearish",
};

export function analyzeCandles(
  symbol: string,
  timeframe: string,
  candles: Candle[],
  session: { isOpen: boolean; reason: string },
): AnalysisSnapshot | null {
  const market = buildMarketContext(candles);
  if (!market) return null;

  const conditions = deriveConditions(market);
  const verdicts = evaluateTemplates(market, conditions);
  const { stance, score, rationale } = scoreStance(market, conditions, verdicts);

  const first = candles[0];
  const lastCandle = candles[candles.length - 1];
  const changePct = first.close > 0 ? ((market.current - first.close) / first.close) * 100 : 0;
  const fired = verdicts.filter((v) => v.side !== null);

  const summary =
    `${symbol} on the ${timeframe} chart reads ${STANCE_TEXT[stance]} ` +
    `(score ${score >= 0 ? "+" : ""}${score}). Price ${round(market.current, 2)}, ` +
    `RSI(14) ${round(market.rsiCurrent, 1)}, EMA9 ${round(market.ema9Current, 2)} vs ` +
    `EMA21 ${round(market.ema21Current, 2)}, MACD ${round(market.macdCurrent, 4)} ` +
    `vs signal ${round(market.macdSignalCurrent, 4)}. ` +
    (fired.length
      ? `${fired.length} strategy template(s) firing: ${fired.map((v) => `${v.name} → ${v.side}`).join("; ")}.`
      : "No strategy template is firing on this bar.");

  return {
    symbol,
    timeframe,
    ranAt: new Date().toISOString(),
    marketOpen: session.isOpen,
    marketStatusReason: session.reason,
    candleCount: candles.length,
    firstCandleAt: first.time,
    lastCandleAt: lastCandle.time,
    changePct: round(changePct, 3),
    indicators: {
      price: round(market.current, 4),
      previousPrice: round(market.previous, 4),
      ema9: round(market.ema9Current, 4),
      ema21: round(market.ema21Current, 4),
      macd: round(market.macdCurrent, 5),
      macdSignal: round(market.macdSignalCurrent, 5),
      macdHistogram: round(market.macdCurrent - market.macdSignalCurrent, 5),
      rsi14: round(market.rsiCurrent, 2),
      rsi14Previous: round(market.rsiPrevious, 2),
      bbUpper: round(market.bbUpper, 4),
      bbBasis: round(market.bbBasis, 4),
      bbLower: round(market.bbLower, 4),
      percentB:
        market.bbUpper === market.bbLower
          ? 0.5
          : round((market.current - market.bbLower) / (market.bbUpper - market.bbLower), 4),
      roc14: round(market.roc14, 3),
      vwap30: round(market.vwap30, 4),
      atr14: round(market.atr14, 4),
      priorHigh20: round(market.priorHigh20, 4),
      priorLow20: round(market.priorLow20, 4),
      volume: round(market.currentVolume, 2),
      volumeAverage: round(market.volumeAverage, 2),
    },
    conditions,
    verdicts,
    stance,
    score,
    rationale,
    summary,
  };
}
