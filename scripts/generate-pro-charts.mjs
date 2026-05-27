/**
 * generate-pro-charts.mjs
 * Professional "trading card" images — 1200×630 px
 * Left  750px: Candlestick chart with strategy-specific indicator
 * Right 450px: Strategy info card (name, params, buy/sell signals)
 *
 * Usage:
 *   node scripts/generate-pro-charts.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "..");
const OUT_LIGHT  = resolve(ROOT, "public/images/strategies/light");
const OUT_DARK   = resolve(ROOT, "public/images/strategies/dark");
const DESK_LIGHT = resolve(process.env.HOME, "Desktop/strategy-charts");

// ── Dimensions ───────────────────────────────────────────────────────────────
const W = 1200, H = 630;
const CHART_W = 730;   // chart area width
const INFO_X  = CHART_W; // info panel starts here (width = W - CHART_W = 470)
const INFO_W  = W - CHART_W;
const CML = 58, CMR = 18, CMT = 52, CMB = 46;  // chart margins
const CW  = CHART_W - CML - CMR;   // drawable chart width
const CH  = H - CMT - CMB;         // drawable chart height

// ── Category accent colours ──────────────────────────────────────────────────
const CATS = {
  trend:    { dark: "#3b82f6", light: "#2563eb", label: "Trend Following"    },
  smc:      { dark: "#f59e0b", light: "#b45309", label: "Smart Money"        },
  revert:   { dark: "#a78bfa", light: "#7c3aed", label: "Mean Reversion"     },
  momentum: { dark: "#fb923c", light: "#c2410c", label: "Momentum"           },
  pattern:  { dark: "#f472b6", light: "#be185d", label: "Pattern Trading"    },
  neutral:  { dark: "#34d399", light: "#047857", label: "Market Neutral"     },
  longterm: { dark: "#60a5fa", light: "#1d4ed8", label: "Long-Term"          },
  arb:      { dark: "#94a3b8", light: "#475569", label: "Arbitrage"          },
  event:    { dark: "#f87171", light: "#dc2626", label: "Event-Driven"       },
  quant:    { dark: "#c084fc", light: "#7e22ce", label: "Quantitative"       },
};

// ── Colour themes ────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0d1117", chartBg: "#0d1117", panelBg: "#161b22",
  infoBg: "#161b22", infoText: "#e6edf3", infoMuted: "#8b949e",
  grid: "#21262d", border: "#30363d", label: "#e6edf3", text: "#8b949e",
  bull: "#26a69a", bear: "#ef5350",
  ma1: "#f7cc50", ma2: "#5b9cf6", ma3: "#b57bff",
  band: "#5b9cf6", bandFill: "rgba(91,156,246,0.10)",
  rsiLine: "#f7cc50", histUp: "#26a69a", histDown: "#ef5350",
  zone1: "rgba(38,166,154,0.20)", zone2: "rgba(239,83,80,0.20)",
  volBar: "rgba(91,156,246,0.35)",
};
const LIGHT = {
  bg: "#f8fafc", chartBg: "#ffffff", panelBg: "#f1f5f9",
  infoBg: "#f1f5f9", infoText: "#0f172a", infoMuted: "#64748b",
  grid: "#e2e8f0", border: "#cbd5e1", label: "#0f172a", text: "#64748b",
  bull: "#089981", bear: "#f23645",
  ma1: "#d97706", ma2: "#2563eb", ma3: "#7c3aed",
  band: "#2563eb", bandFill: "rgba(37,99,235,0.08)",
  rsiLine: "#d97706", histUp: "#089981", histDown: "#f23645",
  zone1: "rgba(8,153,129,0.14)", zone2: "rgba(242,54,69,0.14)",
  volBar: "rgba(37,99,235,0.30)",
};

// ── Strategy definitions ─────────────────────────────────────────────────────
const STRATEGIES = {
  "moving-average-crossover": {
    cat: "trend", chartType: "MA2", p1: 20, p2: 50,
    name: "Moving Average Crossover",
    tagline: "Buy when fast MA crosses above slow MA",
    params: ["Fast MA: SMA 20", "Slow MA: SMA 50", "Works on all timeframes"],
    buy:  "Fast MA crosses above slow MA (golden cross)",
    sell: "Fast MA crosses below slow MA (death cross)",
    tf: "4H / Daily", risk: "Medium",
  },
  "fair-value-gap": {
    cat: "smc", chartType: "ZONE",
    name: "Fair Value Gap",
    tagline: "Trade price inefficiencies left by impulse moves",
    params: ["3-candle imbalance pattern", "Price fills the gap on return", "Confluence with HTF bias"],
    buy:  "Enter longs in bullish FVG on retest",
    sell: "Enter shorts in bearish FVG on retest",
    tf: "15m / 1H", risk: "Medium",
  },
  "smart-money-concepts": {
    cat: "smc", chartType: "ZONE",
    name: "Smart Money Concepts",
    tagline: "Follow institutional order flow and market structure",
    params: ["Break of Structure (BOS)", "Change of Character (CHoCH)", "Order blocks + FVG confluence"],
    buy:  "BOS to upside, pull back to OB/FVG",
    sell: "CHoCH confirmed, push into bearish OB",
    tf: "1H / 4H", risk: "Medium",
  },
  "order-blocks": {
    cat: "smc", chartType: "ZONE",
    name: "Order Blocks Strategy",
    tagline: "Enter where institutions placed large orders",
    params: ["Last opposing candle before impulse", "High-volume price zones", "Best at key S/R levels"],
    buy:  "Price returns to bullish OB with confluence",
    sell: "Price returns to bearish OB with confluence",
    tf: "1H / 4H / Daily", risk: "Low–Medium",
  },
  "liquidity-sweeps": {
    cat: "smc", chartType: "SWEEP",
    name: "Liquidity Sweeps",
    tagline: "Fade the stop-hunt before the real move",
    params: ["Equal highs/lows = liquidity pool", "Wick beyond level then reversal", "Volume spike confirms sweep"],
    buy:  "Wick below equal lows, strong close above",
    sell: "Wick above equal highs, strong close below",
    tf: "15m / 1H", risk: "High",
  },
  "breaker-blocks": {
    cat: "smc", chartType: "ZONE",
    name: "Breaker Blocks Strategy",
    tagline: "Failed order blocks that flip from support to resistance",
    params: ["Order block that was broken through", "Flip: former support → resistance", "Enter on retest of broken OB"],
    buy:  "Bullish breaker holds as new support on retest",
    sell: "Bearish breaker holds as new resistance on retest",
    tf: "1H / 4H", risk: "Medium",
  },
  "trend-following": {
    cat: "trend", chartType: "MA2", p1: 50, p2: 200,
    name: "Trend Following Strategy",
    tagline: "Ride the trend until it bends",
    params: ["SMA 50 / SMA 200 as trend filter", "Trade pullbacks in trend direction", "Wide stops, large targets"],
    buy:  "Price above SMA 200, pull back to SMA 50",
    sell: "Price below SMA 200, rally to SMA 50",
    tf: "Daily / Weekly", risk: "Low",
  },
  "mean-reversion": {
    cat: "revert", chartType: "BAND",
    name: "Mean Reversion Strategy",
    tagline: "Stretched price snaps back to average",
    params: ["Bollinger Bands (20, 2σ)", "Price at +2σ or −2σ extreme", "RSI > 70 or < 30 confirmation"],
    buy:  "Price tags lower band + RSI < 30",
    sell: "Price tags upper band + RSI > 70",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "breakout-strategy": {
    cat: "trend", chartType: "RANGE",
    name: "Breakout Strategy",
    tagline: "Enter when price clears a key level with momentum",
    params: ["Identify consolidation range", "Volume surge confirms breakout", "Retest of broken level as entry"],
    buy:  "Candle closes above resistance with high volume",
    sell: "Candle closes below support with high volume",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "scalping-strategy": {
    cat: "momentum", chartType: "MA2", p1: 8, p2: 21,
    name: "Scalping Strategy",
    tagline: "Fast in-and-out for small, frequent profits",
    params: ["EMA 8 / EMA 21 momentum filter", "1–5 minute charts primary", "Strict 1:1.5 RR minimum"],
    buy:  "EMA 8 crosses above EMA 21, enter on pullback",
    sell: "EMA 8 crosses below EMA 21, enter on rally",
    tf: "1m / 5m", risk: "High",
  },
  "swing-trading": {
    cat: "trend", chartType: "SWING",
    name: "Swing Trading Strategy",
    tagline: "Capture multi-day price swings with precision",
    params: ["Hold 2–10 days per trade", "Higher-high / higher-low structure", "Daily or 4H chart for signals"],
    buy:  "New higher-low forms above prior swing low",
    sell: "New lower-high forms below prior swing high",
    tf: "4H / Daily", risk: "Medium",
  },
  "fibonacci-retracement": {
    cat: "pattern", chartType: "FIB",
    name: "Fibonacci Retracement",
    tagline: "Enter pullbacks at key Fibonacci levels",
    params: ["Key levels: 38.2% · 50% · 61.8%", "Draw from swing low to swing high", "Confluence with MA or S/R"],
    buy:  "Price pulls back to 61.8% in uptrend",
    sell: "Price rallies to 61.8% in downtrend",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "price-action-strategy": {
    cat: "pattern", chartType: "PA",
    name: "Price Action Strategy",
    tagline: "Read pure market structure without indicators",
    params: ["Candlestick patterns at key levels", "Market structure: BOS / S/R zones", "Pin bar, engulfing, inside bar"],
    buy:  "Bullish engulfing / pin bar at support",
    sell: "Bearish engulfing / pin bar at resistance",
    tf: "4H / Daily", risk: "Low",
  },
  "grid-trading": {
    cat: "neutral", chartType: "GRID",
    name: "Grid Trading Strategy",
    tagline: "Profit automatically from price oscillation",
    params: ["Equal-spaced buy & sell orders", "No directional bias needed", "Ideal in ranging markets"],
    buy:  "Automatic buy order at each grid level below",
    sell: "Automatic sell order at each grid level above",
    tf: "1H (ranging market)", risk: "Medium",
  },
  "dollar-cost-averaging": {
    cat: "longterm", chartType: "DCA",
    name: "Dollar-Cost Averaging",
    tagline: "Reduce timing risk by spreading entries over time",
    params: ["Fixed investment at fixed intervals", "Lowers average entry price in dips", "Ideal for long-term accumulation"],
    buy:  "Buy a fixed amount at set time intervals",
    sell: "Exit when target price or allocation met",
    tf: "Weekly / Monthly", risk: "Low",
  },
  "arbitrage-strategy": {
    cat: "arb", chartType: "ARB",
    name: "Arbitrage Strategy",
    tagline: "Exploit price differences across correlated markets",
    params: ["Same asset, different exchanges", "Statistical price divergence", "Near-zero directional risk"],
    buy:  "Buy the cheaper venue, sell the expensive one",
    sell: "Close both legs when spread normalises",
    tf: "Seconds / Minutes", risk: "Low",
  },
  "supply-demand-zones": {
    cat: "smc", chartType: "ZONE",
    name: "Supply & Demand Zones",
    tagline: "Enter where institutions buy or sell in bulk",
    params: ["Strong impulse from a base", "Unmitigated zones have most power", "Fresh zones > tested zones"],
    buy:  "Enter demand zone with bullish candle confirmation",
    sell: "Enter supply zone with bearish candle confirmation",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "wyckoff-method": {
    cat: "pattern", chartType: "WYCK",
    name: "Wyckoff Method",
    tagline: "Read institutional accumulation and distribution",
    params: ["4 phases: Accum · Markup · Dist · Markdown", "Composite Man concept", "VSA (Volume Spread Analysis)"],
    buy:  "Spring or Last Point of Support in accumulation",
    sell: "Upthrust or Last Point of Supply in distribution",
    tf: "Daily / Weekly", risk: "Low",
  },
  "elliott-wave": {
    cat: "pattern", chartType: "ELLIOTT",
    name: "Elliott Wave Theory",
    tagline: "5-wave impulse followed by 3-wave correction",
    params: ["5 impulse waves in trend direction", "3 corrective waves (A-B-C)", "Fibonacci ratios define wave targets"],
    buy:  "Enter Wave 3 after Wave 2 retracement",
    sell: "Exit Wave 5 or trade Wave C short",
    tf: "4H / Daily / Weekly", risk: "High",
  },
  "position-trading": {
    cat: "longterm", chartType: "MA2", p1: 100, p2: 200,
    name: "Position Trading",
    tagline: "Hold for weeks, months, or years on macro trends",
    params: ["SMA 100 / SMA 200 trend filter", "Hold through minor corrections", "News & fundamentals align"],
    buy:  "Price above SMA 200 with bullish macro setup",
    sell: "Price below SMA 200 with bearish macro setup",
    tf: "Daily / Weekly", risk: "Low",
  },
  "pairs-trading": {
    cat: "neutral", chartType: "ARB",
    name: "Pairs Trading Strategy",
    tagline: "Long/short correlated assets when they diverge",
    params: ["Choose historically correlated pair", "Enter when spread > 2σ from mean", "Market-neutral: hedges direction"],
    buy:  "Buy underperformer, short outperformer",
    sell: "Close both legs when spread reverts to mean",
    tf: "Daily", risk: "Low",
  },
  "momentum-trading": {
    cat: "momentum", chartType: "RSI",
    name: "Momentum Trading",
    tagline: "Buy strength, sell weakness — follow the force",
    params: ["RSI > 60 = strong momentum", "Rate-of-change filter > 0", "Trade with trend direction only"],
    buy:  "RSI crosses above 50 in uptrend",
    sell: "RSI crosses below 50 in downtrend",
    tf: "1H / 4H", risk: "Medium",
  },
  "range-trading": {
    cat: "revert", chartType: "RANGE",
    name: "Range Trading Strategy",
    tagline: "Buy support, sell resistance in a bounded market",
    params: ["Identify clear range boundaries", "RSI confirmation at extremes", "Exit at opposite range boundary"],
    buy:  "Price at support + RSI < 35",
    sell: "Price at resistance + RSI > 65",
    tf: "1H / 4H", risk: "Low",
  },
  "news-trading": {
    cat: "event", chartType: "NEWS",
    name: "News Trading Strategy",
    tagline: "Trade the volatility spike around high-impact events",
    params: ["Economic calendar (NFP, CPI, FOMC)", "Enter post-release direction break", "Tight stops, quick target"],
    buy:  "Bullish surprise + candle close above pre-news high",
    sell: "Bearish surprise + candle close below pre-news low",
    tf: "5m / 15m", risk: "High",
  },
  "harmonic-patterns": {
    cat: "pattern", chartType: "FIB",
    name: "Harmonic Patterns",
    tagline: "Fibonacci-defined reversal patterns for precise entries",
    params: ["Gartley · Bat · Butterfly · Crab", "Potential Reversal Zone (PRZ)", "Fibonacci ratios define each leg"],
    buy:  "Bullish pattern completes at PRZ",
    sell: "Bearish pattern completes at PRZ",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "chart-patterns": {
    cat: "pattern", chartType: "PA",
    name: "Chart Patterns Strategy",
    tagline: "Classic formations with defined targets",
    params: ["H&S, Double Top/Bottom", "Triangles, Flags, Wedges", "Breakout + measured move target"],
    buy:  "Pattern breaks out to upside with volume",
    sell: "Pattern breaks down with volume confirmation",
    tf: "4H / Daily", risk: "Medium",
  },
  "carry-trade": {
    cat: "longterm", chartType: "ARB",
    name: "Carry Trade Strategy",
    tagline: "Earn from interest rate differential between currencies",
    params: ["Buy high-rate, sell low-rate currency", "Hold for days to months", "Rollover/swap = daily income"],
    buy:  "Buy high-yield currency vs low-yield currency",
    sell: "Risk-off event or rate convergence signal",
    tf: "Daily / Weekly", risk: "Medium",
  },
  "gap-trading": {
    cat: "event", chartType: "GAP",
    name: "Gap Trading Strategy",
    tagline: "Trade the fill of overnight or weekend price gaps",
    params: ["Common gaps fill ~70% of the time", "Breakaway gaps often don't fill", "Volume at open confirms direction"],
    buy:  "Gap down on strong support: buy gap fill",
    sell: "Gap up near resistance: sell gap fill",
    tf: "Daily (open / pre-market)", risk: "High",
  },
  "triple-screen-strategy": {
    cat: "trend", chartType: "TRIPLE",
    name: "Triple Screen Strategy",
    tagline: "Three-timeframe filter for high-probability entries",
    params: ["Screen 1: Weekly trend direction", "Screen 2: Daily oscillator signal", "Screen 3: Intraday entry trigger"],
    buy:  "Weekly uptrend + daily RSI dip + intraday breakout",
    sell: "Weekly downtrend + daily rally + intraday breakdown",
    tf: "Multi-timeframe", risk: "Low",
  },
  "volatility-trading": {
    cat: "momentum", chartType: "ATR",
    name: "Volatility Trading Strategy",
    tagline: "Enter on volatility expansion, exit on contraction",
    params: ["ATR(14) for stop size", "Bollinger Band squeeze → breakout", "VIX as macro volatility gauge"],
    buy:  "ATR expanding + price breaks above squeeze high",
    sell: "ATR expanding + price breaks below squeeze low",
    tf: "1H / 4H / Daily", risk: "High",
  },
  "market-making-strategy": {
    cat: "neutral", chartType: "RANGE",
    name: "Market Making Strategy",
    tagline: "Quote both sides of the market to capture spread",
    params: ["Continuous bid + ask quotes", "Profit from bid-ask spread", "Hedge inventory with futures"],
    buy:  "Bid below mid-price; fill + immediately hedge",
    sell: "Ask above mid-price; fill + immediately hedge",
    tf: "Microseconds – Seconds", risk: "Low",
  },
  "counter-trend-strategy": {
    cat: "revert", chartType: "RSI",
    name: "Counter-Trend Strategy",
    tagline: "Fade over-extended moves at extreme RSI levels",
    params: ["RSI > 75 overbought reversal", "RSI < 25 oversold reversal", "Requires strong S/R confluence"],
    buy:  "RSI < 25 + bullish divergence + key support",
    sell: "RSI > 75 + bearish divergence + key resistance",
    tf: "4H / Daily", risk: "High",
  },
  "machine-learning-strategy": {
    cat: "quant", chartType: "BAND",
    name: "Machine Learning Strategy",
    tagline: "ML model predicts price direction from historical patterns",
    params: ["Feature engineering (RSI, MACD, vol…)", "Classification: up / down / flat", "Walk-forward validation"],
    buy:  "Model probability of up-move > 65% threshold",
    sell: "Model probability of down-move > 65% threshold",
    tf: "4H / Daily", risk: "Medium",
  },
  "rebalancing-strategy": {
    cat: "longterm", chartType: "DCA",
    name: "Rebalancing Strategy",
    tagline: "Maintain target allocations by trimming winners",
    params: ["Set target weight per asset", "Rebalance when drift > 5%", "Forced buy-low / sell-high discipline"],
    buy:  "Buy underweight assets to restore target %",
    sell: "Sell overweight assets to restore target %",
    tf: "Monthly / Quarterly", risk: "Low",
  },

  // ── Indicators ──────────────────────────────────────────────────────────────
  "rsi-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "RSI Indicator",
    tagline: "Measure momentum strength to spot reversals",
    params: ["14-period default setting", "Overbought above 70, oversold below 30", "Divergence signals trend weakening"],
    buy:  "RSI crosses above 30 from oversold territory",
    sell: "RSI crosses below 70 from overbought territory",
    tf: "Any", risk: "Low",
  },
  "macd-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "MACD Indicator",
    tagline: "Trend and momentum in one oscillator",
    params: ["Fast EMA 12 / Slow EMA 26", "Signal line EMA 9", "Histogram shows momentum strength"],
    buy:  "MACD line crosses above signal line",
    sell: "MACD line crosses below signal line",
    tf: "1H / 4H / Daily", risk: "Low",
  },
  "bollinger-bands": {
    cat: "revert", chartType: "BAND",
    name: "Bollinger Bands",
    tagline: "Volatility bands that contract and expand",
    params: ["20-period SMA as midline", "Upper/lower at ±2 standard deviations", "Squeeze precedes volatility breakout"],
    buy:  "Price touches lower band + squeeze release",
    sell: "Price touches upper band + RSI divergence",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "ema-indicator": {
    cat: "trend", chartType: "MA2", p1: 12, p2: 26,
    name: "EMA Indicator",
    tagline: "Exponential moving average reacts fast to price",
    params: ["Weights recent prices more heavily", "EMA 12 and EMA 26 popular pair", "Crossovers signal trend changes"],
    buy:  "Fast EMA 12 crosses above slow EMA 26",
    sell: "Fast EMA 12 crosses below slow EMA 26",
    tf: "Any", risk: "Low",
  },
  "sma-indicator": {
    cat: "trend", chartType: "MA2", p1: 50, p2: 200,
    name: "SMA Indicator",
    tagline: "Simple moving average smooths price noise",
    params: ["Equal weight to all periods", "SMA 50 / SMA 200 golden/death cross", "Widely followed by all traders"],
    buy:  "SMA 50 crosses above SMA 200 (golden cross)",
    sell: "SMA 50 crosses below SMA 200 (death cross)",
    tf: "Daily / Weekly", risk: "Low",
  },
  "atr-indicator": {
    cat: "momentum", chartType: "ATR",
    name: "ATR Indicator",
    tagline: "Measures true market volatility and stop size",
    params: ["Average True Range (14-period)", "Higher ATR = larger stop required", "Used to size positions and set targets"],
    buy:  "Enter when ATR expands on a breakout setup",
    sell: "Set stop at 1.5–2× ATR from entry",
    tf: "Any", risk: "Low",
  },
  "adx-indicator": {
    cat: "trend", chartType: "RSI",
    name: "ADX Indicator",
    tagline: "Average Directional Index — trend strength meter",
    params: ["ADX > 25 = strong trend present", "+DI / −DI show trend direction", "ADX > 40 = extremely strong trend"],
    buy:  "ADX > 25 and +DI crosses above −DI",
    sell: "ADX > 25 and −DI crosses above +DI",
    tf: "1H / 4H / Daily", risk: "Low",
  },
  "ichimoku-cloud": {
    cat: "trend", chartType: "ZONE",
    name: "Ichimoku Cloud",
    tagline: "All-in-one trend, momentum, and S/R indicator",
    params: ["Tenkan (9) / Kijun (26) crossover", "Kumo cloud = support & resistance area", "Chikou span confirms trend bias"],
    buy:  "Price above cloud + Tenkan crosses above Kijun",
    sell: "Price below cloud + Tenkan crosses below Kijun",
    tf: "4H / Daily", risk: "Low",
  },
  "parabolic-sar": {
    cat: "trend", chartType: "RANGE",
    name: "Parabolic SAR",
    tagline: "Trailing stop-and-reverse signal dots",
    params: ["Dots below price = uptrend", "Dots above price = downtrend", "Step 0.02, Max 0.20 standard settings"],
    buy:  "SAR flips below price (bullish reversal)",
    sell: "SAR flips above price (bearish reversal)",
    tf: "Any", risk: "Medium",
  },
  "pivot-points": {
    cat: "pattern", chartType: "RANGE",
    name: "Pivot Points",
    tagline: "Classic support and resistance from prior session",
    params: ["PP = (High + Low + Close) / 3", "R1, R2, R3 resistance levels above", "S1, S2, S3 support levels below"],
    buy:  "Price bounces from S1 / S2 with volume",
    sell: "Price rejects from R1 / R2 with bearish candle",
    tf: "Intraday / Daily", risk: "Low",
  },
  "obv-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "OBV Indicator",
    tagline: "On-Balance Volume tracks buying/selling pressure",
    params: ["Cumulative volume flow indicator", "Rising OBV = buying pressure dominates", "OBV divergence predicts price reversal"],
    buy:  "OBV rises to new high while price consolidates",
    sell: "OBV falls to new low ahead of price decline",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "vwap-indicator": {
    cat: "neutral", chartType: "MA2", p1: 20, p2: 50,
    name: "VWAP Indicator",
    tagline: "Volume-weighted price benchmark for the day",
    params: ["Resets each trading session", "Institutional benchmark for fills", "Price above VWAP = bullish intraday bias"],
    buy:  "Price pulls back to VWAP in uptrend and holds",
    sell: "Price rallies to VWAP in downtrend and rejects",
    tf: "1m / 5m / 15m", risk: "Low",
  },
  "stochastic-oscillator": {
    cat: "momentum", chartType: "RSI",
    name: "Stochastic Oscillator",
    tagline: "Compare closing price to its recent range",
    params: ["%K(14) and %D(3) smoothed signal", "Overbought > 80, oversold < 20", "Best at divergences near S/R levels"],
    buy:  "%K crosses above %D below 20",
    sell: "%K crosses below %D above 80",
    tf: "Any", risk: "Medium",
  },
  "stochastic-rsi": {
    cat: "momentum", chartType: "RSI",
    name: "Stochastic RSI",
    tagline: "RSI of RSI — faster and more sensitive",
    params: ["StochRSI = Stochastic applied to RSI", "Range 0–1, 0.8 overbought, 0.2 oversold", "More signals than standard RSI"],
    buy:  "StochRSI K crosses above D below 0.2",
    sell: "StochRSI K crosses below D above 0.8",
    tf: "1H / 4H", risk: "High",
  },
  "cci-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "CCI Indicator",
    tagline: "Commodity Channel Index measures price deviation",
    params: ["0 = price at its moving average", "+100 / −100 = overbought/oversold", "Developed by Donald Lambert (1980)"],
    buy:  "CCI crosses above −100 from oversold",
    sell: "CCI crosses below +100 from overbought",
    tf: "Any", risk: "Medium",
  },
  "williams-percent-r": {
    cat: "momentum", chartType: "RSI",
    name: "Williams %R",
    tagline: "Momentum oscillator ranging from -100 to 0",
    params: ["14-period default setting", "Above −20 = overbought zone", "Below −80 = oversold zone"],
    buy:  "%R crosses above −80 from oversold",
    sell: "%R crosses below −20 from overbought",
    tf: "Any", risk: "Medium",
  },
  "aroon-indicator": {
    cat: "trend", chartType: "RSI",
    name: "Aroon Indicator",
    tagline: "Identifies trend changes and consolidation",
    params: ["Aroon Up = periods since 25-day high", "Aroon Down = periods since 25-day low", "Crossover signals trend shift"],
    buy:  "Aroon Up crosses above Aroon Down above 70",
    sell: "Aroon Down crosses above Aroon Up above 70",
    tf: "Daily / Weekly", risk: "Low",
  },
  "alligator-indicator": {
    cat: "trend", chartType: "MA2", p1: 13, p2: 34,
    name: "Alligator Indicator",
    tagline: "Bill Williams 3-MA system for trend timing",
    params: ["Jaw: SMA 13 shifted 8 bars", "Teeth: SMA 8 shifted 5 bars", "Lips: SMA 5 shifted 3 bars"],
    buy:  "Lips cross above Teeth and Jaw (alligator eating)",
    sell: "Lips cross below Teeth and Jaw",
    tf: "Any", risk: "Medium",
  },
  "donchian-channel": {
    cat: "trend", chartType: "BAND",
    name: "Donchian Channel",
    tagline: "20-period highest high and lowest low channel",
    params: ["Upper = 20-period rolling high", "Lower = 20-period rolling low", "Mid = average of upper and lower bands"],
    buy:  "Price breaks above upper channel (new 20-day high)",
    sell: "Price breaks below lower channel (new 20-day low)",
    tf: "Daily / Weekly", risk: "Medium",
  },
  "keltner-channels": {
    cat: "revert", chartType: "BAND",
    name: "Keltner Channels",
    tagline: "ATR-based envelopes around EMA 20",
    params: ["Middle band: EMA 20", "Upper/lower: EMA ± 2× ATR(10)", "Less prone to false signals than BB"],
    buy:  "Price pulls back inside channel after upper breach",
    sell: "Price pulls back inside channel after lower breach",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "supertrend-indicator": {
    cat: "trend", chartType: "RANGE",
    name: "Supertrend Indicator",
    tagline: "ATR-based trend line that flips on reversal",
    params: ["Default: ATR(10) × 3 multiplier", "Green below price = uptrend signal", "Red above price = downtrend signal"],
    buy:  "Supertrend flips to green below price",
    sell: "Supertrend flips to red above price",
    tf: "Any", risk: "Low",
  },
  "fibonacci-indicator": {
    cat: "pattern", chartType: "FIB",
    name: "Fibonacci Indicator",
    tagline: "Golden ratio levels as natural S/R zones",
    params: ["Key levels: 23.6%, 38.2%, 61.8%", "Extensions: 127.2%, 161.8%", "Combine with price action for entries"],
    buy:  "Price retraces to 61.8% in an uptrend",
    sell: "Price retraces to 61.8% in a downtrend",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "hull-moving-average": {
    cat: "trend", chartType: "MA2", p1: 14, p2: 50,
    name: "Hull Moving Average",
    tagline: "Alan Hull's MA reduces lag dramatically",
    params: ["HMA = WMA(2×WMA(n/2) − WMA(n))", "Faster than EMA with less noise", "Period 14 for short-term trend"],
    buy:  "HMA turns upward and price is above it",
    sell: "HMA turns downward and price is below it",
    tf: "1H / 4H", risk: "Medium",
  },
  "linear-regression": {
    cat: "trend", chartType: "MA2", p1: 14, p2: 50,
    name: "Linear Regression",
    tagline: "Best-fit trend line over a look-back period",
    params: ["Best-fit straight line through closes", "Upper/lower channel at ±2 std deviation", "Direction = trend, width = range state"],
    buy:  "Price touches lower regression channel in uptrend",
    sell: "Price touches upper regression channel in downtrend",
    tf: "4H / Daily", risk: "Low",
  },
  "mfi-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "MFI Indicator",
    tagline: "Money Flow Index — RSI weighted by volume",
    params: ["14-period volume-weighted RSI", "Overbought > 80, oversold < 20", "Volume weighting gives stronger signals"],
    buy:  "MFI crosses above 20 from oversold",
    sell: "MFI crosses below 80 from overbought",
    tf: "1H / 4H / Daily", risk: "Medium",
  },
  "awesome-oscillator": {
    cat: "momentum", chartType: "RSI",
    name: "Awesome Oscillator",
    tagline: "Histogram of 5 vs 34-period midpoint SMAs",
    params: ["34-period SMA of midpoints baseline", "5-period SMA of midpoints fast line", "Zero line crossings = momentum shift"],
    buy:  "Histogram crosses above zero line",
    sell: "Histogram crosses below zero line",
    tf: "Any", risk: "Medium",
  },
  "rate-of-change": {
    cat: "momentum", chartType: "RSI",
    name: "Rate of Change",
    tagline: "Percentage change over N periods",
    params: ["ROC = (Close / N-periods ago − 1) × 100", "Zero line crossovers = momentum shifts", "Divergence signals potential reversal"],
    buy:  "ROC crosses above zero",
    sell: "ROC crosses below zero",
    tf: "Any", risk: "Medium",
  },
  "chaikin-money-flow": {
    cat: "momentum", chartType: "RSI",
    name: "Chaikin Money Flow",
    tagline: "Measures buying/selling pressure via volume",
    params: ["21-period money flow volume sum", "Range: −1 to +1, zero line is key", "Bullish when consistently above zero"],
    buy:  "CMF crosses above zero line",
    sell: "CMF crosses below zero line",
    tf: "Daily", risk: "Medium",
  },
  "dmi-indicator": {
    cat: "trend", chartType: "RSI",
    name: "DMI Indicator",
    tagline: "Directional Movement Index with ADX filter",
    params: ["+DI and −DI show directional strength", "ADX confirms overall trend strength", "+DI crossing −DI = bullish shift"],
    buy:  "+DI crosses above −DI with ADX > 20",
    sell: "−DI crosses above +DI with ADX > 20",
    tf: "1H / 4H / Daily", risk: "Low",
  },
  "detrended-price-oscillator": {
    cat: "revert", chartType: "RSI",
    name: "Detrended Price Oscillator",
    tagline: "Removes the trend to reveal price cycles",
    params: ["Subtracts SMA from shifted close price", "Highlights short-term price cycles", "Use to time cycle peaks and troughs"],
    buy:  "DPO crosses above zero at a cycle trough",
    sell: "DPO crosses below zero at a cycle peak",
    tf: "Daily / Weekly", risk: "Medium",
  },
  "elder-ray": {
    cat: "momentum", chartType: "RSI",
    name: "Elder Ray Index",
    tagline: "Bull and bear power relative to EMA",
    params: ["Bull Power = High − EMA(13)", "Bear Power = Low − EMA(13)", "Use alongside trend direction filter"],
    buy:  "Uptrend present + Bear Power negative but rising",
    sell: "Downtrend present + Bull Power positive but falling",
    tf: "Daily", risk: "Medium",
  },
  "force-index": {
    cat: "momentum", chartType: "RSI",
    name: "Force Index",
    tagline: "Combines price change and volume into one line",
    params: ["Force = (Close − Prev Close) × Volume", "2-period EMA for short-term signals", "13-period EMA for trend confirmation"],
    buy:  "13-period Force Index crosses above zero",
    sell: "13-period Force Index crosses below zero",
    tf: "Daily", risk: "Medium",
  },
  "trix-indicator": {
    cat: "momentum", chartType: "RSI",
    name: "TRIX Indicator",
    tagline: "Triple-smoothed EMA oscillator",
    params: ["Triple EMA filters out minor cycles", "TRIX = % change of triple-smoothed EMA", "Signal line = 9-period SMA of TRIX"],
    buy:  "TRIX crosses above signal line and zero",
    sell: "TRIX crosses below signal line and zero",
    tf: "Daily", risk: "Low",
  },
  "ultimate-oscillator": {
    cat: "momentum", chartType: "RSI",
    name: "Ultimate Oscillator",
    tagline: "Multi-timeframe momentum by Larry Williams",
    params: ["Weighted average of 7, 14, 28 periods", "Range 0–100, overbought > 70", "Reduces false signals vs single-period"],
    buy:  "UO crosses above 30 with bullish divergence",
    sell: "UO crosses below 70 with bearish divergence",
    tf: "Any", risk: "Medium",
  },
  "vortex-indicator": {
    cat: "trend", chartType: "RSI",
    name: "Vortex Indicator",
    tagline: "Two oscillators reveal directional vortex",
    params: ["VI+ tracks upward movement", "VI− tracks downward movement", "Crossover = trend change signal"],
    buy:  "VI+ crosses above VI−",
    sell: "VI− crosses above VI+",
    tf: "Daily / Weekly", risk: "Medium",
  },
  "volume-analysis": {
    cat: "momentum", chartType: "RSI",
    name: "Volume Analysis",
    tagline: "Price moves confirmed by volume are more reliable",
    params: ["High volume confirms breakouts", "Climactic volume = potential reversal", "OBV and volume MA reveal trend"],
    buy:  "Breakout candle with 2× average volume",
    sell: "Rejection candle with climactic volume spike",
    tf: "Any", risk: "Low",
  },
};

// ── OHLCV data generator ─────────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function generateOHLCV(n, seed, { trend = 0.0003, vol = 0.016, start = 140 } = {}) {
  const rand = seededRand(seed);
  const candles = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const move = (rand() - 0.49 + trend) * vol * price;
    const open = price;
    const close = price + move;
    const range = Math.abs(move) * (1 + rand() * 1.5);
    const high = Math.max(open, close) + range * rand() * 0.7;
    const low  = Math.min(open, close) - range * rand() * 0.7;
    const volume = 500 + rand() * 1500 + Math.abs(move / price) * 4000;
    candles.push({ o: open, h: high, l: low, c: close, v: volume });
    price = close;
  }
  return candles;
}

// ── Indicator math ───────────────────────────────────────────────────────────
const sum = (arr, i, n) => arr.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0);
function sma(arr, p) { return arr.map((_, i) => i < p - 1 ? null : sum(arr, i, p) / p); }
function ema(arr, p) {
  const k = 2 / (p + 1); let prev = arr[0];
  return arr.map((v, i) => { if (i === 0) return v; const e = v * k + prev * (1 - k); prev = e; return e; });
}
function bb(closes, p = 20) {
  const mid = sma(closes, p);
  return mid.map((m, i) => {
    if (!m) return { mid: null, up: null, dn: null };
    const sl = closes.slice(i - p + 1, i + 1);
    const sd = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / p);
    return { mid: m, up: m + 2 * sd, dn: m - 2 * sd };
  });
}
function rsi(closes, p = 14) {
  const d = closes.map((v, i) => i ? v - closes[i - 1] : 0);
  const gains = d.map(x => x > 0 ? x : 0), losses = d.map(x => x < 0 ? -x : 0);
  let ag = gains.slice(1, p + 1).reduce((s, v) => s + v, 0) / p;
  let al = losses.slice(1, p + 1).reduce((s, v) => s + v, 0) / p;
  const result = Array(p + 1).fill(null);
  result.push(100 - 100 / (1 + ag / (al || 1e-6)));
  for (let i = p + 1; i < closes.length; i++) {
    ag = (ag * (p - 1) + gains[i]) / p;
    al = (al * (p - 1) + losses[i]) / p;
    result.push(100 - 100 / (1 + ag / (al || 1e-6)));
  }
  return result;
}
function atr(candles, p = 14) {
  const tr = candles.map((c, i) => i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i-1].c), Math.abs(c.l - candles[i-1].c)));
  return sma(tr, p);
}
function priceRange(candles, pad = 0.06) {
  const lo = Math.min(...candles.map(c => c.l)), hi = Math.max(...candles.map(c => c.h));
  const p = (hi - lo) * pad;
  return { min: lo - p, max: hi + p };
}

// ── Chart SVG helpers ─────────────────────────────────────────────────────────
function scaleY(v, min, max, h = CH) { return h - ((v - min) / (max - min)) * h; }

function line(vals, min, max, panelTop = 0, panelH = CH, color, width = 1.8, dash = "") {
  const step = CW / vals.length;
  const pts = vals.map((v, i) => v === null ? null : `${(CML + i * step + step / 2).toFixed(1)},${(CMT + panelTop + scaleY(v, min, max, panelH)).toFixed(1)}`).filter(Boolean).join(" ");
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
}

function candles(data, min, max, t) {
  const step = CW / data.length;
  const bw = Math.max(1.5, step * 0.58);
  return data.map((c, i) => {
    const x = CML + i * step + step / 2;
    const col = c.c >= c.o ? t.bull : t.bear;
    const yH = CMT + scaleY(c.h, min, max), yL = CMT + scaleY(c.l, min, max);
    const yO = CMT + scaleY(c.o, min, max), yC = CMT + scaleY(c.c, min, max);
    const bt = Math.min(yO, yC), bh = Math.max(1.2, Math.abs(yO - yC));
    return `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${col}" stroke-width="1.2"/>` +
           `<rect x="${(x - bw / 2).toFixed(1)}" y="${bt.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" rx="0.4"/>`;
  }).join("");
}

function grid(min, max, steps, t, panelTop = 0, panelH = CH) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const v = min + (max - min) * (i / steps);
    const y = (CMT + panelTop + scaleY(v, min, max, panelH)).toFixed(1);
    return `<line x1="${CML}" y1="${y}" x2="${CML + CW}" y2="${y}" stroke="${t.grid}" stroke-width="0.6"/>` +
           `<text x="${(CML - 5).toFixed(1)}" y="${(+y + 4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="${t.text}" font-family="sans-serif">${v.toFixed(1)}</text>`;
  }).join("");
}

function timeAxis(n, t, y = H - CMB + 16) {
  const step = CW / n;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return [0, Math.floor(n/4), Math.floor(n/2), Math.floor(3*n/4), n-1].map((idx, ii) => {
    const x = (CML + idx * step + step / 2).toFixed(1);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="${t.text}" font-family="sans-serif">${months[(ii+2)%12]} '25</text>`;
  }).join("");
}

// ── Chart renderers ───────────────────────────────────────────────────────────
function renderChart(slug, cfg, t) {
  const seed = slug.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const trendBias = seed % 3 === 0 ? 0.0006 : seed % 3 === 1 ? -0.0004 : 0.0002;
  const data = generateOHLCV(75, seed, { trend: trendBias });
  const closes = data.map(c => c.c);
  const { min, max } = priceRange(data);

  switch (cfg.chartType) {
    case "MA2": {
      const fn = (cfg.p1 || 20) <= 21 ? ema : sma;
      const m1 = fn(closes, cfg.p1 || 20);
      const m2 = fn(closes, cfg.p2 || 50);
      return grid(min, max, 4, t) + candles(data, min, max, t) +
             line(m1, min, max, 0, CH, t.ma1, 2) + line(m2, min, max, 0, CH, t.ma2, 2) + timeAxis(data.length, t);
    }
    case "BAND": {
      const bands = bb(closes);
      const upperPts = bands.map((b, i) => b.up === null ? null : `${(CML + i * CW/bands.length + CW/bands.length/2).toFixed(1)},${(CMT + scaleY(b.up, min, max)).toFixed(1)}`).filter(Boolean).join(" ");
      const lowerPts = bands.map((b, i) => b.dn === null ? null : `${(CML + i * CW/bands.length + CW/bands.length/2).toFixed(1)},${(CMT + scaleY(b.dn, min, max)).toFixed(1)}`).filter(Boolean).join(" ");
      const fillD = `M ${upperPts.split(" ").join(" L ")} L ${lowerPts.split(" ").reverse().join(" L ")} Z`;
      return grid(min, max, 4, t) + `<path d="${fillD}" fill="${t.bandFill}"/>` + candles(data, min, max, t) +
             line(bands.map(b => b.up), min, max, 0, CH, t.band, 1.4, "4,3") +
             line(bands.map(b => b.mid), min, max, 0, CH, t.ma1, 2) +
             line(bands.map(b => b.dn), min, max, 0, CH, t.band, 1.4, "4,3") + timeAxis(data.length, t);
    }
    case "RSI": {
      const MH = CH * 0.66, RH = CH - MH - 8, RT = MH + 8;
      const rsiVals = rsi(closes);
      const rOBY = (CMT + RT + scaleY(70, 0, 100, RH)).toFixed(1);
      const rOSY = (CMT + RT + scaleY(30, 0, 100, RH)).toFixed(1);
      const rBotY = (CMT + RT + RH).toFixed(1);
      return grid(min, max, 4, t, 0, MH) + candles(data, min, max, t) +
             `<rect x="${CML}" y="${(CMT+RT).toFixed(1)}" width="${CW}" height="${RH}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.5"/>` +
             `<rect x="${CML}" y="${rOBY}" width="${CW}" height="${(+rBotY - +rOBY).toFixed(1)}" fill="${t.zone2}"/>` +
             `<rect x="${CML}" y="${(CMT+RT).toFixed(1)}" width="${CW}" height="${(+rOSY - CMT - RT).toFixed(1)}" fill="${t.zone1}"/>` +
             `<line x1="${CML}" y1="${rOBY}" x2="${CML+CW}" y2="${rOBY}" stroke="${t.bear}" stroke-width="0.8" stroke-dasharray="3,2"/>` +
             `<line x1="${CML}" y1="${rOSY}" x2="${CML+CW}" y2="${rOSY}" stroke="${t.bull}" stroke-width="0.8" stroke-dasharray="3,2"/>` +
             `<text x="${CML+4}" y="${(CMT+RT+13).toFixed(1)}" font-size="9" fill="${t.text}" font-family="sans-serif">RSI (14)</text>` +
             line(rsiVals, 0, 100, RT, RH, t.rsiLine, 1.8) + timeAxis(data.length, t);
    }
    case "ZONE": {
      const rand = seededRand(seed * 3);
      const step = CW / data.length;
      let zones = "";
      for (let z = 0; z < 4; z++) {
        const idx = 4 + Math.floor(rand() * (data.length - 10));
        const zh = (max - min) * (0.02 + rand() * 0.03);
        const zb = data[idx].c;
        const bull = data[idx].c > data[idx].o;
        zones += `<rect x="${(CML + idx * step).toFixed(1)}" y="${(CMT + scaleY(zb + zh, min, max)).toFixed(1)}" width="${((data.length - idx) * step).toFixed(1)}" height="${(scaleY(zb - zh, min, max) - scaleY(zb + zh, min, max)).toFixed(1)}" fill="${bull ? t.zone1 : t.zone2}" stroke="${bull ? t.bull : t.bear}" stroke-width="0.6" stroke-dasharray="3,2"/>`;
      }
      return grid(min, max, 4, t) + zones + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "RANGE": {
      const lb = Math.floor(data.length * 0.4);
      const res = Math.max(...data.slice(0, lb).map(c => c.h));
      const sup = Math.min(...data.slice(0, lb).map(c => c.l));
      const ry = (CMT + scaleY(res, min, max)).toFixed(1), sy = (CMT + scaleY(sup, min, max)).toFixed(1);
      return grid(min, max, 4, t) +
             `<rect x="${CML}" y="${ry}" width="${CW}" height="${(+sy - +ry).toFixed(1)}" fill="${t.bandFill}"/>` +
             `<line x1="${CML}" y1="${ry}" x2="${CML+CW}" y2="${ry}" stroke="${t.bear}" stroke-width="2" stroke-dasharray="5,3"/>` +
             `<line x1="${CML}" y1="${sy}" x2="${CML+CW}" y2="${sy}" stroke="${t.bull}" stroke-width="2" stroke-dasharray="5,3"/>` +
             `<text x="${(CML+5).toFixed(1)}" y="${(+ry-5).toFixed(1)}" font-size="10" fill="${t.bear}" font-family="sans-serif">Resistance</text>` +
             `<text x="${(CML+5).toFixed(1)}" y="${(+sy+14).toFixed(1)}" font-size="10" fill="${t.bull}" font-family="sans-serif">Support</text>` +
             candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "FIB": {
      const high = max, low = min, range = high - low;
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const cols = [t.ma1, t.ma2, t.ma3, t.text, t.ma3, t.ma2, t.ma1];
      let fibs = "";
      levels.forEach((lv, i) => {
        const price = low + range * (1 - lv);
        const y = (CMT + scaleY(price, min, max)).toFixed(1);
        fibs += `<line x1="${CML}" y1="${y}" x2="${CML+CW}" y2="${y}" stroke="${cols[i]}" stroke-width="${i===0||i===6?1.8:1}" stroke-dasharray="${i===0||i===6?"":"4,3"}"/>`;
        fibs += `<text x="${(CML+CW+4).toFixed(1)}" y="${(+y+4).toFixed(1)}" font-size="8.5" fill="${cols[i]}" font-family="sans-serif">${(lv*100).toFixed(1)}%</text>`;
      });
      return fibs + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "ATR": {
      const MH = CH * 0.66, AH = CH - MH - 8, AT = MH + 8;
      const atrVals = atr(data);
      const atrMax = Math.max(...atrVals.filter(Boolean)) * 1.1;
      return grid(min, max, 4, t, 0, MH) + candles(data, min, max, t) +
             `<rect x="${CML}" y="${(CMT+AT).toFixed(1)}" width="${CW}" height="${AH}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.5"/>` +
             `<text x="${CML+4}" y="${(CMT+AT+13).toFixed(1)}" font-size="9" fill="${t.text}" font-family="sans-serif">ATR (14)</text>` +
             line(atrVals, 0, atrMax, AT, AH, t.ma3, 1.8) + timeAxis(data.length, t);
    }
    case "ARB": {
      const rand = seededRand(seed + 1000);
      const c2 = closes.map(v => v * (0.72 + rand() * 0.06) + (rand() - 0.5) * 4);
      const allMin = Math.min(...closes, ...c2) * 0.99, allMax = Math.max(...closes, ...c2) * 1.01;
      return grid(allMin, allMax, 4, t) + line(closes, allMin, allMax, 0, CH, t.ma1, 2) + line(c2, allMin, allMax, 0, CH, t.ma2, 2) + timeAxis(data.length, t);
    }
    case "GRID": {
      const numG = 6;
      let gLines = "";
      for (let i = 0; i <= numG; i++) {
        const price = min + (max - min) * (i / numG);
        const y = (CMT + scaleY(price, min, max)).toFixed(1);
        gLines += `<line x1="${CML}" y1="${y}" x2="${CML+CW}" y2="${y}" stroke="${t.ma2}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
      }
      return grid(min, max, 0, t) + gLines + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "DCA": {
      const step = CW / data.length;
      const interval = Math.floor(data.length / 7);
      let entries = "";
      for (let i = interval; i < data.length; i += interval) {
        const x = (CML + i * step + step / 2).toFixed(1);
        const y = (CMT + scaleY(data[i].c, min, max)).toFixed(1);
        entries += `<line x1="${x}" y1="${CMT}" x2="${x}" y2="${CMT+CH}" stroke="${t.bull}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.5"/>`;
        entries += `<circle cx="${x}" cy="${y}" r="5" fill="${t.bull}" opacity="0.85"/>`;
      }
      return grid(min, max, 4, t) + entries + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "SWING": {
      let markers = "";
      const step = CW / data.length;
      for (let i = 3; i < data.length - 3; i++) {
        const isH = data[i].h > data[i-1].h && data[i].h > data[i-2].h && data[i].h > data[i+1].h && data[i].h > data[i+2].h;
        const isL = data[i].l < data[i-1].l && data[i].l < data[i-2].l && data[i].l < data[i+1].l && data[i].l < data[i+2].l;
        const x = (CML + i * step + step / 2).toFixed(1);
        if (isH) markers += `<text x="${x}" y="${(CMT + scaleY(data[i].h, min, max) - 8).toFixed(1)}" text-anchor="middle" font-size="13" fill="${t.bear}">▾</text>`;
        if (isL) markers += `<text x="${x}" y="${(CMT + scaleY(data[i].l, min, max) + 17).toFixed(1)}" text-anchor="middle" font-size="13" fill="${t.bull}">▴</text>`;
      }
      return grid(min, max, 4, t) + candles(data, min, max, t) + markers + timeAxis(data.length, t);
    }
    case "PA": {
      return grid(min, max, 4, t) + candles(data, min, max, t) + line(sma(closes, 20), min, max, 0, CH, t.ma1, 1.8, "5,3") + timeAxis(data.length, t);
    }
    case "WYCK": {
      const n = data.length, q = Math.floor(n / 4);
      const phases = [
        { label: "Accum.", color: t.bull, cx: 0.5 },
        { label: "Markup", color: t.ma1, cx: 1.5 },
        { label: "Dist.",  color: t.bear, cx: 2.5 },
        { label: "Mkdn.", color: t.ma2, cx: 3.5 },
      ];
      let ph = "";
      phases.forEach(p => {
        const x = (CML + p.cx * q * CW / n).toFixed(1);
        ph += `<line x1="${x}" y1="${CMT}" x2="${x}" y2="${CMT+CH}" stroke="${p.color}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.5"/>`;
        ph += `<text x="${x}" y="${(CMT+16).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${p.color}" font-family="sans-serif">${p.label}</text>`;
      });
      return grid(min, max, 4, t) + ph + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "ELLIOTT": {
      const n = data.length;
      const wPts = [0, 10, 20, 30, 40, 52, 60, 66, 72].map(p => Math.floor(p * n / 75));
      const wLabels = ["0","1","2","3","4","5","A","B","C"];
      const wCols = [t.text, t.bull, t.ma1, t.bull, t.ma1, t.bull, t.bear, t.ma2, t.bear];
      const step = CW / n;
      let lines = "", marks = "";
      for (let i = 1; i < wPts.length; i++) {
        const x1 = (CML + wPts[i-1]*step+step/2).toFixed(1), y1 = (CMT+scaleY(data[wPts[i-1]].c,min,max)).toFixed(1);
        const x2 = (CML + wPts[i]*step+step/2).toFixed(1),   y2 = (CMT+scaleY(data[wPts[i]].c,min,max)).toFixed(1);
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${wCols[i]}" stroke-width="2.2"/>`;
      }
      wPts.forEach((idx, i) => {
        const x = (CML + idx*step+step/2).toFixed(1), y = (CMT+scaleY(data[idx].c,min,max)-14).toFixed(1);
        marks += `<circle cx="${x}" cy="${(+y+6).toFixed(1)}" r="9" fill="${wCols[Math.min(i,wCols.length-1)]}"/>`;
        marks += `<text x="${x}" y="${(+y+10).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.bg}" font-family="sans-serif">${wLabels[i]}</text>`;
      });
      return grid(min, max, 4, t) + candles(data, min, max, t) + lines + marks + timeAxis(data.length, t);
    }
    case "NEWS": {
      const step = CW / data.length;
      const evIdxs = [10, 25, 42, 58].filter(i => i < data.length);
      let evs = "";
      evIdxs.forEach(idx => {
        const x = (CML + idx * step + step / 2).toFixed(1);
        evs += `<rect x="${(+x-0.5).toFixed(1)}" y="${CMT}" width="1" height="${CH}" fill="${t.ma1}" opacity="0.55"/>`;
        evs += `<text x="${x}" y="${(CMT+16).toFixed(1)}" text-anchor="middle" font-size="11" fill="${t.ma1}">⚡</text>`;
      });
      return grid(min, max, 4, t) + evs + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "GAP": {
      const step = CW / data.length;
      let gaps = "";
      for (let i = 1; i < data.length; i++) {
        const gapSize = Math.abs(data[i].o - data[i-1].c);
        if (gapSize > (max - min) * 0.015) {
          const x = (CML + i * step).toFixed(1);
          const y1 = (CMT + scaleY(Math.max(data[i].o, data[i-1].c), min, max)).toFixed(1);
          const y2 = (CMT + scaleY(Math.min(data[i].o, data[i-1].c), min, max)).toFixed(1);
          const bull = data[i].o > data[i-1].c;
          gaps += `<rect x="${x}" y="${y1}" width="${(step*4).toFixed(1)}" height="${(+y2 - +y1).toFixed(1)}" fill="${bull ? t.zone1 : t.zone2}" stroke="${bull ? t.bull : t.bear}" stroke-width="0.7" stroke-dasharray="3,2"/>`;
        }
      }
      return grid(min, max, 4, t) + gaps + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    case "TRIPLE": {
      const pw = Math.floor(CW / 3) - 6;
      let sv = "";
      ["Weekly","Daily","Intraday"].forEach((label, pi) => {
        const ox = CML + pi * (pw + 9);
        const sub = data.filter((_, i) => i % (pi===0 ? 3 : 1) === 0).slice(0, 30);
        const sm = Math.min(...sub.map(c=>c.l))*0.997, sM = Math.max(...sub.map(c=>c.h))*1.003;
        const st = pw / sub.length;
        sv += `<rect x="${ox}" y="${CMT}" width="${pw}" height="${CH}" fill="${t.panelBg}" stroke="${t.border}" stroke-width="0.7"/>`;
        sv += `<text x="${(ox+pw/2).toFixed(1)}" y="${(CMT+14).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${t.label}" font-family="sans-serif">${label}</text>`;
        sub.forEach((c, i) => {
          const x = ox + i * st + st / 2;
          const col = c.c >= c.o ? t.bull : t.bear;
          const yH = CMT+scaleY(c.h,sm,sM), yL = CMT+scaleY(c.l,sm,sM);
          const yO = CMT+scaleY(c.o,sm,sM), yC = CMT+scaleY(c.c,sm,sM);
          const bw = Math.max(1.2, st*0.55), bt = Math.min(yO,yC), bh = Math.max(1, Math.abs(yO-yC));
          sv += `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${col}" stroke-width="1"/>`;
          sv += `<rect x="${(x-bw/2).toFixed(1)}" y="${bt.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" rx="0.3"/>`;
        });
      });
      return sv;
    }
    case "SWEEP": {
      const step = CW / data.length;
      let sweeps = "";
      for (let i = 5; i < data.length - 5; i++) {
        const lh = Math.max(...data.slice(i-4,i).map(c=>c.h));
        if (data[i].h > lh * 1.002 && data[i].c < lh) {
          const x = (CML + i * step + step / 2).toFixed(1);
          const y = (CMT + scaleY(lh, min, max)).toFixed(1);
          sweeps += `<line x1="${CML}" y1="${y}" x2="${CML+CW}" y2="${y}" stroke="${t.bear}" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>`;
          sweeps += `<text x="${x}" y="${(+y-6).toFixed(1)}" text-anchor="middle" font-size="9" fill="${t.bear}" font-family="sans-serif">sweep</text>`;
        }
      }
      return grid(min, max, 4, t) + sweeps + candles(data, min, max, t) + timeAxis(data.length, t);
    }
    default:
      return grid(min, max, 4, t) + candles(data, min, max, t) + timeAxis(data.length, t);
  }
}

// ── Info panel SVG ────────────────────────────────────────────────────────────
function e(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function infoPanel(slug, cfg, theme) {
  const t = theme === "dark" ? DARK : LIGHT;
  const cat = CATS[cfg.cat];
  const accent = theme === "dark" ? cat.dark : cat.light;
  const ix = INFO_X;

  let svg = "";

  // Panel background
  svg += `<rect x="${ix}" y="0" width="${INFO_W}" height="${H}" fill="${t.infoBg}"/>`;
  // Left accent stripe
  svg += `<rect x="${ix}" y="0" width="5" height="${H}" fill="${accent}"/>`;
  // Subtle gradient overlay at top
  svg += `<defs><linearGradient id="hdr${slug.slice(0,4)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>`;
  svg += `<rect x="${ix+5}" y="0" width="${INFO_W-5}" height="160" fill="url(#hdr${slug.slice(0,4)})"/>`;

  // Category badge
  const bx = ix + 20, by = 28;
  const bw2 = cat.label.length * 6.8 + 16;
  svg += `<rect x="${bx}" y="${by}" width="${bw2}" height="20" rx="10" fill="${accent}" opacity="0.18"/>`;
  svg += `<rect x="${bx}" y="${by}" width="${bw2}" height="20" rx="10" fill="none" stroke="${accent}" stroke-width="1"/>`;
  svg += `<text x="${(bx + bw2/2).toFixed(1)}" y="${by+14}" text-anchor="middle" font-size="10" font-weight="600" fill="${accent}" font-family="sans-serif">${e(cat.label.toUpperCase())}</text>`;

  // Strategy name — wrap at ~20 chars
  const words = cfg.name.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 20) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);

  const nameY = by + 38;
  lines.forEach((ln, i) => {
    svg += `<text x="${ix+20}" y="${nameY + i*30}" font-size="${lines.length > 1 ? 22 : 24}" font-weight="700" fill="${t.infoText}" font-family="sans-serif">${e(ln)}</text>`;
  });

  // Tagline
  const tagY = nameY + lines.length * 30 + 6;
  const tagWords = cfg.tagline.split(" ");
  const tagLines = []; let tCur = "";
  for (const w of tagWords) {
    if ((tCur + " " + w).trim().length > 30) { tagLines.push(tCur.trim()); tCur = w; }
    else tCur = (tCur + " " + w).trim();
  }
  if (tCur) tagLines.push(tCur);
  tagLines.forEach((ln, i) => {
    svg += `<text x="${ix+20}" y="${tagY + i*17}" font-size="12" fill="${t.infoMuted}" font-family="sans-serif" font-style="italic">${e(ln)}</text>`;
  });

  // Divider
  const divY = tagY + tagLines.length * 17 + 14;
  svg += `<line x1="${ix+20}" y1="${divY}" x2="${ix+INFO_W-20}" y2="${divY}" stroke="${t.border}" stroke-width="0.8"/>`;

  // Key parameters
  const paramY = divY + 18;
  svg += `<text x="${ix+20}" y="${paramY}" font-size="10" font-weight="600" fill="${accent}" font-family="sans-serif" letter-spacing="0.8">KEY PARAMETERS</text>`;
  cfg.params.forEach((p, i) => {
    const py2 = paramY + 18 + i * 22;
    svg += `<circle cx="${ix+26}" cy="${py2-5}" r="3" fill="${accent}" opacity="0.7"/>`;
    svg += `<text x="${ix+36}" y="${py2}" font-size="11.5" fill="${t.infoText}" font-family="sans-serif">${e(p)}</text>`;
  });

  // Signal section
  const sigY = paramY + 18 + cfg.params.length * 22 + 16;
  svg += `<line x1="${ix+20}" y1="${sigY}" x2="${ix+INFO_W-20}" y2="${sigY}" stroke="${t.border}" stroke-width="0.8"/>`;
  svg += `<text x="${ix+20}" y="${sigY+16}" font-size="10" font-weight="600" fill="${accent}" font-family="sans-serif" letter-spacing="0.8">SIGNAL</text>`;

  // BUY signal
  const buyY = sigY + 34;
  svg += `<rect x="${ix+20}" y="${buyY-13}" width="32" height="16" rx="4" fill="${t.bull}" opacity="0.15"/>`;
  svg += `<text x="${ix+36}" y="${buyY}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.bull}" font-family="sans-serif">BUY</text>`;
  // wrap buy signal text
  const buyWords2 = cfg.buy.split(" ");
  const buyLines = []; let bCur = "";
  for (const w of buyWords2) {
    if ((bCur + " " + w).trim().length > 28) { buyLines.push(bCur.trim()); bCur = w; }
    else bCur = (bCur + " " + w).trim();
  }
  if (bCur) buyLines.push(bCur);
  buyLines.forEach((ln, i) => {
    svg += `<text x="${ix+58}" y="${buyY + i*16}" font-size="11" fill="${t.infoText}" font-family="sans-serif">${e(ln)}</text>`;
  });

  // SELL signal
  const sellY = buyY + buyLines.length * 16 + 12;
  svg += `<rect x="${ix+20}" y="${sellY-13}" width="32" height="16" rx="4" fill="${t.bear}" opacity="0.15"/>`;
  svg += `<text x="${ix+36}" y="${sellY}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.bear}" font-family="sans-serif">SELL</text>`;
  const sellWords2 = cfg.sell.split(" ");
  const sellLines = []; let sCur = "";
  for (const w of sellWords2) {
    if ((sCur + " " + w).trim().length > 28) { sellLines.push(sCur.trim()); sCur = w; }
    else sCur = (sCur + " " + w).trim();
  }
  if (sCur) sellLines.push(sCur);
  sellLines.forEach((ln, i) => {
    svg += `<text x="${ix+58}" y="${sellY + i*16}" font-size="11" fill="${t.infoText}" font-family="sans-serif">${e(ln)}</text>`;
  });

  // Bottom: TF + risk + branding
  const botY = H - 44;
  svg += `<line x1="${ix+20}" y1="${botY}" x2="${ix+INFO_W-20}" y2="${botY}" stroke="${t.border}" stroke-width="0.8"/>`;
  svg += `<text x="${ix+20}" y="${botY+16}" font-size="10" fill="${t.infoMuted}" font-family="sans-serif">TF: ${e(cfg.tf)}</text>`;
  svg += `<text x="${ix+20}" y="${botY+30}" font-size="10" fill="${t.infoMuted}" font-family="sans-serif">Risk: ${e(cfg.risk)}</text>`;
  svg += `<text x="${ix+INFO_W-15}" y="${botY+30}" text-anchor="end" font-size="10" font-weight="600" fill="${accent}" font-family="sans-serif">invest-begin.com</text>`;

  return svg;
}

// ── Chart frame ───────────────────────────────────────────────────────────────
function chartFrame(slug, cfg, t) {
  const cat = CATS[cfg.cat];
  const accent = t === DARK ? cat.dark : cat.light;
  return `
    <rect width="${CHART_W}" height="${H}" fill="${t.chartBg}"/>
    <rect x="${CML}" y="${CMT}" width="${CW}" height="${CH}" fill="none" stroke="${t.border}" stroke-width="0.7"/>
    <text x="${CML}" y="26" font-size="13" font-weight="700" fill="${t.label}" font-family="sans-serif">${e(cfg.name)}</text>
    <text x="${CML}" y="42" font-size="10" fill="${t.text}" font-family="sans-serif">${e(cfg.tagline)}</text>`;
}

// ── Build full SVG ────────────────────────────────────────────────────────────
function buildSvg(slug, cfg, theme) {
  const t = theme === "dark" ? DARK : LIGHT;
  const chartContent = renderChart(slug, cfg, t);
  const infoPanelContent = infoPanel(slug, cfg, theme);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <rect x="${INFO_X}" y="0" width="1" height="${H}" fill="${t.border}"/>
  ${chartFrame(slug, cfg, t)}
  ${chartContent}
  ${infoPanelContent}
</svg>`;
}

function toPng(svg) {
  return new Resvg(svg, {
    font: {
      loadSystemFonts: true,
      fontDirs: ["/System/Library/Fonts/", "/Library/Fonts/"],
    },
  }).render().asPng();
}

// ── Main ──────────────────────────────────────────────────────────────────────
[OUT_LIGHT, OUT_DARK, DESK_LIGHT].forEach(d => mkdirSync(d, { recursive: true }));
const DESK_DARK = resolve(process.env.HOME, "Desktop/strategy-charts");

console.log(`\n🎨  Generating ${Object.keys(STRATEGIES).length * 2} professional chart images...\n`);
let count = 0;
for (const [slug, cfg] of Object.entries(STRATEGIES)) {
  for (const theme of ["light", "dark"]) {
    const svg = buildSvg(slug, cfg, theme);
    const png = toPng(svg);
    const outDir = theme === "light" ? OUT_LIGHT : OUT_DARK;
    writeFileSync(resolve(outDir, `${slug}.png`), png);
    // Also write flat copies to Desktop folder
    writeFileSync(resolve(DESK_DARK, `${slug}-${theme}.png`), png);
    count++;
  }
  process.stdout.write(`  ✅  ${slug}\n`);
}

console.log(`\n✅  ${count} images generated.`);
console.log(`   Light → public/images/strategies/light/`);
console.log(`   Dark  → public/images/strategies/dark/`);
console.log(`   All   → ~/Desktop/strategy-charts/\n`);
