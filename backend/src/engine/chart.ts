import { getBot, getExchangeByLabel, getStrategy } from "./repository";
import { fetchAlpacaStockBars, fetchBinanceCandles } from "./marketData";
import { isCryptoLikeSymbol, marketSessionForExchange } from "./marketSession";

export async function resolveInstrumentChart(uid: string, strategyId: string) {
  const strategy = await getStrategy(uid, strategyId);
  if (!strategy) throw new Error("Strategy not found");

  const botId = String(strategy.assignedBotId || "");
  if (!botId) throw new Error("Strategy has no assigned bot");

  const bot = await getBot(uid, botId);
  if (!bot) throw new Error("Assigned bot not found");

  const exchange = await getExchangeByLabel(uid, bot.exchangeLabel);
  if (!exchange) throw new Error("Exchange not found");

  const exchangeId = String(bot.exchangeId || exchange.exchangeId || "");
  let candles;

  if (exchangeId === "binance") {
    candles = await fetchBinanceCandles(bot.symbol, bot.timeframe, 80);
  } else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
    if (isCryptoLikeSymbol(bot.symbol)) {
      candles = await fetchBinanceCandles(bot.symbol, bot.timeframe, 80);
    } else {
      const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
      const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
      candles = await fetchAlpacaStockBars(apiKey, apiSecret, bot.symbol, bot.timeframe, 80);
    }
  } else {
    throw new Error(`Exchange ${exchangeId} is not supported for live chart data`);
  }

  if (!Array.isArray(candles) || candles.length < 2) {
    throw new Error("Not enough market data to build chart");
  }

  const closes = candles.map((c) => c.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const session = marketSessionForExchange(exchangeId, bot.symbol, new Date());

  return {
    symbol: bot.symbol,
    timeframe: bot.timeframe,
    exchangeId,
    marketOpen: session.isOpen,
    marketStatusReason: session.reason,
    candles,
    lastPrice: last,
    changePct,
    updatedAt: new Date().toISOString(),
  };
}
