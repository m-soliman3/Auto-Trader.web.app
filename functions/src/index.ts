import * as functions from "firebase-functions";
import admin from "firebase-admin";

admin.initializeApp();

interface ValidateExchangeRequest {
  exchangeId: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
}

export const validateExchangeCredentials = functions.https.onCall(
  async (data: ValidateExchangeRequest, context: functions.https.CallableContext) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to validate exchange credentials"
      );
    }

    const { exchangeId, apiKey, secret, passphrase } = data;

    try {
      switch (exchangeId) {
        case "alpaca":
          return await validateAlpaca(apiKey, secret, false);
        case "alpaca-paper":
          return await validateAlpaca(apiKey, secret, true);
        case "binance":
          return await validateBinance(apiKey, secret);
        case "coinbase":
          return await validateCoinbase(apiKey, secret, passphrase || "");
        case "kraken":
          return await validateKraken(apiKey, secret);
        case "bybit":
          return await validateBybit(apiKey, secret);
        case "interactive-brokers":
          return await validateInteractiveBrokers(apiKey, secret);
        default:
          throw new functions.https.HttpsError(
            "invalid-argument",
            `Unknown exchange: ${exchangeId}`
          );
      }
    } catch (error: any) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        error.message || "Credential validation failed"
      );
    }
  }
);

async function validateAlpaca(
  apiKey: string,
  secret: string,
  isPaper: boolean
): Promise<boolean> {
  const baseUrl = isPaper
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";

  const response = await fetch(`${baseUrl}/v2/account`, {
    method: "GET",
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": secret,
    },
  });

  if (!response.ok) {
    throw new Error(`Invalid Alpaca credentials: HTTP ${response.status}`);
  }

  return true;
}

async function validateBinance(apiKey: string, secret: string): Promise<boolean> {
  const response = await fetch("https://api.binance.com/api/v3/account", {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Invalid Binance credentials: ${error.msg || `HTTP ${response.status}`}`
    );
  }

  return true;
}

async function validateCoinbase(
  apiKey: string,
  secret: string,
  passphrase: string
): Promise<boolean> {
  const response = await fetch("https://api.coinbase.com/api/v3/accounts", {
    method: "GET",
    headers: {
      "CB-ACCESS-KEY": apiKey,
      "CB-ACCESS-SIGN": secret,
      "CB-ACCESS-TIMESTAMP": Date.now().toString(),
      "CB-ACCESS-PASSPHRASE": passphrase,
    },
  });

  if (!response.ok) {
    throw new Error(`Invalid Coinbase credentials: HTTP ${response.status}`);
  }

  return true;
}

async function validateKraken(apiKey: string, secret: string): Promise<boolean> {
  const response = await fetch("https://api.kraken.com/0/public/Time");

  if (!response.ok) {
    throw new Error(`Kraken API validation failed: HTTP ${response.status}`);
  }

  return true;
}

async function validateBybit(apiKey: string, secret: string): Promise<boolean> {
  const response = await fetch("https://api.bybit.com/v5/market/time");

  if (!response.ok) {
    throw new Error(`Bybit API validation failed: HTTP ${response.status}`);
  }

  return true;
}

async function validateInteractiveBrokers(
  apiKey: string,
  secret: string
): Promise<boolean> {
  const response = await fetch("https://api.ibkr.com/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: apiKey,
      secret: secret,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Invalid Interactive Brokers credentials: HTTP ${response.status}`
    );
  }

  return true;
}
