"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runActiveStrategies = exports.executeStrategyHttp = exports.getPortfolioHttp = exports.getPortfolio = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const corsHandler = (0, cors_1.default)({
    origin: ["https://autotrader-b8851.web.app", "http://localhost:4200"],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
async function fetchAlpacaPortfolio(apiKey, apiSecret, isPaper) {
    const baseUrl = isPaper
        ? "https://paper-api.alpaca.markets"
        : "https://api.alpaca.markets";
    const url = `${baseUrl}/v2/account`;
    console.log("🔗 Alpaca URL:", url, "isPaper:", isPaper);
    const response = await (0, node_fetch_1.default)(url, {
        headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": apiSecret,
        },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("❌ Alpaca error:", text);
        throw new functions.https.HttpsError("internal", `Alpaca API error ${response.status}: ${text}`);
    }
    const data = await response.json();
    const equity = parseFloat(data.equity || data.portfolio_value || "0");
    const lastEquity = parseFloat(data.last_equity || "0");
    const todayPnl = equity - lastEquity;
    const todayPnlPct = lastEquity > 0 ? (todayPnl / lastEquity) * 100 : 0;
    return {
        portfolioValue: equity,
        unrealizedPnl: todayPnl,
        pnlPercentage: todayPnlPct,
        updatedAt: new Date().toISOString(),
    };
}
async function fetchBinance24hTicker(symbol) {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    const response = await (0, node_fetch_1.default)(url);
    if (!response.ok) {
        return null;
    }
    const data = await response.json();
    const lastPrice = parseFloat(data.lastPrice || "0");
    const prevClosePrice = parseFloat(data.prevClosePrice || "0");
    if (!Number.isFinite(lastPrice) || !Number.isFinite(prevClosePrice)) {
        return null;
    }
    return { lastPrice, prevClosePrice };
}
async function fetchBinancePortfolio(apiKey, apiSecret) {
    const baseUrl = "https://api.binance.com";
    const endpoint = "/api/v3/account";
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(queryString)
        .digest("hex");
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    console.log("🔗 Binance URL:", url);
    const response = await (0, node_fetch_1.default)(url, {
        headers: { "X-MBX-APIKEY": apiKey },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("❌ Binance error:", text);
        throw new functions.https.HttpsError("internal", `Binance API error ${response.status}: ${text}`);
    }
    const data = await response.json();
    const balances = (data.balances || []).filter((asset) => {
        const totalQty = parseFloat(asset.free || "0") + parseFloat(asset.locked || "0");
        return totalQty > 0;
    });
    const stableCoins = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD"]);
    const valuedAssets = await Promise.all(balances.map(async (asset) => {
        const quantity = parseFloat(asset.free || "0") + parseFloat(asset.locked || "0");
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { currentValue: 0, previousValue: 0 };
        }
        const assetSymbol = String(asset.asset || "").toUpperCase();
        if (stableCoins.has(assetSymbol)) {
            return {
                currentValue: quantity,
                previousValue: quantity,
            };
        }
        const ticker = await fetchBinance24hTicker(`${assetSymbol}USDT`);
        if (!ticker) {
            return { currentValue: 0, previousValue: 0 };
        }
        return {
            currentValue: quantity * ticker.lastPrice,
            previousValue: quantity * ticker.prevClosePrice,
        };
    }));
    const totalCurrentValue = valuedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalPreviousValue = valuedAssets.reduce((sum, asset) => sum + asset.previousValue, 0);
    const todayPnl = totalCurrentValue - totalPreviousValue;
    const todayPnlPct = totalPreviousValue > 0 ? (todayPnl / totalPreviousValue) * 100 : 0;
    return {
        portfolioValue: totalCurrentValue,
        unrealizedPnl: todayPnl,
        pnlPercentage: todayPnlPct,
        updatedAt: new Date().toISOString(),
    };
}
async function resolvePortfolio(exchangeId, apiKey, apiSecretFromClient) {
    const sanitizedApiKey = (apiKey || "").replace(/\s+/g, "");
    const sanitizedApiSecret = (apiSecretFromClient || "").replace(/\s+/g, "");
    if (!exchangeId || !sanitizedApiKey || !sanitizedApiSecret) {
        console.error("❌ Missing exchangeId, apiKey, or apiSecret");
        throw new functions.https.HttpsError("invalid-argument", "Missing exchangeId, apiKey, or apiSecret");
    }
    if (exchangeId === "binance") {
        console.log("Fetching Binance portfolio...");
        return fetchBinancePortfolio(sanitizedApiKey, sanitizedApiSecret);
    }
    if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
        const isPaper = exchangeId === "alpaca-paper";
        console.log(`Fetching Alpaca portfolio (paper=${isPaper})...`);
        return fetchAlpacaPortfolio(sanitizedApiKey, sanitizedApiSecret, isPaper);
    }
    console.error(`Unsupported exchange: ${exchangeId}`);
    throw new functions.https.HttpsError("not-found", `Exchange not yet supported: ${exchangeId}`);
}
function normalizeBinanceSymbol(symbol) {
    return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function normalizeAlpacaSymbol(symbol) {
    const upper = String(symbol || "").toUpperCase().trim();
    if (!upper.includes("/")) {
        return upper;
    }
    return upper.replace("USDT", "USD");
}
function normalizeSymbolForMarketData(symbol) {
    const upper = String(symbol || "").toUpperCase().trim();
    if (!upper.includes("/")) {
        return upper;
    }
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    if (compact.endsWith("USD") && !compact.endsWith("USDT")) {
        return `${compact.slice(0, -3)}USDT`;
    }
    return compact;
}
function calculateEmaSeries(values, period) {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }
    const multiplier = 2 / (period + 1);
    const series = [];
    let previousEma = values[0];
    series.push(previousEma);
    for (let index = 1; index < values.length; index++) {
        const value = values[index];
        previousEma = (value - previousEma) * multiplier + previousEma;
        series.push(previousEma);
    }
    return series;
}
async function fetchBinanceClosePrices(symbol, timeframe, limit = 120) {
    const candles = await fetchBinanceCandles(symbol, timeframe, limit);
    return candles.map((candle) => candle.close);
}
async function fetchBinanceCandles(symbol, timeframe, limit = 120) {
    const normalizedSymbol = normalizeSymbolForMarketData(symbol);
    const interval = ["1m", "5m", "15m", "1h", "4h", "1d"].includes(String(timeframe || ""))
        ? String(timeframe)
        : "1h";
    const url = `https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${Math.max(limit, 40)}`;
    const response = await (0, node_fetch_1.default)(url);
    if (!response.ok) {
        return [];
    }
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : [];
    if (!Array.isArray(payload)) {
        return [];
    }
    return payload
        .map((candle) => ({
        open: Number.parseFloat(String(candle?.[1] || "0")),
        high: Number.parseFloat(String(candle?.[2] || "0")),
        low: Number.parseFloat(String(candle?.[3] || "0")),
        close: Number.parseFloat(String(candle?.[4] || "0")),
        volume: Number.parseFloat(String(candle?.[5] || "0")),
    }))
        .filter((candle) => Number.isFinite(candle.open)
        && Number.isFinite(candle.high)
        && Number.isFinite(candle.low)
        && Number.isFinite(candle.close)
        && candle.high >= candle.low
        && candle.close > 0);
}
function average(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function stdDev(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    const mean = average(values);
    const variance = average(values.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance);
}
function calculateRsiSeries(values, period = 14) {
    if (!Array.isArray(values) || values.length < period + 1) {
        return [];
    }
    const result = [];
    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index++) {
        const delta = values[index] - values[index - 1];
        if (delta >= 0) {
            gains += delta;
        }
        else {
            losses += Math.abs(delta);
        }
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const initialRs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
    result.push(100 - 100 / (1 + initialRs));
    for (let index = period + 1; index < values.length; index++) {
        const delta = values[index] - values[index - 1];
        const gain = delta > 0 ? delta : 0;
        const loss = delta < 0 ? Math.abs(delta) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
    }
    return result;
}
function calculateAtrSeries(candles, period = 14) {
    if (!Array.isArray(candles) || candles.length < period + 1) {
        return [];
    }
    const trueRanges = [];
    for (let index = 0; index < candles.length; index++) {
        const current = candles[index];
        const previousClose = index > 0 ? candles[index - 1].close : current.close;
        const tr = Math.max(current.high - current.low, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose));
        trueRanges.push(tr);
    }
    const atr = [];
    const firstWindow = trueRanges.slice(0, period);
    let previousAtr = average(firstWindow);
    atr.push(previousAtr);
    for (let index = period; index < trueRanges.length; index++) {
        previousAtr = (previousAtr * (period - 1) + trueRanges[index]) / period;
        atr.push(previousAtr);
    }
    return atr;
}
function calculateVwap(candles, period = 30) {
    if (!Array.isArray(candles) || candles.length === 0) {
        return 0;
    }
    const window = candles.slice(-period);
    let weightedPriceSum = 0;
    let volumeSum = 0;
    for (const candle of window) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        const volume = Number.isFinite(candle.volume) ? candle.volume : 0;
        weightedPriceSum += typicalPrice * volume;
        volumeSum += volume;
    }
    if (volumeSum <= 0) {
        return average(window.map((candle) => candle.close));
    }
    return weightedPriceSum / volumeSum;
}
function buildMarketContext(candles) {
    if (!Array.isArray(candles) || candles.length < 30) {
        return null;
    }
    const closes = candles.map((candle) => candle.close);
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const volumes = candles.map((candle) => candle.volume);
    const ema9 = calculateEmaSeries(closes, 9);
    const ema21 = calculateEmaSeries(closes, 21);
    const ema12 = calculateEmaSeries(closes, 12);
    const ema26 = calculateEmaSeries(closes, 26);
    if (ema9.length < 2 || ema21.length < 2 || ema12.length < 2 || ema26.length < 2) {
        return null;
    }
    const macdLine = ema12.map((value, index) => value - ema26[index]);
    const macdSignal = calculateEmaSeries(macdLine, 9);
    const rsiSeries = calculateRsiSeries(closes, 14);
    const atrSeries = calculateAtrSeries(candles, 14);
    const bbWindow = closes.slice(-20);
    const bbBasis = average(bbWindow);
    const bbSigma = stdDev(bbWindow);
    const bbUpper = bbBasis + bbSigma * 2;
    const bbLower = bbBasis - bbSigma * 2;
    const current = closes[closes.length - 1];
    const previous = closes[closes.length - 2];
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeAverage = average(volumes.slice(-20));
    const priorHigh20 = Math.max(...highs.slice(-21, -1));
    const priorLow20 = Math.min(...lows.slice(-21, -1));
    const roc14 = closes.length > 14
        ? ((current - closes[closes.length - 15]) / closes[closes.length - 15]) * 100
        : 0;
    const vwap30 = calculateVwap(candles, 30);
    const atrCurrent = atrSeries[atrSeries.length - 1] || 0;
    return {
        current,
        previous,
        ema9Current: ema9[ema9.length - 1],
        ema9Previous: ema9[ema9.length - 2],
        ema21Current: ema21[ema21.length - 1],
        ema21Previous: ema21[ema21.length - 2],
        macdCurrent: macdLine[macdLine.length - 1],
        macdPrevious: macdLine[macdLine.length - 2],
        macdSignalCurrent: macdSignal[macdSignal.length - 1],
        macdSignalPrevious: macdSignal[macdSignal.length - 2],
        rsiCurrent: rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : 50,
        rsiPrevious: rsiSeries.length > 1 ? rsiSeries[rsiSeries.length - 2] : 50,
        bbUpper,
        bbLower,
        bbBasis,
        roc14,
        vwap30,
        atr14: atrCurrent,
        priorHigh20,
        priorLow20,
        currentVolume,
        volumeAverage,
    };
}
function signalByPreferredSide(candidateSide, preferredSide, reason) {
    if (candidateSide !== preferredSide) {
        return null;
    }
    return {
        side: candidateSide,
        reason,
    };
}
async function evaluateStrategySignal(strategy, bot) {
    const templateId = String(strategy?.templateId || "");
    const preferredSide = String(strategy?.tradeSide || "buy").toLowerCase() === "sell" ? "sell" : "buy";
    const candles = await fetchBinanceCandles(bot?.symbol, bot?.timeframe, 140);
    const market = buildMarketContext(candles);
    if (!market) {
        return null;
    }
    const emaBullCross = market.ema9Previous <= market.ema21Previous && market.ema9Current > market.ema21Current;
    const emaBearCross = market.ema9Previous >= market.ema21Previous && market.ema9Current < market.ema21Current;
    const macdBullCross = market.macdPrevious <= market.macdSignalPrevious && market.macdCurrent > market.macdSignalCurrent;
    const macdBearCross = market.macdPrevious >= market.macdSignalPrevious && market.macdCurrent < market.macdSignalCurrent;
    const rsiOversoldCross = market.rsiPrevious <= 30 && market.rsiCurrent > 30;
    const rsiOverboughtCross = market.rsiPrevious >= 70 && market.rsiCurrent < 70;
    const breakoutUp = market.current > market.priorHigh20 && market.currentVolume >= market.volumeAverage * 1.15;
    const breakoutDown = market.current < market.priorLow20 && market.currentVolume >= market.volumeAverage * 1.15;
    const vwapDeviation = market.vwap30 > 0 ? (market.current - market.vwap30) / market.vwap30 : 0;
    const highVolatility = market.atr14 > 0 && (market.atr14 / market.current) * 100 > 0.8;
    const lowVolatility = market.atr14 > 0 && (market.atr14 / market.current) * 100 < 0.5;
    switch (templateId) {
        case "ema-crossover":
            if (emaBullCross) {
                return signalByPreferredSide("buy", preferredSide, "EMA9 crossed above EMA21");
            }
            if (emaBearCross) {
                return signalByPreferredSide("sell", preferredSide, "EMA9 crossed below EMA21");
            }
            return null;
        case "macd-trend":
            if (macdBullCross && market.macdCurrent > 0) {
                return signalByPreferredSide("buy", preferredSide, "MACD bullish crossover with positive momentum");
            }
            if (macdBearCross && market.macdCurrent < 0) {
                return signalByPreferredSide("sell", preferredSide, "MACD bearish crossover with negative momentum");
            }
            return null;
        case "supertrend":
            if (emaBullCross && highVolatility) {
                return signalByPreferredSide("buy", preferredSide, "Trend flipped bullish with elevated ATR");
            }
            if (emaBearCross && highVolatility) {
                return signalByPreferredSide("sell", preferredSide, "Trend flipped bearish with elevated ATR");
            }
            return null;
        case "rsi-reversal":
            if (rsiOversoldCross) {
                return signalByPreferredSide("buy", preferredSide, "RSI recovered from oversold zone");
            }
            if (rsiOverboughtCross) {
                return signalByPreferredSide("sell", preferredSide, "RSI faded from overbought zone");
            }
            return null;
        case "bollinger-bounce":
            if (market.previous < market.bbLower && market.current >= market.bbLower) {
                return signalByPreferredSide("buy", preferredSide, "Price bounced from lower Bollinger band");
            }
            if (market.previous > market.bbUpper && market.current <= market.bbUpper) {
                return signalByPreferredSide("sell", preferredSide, "Price reverted from upper Bollinger band");
            }
            return null;
        case "vwap-reversion":
            if (vwapDeviation <= -0.015 && market.current > market.previous) {
                return signalByPreferredSide("buy", preferredSide, "Price mean-reverting upward toward VWAP");
            }
            if (vwapDeviation >= 0.015 && market.current < market.previous) {
                return signalByPreferredSide("sell", preferredSide, "Price mean-reverting downward toward VWAP");
            }
            return null;
        case "breakout":
            if (breakoutUp) {
                return signalByPreferredSide("buy", preferredSide, "Volume-confirmed upside breakout");
            }
            if (breakoutDown) {
                return signalByPreferredSide("sell", preferredSide, "Volume-confirmed downside breakout");
            }
            return null;
        case "dca":
            return signalByPreferredSide("buy", preferredSide, "Scheduled DCA accumulation interval");
        case "momentum-roc":
            if (market.roc14 >= 2.5) {
                return signalByPreferredSide("buy", preferredSide, "ROC momentum crossed bullish threshold");
            }
            if (market.roc14 <= -2.5) {
                return signalByPreferredSide("sell", preferredSide, "ROC momentum crossed bearish threshold");
            }
            return null;
        case "grid":
            if (market.current <= market.bbLower && lowVolatility) {
                return signalByPreferredSide("buy", preferredSide, "Grid lower band fill opportunity");
            }
            if (market.current >= market.bbUpper && lowVolatility) {
                return signalByPreferredSide("sell", preferredSide, "Grid upper band reduce opportunity");
            }
            return null;
        case "scalping":
            if (emaBullCross && market.currentVolume >= market.volumeAverage) {
                return signalByPreferredSide("buy", preferredSide, "Short-term bullish momentum impulse");
            }
            if (emaBearCross && market.currentVolume >= market.volumeAverage) {
                return signalByPreferredSide("sell", preferredSide, "Short-term bearish momentum impulse");
            }
            return null;
        case "triangular-arb":
            if (Math.abs(vwapDeviation) >= 0.01 && market.currentVolume >= market.volumeAverage * 1.2) {
                return signalByPreferredSide(preferredSide, preferredSide, "Arbitrage window heuristic triggered");
            }
            return null;
        case "covered-call":
            if (market.rsiCurrent >= 60 && market.current > market.bbBasis) {
                return signalByPreferredSide("sell", preferredSide, "Covered-call premium opportunity (overbought bias)");
            }
            return null;
        default:
            return null;
    }
    return null;
}
async function fetchBinancePrice(symbol) {
    const tickerUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const response = await (0, node_fetch_1.default)(tickerUrl);
    if (!response.ok) {
        const text = await response.text();
        throw new functions.https.HttpsError("internal", `Unable to fetch Binance price: ${text}`);
    }
    const data = await response.json();
    return Number.parseFloat(data.price || "0");
}
async function signedBinanceRequest(apiKey, apiSecret, endpoint, params = {}, method = "GET") {
    const timestamp = Date.now();
    const query = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: "5000" });
    const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(query.toString())
        .digest("hex");
    const url = `https://api.binance.com${endpoint}?${query.toString()}&signature=${signature}`;
    const response = await (0, node_fetch_1.default)(url, {
        method,
        headers: {
            "X-MBX-APIKEY": apiKey,
            "Content-Type": "application/json",
        },
    });
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `Binance order error ${response.status}: ${payloadText}`);
    }
    return payload;
}
async function placeBinanceOrder({ apiKey, apiSecret, symbol, side, investment, }) {
    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    if (!normalizedSymbol) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid Binance trading symbol.");
    }
    const normalizedSide = side.toUpperCase();
    if (normalizedSide === "BUY") {
        const order = await signedBinanceRequest(apiKey, apiSecret, "/api/v3/order", {
            symbol: normalizedSymbol,
            side: "BUY",
            type: "MARKET",
            quoteOrderQty: Number(investment).toFixed(2),
        }, "POST");
        return {
            orderId: String(order.orderId || "binance-buy"),
            raw: order,
        };
    }
    const price = await fetchBinancePrice(normalizedSymbol);
    if (!Number.isFinite(price) || price <= 0) {
        throw new functions.https.HttpsError("internal", "Unable to fetch market price for sell order.");
    }
    const estimatedQty = Math.max(Number(investment) / price, 0.000001);
    const order = await signedBinanceRequest(apiKey, apiSecret, "/api/v3/order", {
        symbol: normalizedSymbol,
        side: "SELL",
        type: "MARKET",
        quantity: estimatedQty.toFixed(6),
    }, "POST");
    return {
        orderId: String(order.orderId || "binance-sell"),
        raw: order,
    };
}
async function placeAlpacaOrder({ exchangeId, apiKey, apiSecret, symbol, side, investment, }) {
    const isPaper = exchangeId === "alpaca-paper";
    const baseUrl = isPaper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
    const normalizedSymbol = normalizeAlpacaSymbol(symbol);
    const normalizedSide = String(side || "buy").toLowerCase() === "sell" ? "sell" : "buy";
    const isCryptoSymbol = normalizedSymbol.includes("/");
    const timeInForce = isCryptoSymbol ? "gtc" : "day";
    const headers = {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
        "Content-Type": "application/json",
    };
    let orderBody;
    if (isCryptoSymbol && normalizedSide === "sell") {
        const positionsResponse = await (0, node_fetch_1.default)(`${baseUrl}/v2/positions`, {
            method: "GET",
            headers,
        });
        const positionsText = await positionsResponse.text();
        const positionsPayload = positionsText ? JSON.parse(positionsText) : [];
        if (!positionsResponse.ok) {
            throw new functions.https.HttpsError("internal", `Alpaca positions error ${positionsResponse.status}: ${positionsText}`);
        }
        const toComparable = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const targetSymbol = toComparable(normalizedSymbol);
        const matchingPosition = Array.isArray(positionsPayload)
            ? positionsPayload.find((position) => toComparable(position?.symbol) === targetSymbol)
            : null;
        const availableQty = Number.parseFloat(String(matchingPosition?.qty || "0"));
        const marketValue = Math.abs(Number.parseFloat(String(matchingPosition?.market_value || "0")));
        if (!Number.isFinite(availableQty) || availableQty <= 0) {
            throw new functions.https.HttpsError("failed-precondition", `No available ${normalizedSymbol} position to sell.`);
        }
        let qtyToSell = availableQty;
        if (Number.isFinite(marketValue) && marketValue > 0 && Number.isFinite(Number(investment)) && Number(investment) > 0) {
            qtyToSell = Math.min(availableQty, (Number(investment) / marketValue) * availableQty);
        }
        qtyToSell = Math.max(Math.min(qtyToSell * 0.995, availableQty * 0.995), 0);
        if (!Number.isFinite(qtyToSell) || qtyToSell <= 0) {
            throw new functions.https.HttpsError("failed-precondition", `Computed sell quantity is invalid for ${normalizedSymbol}.`);
        }
        orderBody = {
            symbol: normalizedSymbol,
            side: normalizedSide,
            type: "market",
            time_in_force: timeInForce,
            qty: qtyToSell.toFixed(8),
        };
    }
    else {
        const baseNotional = Number(investment);
        const bufferedNotional = normalizedSide === "buy" && isCryptoSymbol
            ? baseNotional * 0.98
            : baseNotional;
        orderBody = {
            symbol: normalizedSymbol,
            side: normalizedSide,
            type: "market",
            time_in_force: timeInForce,
            notional: bufferedNotional.toFixed(2),
        };
    }
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(orderBody),
    });
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `Alpaca order error ${response.status}: ${payloadText}`);
    }
    return {
        orderId: String(payload.id || "alpaca-order"),
        raw: payload,
    };
}
async function executeStrategyOrder(uid, strategyId, sideOverride) {
    const db = admin.firestore();
    const strategyRef = db.doc(`users/${uid}/strategies/${strategyId}`);
    const strategySnap = await strategyRef.get();
    if (!strategySnap.exists) {
        throw new functions.https.HttpsError("not-found", "Strategy not found.");
    }
    const strategy = strategySnap.data() || {};
    if ((strategy.status || "active") !== "active") {
        throw new functions.https.HttpsError("failed-precondition", "Strategy must be active before execution.");
    }
    const botId = strategy.assignedBotId;
    if (!botId) {
        throw new functions.https.HttpsError("failed-precondition", "Strategy has no assigned bot.");
    }
    const botRef = db.doc(`users/${uid}/bots/${botId}`);
    const botSnap = await botRef.get();
    if (!botSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Assigned bot not found.");
    }
    const bot = botSnap.data() || {};
    if ((bot.status || "paused") !== "active") {
        throw new functions.https.HttpsError("failed-precondition", "Bot must be active before execution.");
    }
    const exchangeLabel = bot.exchangeLabel;
    const exchangeRef = db.doc(`users/${uid}/exchanges/${exchangeLabel}`);
    const exchangeSnap = await exchangeRef.get();
    if (!exchangeSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Exchange connection not found for assigned bot.");
    }
    const exchange = exchangeSnap.data() || {};
    const exchangeId = String(bot.exchangeId || exchange.exchangeId || "");
    const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
    const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
    if (!exchangeId || !apiKey || !apiSecret) {
        throw new functions.https.HttpsError("failed-precondition", "Missing exchange credentials for execution.");
    }
    const configuredSide = String(strategy.tradeSide || "buy").toLowerCase() === "sell" ? "sell" : "buy";
    const side = sideOverride === "sell" || sideOverride === "buy" ? sideOverride : configuredSide;
    const symbol = String(bot.symbol || "");
    const investment = Number(bot.investment || 0);
    if (!symbol || !Number.isFinite(investment) || investment <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "Bot symbol or investment is invalid.");
    }
    let orderResult;
    if (exchangeId === "binance") {
        orderResult = await placeBinanceOrder({
            apiKey,
            apiSecret,
            symbol,
            side,
            investment,
        });
    }
    else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
        orderResult = await placeAlpacaOrder({
            exchangeId,
            apiKey,
            apiSecret,
            symbol,
            side,
            investment,
        });
    }
    else {
        throw new functions.https.HttpsError("not-found", `Exchange ${exchangeId} is not yet supported for live orders.`);
    }
    const now = new Date().toISOString();
    const nextTrades = Number(bot.trades || 0) + 1;
    await botRef.set({
        trades: nextTrades,
        updatedAt: now,
    }, { merge: true });
    await strategyRef.set({
        lastExecutionAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.collection(`users/${uid}/executions`).add({
        strategyId,
        strategyName: strategy.name || "Strategy",
        botId,
        botName: bot.name || "Bot",
        exchangeId,
        side,
        symbol,
        investment,
        orderId: orderResult.orderId,
        rawOrder: orderResult.raw,
        executedAt: now,
    });
    return {
        success: true,
        side,
        orderId: orderResult.orderId,
        executedAt: now,
        message: `${side.toUpperCase()} order executed successfully.`,
    };
}
function timeframeToMs(timeframe) {
    const map = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "4h": 4 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
    };
    return map[String(timeframe || "")] ?? 60 * 1000;
}
function shouldRunByTimeframe(strategy, bot, nowMs) {
    const cadenceMs = timeframeToMs(bot.timeframe);
    const lastExecutionRaw = strategy.lastExecutionAt;
    if (lastExecutionRaw) {
        const lastExecutionMs = new Date(lastExecutionRaw).getTime();
        if (Number.isFinite(lastExecutionMs) && lastExecutionMs > 0) {
            return nowMs - lastExecutionMs >= cadenceMs;
        }
    }
    const activationRaw = strategy.activatedAt || strategy.updatedAt || strategy.createdAt;
    const activationMs = new Date(String(activationRaw || "")).getTime();
    if (!Number.isFinite(activationMs) || activationMs <= 0) {
        return false;
    }
    return nowMs - activationMs >= cadenceMs;
}
async function runActiveStrategiesOnce() {
    const db = admin.firestore();
    const nowMs = Date.now();
    const usersSnap = await db.collection("users").get();
    const activeStrategies = [];
    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const strategiesSnap = await db.collection(`users/${uid}/strategies`).where("status", "==", "active").get();
        for (const strategyDoc of strategiesSnap.docs) {
            activeStrategies.push({
                uid,
                strategyId: strategyDoc.id,
                strategy: strategyDoc.data() || {},
            });
        }
    }
    let executed = 0;
    let skipped = 0;
    let failed = 0;
    for (const activeItem of activeStrategies) {
        const { uid, strategyId, strategy } = activeItem;
        if (!uid || !strategyId) {
            skipped++;
            continue;
        }
        const botId = strategy.assignedBotId;
        if (!botId) {
            skipped++;
            continue;
        }
        const botRef = db.doc(`users/${uid}/bots/${botId}`);
        const botSnap = await botRef.get();
        if (!botSnap.exists) {
            skipped++;
            continue;
        }
        const bot = botSnap.data() || {};
        if ((bot.status || "paused") !== "active") {
            skipped++;
            continue;
        }
        if (!shouldRunByTimeframe(strategy, bot, nowMs)) {
            skipped++;
            continue;
        }
        const strategyRef = db.doc(`users/${uid}/strategies/${strategyId}`);
        let pendingSignal = strategy.pendingSignal;
        let signalSideRaw = String(pendingSignal?.side || "").toLowerCase();
        if (signalSideRaw !== "buy" && signalSideRaw !== "sell") {
            const generatedSignal = await evaluateStrategySignal(strategy, bot);
            if (generatedSignal) {
                const nowIso = new Date().toISOString();
                pendingSignal = {
                    side: generatedSignal.side,
                    reason: generatedSignal.reason,
                    detectedAt: nowIso,
                    source: "backend-evaluator",
                    templateId: String(strategy.templateId || ""),
                };
                await strategyRef.set({
                    pendingSignal,
                    updatedAt: nowIso,
                }, { merge: true });
                signalSideRaw = String(pendingSignal.side || "").toLowerCase();
            }
        }
        if (signalSideRaw !== "buy" && signalSideRaw !== "sell") {
            skipped++;
            continue;
        }
        try {
            await executeStrategyOrder(uid, strategyId, signalSideRaw);
            await strategyRef.set({
                pendingSignal: admin.firestore.FieldValue.delete(),
                lastProcessedSignalAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            executed++;
        }
        catch (error) {
            failed++;
            console.error("runActiveStrategies execution error", {
                uid,
                strategyId,
                message: error?.message || "unknown error",
            });
        }
    }
    return {
        totalActiveStrategies: activeStrategies.length,
        executed,
        skipped,
        failed,
        ranAt: new Date().toISOString(),
    };
}
exports.getPortfolio = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    console.log("🚀 Function started for user:", context.auth.uid);
    try {
        const { exchangeId, apiKey, apiSecret } = data;
        console.log("📊 Portfolio request for:", exchangeId);
        console.log("🔑 API Key provided:", !!apiKey);
        const portfolio = await resolvePortfolio(exchangeId, apiKey, apiSecret);
        console.log("✅ Success! Portfolio value:", portfolio.portfolioValue);
        return portfolio;
    }
    catch (error) {
        console.error("❌❌❌ Uncaught Error:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", error.message, error);
    }
});
exports.getPortfolioHttp = functions
    .region("europe-west1")
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
            if (!token) {
                res.status(401).json({ error: "Missing Authorization Bearer token" });
                return;
            }
            const decoded = await admin.auth().verifyIdToken(token);
            console.log("🚀 HTTP function started for user:", decoded.uid);
            const { exchangeId, apiKey, apiSecret } = req.body || {};
            console.log("📊 HTTP portfolio request for:", exchangeId);
            console.log("🔑 API Key provided:", !!apiKey);
            const portfolio = await resolvePortfolio(exchangeId, apiKey, apiSecret);
            res.status(200).json(portfolio);
        }
        catch (error) {
            console.error("❌❌❌ HTTP function uncaught error:", error);
            const code = error?.code;
            if (code === "invalid-argument") {
                res.status(400).json({ error: error.message });
                return;
            }
            if (code === "not-found") {
                res.status(404).json({ error: error.message });
                return;
            }
            if (code === "unauthenticated") {
                res.status(401).json({ error: error.message });
                return;
            }
            const message = error?.message || "Internal server error";
            if (message.includes("Binance API error 451") || message.includes("restricted location")) {
                res.status(451).json({
                    error: "Binance blocked this server location (451 restricted location). Please use Binance for this region, Binance.US if applicable, or deploy functions in another allowed region.",
                });
                return;
            }
            res.status(500).json({ error: message });
        }
    });
});
exports.executeStrategyHttp = functions
    .region("europe-west1")
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
            if (!token) {
                res.status(401).json({ error: "Missing Authorization Bearer token" });
                return;
            }
            const decoded = await admin.auth().verifyIdToken(token);
            const { strategyId } = req.body || {};
            if (!strategyId) {
                res.status(400).json({ error: "strategyId is required" });
                return;
            }
            const result = await executeStrategyOrder(decoded.uid, String(strategyId));
            res.status(200).json(result);
        }
        catch (error) {
            console.error("executeStrategyHttp error:", error);
            const code = error?.code;
            if (code === "invalid-argument") {
                res.status(400).json({ error: error.message });
                return;
            }
            if (code === "unauthenticated") {
                res.status(401).json({ error: error.message });
                return;
            }
            if (code === "not-found") {
                res.status(404).json({ error: error.message });
                return;
            }
            if (code === "failed-precondition") {
                res.status(412).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: error?.message || "Internal server error" });
        }
    });
});
exports.runActiveStrategies = functions
    .region("europe-west1")
    .runWith({
    timeoutSeconds: 540,
    memory: "512MB",
    serviceAccount: "1022221175478-compute@developer.gserviceaccount.com",
})
    .pubsub.schedule("every 1 minutes")
    .timeZone("Etc/UTC")
    .onRun(async () => {
    const summary = await runActiveStrategiesOnce();
    console.log("runActiveStrategies summary", summary);
    return null;
});
//# sourceMappingURL=index.js.map