"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateStrategySignal = evaluateStrategySignal;
const marketData_1 = require("./marketData");
const indicators_1 = require("./indicators");
const marketSession_1 = require("./marketSession");
function signalByPreferredSide(candidate, preferred, reason) {
    if (candidate !== preferred)
        return null;
    return { side: candidate, reason };
}
async function evaluateStrategySignal(strategy, bot, exchangeId, exchange) {
    const preferredSide = strategy.tradeSide === "sell" ? "sell" : "buy";
    const templateId = String(strategy.templateId || "");
    let candles;
    if (exchangeId === "binance") {
        candles = await (0, marketData_1.fetchBinanceCandles)(bot.symbol, bot.timeframe, 140);
    }
    else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
        if ((0, marketSession_1.isCryptoLikeSymbol)(bot.symbol)) {
            candles = await (0, marketData_1.fetchBinanceCandles)(bot.symbol, bot.timeframe, 140);
        }
        else {
            const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
            const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
            candles = await (0, marketData_1.fetchAlpacaStockBars)(apiKey, apiSecret, bot.symbol, bot.timeframe, 140);
        }
    }
    else {
        return null;
    }
    const market = (0, indicators_1.buildMarketContext)(candles);
    if (!market)
        return null;
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
            if (emaBullCross)
                return signalByPreferredSide("buy", preferredSide, "EMA9 crossed above EMA21");
            if (emaBearCross)
                return signalByPreferredSide("sell", preferredSide, "EMA9 crossed below EMA21");
            return null;
        case "macd-trend":
            if (macdBullCross && market.macdCurrent > 0)
                return signalByPreferredSide("buy", preferredSide, "MACD bullish crossover");
            if (macdBearCross && market.macdCurrent < 0)
                return signalByPreferredSide("sell", preferredSide, "MACD bearish crossover");
            return null;
        case "rsi-reversal":
            if (rsiOversoldCross)
                return signalByPreferredSide("buy", preferredSide, "RSI recovered from oversold");
            if (rsiOverboughtCross)
                return signalByPreferredSide("sell", preferredSide, "RSI faded from overbought");
            return null;
        case "breakout":
            if (breakoutUp)
                return signalByPreferredSide("buy", preferredSide, "Upside breakout with volume");
            if (breakoutDown)
                return signalByPreferredSide("sell", preferredSide, "Downside breakout with volume");
            return null;
        case "grid":
            if (market.current <= market.bbLower && lowVol)
                return signalByPreferredSide("buy", preferredSide, "Grid lower band fill");
            if (market.current >= market.bbUpper && lowVol)
                return signalByPreferredSide("sell", preferredSide, "Grid upper band reduce");
            return null;
        case "scalping":
            if (emaBullCross && market.currentVolume >= market.volumeAverage)
                return signalByPreferredSide("buy", preferredSide, "Short-term bullish impulse");
            if (emaBearCross && market.currentVolume >= market.volumeAverage)
                return signalByPreferredSide("sell", preferredSide, "Short-term bearish impulse");
            return null;
        case "supertrend":
            if (emaBullCross && highVol)
                return signalByPreferredSide("buy", preferredSide, "Bullish trend flip");
            if (emaBearCross && highVol)
                return signalByPreferredSide("sell", preferredSide, "Bearish trend flip");
            return null;
        case "vwap-reversion":
            if (vwapDeviation <= -0.015 && market.current > market.previous)
                return signalByPreferredSide("buy", preferredSide, "Mean reversion up");
            if (vwapDeviation >= 0.015 && market.current < market.previous)
                return signalByPreferredSide("sell", preferredSide, "Mean reversion down");
            return null;
        case "dca":
            return signalByPreferredSide("buy", preferredSide, "DCA interval trigger");
        default:
            return null;
    }
}
