import { BotDoc, ExchangeDoc, Signal, StrategyDoc } from "../types/domain";
import { fetchAlpacaStockBars, fetchBinanceCandles, fetchCandlesViaYfinance } from "./marketData";
import { buildMarketContext } from "./indicators";
import { isCryptoLikeSymbol } from "./marketSession";

function signalByPreferredSide(candidate: "buy" | "sell", preferred: "buy" | "sell", reason: string): Signal | null {
  if (candidate !== preferred) return null;
  return { side: candidate, reason };
}

// Exchanges that trade crypto assets 24/7 — use Binance/yfinance for market data
const CRYPTO_EXCHANGES = new Set([
  "binance", "coinbase",
  "kraken",
  "bybit", "bybit-testnet",
  "okx", "okx-demo",
  "kucoin", "kucoin-sandbox",
  "bitfinex",
  "gateio",
  "mexc",
  "deribit", "deribit-testnet",
]);

// Exchanges that trade equities — use Alpaca or yfinance for market data
const STOCK_EXCHANGES = new Set([
  "alpaca", "alpaca-paper",
  "tradier", "tradier-sandbox",
  "tastytrade",
  "schwab", "schwab-paper",
  "interactive-brokers", "interactive-brokers-paper",
  "ig-group", "ig-group-demo",
]);

export async function evaluateStrategySignal(
  strategy: StrategyDoc,
  bot: BotDoc,
  exchangeId: string,
  exchange: ExchangeDoc,
): Promise<Signal | null> {
  const preferredSide: "buy" | "sell" = strategy.tradeSide === "sell" ? "sell" : "buy";
  const templateId = String(strategy.templateId || "");

  let candles;
  if (CRYPTO_EXCHANGES.has(exchangeId)) {
    // All crypto exchanges: use Binance candles (yfinance preferred, Binance REST fallback)
    candles = await fetchBinanceCandles(bot.symbol, bot.timeframe, 140);
  } else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
    if (isCryptoLikeSymbol(bot.symbol)) {
      candles = await fetchBinanceCandles(bot.symbol, bot.timeframe, 140);
    } else {
      const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
      const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
      candles = await fetchAlpacaStockBars(apiKey, apiSecret, bot.symbol, bot.timeframe, 140);
    }
  } else if (STOCK_EXCHANGES.has(exchangeId)) {
    // All other stock exchanges: use yfinance via the generic fetcher
    candles = await fetchCandlesViaYfinance(bot.symbol, bot.timeframe, 140);
  } else {
    return null;
  }

  const market = buildMarketContext(candles);
  if (!market) return null;

  const emaBullCross = market.ema9Previous <= market.ema21Previous && market.ema9Current > market.ema21Current;
  const emaBearCross = market.ema9Previous >= market.ema21Previous && market.ema9Current < market.ema21Current;
  const macdBullCross = market.macdPrevious <= market.macdSignalPrevious && market.macdCurrent > market.macdSignalCurrent;
  const macdBearCross = market.macdPrevious >= market.macdSignalPrevious && market.macdCurrent < market.macdSignalCurrent;
  const rsiOversoldCross = market.rsiPrevious <= 30 && market.rsiCurrent > 30;
  const rsiOverboughtCross = market.rsiPrevious >= 70 && market.rsiCurrent < 70;
  const breakoutUp = market.current > market.priorHigh20 && market.currentVolume >= market.volumeAverage * 1.15;
  const breakoutDown = market.current < market.priorLow20 && market.currentVolume >= market.volumeAverage * 1.15;
  const vwapDeviation = market.vwap30 > 0 ? (market.current - market.vwap30) / market.vwap30 : 0;
  const highVol = market.atr14 > 0 && (market.atr14 / market.current) * 100 > 0.8;
  const lowVol = market.atr14 > 0 && (market.atr14 / market.current) * 100 < 0.5;

  switch (templateId) {
    case "ema-crossover":
      if (emaBullCross) return signalByPreferredSide("buy", preferredSide, "EMA9 crossed above EMA21");
      if (emaBearCross) return signalByPreferredSide("sell", preferredSide, "EMA9 crossed below EMA21");
      return null;
    case "macd-trend":
      if (macdBullCross && market.macdCurrent > 0) return signalByPreferredSide("buy", preferredSide, "MACD bullish crossover");
      if (macdBearCross && market.macdCurrent < 0) return signalByPreferredSide("sell", preferredSide, "MACD bearish crossover");
      return null;
    case "rsi-reversal":
      if (rsiOversoldCross) return signalByPreferredSide("buy", preferredSide, "RSI recovered from oversold");
      if (rsiOverboughtCross) return signalByPreferredSide("sell", preferredSide, "RSI faded from overbought");
      return null;
    case "breakout":
      if (breakoutUp) return signalByPreferredSide("buy", preferredSide, "Upside breakout with volume");
      if (breakoutDown) return signalByPreferredSide("sell", preferredSide, "Downside breakout with volume");
      return null;
    case "grid":
      if (market.current <= market.bbLower && lowVol) return signalByPreferredSide("buy", preferredSide, "Grid lower band fill");
      if (market.current >= market.bbUpper && lowVol) return signalByPreferredSide("sell", preferredSide, "Grid upper band reduce");
      return null;
    case "scalping":
      if (emaBullCross && market.currentVolume >= market.volumeAverage) return signalByPreferredSide("buy", preferredSide, "Short-term bullish impulse");
      if (emaBearCross && market.currentVolume >= market.volumeAverage) return signalByPreferredSide("sell", preferredSide, "Short-term bearish impulse");
      return null;
    case "supertrend":
      if (emaBullCross && highVol) return signalByPreferredSide("buy", preferredSide, "Bullish trend flip");
      if (emaBearCross && highVol) return signalByPreferredSide("sell", preferredSide, "Bearish trend flip");
      return null;
    case "vwap-reversion":
      if (vwapDeviation <= -0.015 && market.current > market.previous) return signalByPreferredSide("buy", preferredSide, "Mean reversion up");
      if (vwapDeviation >= 0.015 && market.current < market.previous) return signalByPreferredSide("sell", preferredSide, "Mean reversion down");
      return null;
    case "dca":
      return signalByPreferredSide("buy", preferredSide, "DCA interval trigger");
    default:
      return null;
  }
}
