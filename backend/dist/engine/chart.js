"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInstrumentChart = resolveInstrumentChart;
const repository_1 = require("./repository");
const marketData_1 = require("./marketData");
const marketSession_1 = require("./marketSession");
async function resolveInstrumentChart(uid, strategyId) {
    const strategy = await (0, repository_1.getStrategy)(uid, strategyId);
    if (!strategy)
        throw new Error("Strategy not found");
    const botId = String(strategy.assignedBotId || "");
    if (!botId)
        throw new Error("Strategy has no assigned bot");
    const bot = await (0, repository_1.getBot)(uid, botId);
    if (!bot)
        throw new Error("Assigned bot not found");
    const exchange = await (0, repository_1.getExchangeByLabel)(uid, bot.exchangeLabel);
    if (!exchange)
        throw new Error("Exchange not found");
    const exchangeId = String(bot.exchangeId || exchange.exchangeId || "");
    let candles;
    if (exchangeId === "binance") {
        candles = await (0, marketData_1.fetchBinanceCandles)(bot.symbol, bot.timeframe, 80);
    }
    else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
        if ((0, marketSession_1.isCryptoLikeSymbol)(bot.symbol)) {
            candles = await (0, marketData_1.fetchBinanceCandles)(bot.symbol, bot.timeframe, 80);
        }
        else {
            const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
            const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
            candles = await (0, marketData_1.fetchAlpacaStockBars)(apiKey, apiSecret, bot.symbol, bot.timeframe, 80);
        }
    }
    else {
        throw new Error(`Exchange ${exchangeId} is not supported for live chart data`);
    }
    if (!Array.isArray(candles) || candles.length < 2) {
        throw new Error("Not enough market data to build chart");
    }
    const closes = candles.map((c) => c.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const session = (0, marketSession_1.marketSessionForExchange)(exchangeId, bot.symbol, new Date());
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
