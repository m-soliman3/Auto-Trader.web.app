import * as functions from "firebase-functions";
import fetch from "node-fetch";

// API Key for authentication
const API_KEY = "autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d";

interface PortfolioData {
  portfolioValue: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  updatedAt: string;
}

async function fetchAlpacaPortfolio(
  apiKey: string,
  isPaper: boolean
): Promise<PortfolioData> {
  const baseUrl = isPaper 
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";
  const url = `${baseUrl}/v2/account`;
  
  console.log("🔗 Alpaca URL:", url);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  } as any);

  if (!response.ok) {
    const text = await response.text();
    console.error("❌ Alpaca error:", text);
    throw new Error(`Alpaca API error ${response.status}: ${text}`);
  }

  const data: any = await response.json();
  const portfolioValue = parseFloat(data.portfolio_value || "0");

  return {
    portfolioValue,
    unrealizedPnl: parseFloat(data.unrealized_pl || "0"),
    pnlPercentage: parseFloat(data.unrealized_pl_pct || "0") * 100,
    updatedAt: new Date().toISOString(),
  };
}

// Callable function - works from Firebase web app without IAM issues
export const getPortfolio = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      const { exchangeId, apiKey: exchangeApiKey } = data;

      console.log("📊 Portfolio request for:", exchangeId);

      if (!exchangeId || !exchangeApiKey) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Missing exchangeId or apiKey"
        );
      }

      let portfolio: PortfolioData;

      if (exchangeId === "alpaca") {
        portfolio = await fetchAlpacaPortfolio(exchangeApiKey, false);
      } else if (exchangeId === "alpaca-paper") {
        portfolio = await fetchAlpacaPortfolio(exchangeApiKey, true);
      } else {
        throw new functions.https.HttpsError(
          "not-found",
          `Exchange not yet supported: ${exchangeId}`
        );
      }

      console.log("✅ Success! Portfolio value:", portfolio.portfolioValue);
      return portfolio;
    } catch (error: any) {
      console.error("❌ Error:", error.message);
      throw new functions.https.HttpsError(
        "internal",
        error.message
      );
    }
  });
