"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBinanceSymbol = normalizeBinanceSymbol;
exports.fetchBinanceCandles = fetchBinanceCandles;
exports.fetchAlpacaStockBars = fetchAlpacaStockBars;
exports.fetchBinancePrice = fetchBinancePrice;
exports.placeBinanceOrder = placeBinanceOrder;
exports.placeAlpacaOrder = placeAlpacaOrder;
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const config_1 = require("../infra/config");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function normalizeBinanceSymbol(symbol) {
    return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function normalizeSymbolForMarketData(symbol) {
    const upper = String(symbol || "").toUpperCase().trim();
    if (!upper.includes("/"))
        return upper;
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    if (compact.endsWith("USD") && !compact.endsWith("USDT")) {
        return `${compact.slice(0, -3)}USDT`;
    }
    return compact;
}
function normalizeSymbolForYfinance(symbol) {
    const upper = String(symbol || "").toUpperCase().trim();
    if (!upper.includes("/"))
        return upper;
    const [baseRaw, quoteRaw] = upper.split("/");
    const base = String(baseRaw || "").replace(/[^A-Z0-9]/g, "");
    const quote = String(quoteRaw || "").replace(/[^A-Z0-9]/g, "");
    if (!base)
        return upper.replace(/[^A-Z0-9.-]/g, "");
    // Yahoo crypto tickers commonly use USD quote (e.g. BTC-USD).
    const mappedQuote = quote === "USDT" || quote === "USDC" || quote === "BUSD" ? "USD" : quote;
    if (!mappedQuote)
        return base;
    return `${base}-${mappedQuote}`;
}
function mapTimeframeToYfinanceInterval(timeframe) {
    switch (String(timeframe || "")) {
        case "1m": return "1m";
        case "5m": return "5m";
        case "15m": return "15m";
        case "1h": return "60m";
        case "4h": return "60m";
        case "1d": return "1d";
        default: return "60m";
    }
}
function periodForInterval(interval, limit) {
    const normalizedLimit = Math.max(limit, 40);
    if (interval === "1m") {
        if (normalizedLimit <= 390)
            return "1d";
        if (normalizedLimit <= 1950)
            return "5d";
        return "7d";
    }
    if (interval === "5m" || interval === "15m" || interval === "60m") {
        if (normalizedLimit <= 500)
            return "5d";
        if (normalizedLimit <= 1200)
            return "1mo";
        return "3mo";
    }
    return "6mo";
}
async function fetchYfinanceCandles(symbol, timeframe, limit = 140) {
    const yfSymbol = normalizeSymbolForYfinance(symbol);
    const interval = mapTimeframeToYfinanceInterval(timeframe);
    const safeLimit = Math.max(limit, 40);
    const period = periodForInterval(interval, safeLimit);
    const pyCode = [
        "import json, sys",
        "import yfinance as yf",
        "symbol = sys.argv[1]",
        "interval = sys.argv[2]",
        "period = sys.argv[3]",
        "limit = int(sys.argv[4])",
        "ticker = yf.Ticker(symbol)",
        "hist = ticker.history(period=period, interval=interval, auto_adjust=False, prepost=True)",
        "rows = []",
        "if hist is not None and not hist.empty:",
        "    tail = hist.tail(limit)",
        "    for idx, row in tail.iterrows():",
        "        rows.append({",
        "            'time': str(idx),",
        "            'open': float(row.get('Open', 0) or 0),",
        "            'high': float(row.get('High', 0) or 0),",
        "            'low': float(row.get('Low', 0) or 0),",
        "            'close': float(row.get('Close', 0) or 0),",
        "            'volume': float(row.get('Volume', 0) or 0),",
        "        })",
        "print(json.dumps(rows))",
    ].join("\n");
    try {
        const { stdout } = await execFileAsync(config_1.config.yfinancePythonBin, ["-c", pyCode, yfSymbol, interval, period, String(safeLimit)], {
            timeout: 20000,
            maxBuffer: 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || "[]"));
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .map((c) => ({
            time: new Date(String(c?.time || Date.now())).toISOString(),
            open: Number.parseFloat(String(c?.open || "0")),
            high: Number.parseFloat(String(c?.high || "0")),
            low: Number.parseFloat(String(c?.low || "0")),
            close: Number.parseFloat(String(c?.close || "0")),
            volume: Number.parseFloat(String(c?.volume || "0")),
        }))
            .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
    }
    catch (error) {
        console.error("yfinance fetch failed", { symbol: yfSymbol, interval, period, message: error?.message || "unknown" });
        return [];
    }
}
async function fetchBinanceCandles(symbol, timeframe, limit = 140) {
    if (config_1.config.marketDataProvider === "yfinance") {
        const yf = await fetchYfinanceCandles(symbol, timeframe, limit);
        if (yf.length >= 2)
            return yf;
    }
    const normalizedSymbol = normalizeSymbolForMarketData(symbol);
    const interval = ["1m", "5m", "15m", "1h", "4h", "1d"].includes(timeframe) ? timeframe : "1h";
    const url = `https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${Math.max(limit, 40)}`;
    const response = await (0, node_fetch_1.default)(url);
    if (!response.ok)
        return [];
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : [];
    if (!Array.isArray(payload))
        return [];
    return payload
        .map((c) => ({
        time: new Date(Number(c?.[0] || Date.now())).toISOString(),
        open: Number.parseFloat(String(c?.[1] || "0")),
        high: Number.parseFloat(String(c?.[2] || "0")),
        low: Number.parseFloat(String(c?.[3] || "0")),
        close: Number.parseFloat(String(c?.[4] || "0")),
        volume: Number.parseFloat(String(c?.[5] || "0")),
    }))
        .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
}
function mapTimeframeToAlpaca(timeframe) {
    switch (String(timeframe || "")) {
        case "1m": return "1Min";
        case "5m": return "5Min";
        case "15m": return "15Min";
        case "1h": return "1Hour";
        case "4h": return "4Hour";
        case "1d": return "1Day";
        default: return "1Hour";
    }
}
async function fetchAlpacaStockBars(apiKey, apiSecret, symbol, timeframe, limit = 140) {
    if (config_1.config.marketDataProvider === "yfinance") {
        const yf = await fetchYfinanceCandles(symbol, timeframe, limit);
        if (yf.length >= 2)
            return yf;
    }
    if (!String(apiKey || "").trim() || !String(apiSecret || "").trim()) {
        throw new Error("Missing Alpaca credentials for stock market data");
    }
    const normalizedSymbol = String(symbol || "").toUpperCase().replace(/\/.+$/, "").trim();
    if (!normalizedSymbol)
        return [];
    const alpacaTf = mapTimeframeToAlpaca(timeframe);
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(normalizedSymbol)}/bars?timeframe=${alpacaTf}&limit=${Math.max(20, limit)}&adjustment=raw&feed=iex`;
    const response = await (0, node_fetch_1.default)(url, {
        headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": apiSecret,
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Alpaca bars error ${response.status}: ${text}`);
    }
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    const bars = Array.isArray(payload?.bars) ? payload.bars : [];
    return bars
        .map((bar) => ({
        time: String(bar?.t || ""),
        open: Number.parseFloat(String(bar?.o || "0")),
        high: Number.parseFloat(String(bar?.h || "0")),
        low: Number.parseFloat(String(bar?.l || "0")),
        close: Number.parseFloat(String(bar?.c || "0")),
        volume: Number.parseFloat(String(bar?.v || "0")),
    }))
        .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
}
async function fetchBinancePrice(symbol) {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${normalizeBinanceSymbol(symbol)}`;
    const response = await (0, node_fetch_1.default)(url);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Unable to fetch Binance price: ${text}`);
    }
    const data = await response.json();
    return Number.parseFloat(String(data?.price || "0"));
}
async function signedBinanceRequest(apiKey, apiSecret, endpoint, params = {}, method = "GET") {
    const timestamp = Date.now();
    const query = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: "5000" });
    const signature = crypto_1.default.createHmac("sha256", apiSecret).update(query.toString()).digest("hex");
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
    if (!response.ok)
        throw new Error(`Binance order error ${response.status}: ${payloadText}`);
    return payload;
}
async function placeBinanceOrder(input) {
    const symbol = normalizeBinanceSymbol(input.symbol);
    const side = input.side.toUpperCase();
    if (side === "BUY") {
        const order = await signedBinanceRequest(input.apiKey, input.apiSecret, "/api/v3/order", {
            symbol,
            side: "BUY",
            type: "MARKET",
            quoteOrderQty: Number(input.investment).toFixed(2),
        }, "POST");
        return { orderId: String(order.orderId || "binance-buy"), raw: order };
    }
    const price = await fetchBinancePrice(symbol);
    if (!Number.isFinite(price) || price <= 0)
        throw new Error("Unable to fetch market price for sell order.");
    const quantity = Math.max(Number(input.investment) / price, 0.000001).toFixed(6);
    const order = await signedBinanceRequest(input.apiKey, input.apiSecret, "/api/v3/order", {
        symbol,
        side: "SELL",
        type: "MARKET",
        quantity,
    }, "POST");
    return { orderId: String(order.orderId || "binance-sell"), raw: order };
}
async function placeAlpacaOrder(input) {
    const isPaper = input.exchangeId === "alpaca-paper";
    const baseUrl = isPaper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
    const symbol = String(input.symbol || "").toUpperCase().trim();
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/orders`, {
        method: "POST",
        headers: {
            "APCA-API-KEY-ID": input.apiKey,
            "APCA-API-SECRET-KEY": input.apiSecret,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            symbol,
            side: input.side,
            type: "market",
            time_in_force: symbol.includes("/") ? "gtc" : "day",
            notional: Number(input.investment).toFixed(2),
        }),
    });
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    if (!response.ok)
        throw new Error(`Alpaca order error ${response.status}: ${payloadText}`);
    const orderId = String(payload.id || "alpaca-order");
    // Attempt to enrich immediate order response with fill fields.
    let enrichedPayload = payload;
    if (orderId && orderId !== "alpaca-order") {
        for (let attempt = 0; attempt < 4; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            const detailResponse = await (0, node_fetch_1.default)(`${baseUrl}/v2/orders/${encodeURIComponent(orderId)}`, {
                method: "GET",
                headers: {
                    "APCA-API-KEY-ID": input.apiKey,
                    "APCA-API-SECRET-KEY": input.apiSecret,
                    "Content-Type": "application/json",
                },
            });
            const detailText = await detailResponse.text();
            const detail = detailText ? JSON.parse(detailText) : null;
            if (!detailResponse.ok || !detail) {
                continue;
            }
            enrichedPayload = detail;
            const filledAvgPrice = Number(detail.filled_avg_price || 0);
            const filledQty = Number(detail.filled_qty || 0);
            if (filledAvgPrice > 0 || filledQty > 0) {
                break;
            }
        }
    }
    return { orderId, raw: enrichedPayload };
}
