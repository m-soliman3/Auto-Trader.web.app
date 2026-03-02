import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import * as crypto from "crypto";
import cors from "cors";

interface PortfolioData {
  portfolioValue: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  updatedAt: string;
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const corsHandler = cors({
  origin: ["https://autotrader-b8851.web.app", "http://localhost:4200"],
  methods: ["POST", "OPTIONS"],
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

  return {
    portfolioValue: parseFloat(data.portfolio_value || "0"),
    unrealizedPnl: parseFloat(data.unrealized_pl || "0"),
    pnlPercentage: parseFloat(data.unrealized_plpc || "0") * 100,
    updatedAt: new Date().toISOString(),
  };
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
  const totalValue = data.balances.reduce((acc: number, asset: any) => {
    return acc + parseFloat(asset.free) + parseFloat(asset.locked);
  }, 0);

  return {
    portfolioValue: totalValue,
    unrealizedPnl: 0,
    pnlPercentage: 0,
    updatedAt: new Date().toISOString(),
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

