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
const ALPACA_BROKER_KEY = defineSecret("ALPACA_BROKER_KEY");
const ALPACA_BROKER_SECRET = defineSecret("ALPACA_BROKER_SECRET");

function getUsEasternClockParts(now: Date): { weekday: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    weekday: map.weekday || "",
    hour: Number.parseInt(map.hour || "0", 10),
    minute: Number.parseInt(map.minute || "0", 10),
  };
}

/**
 * Determines whether a symbol is currently tradeable on its exchange, so the
 * liquidation flow knows whether to submit an immediate market order or a
 * standing (GTC) order that waits for the market to reopen.
 */
function resolveMarketSession(exchangeId: string, symbol: string): { isOpen: boolean; reason: string } {
  const normalized = String(exchangeId || "").toLowerCase();

  if (normalized === "binance") {
    return { isOpen: true, reason: "Crypto market is 24/7." };
  }

  if (normalized === "alpaca" || normalized === "alpaca-paper") {
    if (String(symbol || "").includes("/")) {
      return { isOpen: true, reason: "Alpaca crypto market is 24/7." };
    }

    const clock = getUsEasternClockParts(new Date());
    if (clock.weekday === "Sat" || clock.weekday === "Sun") {
      return { isOpen: false, reason: "US equities market is closed on weekends." };
    }
    const minutes = clock.hour * 60 + clock.minute;
    const open = 9 * 60 + 30;
    const close = 16 * 60;
    if (minutes < open || minutes >= close) {
      return { isOpen: false, reason: "US equities market hours are 09:30–16:00 ET." };
    }
    return { isOpen: true, reason: "US equities regular session is open." };
  }

  return { isOpen: false, reason: `Exchange "${exchangeId}" is not supported.` };
}

// OAuth2 credentials for the Alpaca "Connect Apps" integration — separate
// from the Broker API credentials above. This is the flow where a user
// authorizes Invest-Begin against their own existing Alpaca account
// (docs.alpaca.markets/docs/about-connect-api), as opposed to the Broker API
// which provisions managed sandbox sub-accounts.
const ALPACA_OAUTH_CLIENT_ID = defineSecret("ALPACA_OAUTH_CLIENT_ID");
const ALPACA_OAUTH_CLIENT_SECRET = defineSecret("ALPACA_OAUTH_CLIENT_SECRET");

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
        const symbol = String(position.symbol || "");
        const session = resolveMarketSession(isPaper ? "alpaca-paper" : "alpaca", symbol);
        return {
          symbol,
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
          marketOpen: session.isOpen,
          marketStatusReason: session.reason,
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
      marketOpen: true,
      marketStatusReason: "Crypto market is 24/7.",
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
async function fetchAlpacaBrokerPaperPortfolio(
  brokerKey: string,
  brokerSecret: string,
  accountId: string
): Promise<PortfolioData> {
  const BROKER_BASE = "https://broker-api.sandbox.alpaca.markets";
  const AUTHX_BASE = "https://authx.sandbox.alpaca.markets";

  const tokenRes = await fetch(`${AUTHX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: brokerKey,
      client_secret: brokerSecret,
    }).toString(),
  } as any);

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new functions.https.HttpsError("internal", `Alpaca auth token failed (${tokenRes.status}): ${err}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const auth = `Bearer ${access_token}`;
  const headers = { Authorization: auth, Accept: "application/json" };

  console.log("🔗 Alpaca Broker sandbox proxy, accountId:", accountId);

  const accountRes = await fetch(`${BROKER_BASE}/v1/trading/accounts/${accountId}/account`, { headers } as any);
  if (!accountRes.ok) {
    const text = await accountRes.text();
    throw new functions.https.HttpsError("internal", `Alpaca Broker account error ${accountRes.status}: ${text}`);
  }
  const data: any = await accountRes.json();

  const posRes = await fetch(`${BROKER_BASE}/v1/trading/accounts/${accountId}/positions`, { headers } as any);
  if (!posRes.ok) {
    const text = await posRes.text();
    throw new functions.https.HttpsError("internal", `Alpaca Broker positions error ${posRes.status}: ${text}`);
  }
  const positions: any[] = await posRes.json();

  const openPositions = Array.isArray(positions)
    ? positions.map((p: any) => {
        const side: "long" | "short" = String(p.side || "long").toLowerCase() === "short" ? "short" : "long";
        const symbol = String(p.symbol || "");
        const session = resolveMarketSession("alpaca-paper", symbol);
        return {
          symbol,
          quantity: Number.parseFloat(p.qty || "0"),
          marketValue: Number.parseFloat(p.market_value || "0"),
          unrealizedPnl: p.unrealized_pl != null ? Number.parseFloat(p.unrealized_pl) : null,
          pnlPercentage: p.unrealized_plpc != null ? Number.parseFloat(p.unrealized_plpc) * 100 : null,
          entryPrice: p.avg_entry_price != null ? Number.parseFloat(p.avg_entry_price) : null,
          currentPrice: p.current_price != null ? Number.parseFloat(p.current_price) : null,
          side,
          marketOpen: session.isOpen,
          marketStatusReason: session.reason,
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

      // Alpaca accounts connected via the "Connect with Alpaca" OAuth flow
      // (see alpacaOAuthCallback below) carry no apiKey/apiSecret at all —
      // the access token lives server-side in alpaca_oauth_tokens, looked up
      // by uid, and is never sent by the client.
      if ((exchangeId === "alpaca" || exchangeId === "alpaca-paper") && data.authMethod === "oauth") {
        const env: "live" | "paper" = exchangeId === "alpaca-paper" ? "paper" : "live";
        const portfolio = await fetchAlpacaOAuthPortfolio(context.auth.uid, env);
        console.log("✅ Success! (Alpaca OAuth) Portfolio value:", portfolio.portfolioValue);
        return portfolio;
      }

      // Top-up paper accounts use CK-prefixed Broker API keys which only work
      // against the Broker sandbox trading proxy (not paper-api.alpaca.markets).
      // Manually connected alpaca-paper accounts use regular PK-prefixed keys
      // and continue to use paper-api.alpaca.markets.
      if (exchangeId === "alpaca-paper" && (apiKey || "").startsWith("CK")) {
        const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
        const brokerAccountId = userDoc.data()?.alpacaBrokerAccountId;
        if (brokerAccountId) {
          console.log("📊 Routing to Alpaca Broker sandbox proxy, accountId:", brokerAccountId);
          const portfolio = await fetchAlpacaBrokerPaperPortfolio(
            ALPACA_BROKER_KEY.value(),
            ALPACA_BROKER_SECRET.value(),
            brokerAccountId
          );
          console.log("✅ Success! Portfolio value:", portfolio.portfolioValue);
          return portfolio;
        }
      }

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

        // Same OAuth routing as the callable version above.
        if ((exchangeId === "alpaca" || exchangeId === "alpaca-paper") && req.body?.authMethod === "oauth") {
          const env: "live" | "paper" = exchangeId === "alpaca-paper" ? "paper" : "live";
          const portfolio = await fetchAlpacaOAuthPortfolio(decoded.uid, env);
          res.status(200).json(portfolio);
          return;
        }

        // Same CK-key routing as the callable version.
        if (exchangeId === "alpaca-paper" && (apiKey || "").startsWith("CK")) {
          const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
          const brokerAccountId = userDoc.data()?.alpacaBrokerAccountId;
          if (brokerAccountId) {
            console.log("📊 HTTP routing to Alpaca Broker sandbox proxy, accountId:", brokerAccountId);
            const portfolio = await fetchAlpacaBrokerPaperPortfolio(
              ALPACA_BROKER_KEY.value(),
              ALPACA_BROKER_SECRET.value(),
              brokerAccountId
            );
            res.status(200).json(portfolio);
            return;
          }
        }

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

/**
 * Submits a market-close order to an Alpaca trading account (direct keys or
 * the Broker sandbox trading proxy). When the market is open, it's an
 * immediate "day" market order for the full position size. When the market
 * is closed, it's a standing "gtc" limit order at the price the user saw
 * when they clicked Liquidate, so it fills as soon as the market reopens.
 */
async function submitAlpacaLiquidationOrder(
  ordersUrl: string,
  headers: Record<string, string>,
  params: { symbol: string; quantity: number; side: "long" | "short"; marketOpen: boolean; limitPrice?: number }
): Promise<any> {
  const orderSide = params.side === "short" ? "buy" : "sell";
  const qty = Math.abs(Number(params.quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid quantity for liquidation order.");
  }

  const body: Record<string, any> = {
    symbol: params.symbol,
    side: orderSide,
    qty: qty.toString(),
  };

  if (params.marketOpen) {
    body.type = "market";
    body.time_in_force = "day";
  } else {
    const limitPrice = Number(params.limitPrice);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A valid price is required to place a standing order while the market is closed."
      );
    }
    body.type = "limit";
    body.time_in_force = "gtc";
    body.limit_price = limitPrice.toFixed(2);
  }

  const response = await fetch(ordersUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as any);

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Broker order error ${response.status}: ${text}`);
  }
  return payload;
}

async function placeBinanceLiquidationOrder(apiKey: string, apiSecret: string, symbol: string, quantity: number): Promise<any> {
  const qty = Math.abs(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid quantity for liquidation order.");
  }

  const pair = `${symbol.toUpperCase()}USDT`;
  const timestamp = Date.now();
  const queryString = `symbol=${pair}&side=SELL&type=MARKET&quantity=${qty}&timestamp=${timestamp}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
  const url = `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`;

  const response = await fetch(url, { method: "POST", headers: { "X-MBX-APIKEY": apiKey } } as any);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Binance order error ${response.status}: ${text}`);
  }
  return payload;
}

export const liquidatePosition = functions
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
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);

        const exchangeId = String(req.body?.exchangeId || "").trim();
        const apiKey = String(req.body?.apiKey || "").replace(/\s+/g, "");
        const apiSecret = String(req.body?.apiSecret || "").replace(/\s+/g, "");
        const symbol = String(req.body?.symbol || "").trim();
        const quantity = Number(req.body?.quantity);
        const side: "long" | "short" = String(req.body?.side || "long").toLowerCase() === "short" ? "short" : "long";
        const limitPrice = req.body?.limitPrice != null ? Number(req.body.limitPrice) : undefined;

        if (!exchangeId || !apiKey || !apiSecret || !symbol || !Number.isFinite(quantity) || quantity <= 0) {
          res.status(400).json({ error: "Missing or invalid exchangeId, apiKey, apiSecret, symbol, or quantity" });
          return;
        }

        console.log(`🔻 Liquidation requested by ${decoded.uid}: ${exchangeId} ${symbol} qty=${quantity} side=${side}`);

        if (exchangeId === "binance") {
          const order = await placeBinanceLiquidationOrder(apiKey, apiSecret, symbol, quantity);
          res.status(200).json({ success: true, message: `Market sell order submitted for ${symbol}.`, order });
          return;
        }

        if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
          const session = resolveMarketSession(exchangeId, symbol);
          let order: any;

          if (exchangeId === "alpaca-paper" && apiKey.startsWith("CK")) {
            const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
            const brokerAccountId = userDoc.data()?.alpacaBrokerAccountId;
            if (!brokerAccountId) {
              res.status(404).json({ error: "Broker-provisioned paper account not found for this user." });
              return;
            }

            const tokenRes = await fetch("https://authx.sandbox.alpaca.markets/v1/oauth2/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: ALPACA_BROKER_KEY.value(),
                client_secret: ALPACA_BROKER_SECRET.value(),
              }).toString(),
            } as any);
            if (!tokenRes.ok) {
              const errText = await tokenRes.text();
              throw new functions.https.HttpsError("internal", `Alpaca auth token failed (${tokenRes.status}): ${errText}`);
            }
            const { access_token } = (await tokenRes.json()) as { access_token: string };

            order = await submitAlpacaLiquidationOrder(
              `https://broker-api.sandbox.alpaca.markets/v1/trading/accounts/${brokerAccountId}/orders`,
              { Authorization: `Bearer ${access_token}` },
              { symbol, quantity, side, marketOpen: session.isOpen, limitPrice }
            );
          } else {
            const baseUrl = exchangeId === "alpaca-paper" ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
            order = await submitAlpacaLiquidationOrder(
              `${baseUrl}/v2/orders`,
              { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret },
              { symbol, quantity, side, marketOpen: session.isOpen, limitPrice }
            );
          }

          const message = session.isOpen
            ? `Market order submitted to close ${symbol}.`
            : `Market is closed — a standing order was placed to close ${symbol} at $${Number(limitPrice).toFixed(2)} once trading resumes.`;

          res.status(200).json({ success: true, message, order });
          return;
        }

        res.status(404).json({ error: `Liquidation is not supported for exchange: ${exchangeId}` });
      } catch (error: any) {
        console.error("❌❌❌ liquidatePosition error:", error);
        const message = error?.message || "Failed to liquidate position";
        if (message.includes("Authorization Bearer token")) {
          res.status(401).json({ error: message });
          return;
        }
        const code = error?.code;
        if (code === "invalid-argument") {
          res.status(400).json({ error: message });
          return;
        }
        if (code === "not-found") {
          res.status(404).json({ error: message });
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
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const LEARN_CODE_COLLECTION = "learn_code_access";
const NEWSLETTER_SUBSCRIBERS_COLLECTION = "newsletter_subscribers";
const LEARN_CODE_EXPIRY_MINUTES = 15;
const LEARN_CODE_RATE_LIMIT_SECONDS = 60;
const LEARN_CODE_MAX_ATTEMPTS = 5;
const PREMIUM_MONTHLY_PRICE_USD = Number(process.env.PREMIUM_MONTHLY_PRICE_USD || "10");
const PREMIUM_MONTHLY_PRICE_CENTS = Math.max(1, Math.round(PREMIUM_MONTHLY_PRICE_USD * 100));
const PREMIUM_CURRENCY = "usd";
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_PREMIUM_PRICE_ID = defineSecret("STRIPE_PREMIUM_PRICE_ID");
const PAYPAL_CLIENT_ID = defineSecret("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const PAYPAL_PLAN_ID = defineSecret("PAYPAL_PLAN_ID");

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
  .runWith({ secrets: [RESEND_API_KEY] })
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

        const apiKey = RESEND_API_KEY.value();
        if (!apiKey) {
          console.error("❌ Missing RESEND_API_KEY secret.");
          res.status(500).json({ error: "Email service is not configured" });
          return;
        }

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AutoTrader Contact <assistant@invest-begin.com>",
            to: [CONTACT_RECIPIENT],
            reply_to: sender,
            subject: `[Contact Form] ${emailSubject}`,
            text: `From: ${sender}\n\n${emailMessage}`,
          }),
        } as any);

        if (!resendRes.ok) {
          const text = await resendRes.text();
          console.error("❌ Resend send failed:", text);
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 100) {
    return false;
  }
  return /^[\p{L}\p{N} .,'-]+$/u.test(name);
}

function normalizeLearnSlug(rawSlug: any): string {
  return String(rawSlug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function normalizeName(rawName: any): string {
  return String(rawName || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function normalizeEmail(rawEmail: any): string {
  return String(rawEmail || "").trim().toLowerCase();
}

function buildLearnCodeDocId(slug: string, email: string): string {
  return crypto.createHash("sha256").update(`${slug}|${email}`).digest("hex");
}

function hashLearnCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateLearnAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendLearnAccessCodeEmail(params: {
  recipientEmail: string;
  recipientName: string;
  code: string;
  slug: string;
  apiKey: string;
}): Promise<void> {
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AutoTrader <assistant@invest-begin.com>",
      to: [params.recipientEmail],
      subject: "Your AutoTrader verification code",
      text: `Hello ${params.recipientName || "Trader"},\n\nYour verification code is: ${params.code}\n\nThis code expires in ${LEARN_CODE_EXPIRY_MINUTES} minutes.\n\nPage: ${params.slug}`,
    }),
  } as any);

  if (!resendRes.ok) {
    const text = await resendRes.text();
    throw new Error(`Resend send failed (${resendRes.status}): ${text}`);
  }
}

export const requestLearnCodeAccess = functions
  .region("europe-west1")
  .runWith({ secrets: [RESEND_API_KEY] })
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
        const slug = normalizeLearnSlug(req.body?.slug);
        const name = normalizeName(req.body?.name);
        const email = normalizeEmail(req.body?.email);

        if (!slug || !name || !email) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        if (!isValidEmail(email)) {
          res.status(400).json({ error: "Invalid email" });
          return;
        }

        if (!isValidName(name)) {
          res.status(400).json({ error: "Invalid name" });
          return;
        }

        const docId = buildLearnCodeDocId(slug, email);
        const docRef = admin.firestore().collection(LEARN_CODE_COLLECTION).doc(docId);
        const nowMs = Date.now();
        const now = admin.firestore.Timestamp.fromMillis(nowMs);

        const existingSnap = await docRef.get();
        const existing = existingSnap.exists ? (existingSnap.data() as any) : null;

        if (existing?.lastSentAt?.toMillis) {
          const secondsSinceSend = (nowMs - existing.lastSentAt.toMillis()) / 1000;
          if (secondsSinceSend < LEARN_CODE_RATE_LIMIT_SECONDS) {
            res.status(429).json({ error: "Please wait before requesting another code." });
            return;
          }
        }

        const code = generateLearnAccessCode();
        const codeHash = hashLearnCode(code);
        const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + LEARN_CODE_EXPIRY_MINUTES * 60 * 1000);

        await docRef.set(
          {
            slug,
            email,
            name,
            codeHash,
            attempts: 0,
            verifiedAt: null,
            lastSentAt: now,
            expiresAt,
            updatedAt: now,
            createdAt: existing?.createdAt || now,
            source: "learn-code-gate",
          },
          { merge: true }
        );

        const subscriberId = crypto.createHash("sha256").update(email).digest("hex");
        const subscriberRef = admin.firestore().collection(NEWSLETTER_SUBSCRIBERS_COLLECTION).doc(subscriberId);
        await subscriberRef.set(
          {
            email,
            name,
            latestSlug: slug,
            source: "learn-code-gate",
            verificationStatus: "pending",
            verified: false,
            updatedAt: now,
            createdAt: existing?.createdAt || now,
          },
          { merge: true }
        );

        await sendLearnAccessCodeEmail({
          recipientEmail: email,
          recipientName: name,
          code,
          slug,
          apiKey: RESEND_API_KEY.value(),
        });

        res.status(200).json({ ok: true, expiresInMinutes: LEARN_CODE_EXPIRY_MINUTES });
      } catch (error: any) {
        console.error("❌ requestLearnCodeAccess error:", error?.message || error);
        res.status(500).json({ error: error?.message || "Failed to send verification code" });
      }
    });
  });

export const verifyLearnCodeAccess = functions
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
        const slug = normalizeLearnSlug(req.body?.slug);
        const email = normalizeEmail(req.body?.email);
        const code = String(req.body?.code || "").trim();

        if (!slug || !email || !code) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        if (!isValidEmail(email)) {
          res.status(400).json({ error: "Invalid email" });
          return;
        }

        const docId = buildLearnCodeDocId(slug, email);
        const docRef = admin.firestore().collection(LEARN_CODE_COLLECTION).doc(docId);
        const snap = await docRef.get();

        if (!snap.exists) {
          res.status(404).json({ error: "Verification request not found." });
          return;
        }

        const data = snap.data() as any;
        const nowMs = Date.now();
        const now = admin.firestore.Timestamp.fromMillis(nowMs);

        if (data?.expiresAt?.toMillis && data.expiresAt.toMillis() < nowMs) {
          res.status(410).json({ error: "Verification code expired. Please request a new code." });
          return;
        }

        const attempts = Number(data?.attempts || 0);
        if (attempts >= LEARN_CODE_MAX_ATTEMPTS) {
          res.status(429).json({ error: "Too many attempts. Please request a new code." });
          return;
        }

        const inputHash = hashLearnCode(code);
        if (inputHash !== String(data?.codeHash || "")) {
          await docRef.set(
            {
              attempts: attempts + 1,
              updatedAt: now,
            },
            { merge: true }
          );
          res.status(400).json({ error: "Invalid verification code." });
          return;
        }

        await docRef.set(
          {
            verifiedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        const subscriberId = crypto.createHash("sha256").update(email).digest("hex");
        await admin.firestore().collection(NEWSLETTER_SUBSCRIBERS_COLLECTION).doc(subscriberId).set(
          {
            latestSlug: slug,
            verificationStatus: "verified",
            verified: true,
            verifiedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        res.status(200).json({ ok: true, verified: true });
      } catch (error: any) {
        console.error("❌ verifyLearnCodeAccess error:", error?.message || error);
        res.status(500).json({ error: error?.message || "Failed to verify code" });
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

// ── Real-money top-up ───────────────────────────────────────────────────────

/**
 * Creates an Alpaca Broker sandbox sub-account for the user, generates
 * paper-trading API keys, and funds it with virtual money matching the deposit.
 * Uses Alpaca's sandbox environment (paper-only, no real money at risk).
 * Returns null (with a warning) on any Alpaca API error so the top-up itself
 * is never blocked.
 */
async function provisionAlpacaPaperAccount(
  uid: string,
  email: string,
  displayName: string,
  depositAmountUsd: number,
  brokerKey: string,
  brokerSecret: string
): Promise<{ accountId: string; apiKey: string; apiSecret: string } | null> {
  try {
    const ALPACA_BROKER_BASE = "https://broker-api.sandbox.alpaca.markets";
    const authHeader = `Basic ${Buffer.from(`${brokerKey}:${brokerSecret}`).toString("base64")}`;
    const headers: Record<string, string> = {
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
    const createResp = await fetch(`${ALPACA_BROKER_BASE}/v1/accounts`, {
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

    const account = (await createResp.json()) as { id: string };
    const accountId = account.id;

    // 2 ── Generate paper-trading API keys for the sub-account.
    const keysResp = await fetch(
      `${ALPACA_BROKER_BASE}/v1/trading/accounts/${accountId}/access_keys`,
      { method: "POST", headers, body: JSON.stringify({}) }
    );

    if (!keysResp.ok) {
      console.warn(`⚠️ Alpaca key generation failed for ${uid}: ${await keysResp.text()}`);
      return null;
    }

    const keys = (await keysResp.json()) as { id: string; secret: string };

    // 3 ── Fund the paper account with virtual money matching the deposit.
    const fundResp = await fetch(
      `${ALPACA_BROKER_BASE}/v1/accounts/${accountId}/transactions/cash`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: String(depositAmountUsd),
          direction: "INCOMING",
          reason: "AutoTrader user deposit",
        }),
      }
    );

    if (!fundResp.ok) {
      // Funding failure is non-fatal — account + keys are still usable.
      console.warn(`⚠️ Alpaca fund deposit warning for ${uid}: ${await fundResp.text()}`);
    }

    console.log(`✅ Alpaca paper account provisioned for ${uid}: ${accountId}`);
    return { accountId, apiKey: keys.id, apiSecret: keys.secret };
  } catch (err) {
    console.warn("⚠️ provisionAlpacaPaperAccount threw:", err);
    return null;
  }
}

const MIN_TOPUP_USD = 1;
const MAX_TOPUP_USD = 100_000;

/**
 * Creates a Stripe PaymentIntent for a one-time real-money top-up.
 * The frontend confirms the payment with the returned clientSecret,
 * then calls confirmTopUp to credit the user's account in Firestore.
 */
export const createTopUpIntent = functions
  .region("europe-west1")
  .runWith({ secrets: [STRIPE_SECRET_KEY] })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

      try {
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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
      } catch (error: any) {
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
export const confirmTopUp = functions
  .region("europe-west1")
  .runWith({ secrets: [STRIPE_SECRET_KEY, ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

      try {
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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
        let alpacaAccount: { accountId: string; apiKey: string; apiSecret: string } | null = null;
        if (!userData.alpacaBrokerAccountId) {
          const brokerKey = ALPACA_BROKER_KEY.value();
          const brokerSecret = ALPACA_BROKER_SECRET.value();
          if (brokerKey && brokerSecret) {
            const userEmail = decoded.email ?? `${decoded.uid}@autotrader.app`;
            const userDisplayName = decoded.name ?? "AutoTrader User";
            alpacaAccount = await provisionAlpacaPaperAccount(
              decoded.uid,
              userEmail,
              userDisplayName,
              verifiedAmountUsd,
              brokerKey,
              brokerSecret
            );
          } else {
            console.warn("⚠️ ALPACA_BROKER_KEY / ALPACA_BROKER_SECRET not set — skipping Alpaca provisioning");
          }
        }

        const firestoreUpdate: Record<string, unknown> = {
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
      } catch (error: any) {
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

const NOWPAYMENTS_API_KEY = defineSecret("NOWPAYMENTS_API_KEY");
const NOWPAYMENTS_PUBLIC_KEY = defineSecret("NOWPAYMENTS_PUBLIC_KEY");
const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io";

async function fetchNowPaymentsMerchantCurrencies(apiKey: string): Promise<string[]> {
  const resp = await fetch(`${NOWPAYMENTS_BASE_URL}/v1/merchant/coins`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  } as any);

  if (!resp.ok) {
    const providerErr = await resp.text();
    throw new Error(`Failed to fetch merchant currencies (${resp.status}): ${providerErr}`);
  }

  const payload: any = await resp.json();
  const raw = Array.isArray(payload?.selectedCurrencies) ? payload.selectedCurrencies : [];
  return raw
    .map((c: any) => String(c || "").trim().toUpperCase())
    .filter((c: string) => c.length > 0)
    .sort();
}

// CORS handler that also allows GET (needed for order status polling).
const corsHandlerGet = cors({
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
export const createNowPaymentsOrder = functions
  .region("europe-west1")
  .runWith({ secrets: [NOWPAYMENTS_API_KEY] })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

      try {
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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
        let order: any = null;
        let paymentUrl = "";
        let lastProviderError = "";

        const invoiceResp = await fetch(`${NOWPAYMENTS_BASE_URL}/v1/invoice`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentPayload),
        } as any);

        if (invoiceResp.ok) {
          order = await invoiceResp.json();
          paymentUrl = String(order.invoice_url || order.url || order.hosted_url || "").trim();
        } else {
          lastProviderError = await invoiceResp.text();
          console.warn("⚠️ NOWPayments invoice creation failed, falling back to payment API:", lastProviderError);
        }

        if (!paymentUrl) {
          const paymentResp = await fetch(`${NOWPAYMENTS_BASE_URL}/v1/payment`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paymentPayload),
          } as any);

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
            } catch {
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
      } catch (error: any) {
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
export const listNowPaymentsCurrencies = functions
  .region("europe-west1")
  .runWith({ secrets: [NOWPAYMENTS_API_KEY] })
  .https.onRequest((req, res) => {
    corsHandlerGet(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

      try {
        await verifyBearerToken(req.headers.authorization as string | undefined);

        const apiKey = NOWPAYMENTS_API_KEY.value().trim();
        if (!apiKey) {
          res.status(500).json({ error: "Crypto payment is not configured. Please contact support." });
          return;
        }

        const currencies = await fetchNowPaymentsMerchantCurrencies(apiKey);
        res.status(200).json({ currencies });
      } catch (error: any) {
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
export const checkNowPaymentsOrder = functions
  .region("europe-west1")
  .runWith({ secrets: [] })
  .https.onRequest((req, res) => {
    corsHandlerGet(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }

      try {
        const decoded = await verifyBearerToken(req.headers.authorization as string | undefined);
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

        const orderData = orderSnap.data()!;
        // Security: only the owning user can poll their order.
        if (orderData.uid !== decoded.uid) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        res.status(200).json({
          status: orderData.status,
          amountUsd: orderData.amountUsd,
        });
      } catch (error: any) {
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
export const nowPaymentsCallback = functions
  .region("europe-west1")
  .runWith({ secrets: [NOWPAYMENTS_API_KEY, NOWPAYMENTS_PUBLIC_KEY, ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET] })
  .https.onRequest(async (req, res) => {
    // No CORS needed — this is a server-to-server webhook from NOWPayments.
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

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

      const orderData = orderSnap.data()!;

      // Idempotency: skip if already processed.
      if (orderData.status === "paid") {
        res.status(200).send("OK");
        return;
      }

      // Security: independently verify the payment with the NOWPayments API.
      const apiKey = NOWPAYMENTS_API_KEY.value();
      if (paymentId && apiKey) {
        const verifyResp = await fetch(`${NOWPAYMENTS_BASE_URL}/v1/payment/${encodeURIComponent(paymentId)}`, {
          headers: { "x-api-key": apiKey },
        } as any);

        if (verifyResp.ok) {
          const verifiedOrder: any = await verifyResp.json();
          const verifiedStatus = String(verifiedOrder.payment_status || verifiedOrder.status || "").toLowerCase();
          if (verifiedStatus !== "confirmed" && verifiedStatus !== "finished") {
            console.warn(`⚠️ NOWPayments verification: order ${paymentId} not confirmed paid`);
            res.status(200).send("OK");
            return;
          }
        } else {
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
      let alpacaAccount: { accountId: string; apiKey: string; apiSecret: string } | null = null;
      if (!userData.alpacaBrokerAccountId) {
        const brokerKey = ALPACA_BROKER_KEY.value();
        const brokerSecret = ALPACA_BROKER_SECRET.value();
        if (brokerKey && brokerSecret) {
          const userEmail = userData.email ?? `${uid}@autotrader.app`;
          const userDisplayName = userData.displayName ?? "AutoTrader User";
          alpacaAccount = await provisionAlpacaPaperAccount(
            uid, userEmail, userDisplayName, amountUsd, brokerKey, brokerSecret
          );
        }
      }

      const firestoreUpdate: Record<string, unknown> = {
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
    } catch (error: any) {
      console.error("❌ nowPaymentsCallback failed:", error);
      res.status(500).send("Internal server error");
    }
  });

// ── Shopify OAuth ─────────────────────────────────────────────────────────────

const SHOPIFY_SCOPES = "read_products,write_products";

function verifyShopifyHmac(query: Record<string, string>, clientSecret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const expected = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * Initiates the Shopify OAuth install flow.
 * GET /api/shopify/auth?shop=my-store.myshopify.com
 */
export const shopifyAuth = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    const shop = String(req.query.shop || "").trim().toLowerCase();
    if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      res.status(400).send("Invalid shop parameter");
      return;
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    if (!clientId) {
      res.status(500).send("Shopify credentials not configured");
      return;
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await admin.firestore()
      .collection("shopify_oauth_nonces")
      .doc(nonce)
      .set({ shop, expiresAt });

    const host = req.headers.host || "";
    const redirectUri =
      host.includes("localhost") || host.includes("127.0.0.1")
        ? `http://${host}/api/shopify/callback`
        : "https://invest-begin.com/api/shopify/callback";

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", nonce);

    res.redirect(302, authUrl.toString());
  });

/**
 * Handles the Shopify OAuth callback.
 * Shopify redirects here with ?code=...&hmac=...&shop=...&state=...
 * Verifies HMAC + nonce, exchanges code for access token, stores in Firestore.
 */
export const shopifyCallback = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).send("Shopify credentials not configured");
      return;
    }

    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      query[k] = String(v);
    }

    // 1. Verify HMAC signature from Shopify
    if (!verifyShopifyHmac(query, clientSecret)) {
      res.status(401).send("HMAC validation failed");
      return;
    }

    const { shop, code, state: nonce } = query;
    if (!shop || !code || !nonce) {
      res.status(400).send("Missing required parameters");
      return;
    }

    // 2. Verify one-time nonce and that shop matches
    const nonceRef = admin.firestore().collection("shopify_oauth_nonces").doc(nonce);
    const nonceSnap = await nonceRef.get();
    if (!nonceSnap.exists) {
      res.status(401).send("Invalid or expired state");
      return;
    }

    const nonceData = nonceSnap.data()!;
    await nonceRef.delete(); // consumed — one-time use only

    if (nonceData.shop !== shop || Date.now() > nonceData.expiresAt) {
      res.status(401).send("Invalid or expired state");
      return;
    }

    // 3. Exchange authorization code for a permanent access token
    const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    } as any);

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      console.error("❌ Shopify token exchange failed:", text);
      res.status(502).send("Token exchange failed");
      return;
    }

    const tokenData: any = await tokenResp.json();
    const accessToken: string = tokenData.access_token;
    const scope: string = tokenData.scope;

    if (!accessToken) {
      res.status(502).send("No access token in Shopify response");
      return;
    }

    // 4. Persist access token in Firestore (keyed by shop domain)
    await admin.firestore()
      .collection("shopify_stores")
      .doc(shop)
      .set({
        shop,
        accessToken,
        scope,
        connectedAt: new Date().toISOString(),
      });

    console.log(`✅ Shopify store connected: ${shop}`);
    res.redirect(302, "https://invest-begin.com/?shopify=connected");
  });

/**
 * Creates a new product listing in the connected Shopify store.
 *
 * Callable function — requires Firebase Auth.
 *
 * Request payload:
 * {
 *   shop: string;           // e.g. "autotradingx.myshopify.com"
 *   title: string;
 *   descriptionHtml?: string;
 *   vendor?: string;
 *   productType?: string;
 *   tags?: string[];
 *   status?: "ACTIVE" | "DRAFT" | "ARCHIVED";  // defaults to "DRAFT"
 *   options?: Array<{ name: string; values: string[] }>;
 *   price?: string;         // e.g. "19.99" — applies to the default variant
 *   sku?: string;
 *   quantity?: number;
 * }
 */
export const createShopifyListing = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
    }

    const shop = String(data.shop || "").trim().toLowerCase();
    if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid shop parameter");
    }

    const title = String(data.title || "").trim();
    if (!title) {
      throw new functions.https.HttpsError("invalid-argument", "title is required");
    }

    // Load access token from Firestore
    const storeSnap = await admin.firestore().collection("shopify_stores").doc(shop).get();
    if (!storeSnap.exists) {
      throw new functions.https.HttpsError("not-found", `Shop ${shop} is not connected. Complete OAuth first.`);
    }
    const accessToken: string = storeSnap.data()!.accessToken;

    // Build productOptions input (optional)
    const rawOptions: Array<{ name: string; values: string[] }> = Array.isArray(data.options)
      ? data.options
      : [];
    const productOptionsInput = rawOptions.map((opt) => ({
      name: opt.name,
      values: opt.values.map((v: string) => ({ name: v })),
    }));

    // Build the productCreate GraphQL mutation
    const mutation = `
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            onlineStoreUrl
            variants(first: 1) {
              edges {
                node {
                  id
                  sku
                  price
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const productInput: Record<string, unknown> = {
      title,
      status: String(data.status || "DRAFT").toUpperCase(),
    };
    if (data.descriptionHtml) productInput.descriptionHtml = String(data.descriptionHtml);
    if (data.vendor) productInput.vendor = String(data.vendor);
    if (data.productType) productInput.productType = String(data.productType);
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      productInput.tags = data.tags.map(String);
    }
    if (productOptionsInput.length > 0) {
      productInput.productOptions = productOptionsInput;
    }

    const gqlResp = await fetch(
      `https://${shop}/admin/api/2024-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: mutation, variables: { product: productInput } }),
      } as any
    );

    if (!gqlResp.ok) {
      const text = await gqlResp.text();
      console.error("❌ Shopify GraphQL request failed:", text);
      throw new functions.https.HttpsError("internal", `Shopify API error ${gqlResp.status}`);
    }

    const gqlData: any = await gqlResp.json();
    const userErrors: Array<{ field: string; message: string }> =
      gqlData?.data?.productCreate?.userErrors ?? [];

    if (userErrors.length > 0) {
      console.error("❌ Shopify productCreate userErrors:", userErrors);
      throw new functions.https.HttpsError(
        "invalid-argument",
        userErrors.map((e) => `${e.field}: ${e.message}`).join("; ")
      );
    }

    const product = gqlData?.data?.productCreate?.product;
    if (!product) {
      throw new functions.https.HttpsError("internal", "No product returned from Shopify");
    }

    // If a price was provided, update the default variant via productVariantsBulkUpdate
    if (data.price !== undefined || data.sku !== undefined || data.quantity !== undefined) {
      const variantId: string = product.variants?.edges?.[0]?.node?.id;
      if (variantId) {
        const variantMutation = `
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants { id price sku }
              userErrors { field message }
            }
          }
        `;
        const variantInput: Record<string, unknown> = { id: variantId };
        if (data.price !== undefined) variantInput.price = String(data.price);
        if (data.sku !== undefined) variantInput.sku = String(data.sku);
        if (data.quantity !== undefined) {
          variantInput.inventoryQuantities = [{
            availableQuantity: Number(data.quantity),
            locationId: null, // Shopify will use the primary location
          }];
        }

        await fetch(`https://${shop}/admin/api/2024-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query: variantMutation,
            variables: { productId: product.id, variants: [variantInput] },
          }),
        } as any);
      }
    }

    console.log(`✅ Shopify listing created: ${product.id} — "${title}" on ${shop}`);
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      onlineStoreUrl: product.onlineStoreUrl ?? null,
    };
  });

// ── Alpaca Connect OAuth ─────────────────────────────────────────────────────
//
// Implements Alpaca's "Connect Apps" OAuth2 flow so a user can authorize
// Invest-Begin against their own Alpaca account without ever pasting an API
// key/secret into this app (docs.alpaca.markets/docs/about-connect-api).
// This is independent of the Broker API sandbox provisioning further above,
// which creates managed paper sub-accounts instead.
//
// Scopes requested: "trading data" (place/cancel orders + read account/market
// data) — the same Read + Trade permissions the manual API-key flow already
// asks users to enable, see connect-exchange-modal.html.

const ALPACA_OAUTH_SCOPES = "trading data";
const ALPACA_OAUTH_STATE_COLLECTION = "alpaca_oauth_states";
// Server-only collection — deliberately NOT under users/{uid}/, so no
// Firestore security rule matches it and access tokens can never be read by
// a client SDK (mirrors the marketAnalysis collection pattern used by the
// MCP analysis runner). Doc id is `${uid}_${env}`.
const ALPACA_OAUTH_TOKENS_COLLECTION = "alpaca_oauth_tokens";

function resolveAlpacaOAuthRedirectUri(host: string): string {
  return host.includes("localhost") || host.includes("127.0.0.1")
    ? `http://${host}/api/alpaca/oauth/callback`
    : "https://invest-begin.com/api/alpaca/oauth/callback";
}

/**
 * Fetches portfolio (equity + open positions) for an Alpaca account connected
 * via OAuth, using the access token stored server-side for this uid/env.
 */
async function fetchAlpacaOAuthPortfolio(uid: string, env: "live" | "paper"): Promise<PortfolioData> {
  const tokenSnap = await admin.firestore()
    .collection(ALPACA_OAUTH_TOKENS_COLLECTION)
    .doc(`${uid}_${env}`)
    .get();

  if (!tokenSnap.exists) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Alpaca is not connected via OAuth (${env}). Please reconnect.`
    );
  }

  const { accessToken } = tokenSnap.data() as { accessToken: string };
  const baseUrl = env === "paper" ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  const headers = { Authorization: `Bearer ${accessToken}` };

  const accountRes = await fetch(`${baseUrl}/v2/account`, { headers } as any);
  if (!accountRes.ok) {
    const text = await accountRes.text();
    throw new functions.https.HttpsError("internal", `Alpaca OAuth account error ${accountRes.status}: ${text}`);
  }
  const data: any = await accountRes.json();

  const posRes = await fetch(`${baseUrl}/v2/positions`, { headers } as any);
  if (!posRes.ok) {
    const text = await posRes.text();
    throw new functions.https.HttpsError("internal", `Alpaca OAuth positions error ${posRes.status}: ${text}`);
  }
  const positions: any[] = await posRes.json();

  const openPositions = Array.isArray(positions)
    ? positions.map((p: any) => {
        const side: "long" | "short" = String(p.side || "long").toLowerCase() === "short" ? "short" : "long";
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

/**
 * Starts the Alpaca Connect OAuth flow for the authenticated user.
 * POST /api/alpaca/oauth/start   body: { env: "live" | "paper" }
 * Returns { authorizeUrl } for the frontend to navigate the browser to.
 */
export const alpacaOAuthStart = functions
  .region("europe-west1")
  .runWith({ secrets: [ALPACA_OAUTH_CLIENT_ID] })
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
        const env: "live" | "paper" = req.body?.env === "paper" ? "paper" : "live";

        const clientId = ALPACA_OAUTH_CLIENT_ID.value();
        if (!clientId) {
          res.status(500).json({ error: "Alpaca OAuth is not configured" });
          return;
        }

        const state = crypto.randomBytes(24).toString("hex");
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        await admin.firestore()
          .collection(ALPACA_OAUTH_STATE_COLLECTION)
          .doc(state)
          .set({ uid: decoded.uid, env, expiresAt });

        const redirectUri = resolveAlpacaOAuthRedirectUri(String(req.headers.host || ""));

        const authorizeUrl = new URL("https://app.alpaca.markets/oauth/authorize");
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("scope", ALPACA_OAUTH_SCOPES);
        authorizeUrl.searchParams.set("state", state);
        authorizeUrl.searchParams.set("env", env);

        res.status(200).json({ authorizeUrl: authorizeUrl.toString() });
      } catch (error: any) {
        const message = error?.message || "Failed to start Alpaca OAuth";
        if (message.includes("Authorization Bearer token")) {
          res.status(401).json({ error: message });
          return;
        }
        console.error("❌ alpacaOAuthStart failed:", error);
        res.status(500).json({ error: message });
      }
    });
  });

/**
 * Handles Alpaca's OAuth2 redirect back from the authorize step.
 * GET /api/alpaca/oauth/callback?code=...&state=...
 *
 * Exchanges the code for an access token, stores it server-side only (never
 * sent to the client — see ALPACA_OAUTH_TOKENS_COLLECTION above), records a
 * lightweight connection under users/{uid}/exchanges/ so the existing
 * frontend lists it exactly like any other connected exchange, then
 * redirects the browser back into the app.
 */
export const alpacaOAuthCallback = functions
  .region("europe-west1")
  .runWith({ secrets: [ALPACA_OAUTH_CLIENT_ID, ALPACA_OAUTH_CLIENT_SECRET] })
  .https.onRequest(async (req, res) => {
    const clientId = ALPACA_OAUTH_CLIENT_ID.value();
    const clientSecret = ALPACA_OAUTH_CLIENT_SECRET.value();

    if (!clientId || !clientSecret) {
      res.status(500).send("Alpaca OAuth is not configured");
      return;
    }

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const oauthError = String(req.query.error || "");

    if (oauthError) {
      console.warn("⚠ Alpaca OAuth authorize returned an error:", oauthError);
      res.redirect(302, "https://invest-begin.com/exchanges?alpaca_connect=error");
      return;
    }
    if (!code || !state) {
      res.status(400).send("Missing required parameters");
      return;
    }

    // Verify one-time state and recover which user/env started this flow.
    const stateRef = admin.firestore().collection(ALPACA_OAUTH_STATE_COLLECTION).doc(state);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.status(401).send("Invalid or expired state");
      return;
    }
    const stateData = stateSnap.data()!;
    await stateRef.delete(); // consumed — one-time use only

    if (Date.now() > stateData.expiresAt) {
      res.status(401).send("Invalid or expired state");
      return;
    }

    const uid = String(stateData.uid);
    const env: "live" | "paper" = stateData.env === "paper" ? "paper" : "live";

    try {
      const redirectUri = resolveAlpacaOAuthRedirectUri(String(req.headers.host || ""));
      const tokenRes = await fetch("https://api.alpaca.markets/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }).toString(),
      } as any);

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        console.error("❌ Alpaca OAuth token exchange failed:", text);
        res.redirect(302, "https://invest-begin.com/exchanges?alpaca_connect=error");
        return;
      }

      const tokenData: any = await tokenRes.json();
      const accessToken: string = tokenData.access_token;
      const scope: string = tokenData.scope || ALPACA_OAUTH_SCOPES;

      if (!accessToken) {
        console.error("❌ Alpaca OAuth token response had no access_token");
        res.redirect(302, "https://invest-begin.com/exchanges?alpaca_connect=error");
        return;
      }

      // Persist the access token server-side only.
      await admin.firestore()
        .collection(ALPACA_OAUTH_TOKENS_COLLECTION)
        .doc(`${uid}_${env}`)
        .set({ uid, env, accessToken, scope, connectedAt: new Date().toISOString() });

      // Lightweight, client-visible connection record — no secret material.
      // Fixed label so reconnecting the same env updates it instead of
      // creating a duplicate entry in the exchanges list.
      const exchangeId = env === "paper" ? "alpaca-paper" : "alpaca";
      const label = env === "paper" ? "Alpaca Paper (Connect)" : "Alpaca (Connect)";
      await admin.firestore()
        .collection("users").doc(uid)
        .collection("exchanges").doc(label)
        .set(
          {
            exchangeId,
            label,
            apiKey: "",
            secret: "",
            authMethod: "oauth",
            connectedAt: new Date().toISOString(),
            status: "active",
          },
          { merge: true }
        );

      console.log(`✅ Alpaca OAuth connected for uid=${uid} env=${env}`);
      res.redirect(302, `https://invest-begin.com/exchanges?alpaca_connect=success&env=${env}`);
    } catch (error: any) {
      console.error("❌ alpacaOAuthCallback failed:", error);
      res.redirect(302, "https://invest-begin.com/exchanges?alpaca_connect=error");
    }
  });
