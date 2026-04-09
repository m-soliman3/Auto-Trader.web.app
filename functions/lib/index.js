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
exports.cancelPremiumSubscription = exports.getPremiumBillingOverview = exports.confirmPremiumSubscriptionActivation = exports.createPremiumSubscriptionIntent = exports.sendContactMessage = exports.getMarketData = exports.getPortfolioHttp = exports.getPortfolio = void 0;
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
//# sourceMappingURL=index.js.map