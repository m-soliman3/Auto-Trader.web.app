import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import * as crypto from "crypto";
import cors from "cors";
import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

interface PortfolioData {
  portfolioValue: number;
  unrealizedPnl: number | null;
  pnlPercentage: number | null;
  updatedAt: string;
  openPositions?: Array<{
    symbol: string;
    quantity: number;
    marketValue: number;
    unrealizedPnl: number | null;
    pnlPercentage: number | null;
    entryPrice: number | null;
    currentPrice: number | null;
    side: "long" | "short";
    marketOpen?: boolean;
    marketStatusReason?: string;
  }>;
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const corsHandler = cors({
  // Allow production hosting plus local dev on any localhost/127.0.0.1 port.
  origin: [
    "https://autotrader-b8851.web.app",
    "https://autotrader-b8851-staging.web.app",
    "https://invest-begin.com",
    "https://www.invest-begin.com",
    /^http:\/\/localhost(?::\d+)?$/,
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  ],
  methods: ["POST", "OPTIONS", "GET"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

async function fetchAlpacaPortfolio(
  apiKey: string,
  apiSecret: string,
  isPaper: boolean
): Promise<PortfolioData> {
  const baseUrl = isPaper
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";
  const url = `${baseUrl}/v2/account`;

  console.log("🔗 Alpaca URL:", url, "isPaper:", isPaper);

  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
    },
  } as any);

  if (!response.ok) {
    const text = await response.text();
    console.error("❌ Alpaca error:", text);
    throw new functions.https.HttpsError("internal", `Alpaca API error ${response.status}: ${text}`);
  }

  const data: any = await response.json();

  const positionsUrl = `${baseUrl}/v2/positions`;
  const positionsResponse = await fetch(positionsUrl, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
    },
  } as any);

  if (!positionsResponse.ok) {
    const text = await positionsResponse.text();
    console.error("❌ Alpaca positions error:", text);
    throw new functions.https.HttpsError("internal", `Alpaca positions API error ${positionsResponse.status}: ${text}`);
  }

  const positionsPayload: any[] = await positionsResponse.json();
  const openPositions = Array.isArray(positionsPayload)
    ? positionsPayload.map((position: any) => {
        const side: "long" | "short" = String(position.side || "long").toLowerCase() === "short" ? "short" : "long";
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

async function fetchBinance24hTicker(symbol: string): Promise<{ lastPrice: number } | null> {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const response = await fetch(url as any);
  if (!response.ok) {
    return null;
  }

  const data: any = await response.json();
  const lastPrice = parseFloat(data.lastPrice || "0");
  if (!Number.isFinite(lastPrice)) {
    return null;
  }

  return { lastPrice };
}

async function fetchBinancePortfolio(
  apiKey: string,
  apiSecret: string
): Promise<PortfolioData> {
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

  const response = await fetch(url, {
    headers: { "X-MBX-APIKEY": apiKey },
  } as any);

  if (!response.ok) {
    const text = await response.text();
    console.error("❌ Binance error:", text);
    throw new functions.https.HttpsError("internal", `Binance API error ${response.status}: ${text}`);
  }

  const data: any = await response.json();
  const balances = (data.balances || []).filter((asset: any) => {
    const totalQty = parseFloat(asset.free || "0") + parseFloat(asset.locked || "0");
    return totalQty > 0;
  });

  const stableCoins = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD"]);

  const valuedAssets = await Promise.all(
    balances.map(async (asset: any) => {
      const quantity = parseFloat(asset.free || "0") + parseFloat(asset.locked || "0");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { assetSymbol: '', quantity: 0, currentPrice: null as number | null, currentValue: 0 };
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
        return { assetSymbol, quantity, currentPrice: null as number | null, currentValue: 0 };
      }

      return {
        assetSymbol,
        quantity,
        currentPrice: ticker.lastPrice,
        currentValue: quantity * ticker.lastPrice,
      };
    })
  );

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
      side: "long" as const,
    }));

  return {
    portfolioValue: totalCurrentValue,
    unrealizedPnl: null,
    pnlPercentage: null,
    updatedAt: new Date().toISOString(),
    openPositions,
  };
}

async function resolvePortfolio(
  exchangeId: string,
  apiKey: string,
  apiSecretFromClient?: string
): Promise<PortfolioData> {
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

export const getPortfolio = functions
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
    } catch (error: any) {
      console.error("❌❌❌ Uncaught Error:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", error.message, error);
    }
  });

export const getPortfolioHttp = functions
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
      } catch (error: any) {
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

export const getMarketData = functions
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

        const instrumentUrl =
          `${backendUrl}/v1/instrument-chart?` +
          `symbol=${encodeURIComponent(String(symbol))}` +
          `&timeframe=${encodeURIComponent(String(timeframe))}` +
          (interval ? `&interval=${encodeURIComponent(String(interval))}` : "");

        console.log("📈 Fetching market data from:", instrumentUrl);

        const response = await fetch(instrumentUrl);

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
      } catch (error: any) {
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
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_PREMIUM_PRICE_ID = defineSecret("STRIPE_PREMIUM_PRICE_ID");
const PAYPAL_CLIENT_ID = defineSecret("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const PAYPAL_PLAN_ID = defineSecret("PAYPAL_PLAN_ID");
const BINANCE_CLIENT_ID = defineSecret("BINANCE_CLIENT_ID");
const BINANCE_CLIENT_SECRET = defineSecret("BINANCE_CLIENT_SECRET");

let stripeClient: InstanceType<typeof Stripe> | null = null;

function resolveStripeSecretKey(): string {
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

function resolveStripePremiumPriceId(): string {
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

function resolvePayPalApiBaseUrl(): string {
  return process.env.PAYPAL_API_BASE_URL || "https://api-m.paypal.com";
}

function resolvePayPalClientId(): string {
  const value = PAYPAL_CLIENT_ID.value() || process.env.PAYPAL_CLIENT_ID || "";
  return String(value).trim();
}

function resolvePayPalClientSecret(): string {
  const value = PAYPAL_CLIENT_SECRET.value() || process.env.PAYPAL_CLIENT_SECRET || "";
  return String(value).trim();
}

function resolvePayPalPlanId(): string {
  const value = PAYPAL_PLAN_ID.value() || process.env.PAYPAL_PLAN_ID || "";
  return String(value).trim();
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = resolvePayPalClientId();
  const clientSecret = resolvePayPalClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("PayPal is not configured (missing client credentials)");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenResponse = await fetch(`${resolvePayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  } as any);

  const tokenPayload: any = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(`Failed to obtain PayPal access token: ${tokenPayload?.error_description || tokenResponse.statusText}`);
  }

  return String(tokenPayload.access_token);
}

function getStripeClient(): InstanceType<typeof Stripe> {
  if (stripeClient) {
    return stripeClient;
  }

  const secret = resolveStripeSecretKey();
  if (!secret) {
    throw new Error("Missing Stripe secret key (set STRIPE_SECRET_KEY or functions config stripe.secret_key)");
  }

  stripeClient = new Stripe(secret);
  return stripeClient;
}

async function verifyBearerToken(authHeader?: string): Promise<admin.auth.DecodedIdToken> {
  const header = String(authHeader || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    throw new Error("Missing Authorization Bearer token");
  }

  return admin.auth().verifyIdToken(token);
}

function isoFromUnix(seconds?: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

async function getOrCreateStripeCustomer(decoded: admin.auth.DecodedIdToken): Promise<any> {
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

  await userRef.set(
    {
      subscription: {
        stripeCustomerId: customer.id,
      },
    },
    { merge: true }
  );

  return customer;
}

export const sendContactMessage = functions
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

        const payload: any = {
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

        const emailjsRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        } as any);

        if (!emailjsRes.ok) {
          const text = await emailjsRes.text();
          console.error("❌ EmailJS send failed:", text);
          res.status(502).json({ error: "Failed to send message" });
          return;
        }

        res.status(200).json({ ok: true });
      } catch (error: any) {
        console.error("❌ Contact send error:", error?.message || error);
        res.status(500).json({
          error: error?.message || "Failed to send contact message",
        });
      }
    });
  });

export const createPremiumSubscriptionIntent = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
        const stripe = getStripeClient();
        const customer = await getOrCreateStripeCustomer(decoded);
        const premiumPriceId = resolveStripePremiumPriceId();
        if (!premiumPriceId) {
          res.status(500).json({ error: "Billing plan is not configured (missing Stripe premium price id)" });
          return;
        }

        const premiumPrice: any = await stripe.prices.retrieve(premiumPriceId);
        const billingAmount = Number(premiumPrice?.unit_amount || PREMIUM_MONTHLY_PRICE_CENTS);
        const billingCurrency = String(premiumPrice?.currency || PREMIUM_CURRENCY);

        const subscription: any = await stripe.subscriptions.create({
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

        let latestInvoice: any = subscription.latest_invoice || null;
        if (typeof latestInvoice === "string" && latestInvoice) {
          latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
            expand: ["payment_intent"],
          });
        }

        let paymentIntent: any = latestInvoice?.payment_intent || null;
        if (typeof paymentIntent === "string" && paymentIntent) {
          paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
        }

        // Some Stripe configurations return an open invoice without an attached payment intent at creation time.
        // In that case, attempt to trigger invoice payment to force Stripe to generate the payment intent.
        if (!paymentIntent?.client_secret && latestInvoice?.id) {
          try {
            const paidAttempt: any = await stripe.invoices.pay(latestInvoice.id, {
              expand: ["payment_intent"],
            } as any);

            latestInvoice = paidAttempt || latestInvoice;
            let fallbackPaymentIntent: any = paidAttempt?.payment_intent || null;
            if (typeof fallbackPaymentIntent === "string" && fallbackPaymentIntent) {
              fallbackPaymentIntent = await stripe.paymentIntents.retrieve(fallbackPaymentIntent);
            }

            if (fallbackPaymentIntent?.client_secret) {
              paymentIntent = fallbackPaymentIntent;
            }
          } catch (payAttemptError: any) {
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
      } catch (error: any) {
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

export const confirmPremiumSubscriptionActivation = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
        const subscriptionId = String(req.body?.subscriptionId || "").trim();
        if (!subscriptionId) {
          res.status(400).json({ error: "Missing subscriptionId" });
          return;
        }

        const stripe = getStripeClient();
        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);

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
        await userRef.set(
          {
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
          },
          { merge: true }
        );

        res.status(200).json({
          ok: true,
          message: "Premium subscription activated",
        });
      } catch (error: any) {
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

export const getPremiumBillingOverview = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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

        let subscription: any = null;
        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } else {
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
      } catch (error: any) {
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

export const cancelPremiumSubscription = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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

        const updated: any = await stripe.subscriptions.update(existingSubId, {
          cancel_at_period_end: true,
        });

        await userRef.set(
          {
            subscription: {
              status: updated.status,
              cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
              currentPeriodEnd: isoFromUnix(updated.current_period_end),
              canceledAt: new Date().toISOString(),
              canceledBy: "user",
            },
          },
          { merge: true }
        );

        res.status(200).json({
          ok: true,
          message: "Subscription will cancel at the end of the current billing period",
          currentPeriodEnd: isoFromUnix(updated.current_period_end),
        });
      } catch (error: any) {
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

export const createPayPalSubscription = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
        const planId = resolvePayPalPlanId();
        if (!planId) {
          res.status(500).json({ error: "PayPal plan is not configured" });
          return;
        }

        const returnUrl = String(req.body?.returnUrl || "").trim() || "https://autotrader-b8851.web.app/billing/checkout?paypal=success";
        const cancelUrl = String(req.body?.cancelUrl || "").trim() || "https://autotrader-b8851.web.app/billing/checkout?paypal=cancel";

        const accessToken = await getPayPalAccessToken();
        const response = await fetch(`${resolvePayPalApiBaseUrl()}/v1/billing/subscriptions`, {
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
        } as any);

        const payload: any = await response.json();
        if (!response.ok) {
          res.status(500).json({ error: payload?.message || "Failed to create PayPal subscription" });
          return;
        }

        const approvalUrl = Array.isArray(payload?.links)
          ? payload.links.find((link: any) => link?.rel === "approve")?.href || ""
          : "";

        if (!payload?.id || !approvalUrl) {
          res.status(500).json({ error: "PayPal did not return subscription approval URL" });
          return;
        }

        res.status(200).json({
          subscriptionId: String(payload.id),
          approvalUrl: String(approvalUrl),
        });
      } catch (error: any) {
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

export const confirmPayPalSubscription = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
        const subscriptionId = String(req.body?.subscriptionId || "").trim();
        if (!subscriptionId) {
          res.status(400).json({ error: "Missing subscriptionId" });
          return;
        }

        const accessToken = await getPayPalAccessToken();
        const response = await fetch(`${resolvePayPalApiBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        } as any);

        const payload: any = await response.json();
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
        await userRef.set(
          {
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
          },
          { merge: true }
        );

        res.status(200).json({
          ok: true,
          message: "Premium subscription activated via PayPal",
        });
      } catch (error: any) {
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

/**
 * Binance OAuth callback handler.
 *
 * Receives the authorisation code from the frontend after the user approves
 * the Binance OAuth consent screen, exchanges it for an access token, fetches
 * the Binance user profile, creates (or reuses) a Firebase user, and returns a
 * Firebase custom token that the frontend can use with signInWithCustomToken().
 *
 * Required Firebase secrets:
 *   BINANCE_CLIENT_ID     – OAuth App Client ID from https://developers.binance.com/
 *   BINANCE_CLIENT_SECRET – OAuth App Client Secret from the same portal
 */
export const binanceOAuthCallback = functions
  .region("europe-west1")
  .runWith({ secrets: [BINANCE_CLIENT_ID, BINANCE_CLIENT_SECRET] })
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

      const clientId = BINANCE_CLIENT_ID.value() || process.env.BINANCE_CLIENT_ID || "";
      const clientSecret = BINANCE_CLIENT_SECRET.value() || process.env.BINANCE_CLIENT_SECRET || "";

      if (!clientId || !clientSecret) {
        console.error("❌ binanceOAuthCallback: BINANCE_CLIENT_ID or BINANCE_CLIENT_SECRET is not configured.");
        res.status(503).json({
          error:
            "Binance OAuth is not configured on this server. " +
            "Please set the BINANCE_CLIENT_ID and BINANCE_CLIENT_SECRET Firebase secrets.",
        });
        return;
      }

      const { code, redirectUri } = req.body || {};
      if (!code || !redirectUri) {
        res.status(400).json({ error: "Missing required fields: code, redirectUri" });
        return;
      }

      try {
        // ── Step 1: Exchange authorisation code for access token ──────────────
        const tokenRes = await fetch("https://accounts.binance.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: String(code),
            redirect_uri: String(redirectUri),
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        } as any);

        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          console.error("❌ Binance token exchange failed:", text);
          res.status(400).json({ error: `Binance token exchange failed: ${text}` });
          return;
        }

        const tokenData: any = await tokenRes.json();
        const accessToken = String(tokenData.access_token || "").trim();
        if (!accessToken) {
          res.status(400).json({ error: "Binance token exchange returned no access_token." });
          return;
        }

        // ── Step 2: Fetch Binance user profile ────────────────────────────────
        const userRes = await fetch("https://accounts.binance.com/oauth/user-info", {
          headers: { Authorization: `Bearer ${accessToken}` },
        } as any);

        if (!userRes.ok) {
          const text = await userRes.text();
          console.error("❌ Binance user-info failed:", text);
          res.status(400).json({ error: `Failed to fetch Binance user info: ${text}` });
          return;
        }

        const userData: any = await userRes.json();
        const binanceUserId = String(userData.userId || userData.sub || userData.id || "").trim();
        if (!binanceUserId) {
          res.status(400).json({ error: "Binance user info did not contain a user ID." });
          return;
        }

        // Use a deterministic placeholder when Binance does not expose the user's
        // email address (e.g. the scope was not granted or the account has no
        // verified email). The address is never exposed externally and is only
        // used to satisfy the Firebase user-creation requirement.
        const email = String(userData.email || `binance-${binanceUserId}@binance-oauth.local`).trim();
        const displayName = String(userData.name || userData.username || "Binance User").trim();

        // ── Step 3: Create or retrieve the Firebase user ──────────────────────
        const uid = `binance:${binanceUserId}`;

        try {
          await admin.auth().getUser(uid);
        } catch (e: any) {
          if (e.code === "auth/user-not-found") {
            await admin.auth().createUser({ uid, email, displayName, emailVerified: true });
            await admin.firestore().collection("users").doc(uid).set({
              id: uid,
              name: displayName,
              email,
              createdAt: new Date().toISOString(),
              preferredLanguage: "en",
            });
          } else {
            throw e;
          }
        }

        // ── Step 4: Return a Firebase custom token ────────────────────────────
        const customToken = await admin.auth().createCustomToken(uid);
        res.status(200).json({ customToken });
      } catch (error: any) {
        console.error("❌ binanceOAuthCallback error:", error);
        res.status(500).json({ error: error?.message || "Binance OAuth sign-in failed." });
      }
    });
  });

