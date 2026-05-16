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
exports.nowPaymentsCallback = exports.checkNowPaymentsOrder = exports.listNowPaymentsCurrencies = exports.createNowPaymentsOrder = exports.confirmTopUp = exports.createTopUpIntent = exports.confirmPayPalSubscription = exports.createPayPalSubscription = exports.cancelPremiumSubscription = exports.getPremiumBillingOverview = exports.confirmPremiumSubscriptionActivation = exports.createPremiumSubscriptionIntent = exports.sendContactMessage = exports.getMarketData = exports.getPortfolioHttp = exports.getPortfolio = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
const stripe_1 = __importDefault(require("stripe"));
const params_1 = require("firebase-functions/params");
if (!admin.apps.length) {
    admin.initializeApp();
}
const corsHandler = (0, cors_1.default)({
    // Allow production hosting plus local dev on any localhost/127.0.0.1 port.
    origin: [
        "https://autotrader-b8851.web.app",
        "https://invest-begin.com",
        "https://www.invest-begin.com",
        /^http:\/\/localhost(?::\d+)?$/,
        /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
    ],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
// Broker secrets declared here so they are available to getPortfolio/getPortfolioHttp
// which are defined early in this file, before the top-up/payment functions.
const ALPACA_BROKER_KEY = (0, params_1.defineSecret)("ALPACA_BROKER_KEY");
const ALPACA_BROKER_SECRET = (0, params_1.defineSecret)("ALPACA_BROKER_SECRET");
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
    const positionsUrl = `${baseUrl}/v2/positions`;
    const positionsResponse = await (0, node_fetch_1.default)(positionsUrl, {
        headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": apiSecret,
        },
    });
    if (!positionsResponse.ok) {
        const text = await positionsResponse.text();
        console.error("❌ Alpaca positions error:", text);
        throw new functions.https.HttpsError("internal", `Alpaca positions API error ${positionsResponse.status}: ${text}`);
    }
    const positionsPayload = await positionsResponse.json();
    const openPositions = Array.isArray(positionsPayload)
        ? positionsPayload.map((position) => {
            const side = String(position.side || "long").toLowerCase() === "short" ? "short" : "long";
            return {
                symbol: String(position.symbol || ""),
                quantity: Number.parseFloat(position.qty || "0"),
                marketValue: Number.parseFloat(position.market_value || "0"),
                unrealizedPnl: position.unrealized_pl === undefined || position.unrealized_pl === null
                    ? null
                    : Number.parseFloat(position.unrealized_pl),
                pnlPercentage: position.unrealized_plpc === undefined || position.unrealized_plpc === null
                    ? null
                    : Number.parseFloat(position.unrealized_plpc) * 100,
                entryPrice: position.avg_entry_price === undefined || position.avg_entry_price === null
                    ? null
                    : Number.parseFloat(position.avg_entry_price),
                currentPrice: position.current_price === undefined || position.current_price === null
                    ? null
                    : Number.parseFloat(position.current_price),
                side,
            };
        })
        : [];
    return {
        portfolioValue: Number.parseFloat(data.equity || data.portfolio_value || "0"),
        unrealizedPnl: Number.parseFloat(data.unrealized_pl || "0"),
        pnlPercentage: Number.parseFloat(data.unrealized_plpc || "0") * 100,
        updatedAt: new Date().toISOString(),
        openPositions,
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
    if (!Number.isFinite(lastPrice)) {
        return null;
    }
    return { lastPrice };
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
            return { assetSymbol: '', quantity: 0, currentPrice: null, currentValue: 0 };
        }
        const assetSymbol = String(asset.asset || "").toUpperCase();
        if (stableCoins.has(assetSymbol)) {
            return {
                assetSymbol,
                quantity,
                currentPrice: 1,
                currentValue: quantity,
            };
        }
        const ticker = await fetchBinance24hTicker(`${assetSymbol}USDT`);
        if (!ticker) {
            return { assetSymbol, quantity, currentPrice: null, currentValue: 0 };
        }
        return {
            assetSymbol,
            quantity,
            currentPrice: ticker.lastPrice,
            currentValue: quantity * ticker.lastPrice,
        };
    }));
    const totalCurrentValue = valuedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const openPositions = valuedAssets
        .filter((asset) => asset.assetSymbol && !stableCoins.has(asset.assetSymbol) && asset.quantity > 0)
        .map((asset) => ({
        symbol: asset.assetSymbol,
        quantity: asset.quantity,
        marketValue: asset.currentValue,
        unrealizedPnl: null,
        pnlPercentage: null,
        entryPrice: null,
        currentPrice: asset.currentPrice,
        side: "long",
    }));
    return {
        portfolioValue: totalCurrentValue,
        unrealizedPnl: null,
        pnlPercentage: null,
        updatedAt: new Date().toISOString(),
        openPositions,
    };
}
/**
 * Fetches portfolio for an Alpaca Broker-provisioned paper account via the
 * Broker sandbox trading proxy using an OAuth2 Bearer token.
 *
 * Used when the stored API key is a CK-prefixed broker sub-account key
 * (provisioned via top-up) rather than a regular PK-prefixed trading key
 * (manually connected). CK keys cannot be used with paper-api.alpaca.markets.
 */
async function fetchAlpacaBrokerPaperPortfolio(brokerKey, brokerSecret, accountId) {
    const BROKER_BASE = "https://broker-api.sandbox.alpaca.markets";
    const AUTHX_BASE = "https://authx.sandbox.alpaca.markets";
    const tokenRes = await (0, node_fetch_1.default)(`${AUTHX_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: brokerKey,
            client_secret: brokerSecret,
        }).toString(),
    });
    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new functions.https.HttpsError("internal", `Alpaca auth token failed (${tokenRes.status}): ${err}`);
    }
    const { access_token } = (await tokenRes.json());
    const auth = `Bearer ${access_token}`;
    const headers = { Authorization: auth, Accept: "application/json" };
    console.log("🔗 Alpaca Broker sandbox proxy, accountId:", accountId);
    const accountRes = await (0, node_fetch_1.default)(`${BROKER_BASE}/v1/trading/accounts/${accountId}/account`, { headers });
    if (!accountRes.ok) {
        const text = await accountRes.text();
        throw new functions.https.HttpsError("internal", `Alpaca Broker account error ${accountRes.status}: ${text}`);
    }
    const data = await accountRes.json();
    const posRes = await (0, node_fetch_1.default)(`${BROKER_BASE}/v1/trading/accounts/${accountId}/positions`, { headers });
    if (!posRes.ok) {
        const text = await posRes.text();
        throw new functions.https.HttpsError("internal", `Alpaca Broker positions error ${posRes.status}: ${text}`);
    }
    const positions = await posRes.json();
    const openPositions = Array.isArray(positions)
        ? positions.map((p) => {
            const side = String(p.side || "long").toLowerCase() === "short" ? "short" : "long";
            return {
                symbol: String(p.symbol || ""),
                quantity: Number.parseFloat(p.qty || "0"),
                marketValue: Number.parseFloat(p.market_value || "0"),
                unrealizedPnl: p.unrealized_pl != null ? Number.parseFloat(p.unrealized_pl) : null,
                pnlPercentage: p.unrealized_plpc != null ? Number.parseFloat(p.unrealized_plpc) * 100 : null,
                entryPrice: p.avg_entry_price != null ? Number.parseFloat(p.avg_entry_price) : null,
                currentPrice: p.current_price != null ? Number.parseFloat(p.current_price) : null,
                side,
            };
        })
        : [];
    return {
        portfolioValue: Number.parseFloat(data.equity || data.portfolio_value || "0"),
        unrealizedPnl: data.unrealized_pl != null ? Number.parseFloat(data.unrealized_pl) : null,
        pnlPercentage: data.unrealized_plpc != null ? Number.parseFloat(data.unrealized_plpc) * 100 : null,
        updatedAt: new Date().toISOString(),
        openPositions,
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
exports.getPortfolio = functions
    .region("europe-west1")
    .runWith({ secrets: [ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    console.log("🚀 Function started for user:", context.auth.uid);
    try {
        const { exchangeId, apiKey, apiSecret } = data;
        console.log("📊 Portfolio request for:", exchangeId);
        console.log("🔑 API Key provided:", !!apiKey);
        // Top-up paper accounts use CK-prefixed Broker API keys which only work
        // against the Broker sandbox trading proxy (not paper-api.alpaca.markets).
        // Manually connected alpaca-paper accounts use regular PK-prefixed keys
        // and continue to use paper-api.alpaca.markets.
        if (exchangeId === "alpaca-paper" && (apiKey || "").startsWith("CK")) {
            const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
            const brokerAccountId = userDoc.data()?.alpacaBrokerAccountId;
            if (brokerAccountId) {
                console.log("📊 Routing to Alpaca Broker sandbox proxy, accountId:", brokerAccountId);
                const portfolio = await fetchAlpacaBrokerPaperPortfolio(ALPACA_BROKER_KEY.value(), ALPACA_BROKER_SECRET.value(), brokerAccountId);
                console.log("✅ Success! Portfolio value:", portfolio.portfolioValue);
                return portfolio;
            }
        }
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
    .runWith({ secrets: [ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
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
            // Same CK-key routing as the callable version.
            if (exchangeId === "alpaca-paper" && (apiKey || "").startsWith("CK")) {
                const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
                const brokerAccountId = userDoc.data()?.alpacaBrokerAccountId;
                if (brokerAccountId) {
                    console.log("📊 HTTP routing to Alpaca Broker sandbox proxy, accountId:", brokerAccountId);
                    const portfolio = await fetchAlpacaBrokerPaperPortfolio(ALPACA_BROKER_KEY.value(), ALPACA_BROKER_SECRET.value(), brokerAccountId);
                    res.status(200).json(portfolio);
                    return;
                }
            }
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
exports.getMarketData = functions
    .region("europe-west1")
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { symbol, timeframe, interval } = req.query;
            if (!symbol || !timeframe) {
                res.status(400).json({
                    error: "Missing required query parameters: symbol, timeframe",
                });
                return;
            }
            // Call the backend Cloud Run service to fetch market data
            const backendUrl = process.env.TRADING_BACKEND_URL ||
                "https://auto-trader-backend-zcypdnoyqa-ew.a.run.app";
            const instrumentUrl = `${backendUrl}/v1/instrument-chart?` +
                `symbol=${encodeURIComponent(String(symbol))}` +
                `&timeframe=${encodeURIComponent(String(timeframe))}` +
                (interval ? `&interval=${encodeURIComponent(String(interval))}` : "");
            console.log("📈 Fetching market data from:", instrumentUrl);
            const response = await (0, node_fetch_1.default)(instrumentUrl);
            if (!response.ok) {
                const text = await response.text();
                console.error("❌ Market data fetch error:", text);
                res.status(response.status).json({
                    error: `Failed to fetch market data: ${text}`,
                });
                return;
            }
            const data = await response.json();
            res.status(200).json(data);
        }
        catch (error) {
            console.error("❌ Market data error:", error.message);
            res.status(500).json({
                error: error.message || "Failed to fetch market data",
            });
        }
    });
});
const CONTACT_RECIPIENT = "mohamed@investbegin.de";
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "Auto-Trader";
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || "template_z125ea9";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "HYIL6fQcJSo0pHAhw";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";
const PREMIUM_MONTHLY_PRICE_USD = Number(process.env.PREMIUM_MONTHLY_PRICE_USD || "10");
const PREMIUM_MONTHLY_PRICE_CENTS = Math.max(1, Math.round(PREMIUM_MONTHLY_PRICE_USD * 100));
const PREMIUM_CURRENCY = "usd";
const STRIPE_SECRET_KEY = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const STRIPE_PREMIUM_PRICE_ID = (0, params_1.defineSecret)("STRIPE_PREMIUM_PRICE_ID");
const PAYPAL_CLIENT_ID = (0, params_1.defineSecret)("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = (0, params_1.defineSecret)("PAYPAL_CLIENT_SECRET");
const PAYPAL_PLAN_ID = (0, params_1.defineSecret)("PAYPAL_PLAN_ID");
let stripeClient = null;
function resolveStripeSecretKey() {
    const envSecret = process.env.STRIPE_SECRET_KEY || "";
    if (envSecret) {
        return envSecret;
    }
    const secretFromParam = STRIPE_SECRET_KEY.value();
    if (secretFromParam && secretFromParam.trim()) {
        return secretFromParam;
    }
    return "";
}
function resolveStripePremiumPriceId() {
    const envPriceId = process.env.STRIPE_PREMIUM_PRICE_ID || "";
    if (envPriceId) {
        return envPriceId;
    }
    const priceIdFromParam = STRIPE_PREMIUM_PRICE_ID.value();
    if (priceIdFromParam && priceIdFromParam.trim()) {
        return priceIdFromParam;
    }
    return "";
}
function resolvePayPalApiBaseUrl() {
    return process.env.PAYPAL_API_BASE_URL || "https://api-m.paypal.com";
}
function resolvePayPalClientId() {
    const value = PAYPAL_CLIENT_ID.value() || process.env.PAYPAL_CLIENT_ID || "";
    return String(value).trim();
}
function resolvePayPalClientSecret() {
    const value = PAYPAL_CLIENT_SECRET.value() || process.env.PAYPAL_CLIENT_SECRET || "";
    return String(value).trim();
}
function resolvePayPalPlanId() {
    const value = PAYPAL_PLAN_ID.value() || process.env.PAYPAL_PLAN_ID || "";
    return String(value).trim();
}
async function getPayPalAccessToken() {
    const clientId = resolvePayPalClientId();
    const clientSecret = resolvePayPalClientSecret();
    if (!clientId || !clientSecret) {
        throw new Error("PayPal is not configured (missing client credentials)");
    }
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await (0, node_fetch_1.default)(`${resolvePayPalApiBaseUrl()}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
        throw new Error(`Failed to obtain PayPal access token: ${tokenPayload?.error_description || tokenResponse.statusText}`);
    }
    return String(tokenPayload.access_token);
}
function getStripeClient() {
    if (stripeClient) {
        return stripeClient;
    }
    const secret = resolveStripeSecretKey();
    if (!secret) {
        throw new Error("Missing Stripe secret key (set STRIPE_SECRET_KEY or functions config stripe.secret_key)");
    }
    stripeClient = new stripe_1.default(secret);
    return stripeClient;
}
async function verifyBearerToken(authHeader) {
    const header = String(authHeader || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
        throw new Error("Missing Authorization Bearer token");
    }
    return admin.auth().verifyIdToken(token);
}
function isoFromUnix(seconds) {
    if (!seconds || !Number.isFinite(seconds)) {
        return null;
    }
    return new Date(seconds * 1000).toISOString();
}
async function getOrCreateStripeCustomer(decoded) {
    const userRef = admin.firestore().collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const existingCustomerId = String(userData?.subscription?.stripeCustomerId || "").trim();
    const stripe = getStripeClient();
    if (existingCustomerId) {
        const existingCustomer = await stripe.customers.retrieve(existingCustomerId);
        if (!("deleted" in existingCustomer && existingCustomer.deleted)) {
            return existingCustomer;
        }
    }
    const customer = await stripe.customers.create({
        email: decoded.email,
        metadata: {
            uid: decoded.uid,
        },
    });
    await userRef.set({
        subscription: {
            stripeCustomerId: customer.id,
        },
    }, { merge: true });
    return customer;
}
exports.sendContactMessage = functions
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
            const { senderEmail, subject, message } = req.body || {};
            const sender = String(senderEmail || "").trim();
            const emailSubject = String(subject || "").trim();
            const emailMessage = String(message || "").trim();
            if (!sender || !emailSubject || !emailMessage) {
                res.status(400).json({ error: "Missing required fields" });
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sender)) {
                res.status(400).json({ error: "Invalid sender email" });
                return;
            }
            if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
                console.error("❌ Missing EmailJS environment config.");
                res.status(500).json({
                    error: "Contact service is not configured",
                });
                return;
            }
            const payload = {
                service_id: EMAILJS_SERVICE_ID,
                template_id: EMAILJS_TEMPLATE_ID,
                user_id: EMAILJS_PUBLIC_KEY,
                template_params: {
                    to_email: CONTACT_RECIPIENT,
                    recipient_email: CONTACT_RECIPIENT,
                    to_name: "Mohamed",
                    from_email: sender,
                    sender_email: sender,
                    reply_to: sender,
                    subject: emailSubject,
                    message: `From: ${sender}\n\n${emailMessage}`,
                },
            };
            if (EMAILJS_PRIVATE_KEY) {
                payload.accessToken = EMAILJS_PRIVATE_KEY;
            }
            const emailjsRes = await (0, node_fetch_1.default)("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!emailjsRes.ok) {
                const text = await emailjsRes.text();
                console.error("❌ EmailJS send failed:", text);
                res.status(502).json({ error: "Failed to send message" });
                return;
            }
            res.status(200).json({ ok: true });
        }
        catch (error) {
            console.error("❌ Contact send error:", error?.message || error);
            res.status(500).json({
                error: error?.message || "Failed to send contact message",
            });
        }
    });
});
exports.createPremiumSubscriptionIntent = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const stripe = getStripeClient();
            const customer = await getOrCreateStripeCustomer(decoded);
            const premiumPriceId = resolveStripePremiumPriceId();
            if (!premiumPriceId) {
                res.status(500).json({ error: "Billing plan is not configured (missing Stripe premium price id)" });
                return;
            }
            const premiumPrice = await stripe.prices.retrieve(premiumPriceId);
            const billingAmount = Number(premiumPrice?.unit_amount || PREMIUM_MONTHLY_PRICE_CENTS);
            const billingCurrency = String(premiumPrice?.currency || PREMIUM_CURRENCY);
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [
                    {
                        price: premiumPriceId,
                    },
                ],
                payment_behavior: "default_incomplete",
                collection_method: "charge_automatically",
                metadata: {
                    uid: decoded.uid,
                    plan: "premium",
                },
                expand: ["latest_invoice.payment_intent"],
            });
            let latestInvoice = subscription.latest_invoice || null;
            if (typeof latestInvoice === "string" && latestInvoice) {
                latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
                    expand: ["payment_intent"],
                });
            }
            let paymentIntent = latestInvoice?.payment_intent || null;
            if (typeof paymentIntent === "string" && paymentIntent) {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
            }
            // Some Stripe configurations return an open invoice without an attached payment intent at creation time.
            // In that case, attempt to trigger invoice payment to force Stripe to generate the payment intent.
            if (!paymentIntent?.client_secret && latestInvoice?.id) {
                try {
                    const paidAttempt = await stripe.invoices.pay(latestInvoice.id, {
                        expand: ["payment_intent"],
                    });
                    latestInvoice = paidAttempt || latestInvoice;
                    let fallbackPaymentIntent = paidAttempt?.payment_intent || null;
                    if (typeof fallbackPaymentIntent === "string" && fallbackPaymentIntent) {
                        fallbackPaymentIntent = await stripe.paymentIntents.retrieve(fallbackPaymentIntent);
                    }
                    if (fallbackPaymentIntent?.client_secret) {
                        paymentIntent = fallbackPaymentIntent;
                    }
                }
                catch (payAttemptError) {
                    console.warn("⚠ invoice pay fallback failed while creating subscription intent", {
                        subscriptionId: subscription.id,
                        invoiceId: latestInvoice?.id,
                        message: payAttemptError?.message || payAttemptError,
                    });
                }
            }
            const clientSecret = String(paymentIntent?.client_secret || "");
            if (!clientSecret) {
                const alreadyActive = subscription.status === "active" || subscription.status === "trialing";
                if (!alreadyActive) {
                    console.error("❌ missing client secret for incomplete subscription", {
                        subscriptionId: subscription.id,
                        subscriptionStatus: subscription.status,
                        invoiceId: latestInvoice?.id || null,
                        invoiceStatus: latestInvoice?.status || null,
                        hasPaymentIntent: Boolean(latestInvoice?.payment_intent),
                    });
                    res.status(500).json({
                        error: "Subscription invoice did not return a payment client secret",
                        subscriptionStatus: subscription.status,
                        invoiceStatus: latestInvoice?.status || null,
                        hint: "Ensure this Stripe Price is recurring and charge_automatically-compatible. If using test cards, use test mode keys.",
                    });
                    return;
                }
                res.status(200).json({
                    clientSecret: "",
                    paymentIntentId: null,
                    subscriptionId: subscription.id,
                    amount: billingAmount,
                    currency: billingCurrency,
                    paymentRequired: false,
                    subscriptionStatus: subscription.status,
                });
                return;
            }
            res.status(200).json({
                clientSecret,
                paymentIntentId: paymentIntent.id,
                subscriptionId: subscription.id,
                amount: billingAmount,
                currency: billingCurrency,
                paymentRequired: true,
                subscriptionStatus: subscription.status,
            });
        }
        catch (error) {
            const message = error?.message || "Failed to create subscription intent";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            if (message.includes("Stripe secret key") || message.includes("premium price id")) {
                res.status(500).json({ error: "Billing service is not configured" });
                return;
            }
            console.error("❌ createPremiumSubscriptionIntent failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
exports.confirmPremiumSubscriptionActivation = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const subscriptionId = String(req.body?.subscriptionId || "").trim();
            if (!subscriptionId) {
                res.status(400).json({ error: "Missing subscriptionId" });
                return;
            }
            const stripe = getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (subscription.metadata?.uid !== decoded.uid) {
                res.status(403).json({ error: "Subscription does not belong to this user" });
                return;
            }
            if (subscription.status !== "active" && subscription.status !== "trialing") {
                res.status(400).json({
                    error: `Subscription is not active (status: ${subscription.status})`,
                });
                return;
            }
            const customerId = typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer.id;
            const userRef = admin.firestore().collection("users").doc(decoded.uid);
            await userRef.set({
                plan: "premium",
                subscription: {
                    active: true,
                    status: subscription.status,
                    priceUsd: PREMIUM_MONTHLY_PRICE_USD,
                    renewedAt: new Date().toISOString(),
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscription.id,
                    currentPeriodEnd: isoFromUnix(subscription.current_period_end),
                    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
                },
            }, { merge: true });
            res.status(200).json({
                ok: true,
                message: "Premium subscription activated",
            });
        }
        catch (error) {
            const message = error?.message || "Failed to confirm premium subscription";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            if (message.includes("No such subscription")) {
                res.status(404).json({ error: "Subscription not found" });
                return;
            }
            console.error("❌ confirmPremiumSubscriptionActivation failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
exports.getPremiumBillingOverview = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID] })
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const decoded = await verifyBearerToken(req.headers.authorization);
            const stripe = getStripeClient();
            const userRef = admin.firestore().collection("users").doc(decoded.uid);
            const userSnap = await userRef.get();
            const subData = userSnap.data()?.subscription || {};
            const customerId = String(subData?.stripeCustomerId || "").trim();
            const subscriptionId = String(subData?.stripeSubscriptionId || "").trim();
            if (!customerId) {
                res.status(200).json({
                    plan: "free",
                    hasSubscription: false,
                    status: "inactive",
                    cancelAtPeriodEnd: false,
                    currentPeriodEnd: null,
                    invoices: [],
                });
                return;
            }
            let subscription = null;
            if (subscriptionId) {
                subscription = await stripe.subscriptions.retrieve(subscriptionId);
            }
            else {
                const listed = await stripe.subscriptions.list({
                    customer: customerId,
                    status: "all",
                    limit: 1,
                });
                subscription = listed.data[0] || null;
            }
            const invoices = await stripe.invoices.list({
                customer: customerId,
                limit: 12,
            });
            res.status(200).json({
                plan: subscription && (subscription.status === "active" || subscription.status === "trialing")
                    ? "premium"
                    : "free",
                hasSubscription: Boolean(subscription),
                status: subscription?.status || "inactive",
                cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
                currentPeriodEnd: isoFromUnix(subscription?.current_period_end),
                subscriptionId: subscription?.id || null,
                invoices: invoices.data.map((invoice) => ({
                    id: invoice.id,
                    amountPaid: invoice.amount_paid,
                    currency: invoice.currency,
                    status: invoice.status,
                    createdAt: isoFromUnix(invoice.created),
                    hostedInvoiceUrl: invoice.hosted_invoice_url,
                    invoicePdf: invoice.invoice_pdf,
                })),
            });
        }
        catch (error) {
            const message = error?.message || "Failed to load billing overview";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ getPremiumBillingOverview failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
exports.cancelPremiumSubscription = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const stripe = getStripeClient();
            const userRef = admin.firestore().collection("users").doc(decoded.uid);
            const userSnap = await userRef.get();
            const existingSubId = String(userSnap.data()?.subscription?.stripeSubscriptionId || "").trim();
            if (!existingSubId) {
                res.status(400).json({ error: "No active subscription found" });
                return;
            }
            const subscription = await stripe.subscriptions.retrieve(existingSubId);
            if (subscription.metadata?.uid !== decoded.uid) {
                res.status(403).json({ error: "Subscription does not belong to this user" });
                return;
            }
            const updated = await stripe.subscriptions.update(existingSubId, {
                cancel_at_period_end: true,
            });
            await userRef.set({
                subscription: {
                    status: updated.status,
                    cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
                    currentPeriodEnd: isoFromUnix(updated.current_period_end),
                    canceledAt: new Date().toISOString(),
                    canceledBy: "user",
                },
            }, { merge: true });
            res.status(200).json({
                ok: true,
                message: "Subscription will cancel at the end of the current billing period",
                currentPeriodEnd: isoFromUnix(updated.current_period_end),
            });
        }
        catch (error) {
            const message = error?.message || "Failed to cancel subscription";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ cancelPremiumSubscription failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
exports.createPayPalSubscription = functions
    .region("europe-west1")
    .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const planId = resolvePayPalPlanId();
            if (!planId) {
                res.status(500).json({ error: "PayPal plan is not configured" });
                return;
            }
            const returnUrl = String(req.body?.returnUrl || "").trim() || "https://autotrader-b8851.web.app/billing/checkout?paypal=success";
            const cancelUrl = String(req.body?.cancelUrl || "").trim() || "https://autotrader-b8851.web.app/billing/checkout?paypal=cancel";
            const accessToken = await getPayPalAccessToken();
            const response = await (0, node_fetch_1.default)(`${resolvePayPalApiBaseUrl()}/v1/billing/subscriptions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    plan_id: planId,
                    custom_id: decoded.uid,
                    application_context: {
                        brand_name: "AutoTrader",
                        user_action: "SUBSCRIBE_NOW",
                        return_url: returnUrl,
                        cancel_url: cancelUrl,
                    },
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                res.status(500).json({ error: payload?.message || "Failed to create PayPal subscription" });
                return;
            }
            const approvalUrl = Array.isArray(payload?.links)
                ? payload.links.find((link) => link?.rel === "approve")?.href || ""
                : "";
            if (!payload?.id || !approvalUrl) {
                res.status(500).json({ error: "PayPal did not return subscription approval URL" });
                return;
            }
            res.status(200).json({
                subscriptionId: String(payload.id),
                approvalUrl: String(approvalUrl),
            });
        }
        catch (error) {
            const message = error?.message || "Failed to create PayPal subscription";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ createPayPalSubscription failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
exports.confirmPayPalSubscription = functions
    .region("europe-west1")
    .runWith({ secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const subscriptionId = String(req.body?.subscriptionId || "").trim();
            if (!subscriptionId) {
                res.status(400).json({ error: "Missing subscriptionId" });
                return;
            }
            const accessToken = await getPayPalAccessToken();
            const response = await (0, node_fetch_1.default)(`${resolvePayPalApiBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            const payload = await response.json();
            if (!response.ok) {
                res.status(500).json({ error: payload?.message || "Failed to verify PayPal subscription" });
                return;
            }
            const customId = String(payload?.custom_id || "").trim();
            if (customId && customId !== decoded.uid) {
                res.status(403).json({ error: "PayPal subscription does not belong to this user" });
                return;
            }
            const status = String(payload?.status || "").toUpperCase();
            const activeLike = status === "ACTIVE" || status === "APPROVED";
            if (!activeLike) {
                res.status(400).json({ error: `PayPal subscription is not active (status: ${status || "unknown"})` });
                return;
            }
            const userRef = admin.firestore().collection("users").doc(decoded.uid);
            await userRef.set({
                plan: "premium",
                subscription: {
                    active: true,
                    status: "active",
                    priceUsd: PREMIUM_MONTHLY_PRICE_USD,
                    renewedAt: new Date().toISOString(),
                    provider: "paypal",
                    paypalSubscriptionId: subscriptionId,
                    cancelAtPeriodEnd: false,
                },
            }, { merge: true });
            res.status(200).json({
                ok: true,
                message: "Premium subscription activated via PayPal",
            });
        }
        catch (error) {
            const message = error?.message || "Failed to confirm PayPal subscription";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ confirmPayPalSubscription failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
// ── Real-money top-up ───────────────────────────────────────────────────────
/**
 * Creates an Alpaca Broker sandbox sub-account for the user, generates
 * paper-trading API keys, and funds it with virtual money matching the deposit.
 * Uses Alpaca's sandbox environment (paper-only, no real money at risk).
 * Returns null (with a warning) on any Alpaca API error so the top-up itself
 * is never blocked.
 */
async function provisionAlpacaPaperAccount(uid, email, displayName, depositAmountUsd, brokerKey, brokerSecret) {
    try {
        const ALPACA_BROKER_BASE = "https://broker-api.sandbox.alpaca.markets";
        const authHeader = `Basic ${Buffer.from(`${brokerKey}:${brokerSecret}`).toString("base64")}`;
        const headers = {
            Authorization: authHeader,
            "Content-Type": "application/json",
        };
        // Parse the user's display name into first / last.
        const parts = displayName.trim().split(/\s+/);
        const givenName = parts[0] || "AutoTrader";
        const familyName = parts.slice(1).join(" ") || "User";
        // 1 ── Create broker sub-account.
        //      Alpaca sandbox accepts the test SSN "666-55-4321" documented
        //      in their official sandbox guide.
        const createResp = await (0, node_fetch_1.default)(`${ALPACA_BROKER_BASE}/v1/accounts`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                contact: {
                    email_address: email,
                    phone_number: "555-666-7788",
                    street_address: ["20 N San Mateo Dr"],
                    city: "San Mateo",
                    state: "CA",
                    postal_code: "94401",
                    country: "USA",
                },
                identity: {
                    given_name: givenName,
                    family_name: familyName,
                    date_of_birth: "1990-01-01",
                    tax_id: "666-55-4321",
                    tax_id_type: "USA_SSN",
                    country_of_citizenship: "USA",
                    country_of_birth: "USA",
                    country_of_tax_residence: "USA",
                    funding_source: ["employment_income"],
                },
                disclosures: {
                    is_control_person: false,
                    is_affiliated_exchange_or_finra: false,
                    is_politically_exposed: false,
                    immediate_family_exposed: false,
                },
                agreements: [
                    {
                        agreement: "customer_agreement",
                        signed_at: new Date().toISOString(),
                        ip_address: "127.0.0.1",
                    },
                ],
            }),
        });
        if (!createResp.ok) {
            console.warn(`⚠️ Alpaca account creation failed for ${uid}: ${await createResp.text()}`);
            return null;
        }
        const account = (await createResp.json());
        const accountId = account.id;
        // 2 ── Generate paper-trading API keys for the sub-account.
        const keysResp = await (0, node_fetch_1.default)(`${ALPACA_BROKER_BASE}/v1/trading/accounts/${accountId}/access_keys`, { method: "POST", headers, body: JSON.stringify({}) });
        if (!keysResp.ok) {
            console.warn(`⚠️ Alpaca key generation failed for ${uid}: ${await keysResp.text()}`);
            return null;
        }
        const keys = (await keysResp.json());
        // 3 ── Fund the paper account with virtual money matching the deposit.
        const fundResp = await (0, node_fetch_1.default)(`${ALPACA_BROKER_BASE}/v1/accounts/${accountId}/transactions/cash`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                amount: String(depositAmountUsd),
                direction: "INCOMING",
                reason: "AutoTrader user deposit",
            }),
        });
        if (!fundResp.ok) {
            // Funding failure is non-fatal — account + keys are still usable.
            console.warn(`⚠️ Alpaca fund deposit warning for ${uid}: ${await fundResp.text()}`);
        }
        console.log(`✅ Alpaca paper account provisioned for ${uid}: ${accountId}`);
        return { accountId, apiKey: keys.id, apiSecret: keys.secret };
    }
    catch (err) {
        console.warn("⚠️ provisionAlpacaPaperAccount threw:", err);
        return null;
    }
}
const MIN_TOPUP_USD = 1;
const MAX_TOPUP_USD = 100000;
/**
 * Creates a Stripe PaymentIntent for a one-time real-money top-up.
 * The frontend confirms the payment with the returned clientSecret,
 * then calls confirmTopUp to credit the user's account in Firestore.
 */
exports.createTopUpIntent = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const rawAmount = Number(req.body?.amountUsd ?? 0);
            if (!Number.isFinite(rawAmount) || rawAmount < MIN_TOPUP_USD || rawAmount > MAX_TOPUP_USD) {
                res.status(400).json({ error: `Amount must be between $${MIN_TOPUP_USD} and $${MAX_TOPUP_USD}.` });
                return;
            }
            const amountCents = Math.round(rawAmount * 100);
            const stripe = getStripeClient();
            const customer = await getOrCreateStripeCustomer(decoded);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountCents,
                currency: "usd",
                customer: customer.id,
                description: `AutoTrader real-money account top-up — $${rawAmount}`,
                metadata: {
                    uid: decoded.uid,
                    purpose: "real_money_topup",
                    amountUsd: String(rawAmount),
                },
            });
            res.status(200).json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            });
        }
        catch (error) {
            const message = error?.message || "Failed to create top-up payment";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ createTopUpIntent failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
/**
 * Verifies a completed top-up PaymentIntent and credits the user's
 * real-money balance in Firestore, marking them as onboarded.
 */
exports.confirmTopUp = functions
    .region("europe-west1")
    .runWith({ secrets: [STRIPE_SECRET_KEY, ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const paymentIntentId = String(req.body?.paymentIntentId || "").trim();
            if (!paymentIntentId) {
                res.status(400).json({ error: "Missing paymentIntentId" });
                return;
            }
            const stripe = getStripeClient();
            const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
            // Security: verify the intent belongs to this user.
            if (intent.metadata?.uid !== decoded.uid) {
                res.status(403).json({ error: "PaymentIntent does not belong to this user" });
                return;
            }
            if (intent.status !== "succeeded") {
                res.status(400).json({ error: `Payment has not succeeded (status: ${intent.status})` });
                return;
            }
            // Use the authoritative amount from Stripe (cents → USD).
            const verifiedAmountUsd = intent.amount / 100;
            const userRef = admin.firestore().collection("users").doc(decoded.uid);
            const userSnap = await userRef.get();
            const userData = userSnap.data() ?? {};
            const existingBalance = Number(userData.realMoneyBalance ?? 0);
            const newBalance = Math.round((existingBalance + verifiedAmountUsd) * 100) / 100;
            // Provision an Alpaca Broker sandbox paper account (only on first top-up).
            let alpacaAccount = null;
            if (!userData.alpacaBrokerAccountId) {
                const brokerKey = ALPACA_BROKER_KEY.value();
                const brokerSecret = ALPACA_BROKER_SECRET.value();
                if (brokerKey && brokerSecret) {
                    const userEmail = decoded.email ?? `${decoded.uid}@autotrader.app`;
                    const userDisplayName = decoded.name ?? "AutoTrader User";
                    alpacaAccount = await provisionAlpacaPaperAccount(decoded.uid, userEmail, userDisplayName, verifiedAmountUsd, brokerKey, brokerSecret);
                }
                else {
                    console.warn("⚠️ ALPACA_BROKER_KEY / ALPACA_BROKER_SECRET not set — skipping Alpaca provisioning");
                }
            }
            const firestoreUpdate = {
                realMoneyBalance: newBalance,
                realMoneyOnboarded: true,
            };
            if (alpacaAccount) {
                firestoreUpdate.alpacaBrokerAccountId = alpacaAccount.accountId;
            }
            await userRef.set(firestoreUpdate, { merge: true });
            // Auto-connect the Alpaca paper account as an exchange for the user.
            if (alpacaAccount) {
                const exchangeRef = admin
                    .firestore()
                    .collection("users")
                    .doc(decoded.uid)
                    .collection("exchanges")
                    .doc("alpaca-paper-autotrader");
                await exchangeRef.set({
                    exchangeId: "alpaca-paper",
                    label: "alpaca-paper-autotrader",
                    apiKey: alpacaAccount.apiKey,
                    secret: alpacaAccount.apiSecret,
                    passphrase: "",
                    status: "active",
                    connectedAt: new Date().toISOString(),
                });
            }
            console.log(`✅ Top-up confirmed for ${decoded.uid}: +$${verifiedAmountUsd}, new balance $${newBalance}`);
            res.status(200).json({
                ok: true,
                creditedUsd: verifiedAmountUsd,
                newBalanceUsd: newBalance,
                alpacaProvisioned: alpacaAccount !== null,
            });
        }
        catch (error) {
            const message = error?.message || "Failed to confirm top-up";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ confirmTopUp failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
// ── NOWPayments Cryptocurrency Top-up ──────────────────────────────────────
const NOWPAYMENTS_API_KEY = (0, params_1.defineSecret)("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_PUBLIC_KEY = (0, params_1.defineSecret)("NOWPAYMENTS_PUBLIC_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io";
async function fetchNowPaymentsMerchantCurrencies(apiKey) {
    const resp = await (0, node_fetch_1.default)(`${NOWPAYMENTS_BASE_URL}/v1/merchant/coins`, {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
        },
    });
    if (!resp.ok) {
        const providerErr = await resp.text();
        throw new Error(`Failed to fetch merchant currencies (${resp.status}): ${providerErr}`);
    }
    const payload = await resp.json();
    const raw = Array.isArray(payload?.selectedCurrencies) ? payload.selectedCurrencies : [];
    return raw
        .map((c) => String(c || "").trim().toUpperCase())
        .filter((c) => c.length > 0)
        .sort();
}
// CORS handler that also allows GET (needed for order status polling).
const corsHandlerGet = (0, cors_1.default)({
    origin: [
        "https://autotrader-b8851.web.app",
        "https://invest-begin.com",
        "https://www.invest-begin.com",
        /^http:\/\/localhost(?::\d+)?$/,
        /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
/**
 * Creates a NOWPayments cryptocurrency payment order for a real-money top-up.
 * Returns the hosted payment URL that the user visits to pay in crypto.
 */
exports.createNowPaymentsOrder = functions
    .region("europe-west1")
    .runWith({ secrets: [NOWPAYMENTS_API_KEY] })
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
            const decoded = await verifyBearerToken(req.headers.authorization);
            const rawAmount = Number(req.body?.amountUsd ?? 0);
            const requestedCurrency = String(req.body?.payCurrency || "BTC").trim().toUpperCase();
            if (!Number.isFinite(rawAmount) || rawAmount < MIN_TOPUP_USD || rawAmount > MAX_TOPUP_USD) {
                res.status(400).json({ error: `Amount must be between $${MIN_TOPUP_USD} and $${MAX_TOPUP_USD}.` });
                return;
            }
            // Unique internal order ID: prefix + uid + timestamp
            const internalOrderId = `at_${decoded.uid}_${Date.now()}`;
            // Persist a pending order so the callback can look up the user.
            await admin.firestore().collection("nowpayments_orders").doc(internalOrderId).set({
                uid: decoded.uid,
                amountUsd: rawAmount,
                status: "pending",
                createdAt: new Date().toISOString(),
            });
            const apiKey = NOWPAYMENTS_API_KEY.value().trim();
            if (!apiKey) {
                res.status(500).json({ error: "Crypto payment is not configured. Please contact support." });
                return;
            }
            const availableCurrencies = await fetchNowPaymentsMerchantCurrencies(apiKey);
            const allowedSet = new Set(availableCurrencies);
            if (!allowedSet.has(requestedCurrency)) {
                res.status(400).json({
                    error: `Unsupported pay currency: ${requestedCurrency}`,
                    availableCurrencies,
                });
                return;
            }
            const paymentPayload = {
                order_id: internalOrderId,
                price_amount: rawAmount,
                price_currency: "USD",
                pay_currency: requestedCurrency.toLowerCase(),
                order_description: `Real-money account top-up of $${rawAmount}`,
                ipn_callback_url: "https://autotrader-b8851.web.app/api/nowPaymentsCallback",
                success_url: "https://autotrader-b8851.web.app/?payment=success",
                cancel_url: "https://autotrader-b8851.web.app/?payment=cancelled",
            };
            // Hosted checkout page comes from invoice flow. Payment flow may only
            // provide an address, which can lead to an empty URL on the frontend.
            let order = null;
            let paymentUrl = "";
            let lastProviderError = "";
            const invoiceResp = await (0, node_fetch_1.default)(`${NOWPAYMENTS_BASE_URL}/v1/invoice`, {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(paymentPayload),
            });
            if (invoiceResp.ok) {
                order = await invoiceResp.json();
                paymentUrl = String(order.invoice_url || order.url || order.hosted_url || "").trim();
            }
            else {
                lastProviderError = await invoiceResp.text();
                console.warn("⚠️ NOWPayments invoice creation failed, falling back to payment API:", lastProviderError);
            }
            if (!paymentUrl) {
                const paymentResp = await (0, node_fetch_1.default)(`${NOWPAYMENTS_BASE_URL}/v1/payment`, {
                    method: "POST",
                    headers: {
                        "x-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(paymentPayload),
                });
                if (!paymentResp.ok) {
                    const errText = await paymentResp.text();
                    lastProviderError = errText || lastProviderError;
                    console.error("❌ NOWPayments order creation failed:", lastProviderError);
                    // Try to parse provider details so we can return a useful message.
                    let providerMessage = "Failed to create crypto payment order. Please try again.";
                    try {
                        const parsed = JSON.parse(lastProviderError || "{}");
                        if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
                            providerMessage = parsed.message.trim();
                        }
                        if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
                            const firstError = String(parsed.errors[0] ?? "").trim();
                            if (firstError) {
                                providerMessage = `${providerMessage}: ${firstError}`;
                            }
                        }
                    }
                    catch {
                        // Keep default fallback message when provider body isn't JSON.
                    }
                    await admin.firestore().collection("nowpayments_orders").doc(internalOrderId).update({ status: "failed" });
                    res.status(502).json({ error: providerMessage });
                    return;
                }
                order = await paymentResp.json();
                paymentUrl = String(order.payment_url || order.invoice_url || order.url || order.hosted_url || "").trim();
            }
            if (!paymentUrl) {
                console.error("❌ NOWPayments returned no hosted payment URL", order);
                await admin.firestore().collection("nowpayments_orders").doc(internalOrderId).update({ status: "failed" });
                res.status(502).json({ error: "Crypto checkout page could not be created. Please try again." });
                return;
            }
            await admin.firestore().collection("nowpayments_orders").doc(internalOrderId).update({
                nowPaymentsPaymentId: String(order.payment_id || order.id || ""),
                nowPaymentsInvoiceId: String(order.invoice_id || order.invoiceId || ""),
                payCurrency: requestedCurrency,
                paymentUrl,
            });
            console.log(`✅ NOWPayments order created for ${decoded.uid}: order ${internalOrderId}`);
            res.status(200).json({
                orderId: internalOrderId,
                paymentId: String(order.payment_id || order.id || ""),
                paymentUrl,
            });
        }
        catch (error) {
            const message = error?.message || "Failed to create crypto payment order";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ createNowPaymentsOrder failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
/**
 * Returns merchant-enabled NOWPayments currencies for crypto checkout UI.
 */
exports.listNowPaymentsCurrencies = functions
    .region("europe-west1")
    .runWith({ secrets: [NOWPAYMENTS_API_KEY] })
    .https.onRequest((req, res) => {
    corsHandlerGet(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            await verifyBearerToken(req.headers.authorization);
            const apiKey = NOWPAYMENTS_API_KEY.value().trim();
            if (!apiKey) {
                res.status(500).json({ error: "Crypto payment is not configured. Please contact support." });
                return;
            }
            const currencies = await fetchNowPaymentsMerchantCurrencies(apiKey);
            res.status(200).json({ currencies });
        }
        catch (error) {
            const message = error?.message || "Failed to list crypto currencies";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ listNowPaymentsCurrencies failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
/**
 * Polls the status of a pending NOWPayments order.
 * The frontend calls this every few seconds after the user completes payment
 * to detect when the webhook has confirmed and credited the balance.
 */
exports.checkNowPaymentsOrder = functions
    .region("europe-west1")
    .runWith({ secrets: [] })
    .https.onRequest((req, res) => {
    corsHandlerGet(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        try {
            const decoded = await verifyBearerToken(req.headers.authorization);
            // Support both GET (query param) and POST (body)
            const orderId = String(req.query?.orderId || req.body?.orderId || "").trim();
            if (!orderId) {
                res.status(400).json({ error: "Missing orderId" });
                return;
            }
            const orderSnap = await admin.firestore().collection("nowpayments_orders").doc(orderId).get();
            if (!orderSnap.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            const orderData = orderSnap.data();
            // Security: only the owning user can poll their order.
            if (orderData.uid !== decoded.uid) {
                res.status(403).json({ error: "Forbidden" });
                return;
            }
            res.status(200).json({
                status: orderData.status,
                amountUsd: orderData.amountUsd,
            });
        }
        catch (error) {
            const message = error?.message || "Failed to check order status";
            if (message.includes("Authorization Bearer token")) {
                res.status(401).json({ error: message });
                return;
            }
            console.error("❌ checkNowPaymentsOrder failed:", error);
            res.status(500).json({ error: message });
        }
    });
});
/**
 * Receives NOWPayments payment webhooks (server-to-server POST).
 * Verifies the payment against the NOWPayments API, then credits the user's
 * real-money balance and provisions an Alpaca paper account if needed.
 */
exports.nowPaymentsCallback = functions
    .region("europe-west1")
    .runWith({ secrets: [NOWPAYMENTS_API_KEY, NOWPAYMENTS_PUBLIC_KEY, ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
    .https.onRequest(async (req, res) => {
    // No CORS needed — this is a server-to-server webhook from NOWPayments.
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    try {
        // NOWPayments sends JSON body with payment and order details.
        const body = req.body || {};
        const orderId = String(body.order_id || body.orderId || "").trim();
        const status = String(body.payment_status || body.status || "").trim().toLowerCase();
        const paymentId = String(body.payment_id || body.id || "").trim();
        if (!orderId || !status) {
            res.status(400).send("Missing order_id or status");
            return;
        }
        // Only process final paid statuses.
        if (status !== "confirmed" && status !== "finished") {
            console.log(`ℹ️ NOWPayments callback: order ${orderId} status=${status}, no action needed`);
            res.status(200).send("OK");
            return;
        }
        const orderRef = admin.firestore().collection("nowpayments_orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            console.error(`❌ NOWPayments callback: unknown order ${orderId}`);
            res.status(404).send("Order not found");
            return;
        }
        const orderData = orderSnap.data();
        // Idempotency: skip if already processed.
        if (orderData.status === "paid") {
            res.status(200).send("OK");
            return;
        }
        // Security: independently verify the payment with the NOWPayments API.
        const apiKey = NOWPAYMENTS_API_KEY.value();
        if (paymentId && apiKey) {
            const verifyResp = await (0, node_fetch_1.default)(`${NOWPAYMENTS_BASE_URL}/v1/payment/${encodeURIComponent(paymentId)}`, {
                headers: { "x-api-key": apiKey },
            });
            if (verifyResp.ok) {
                const verifiedOrder = await verifyResp.json();
                const verifiedStatus = String(verifiedOrder.payment_status || verifiedOrder.status || "").toLowerCase();
                if (verifiedStatus !== "confirmed" && verifiedStatus !== "finished") {
                    console.warn(`⚠️ NOWPayments verification: order ${paymentId} not confirmed paid`);
                    res.status(200).send("OK");
                    return;
                }
            }
            else {
                console.warn(`⚠️ NOWPayments order verification request failed (${verifyResp.status}), proceeding with callback data`);
            }
        }
        const uid = String(orderData.uid || "").trim();
        const amountUsd = Number(orderData.amountUsd);
        if (!uid || !Number.isFinite(amountUsd) || amountUsd <= 0) {
            console.error(`❌ NOWPayments callback: invalid order data for ${orderId}`);
            res.status(400).send("Invalid order data");
            return;
        }
        // Credit the user's real-money balance.
        const userRef = admin.firestore().collection("users").doc(uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data() ?? {};
        const existingBalance = Number(userData.realMoneyBalance ?? 0);
        const newBalance = Math.round((existingBalance + amountUsd) * 100) / 100;
        // Provision Alpaca paper account on first top-up.
        let alpacaAccount = null;
        if (!userData.alpacaBrokerAccountId) {
            const brokerKey = ALPACA_BROKER_KEY.value();
            const brokerSecret = ALPACA_BROKER_SECRET.value();
            if (brokerKey && brokerSecret) {
                const userEmail = userData.email ?? `${uid}@autotrader.app`;
                const userDisplayName = userData.displayName ?? "AutoTrader User";
                alpacaAccount = await provisionAlpacaPaperAccount(uid, userEmail, userDisplayName, amountUsd, brokerKey, brokerSecret);
            }
        }
        const firestoreUpdate = {
            realMoneyBalance: newBalance,
            realMoneyOnboarded: true,
        };
        if (alpacaAccount) {
            firestoreUpdate.alpacaBrokerAccountId = alpacaAccount.accountId;
        }
        await userRef.set(firestoreUpdate, { merge: true });
        if (alpacaAccount) {
            await admin.firestore()
                .collection("users").doc(uid)
                .collection("exchanges").doc("alpaca-paper-autotrader")
                .set({
                exchangeId: "alpaca-paper",
                label: "alpaca-paper-autotrader",
                apiKey: alpacaAccount.apiKey,
                secret: alpacaAccount.apiSecret,
                passphrase: "",
                status: "active",
                connectedAt: new Date().toISOString(),
            });
        }
        // Mark the order paid (idempotency guard for future callbacks).
        await orderRef.update({
            status: "paid",
            paidAt: new Date().toISOString(),
            nowPaymentsPaymentId: paymentId || orderData.nowPaymentsPaymentId || "",
        });
        console.log(`✅ NOWPayments top-up credited for ${uid}: +$${amountUsd}, new balance $${newBalance}`);
        res.status(200).send("OK");
    }
    catch (error) {
        console.error("❌ nowPaymentsCallback failed:", error);
        res.status(500).send("Internal server error");
    }
});
//# sourceMappingURL=index.js.map