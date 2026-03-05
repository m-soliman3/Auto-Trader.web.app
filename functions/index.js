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
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/orders`, {
        method: "POST",
        headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": apiSecret,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            symbol: normalizedSymbol,
            side,
            type: "market",
            time_in_force: "day",
            notional: Number(investment).toFixed(2),
        }),
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
async function executeStrategyOrder(uid, strategyId) {
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
    const side = String(strategy.tradeSide || "buy").toLowerCase() === "sell" ? "sell" : "buy";
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
    if (!lastExecutionRaw) {
        return true;
    }
    const lastExecutionMs = new Date(lastExecutionRaw).getTime();
    if (!Number.isFinite(lastExecutionMs) || lastExecutionMs <= 0) {
        return true;
    }
    return nowMs - lastExecutionMs >= cadenceMs;
}
async function runActiveStrategiesOnce() {
    const db = admin.firestore();
    const nowMs = Date.now();
    const activeStrategiesSnap = await db.collectionGroup("strategies").where("status", "==", "active").get();
    let executed = 0;
    let skipped = 0;
    let failed = 0;
    for (const strategyDoc of activeStrategiesSnap.docs) {
        const strategy = strategyDoc.data() || {};
        const pathParts = strategyDoc.ref.path.split("/");
        const uid = pathParts[1];
        const strategyId = strategyDoc.id;
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
        try {
            await executeStrategyOrder(uid, strategyId);
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
        totalActiveStrategies: activeStrategiesSnap.size,
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
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("every 1 minutes")
    .timeZone("Etc/UTC")
    .onRun(async () => {
    const summary = await runActiveStrategiesOnce();
    console.log("runActiveStrategies summary", summary);
    return null;
});
//# sourceMappingURL=index.js.map