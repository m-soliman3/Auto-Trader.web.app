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
exports.portfolioData = void 0;
const functions = __importStar(require("firebase-functions"));
const crypto = __importStar(require("crypto"));
const node_fetch_1 = __importDefault(require("node-fetch"));
async function fetchBinancePortfolio(apiKey, secret) {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(queryString)
        .digest("hex");
    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;
    console.log("Fetching Binance:", url);
    const response = await (0, node_fetch_1.default)(url, {
        headers: { "X-MBX-APIKEY": apiKey },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Binance error response:", text);
        throw new Error(`Binance API error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log("Binance response:", JSON.stringify(data).slice(0, 200));
    const totalAsset = parseFloat(data.totalAssetOfBtc || "0");
    const portfolioValue = totalAsset * 50000; // rough BTC conversion
    console.log("Binance portfolio value:", portfolioValue);
    return {
        portfolioValue,
        unrealizedPnl: 0,
        pnlPercentage: 0,
        updatedAt: new Date().toISOString(),
    };
}
async function fetchCoinbasePortfolio(apiKey, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const method = "GET";
    const path = "/api/v3/brokerage/accounts";
    const message = `${timestamp}${method}${path}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(message)
        .digest("base64");
    const url = `https://api.coinbase.com${path}`;
    console.log("Fetching Coinbase:", url);
    const response = await (0, node_fetch_1.default)(url, {
        headers: {
            "CB-ACCESS-KEY": apiKey,
            "CB-ACCESS-TIMESTAMP": timestamp.toString(),
            "CB-ACCESS-SIGN": signature,
        },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Coinbase error response:", text);
        throw new Error(`Coinbase API error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log("Coinbase response:", JSON.stringify(data).slice(0, 200));
    const accounts = data.accounts || [];
    let portfolioValue = 0;
    for (const account of accounts) {
        if (account.available_balance?.amount) {
            portfolioValue += parseFloat(account.available_balance.amount);
        }
    }
    console.log("Coinbase portfolio value:", portfolioValue);
    return {
        portfolioValue,
        unrealizedPnl: 0,
        pnlPercentage: 0,
        updatedAt: new Date().toISOString(),
    };
}
async function fetchKrakenPortfolio(apiKey, secret) {
    const nonce = Date.now().toString();
    const path = "/0/private/Balance";
    const postdata = `nonce=${nonce}`;
    const sha256 = crypto.createHash("sha256");
    const hash = sha256.update(nonce + postdata).digest("binary");
    const hmac = crypto
        .createHmac("sha512", Buffer.from(secret, "base64"))
        .update(path + hash)
        .digest("base64");
    const url = "https://api.kraken.com" + path;
    console.log("Fetching Kraken:", url);
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        body: postdata,
        headers: {
            "API-Key": apiKey,
            "API-Sign": hmac,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Kraken error response:", text);
        throw new Error(`Kraken API error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log("Kraken response:", JSON.stringify(data).slice(0, 200));
    if (data.error?.length)
        throw new Error(`Kraken error: ${data.error[0]}`);
    const balances = data.result || {};
    let portfolioValue = 0;
    for (const [, balance] of Object.entries(balances)) {
        portfolioValue += parseFloat(balance);
    }
    console.log("Kraken portfolio value:", portfolioValue);
    return {
        portfolioValue,
        unrealizedPnl: 0,
        pnlPercentage: 0,
        updatedAt: new Date().toISOString(),
    };
}
async function fetchBybitPortfolio(apiKey, secret) {
    const timestamp = Date.now();
    const method = "GET";
    const path = "/v5/account/wallet-balance";
    const recvWindow = "5000";
    const queryString = `accountType=UNIFIED&recv_window=${recvWindow}&timestamp=${timestamp}`;
    const signPayload = `${method}${path}?${queryString}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(signPayload)
        .digest("hex");
    const url = `https://api.bybit.com${path}?${queryString}&sign=${signature}`;
    console.log("Fetching Bybit:", url);
    const response = await (0, node_fetch_1.default)(url, {
        headers: { "X-BAPI-API-KEY": apiKey },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Bybit error response:", text);
        throw new Error(`Bybit API error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log("Bybit response:", JSON.stringify(data).slice(0, 200));
    let portfolioValue = 0;
    if (data.result?.list?.[0]) {
        const totalEquity = data.result.list[0].totalEquity;
        portfolioValue = parseFloat(totalEquity || "0");
    }
    console.log("Bybit portfolio value:", portfolioValue);
    return {
        portfolioValue,
        unrealizedPnl: 0,
        pnlPercentage: 0,
        updatedAt: new Date().toISOString(),
    };
}
async function fetchAlpacaPortfolio(apiKey, isPaper = false) {
    const baseUrl = isPaper
        ? "https://paper-api.alpaca.markets"
        : "https://api.alpaca.markets";
    const url = `${baseUrl}/v2/account`;
    console.log("Fetching Alpaca:", url, "isPaper:", isPaper);
    const response = await (0, node_fetch_1.default)(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Alpaca error response:", text);
        throw new Error(`Alpaca API error: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log("Alpaca response:", JSON.stringify(data).slice(0, 200));
    const portfolioValue = parseFloat(data.portfolio_value || "0");
    console.log("Alpaca portfolio value:", portfolioValue);
    return {
        portfolioValue,
        unrealizedPnl: parseFloat(data.unrealized_pl || "0"),
        pnlPercentage: parseFloat(data.unrealized_pl_pct || "0") * 100,
        updatedAt: new Date().toISOString(),
    };
}
exports.portfolioData = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(200).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    try {
        const { exchangeId, apiKey, secret, passphrase } = req.body;
        console.log("Received portfolio request for:", exchangeId);
        if (!exchangeId || !apiKey || !secret) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        let portfolio;
        switch (exchangeId) {
            case "binance":
                portfolio = await fetchBinancePortfolio(apiKey, secret);
                break;
            case "coinbase":
                portfolio = await fetchCoinbasePortfolio(apiKey, secret);
                break;
            case "kraken":
                portfolio = await fetchKrakenPortfolio(apiKey, secret);
                break;
            case "bybit":
                portfolio = await fetchBybitPortfolio(apiKey, secret);
                break;
            case "alpaca":
                portfolio = await fetchAlpacaPortfolio(apiKey, false);
                break;
            case "alpaca-paper":
                portfolio = await fetchAlpacaPortfolio(apiKey, true);
                break;
            default:
                res.status(400).json({ error: `Unknown exchange: ${exchangeId}` });
                return;
        }
        console.log("Returning portfolio:", portfolio);
        res.json(portfolio);
    }
    catch (error) {
        console.error("Portfolio fetch error:", error.message, error);
        res.status(500).json({ error: error.message || "Failed to fetch portfolio" });
    }
});
//# sourceMappingURL=portfolio.js.map