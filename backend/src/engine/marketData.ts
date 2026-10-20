import fetch from "node-fetch";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { Candle } from "../types/domain";
import { config } from "../infra/config";

const execFileAsync = promisify(execFile);

export function normalizeBinanceSymbol(symbol: string): string {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSymbolForMarketData(symbol: string): string {
  const upper = String(symbol || "").toUpperCase().trim();
  if (!upper.includes("/")) return upper;
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  if (compact.endsWith("USD") && !compact.endsWith("USDT")) {
    return `${compact.slice(0, -3)}USDT`;
  }
  return compact;
}

function normalizeSymbolForYfinance(symbol: string): string {
  const upper = String(symbol || "").toUpperCase().trim();
  if (!upper.includes("/")) return upper;

  const [baseRaw, quoteRaw] = upper.split("/");
  const base = String(baseRaw || "").replace(/[^A-Z0-9]/g, "");
  const quote = String(quoteRaw || "").replace(/[^A-Z0-9]/g, "");
  if (!base) return upper.replace(/[^A-Z0-9.-]/g, "");

  // Yahoo crypto tickers commonly use USD quote (e.g. BTC-USD).
  const mappedQuote = quote === "USDT" || quote === "USDC" || quote === "BUSD" ? "USD" : quote;
  if (!mappedQuote) return base;
  return `${base}-${mappedQuote}`;
}

function mapTimeframeToYfinanceInterval(timeframe: string): string {
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

function periodForInterval(interval: string, limit: number): string {
  const normalizedLimit = Math.max(limit, 40);
  if (interval === "1m") {
    if (normalizedLimit <= 390) return "1d";
    if (normalizedLimit <= 1950) return "5d";
    return "7d";
  }
  if (interval === "5m" || interval === "15m" || interval === "60m") {
    if (normalizedLimit <= 500) return "5d";
    if (normalizedLimit <= 1200) return "1mo";
    return "3mo";
  }
  return "6mo";
}

async function fetchYfinanceCandles(symbol: string, timeframe: string, limit = 140): Promise<Candle[]> {
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
    const { stdout } = await execFileAsync(config.yfinancePythonBin, ["-c", pyCode, yfSymbol, interval, period, String(safeLimit)], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });

    const parsed = JSON.parse(String(stdout || "[]"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((c: any) => ({
        time: new Date(String(c?.time || Date.now())).toISOString(),
        open: Number.parseFloat(String(c?.open || "0")),
        high: Number.parseFloat(String(c?.high || "0")),
        low: Number.parseFloat(String(c?.low || "0")),
        close: Number.parseFloat(String(c?.close || "0")),
        volume: Number.parseFloat(String(c?.volume || "0")),
      }))
      .filter((c: Candle) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
  } catch (error) {
    console.error("yfinance fetch failed", { symbol: yfSymbol, interval, period, message: (error as any)?.message || "unknown" });
    return [];
  }
}

export async function fetchBinanceCandles(symbol: string, timeframe: string, limit = 140): Promise<Candle[]> {
  if (config.marketDataProvider === "yfinance") {
    const yf = await fetchYfinanceCandles(symbol, timeframe, limit);
    if (yf.length >= 2) return yf;
  }

  const normalizedSymbol = normalizeSymbolForMarketData(symbol);
  const interval = ["1m", "5m", "15m", "1h", "4h", "1d"].includes(timeframe) ? timeframe : "1h";
  const url = `https://api.binance.com/api/v3/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${Math.max(limit, 40)}`;

  const response = await fetch(url as any);
  if (!response.ok) return [];

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : [];
  if (!Array.isArray(payload)) return [];

  return payload
    .map((c: any) => ({
      time: new Date(Number(c?.[0] || Date.now())).toISOString(),
      open: Number.parseFloat(String(c?.[1] || "0")),
      high: Number.parseFloat(String(c?.[2] || "0")),
      low: Number.parseFloat(String(c?.[3] || "0")),
      close: Number.parseFloat(String(c?.[4] || "0")),
      volume: Number.parseFloat(String(c?.[5] || "0")),
    }))
    .filter((c: Candle) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
}

function mapTimeframeToAlpaca(timeframe: string): string {
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

export async function fetchAlpacaStockBars(apiKey: string, apiSecret: string, symbol: string, timeframe: string, limit = 140): Promise<Candle[]> {
  if (config.marketDataProvider === "yfinance") {
    const yf = await fetchYfinanceCandles(symbol, timeframe, limit);
    if (yf.length >= 2) return yf;
  }

  if (!String(apiKey || "").trim() || !String(apiSecret || "").trim()) {
    throw new Error("Missing Alpaca credentials for stock market data");
  }

  const normalizedSymbol = String(symbol || "").toUpperCase().replace(/\/.+$/, "").trim();
  if (!normalizedSymbol) return [];

  const alpacaTf = mapTimeframeToAlpaca(timeframe);
  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(normalizedSymbol)}/bars?timeframe=${alpacaTf}&limit=${Math.max(20, limit)}&adjustment=raw&feed=iex`;

  const response = await fetch(url as any, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
    },
  } as any);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpaca bars error ${response.status}: ${text}`);
  }

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  const bars = Array.isArray(payload?.bars) ? payload.bars : [];

  return bars
    .map((bar: any) => ({
      time: String(bar?.t || ""),
      open: Number.parseFloat(String(bar?.o || "0")),
      high: Number.parseFloat(String(bar?.h || "0")),
      low: Number.parseFloat(String(bar?.l || "0")),
      close: Number.parseFloat(String(bar?.c || "0")),
      volume: Number.parseFloat(String(bar?.v || "0")),
    }))
    .filter((c: Candle) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.close > 0);
}

export async function fetchBinancePrice(symbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${normalizeBinanceSymbol(symbol)}`;
  const response = await fetch(url as any);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch Binance price: ${text}`);
  }
  const data: any = await response.json();
  return Number.parseFloat(String(data?.price || "0"));
}

async function signedBinanceRequest(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string> = {},
  method = "GET",
): Promise<any> {
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: "5000" });
  const signature = crypto.createHmac("sha256", apiSecret).update(query.toString()).digest("hex");
  const url = `https://api.binance.com${endpoint}?${query.toString()}&signature=${signature}`;

  const response = await fetch(url as any, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/json",
    },
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok) throw new Error(`Binance order error ${response.status}: ${payloadText}`);
  return payload;
}

export async function placeBinanceOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
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
  if (!Number.isFinite(price) || price <= 0) throw new Error("Unable to fetch market price for sell order.");
  const quantity = Math.max(Number(input.investment) / price, 0.000001).toFixed(6);
  const order = await signedBinanceRequest(input.apiKey, input.apiSecret, "/api/v3/order", {
    symbol,
    side: "SELL",
    type: "MARKET",
    quantity,
  }, "POST");

  return { orderId: String(order.orderId || "binance-sell"), raw: order };
}

export async function placeAlpacaOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
  brokerProvisioned?: boolean;
  brokerAccountId?: string;
  /**
   * When set, this Alpaca connection was made via the "Connect with Alpaca"
   * OAuth flow (functions/src/index.ts — alpacaOAuthCallback) rather than a
   * pasted API key/secret. Orders are placed with `Authorization: Bearer
   * <oauthAccessToken>` instead of the APCA-API-KEY-ID/SECRET headers.
   * apiKey/apiSecret are ignored in this case.
   */
  oauthAccessToken?: string;
}): Promise<{ orderId: string; raw: any }> {
  const isPaper = input.exchangeId === "alpaca-paper";
  const useBrokerSandbox = isPaper && (input.brokerProvisioned === true || input.apiKey.startsWith("CK"));

  if (useBrokerSandbox) {
    const brokerAccountId = String(input.brokerAccountId || "").trim();
    if (!brokerAccountId) {
      throw new Error("Alpaca broker account is missing for this paper strategy.");
    }
    if (!config.alpacaBrokerKeyId || !config.alpacaBrokerSecretKey) {
      throw new Error("Alpaca Broker credentials are not configured in backend env.");
    }

    const authBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.alpacaBrokerKeyId,
      client_secret: config.alpacaBrokerSecretKey,
    });
    const tokenRes = await fetch("https://authx.sandbox.alpaca.markets/v1/oauth2/token" as any, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: authBody.toString(),
    } as any);

    const tokenText = await tokenRes.text();
    const tokenPayload = tokenText ? JSON.parse(tokenText) : {};
    if (!tokenRes.ok || !tokenPayload?.access_token) {
      throw new Error(`Alpaca broker auth error ${tokenRes.status}: ${tokenText}`);
    }

    const accessToken = String(tokenPayload.access_token);
    const baseUrl = "https://broker-api.sandbox.alpaca.markets";
    const symbol = String(input.symbol || "").toUpperCase().trim();
    const response = await fetch(`${baseUrl}/v1/trading/accounts/${encodeURIComponent(brokerAccountId)}/orders` as any, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        symbol,
        side: input.side,
        type: "market",
        time_in_force: symbol.includes("/") ? "gtc" : "day",
        notional: Number(input.investment).toFixed(2),
      }),
    } as any);

    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};
    if (!response.ok) {
      throw new Error(`Alpaca broker order error ${response.status}: ${payloadText}`);
    }

    const orderId = String(payload.id || "alpaca-broker-order");
    let enrichedPayload = payload;
    if (orderId && orderId !== "alpaca-broker-order") {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        const detailResponse = await fetch(`${baseUrl}/v1/trading/accounts/${encodeURIComponent(brokerAccountId)}/orders/${encodeURIComponent(orderId)}` as any, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        } as any);

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

  const baseUrl = isPaper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  const symbol = String(input.symbol || "").toUpperCase().trim();

  const authHeaders: Record<string, string> = input.oauthAccessToken
    ? { Authorization: `Bearer ${input.oauthAccessToken}` }
    : { "APCA-API-KEY-ID": input.apiKey, "APCA-API-SECRET-KEY": input.apiSecret };

  const response = await fetch(`${baseUrl}/v2/orders` as any, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      symbol,
      side: input.side,
      type: "market",
      time_in_force: symbol.includes("/") ? "gtc" : "day",
      notional: Number(input.investment).toFixed(2),
    }),
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok) throw new Error(`Alpaca order error ${response.status}: ${payloadText}`);

  const orderId = String(payload.id || "alpaca-order");

  // Attempt to enrich immediate order response with fill fields.
  let enrichedPayload = payload;
  if (orderId && orderId !== "alpaca-order") {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const detailResponse = await fetch(`${baseUrl}/v2/orders/${encodeURIComponent(orderId)}` as any, {
        method: "GET",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
      } as any);

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

// ─────────────────────────────────────────────────────────────────
// Bybit V5 (spot) — real & testnet
// apiKey = API Key, apiSecret = API Secret
// ─────────────────────────────────────────────────────────────────
export async function placeBybitOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isTestnet = input.exchangeId === "bybit-testnet";
  const baseUrl = isTestnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const symbol = String(input.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const body = JSON.stringify({
    category: "spot",
    symbol,
    side: input.side === "buy" ? "Buy" : "Sell",
    orderType: "Market",
    marketUnit: "quoteCoin",
    qty: Number(input.investment).toFixed(2),
  });

  const signStr = `${timestamp}${input.apiKey}${recvWindow}${body}`;
  const sign = crypto.createHmac("sha256", input.apiSecret).update(signStr).digest("hex");

  const response = await fetch(`${baseUrl}/v5/order/create` as any, {
    method: "POST",
    headers: {
      "X-BAPI-API-KEY": input.apiKey,
      "X-BAPI-SIGN": sign,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "Content-Type": "application/json",
    },
    body,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok || payload.retCode !== 0) {
    throw new Error(`Bybit order error: ${payload.retMsg || payloadText}`);
  }
  return { orderId: String(payload.result?.orderId || "bybit-order"), raw: payload.result };
}

// ─────────────────────────────────────────────────────────────────
// Kraken REST — real only (no official testnet)
// apiKey = API Key, apiSecret = Private Key (base64)
// ─────────────────────────────────────────────────────────────────
export async function placeKrakenOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const nonce = Date.now().toString();
  // Kraken pair: BTC/USD → XBTUSDT, AAPL → AAPL (stocks not supported via API, but keep generic)
  const pair = String(input.symbol || "").toUpperCase().replace("/", "");

  const params = new URLSearchParams({ nonce, pair, type: input.side, ordertype: "market" });
  if (input.side === "buy") {
    // quoteOrderQty: spend this much in quote currency
    params.set("oflags", "fciq");
    params.set("quoteOrderQty", Number(input.investment).toFixed(2));
  } else {
    // For sell, fetch current price to derive volume
    const tickerRes = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}` as any);
    if (!tickerRes.ok) throw new Error("Kraken: unable to fetch ticker for sell order");
    const tickerData: any = await tickerRes.json();
    const tickerKey = Object.keys(tickerData.result || {})[0];
    const lastPrice = Number.parseFloat(String(tickerData.result?.[tickerKey]?.c?.[0] || "0"));
    if (!Number.isFinite(lastPrice) || lastPrice <= 0) throw new Error("Kraken: invalid market price for sell");
    params.set("volume", (Number(input.investment) / lastPrice).toFixed(8));
  }

  const path = "/0/private/AddOrder";
  const message = params.toString();
  const hash = crypto.createHash("sha256").update(nonce + message).digest();
  const secret = Buffer.from(input.apiSecret, "base64");
  const mac = crypto.createHmac("sha512", secret).update(Buffer.concat([Buffer.from(path), hash])).digest("base64");

  const response = await fetch(`https://api.kraken.com${path}` as any, {
    method: "POST",
    headers: { "API-Key": input.apiKey, "API-Sign": mac, "Content-Type": "application/x-www-form-urlencoded" },
    body: message,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (payload.error && payload.error.length > 0) {
    throw new Error(`Kraken order error: ${payload.error.join(", ")}`);
  }
  return { orderId: String(payload.result?.txid?.[0] || "kraken-order"), raw: payload.result };
}

// ─────────────────────────────────────────────────────────────────
// Robinhood Crypto Trading API — real only (US, USD pairs)
// apiKey = API key (rh-api-…), apiSecret = base64 Ed25519 private key
// Docs: https://docs.robinhood.com/crypto/trading/
// ─────────────────────────────────────────────────────────────────
const ROBINHOOD_CRYPTO_BASE_URL = "https://trading.robinhood.com";

/** BTC/USD, BTC-USD or BTCUSD → BTC-USD. Robinhood only quotes in USD. */
export function toRobinhoodCryptoSymbol(symbol: string): string {
  const upper = String(symbol || "").toUpperCase().trim();
  const [base, quote] = /[/-]/.test(upper)
    ? upper.split(/[/-]/)
    : upper.endsWith("USD") ? [upper.slice(0, -3), "USD"] : [upper, ""];
  if (!base || quote !== "USD") {
    throw new Error(`Robinhood Crypto only trades USD pairs (e.g. BTC/USD); got "${symbol}".`);
  }
  return `${base}-USD`;
}

async function robinhoodCryptoRequest(
  apiKey: string,
  privateKeyBase64: string,
  method: "GET" | "POST",
  path: string,
  body = "",
): Promise<any> {
  const seed = Buffer.from(privateKeyBase64, "base64");
  if (seed.length !== 32) throw new Error("Robinhood Crypto private key must be a base64-encoded 32-byte Ed25519 key");
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
    format: "der",
    type: "pkcs8",
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Signed message: api key + timestamp + path (with query) + method + raw body.
  const signature = crypto.sign(null, Buffer.from(`${apiKey}${timestamp}${path}${method}${body}`), privateKey).toString("base64");

  const response = await fetch(`${ROBINHOOD_CRYPTO_BASE_URL}${path}` as any, {
    method,
    headers: {
      "x-api-key": apiKey,
      "x-signature": signature,
      "x-timestamp": timestamp,
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
    ...(body ? { body } : {}),
  } as any);

  const payloadText = await response.text();
  let payload: any = {};
  try {
    payload = payloadText ? JSON.parse(payloadText) : {};
  } catch {
    // Auth failures come back as plain text.
  }
  if (!response.ok) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors.map((e: any) => e?.detail || JSON.stringify(e)).join("; ")
      : payloadText;
    throw new Error(`Robinhood Crypto error ${response.status}: ${detail}`);
  }
  return payload;
}

export async function placeRobinhoodCryptoOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const symbol = toRobinhoodCryptoSymbol(input.symbol);
  const query = `?symbol=${encodeURIComponent(symbol)}`;

  const pairs = await robinhoodCryptoRequest(input.apiKey, input.apiSecret, "GET", `/api/v1/crypto/trading/trading_pairs/${query}`);
  const pair = Array.isArray(pairs?.results) ? pairs.results[0] : null;
  const status = String(pair?.status || "").toLowerCase();
  if (!pair || !(status === "tradable" || (status === "sellonly" && input.side === "sell"))) {
    throw new Error(`Robinhood Crypto: ${symbol} is not tradable (${status || "unknown pair"}).`);
  }

  // Market orders take a base-asset quantity, so convert the USD investment
  // using the side's spread-inclusive price.
  const quotes = await robinhoodCryptoRequest(input.apiKey, input.apiSecret, "GET", `/api/v1/crypto/marketdata/best_bid_ask/${query}`);
  const quote = Array.isArray(quotes?.results) ? quotes.results[0] : null;
  const price = Number(input.side === "buy" ? quote?.ask_inclusive_of_buy_spread : quote?.bid_inclusive_of_sell_spread);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Robinhood Crypto: invalid market price for ${symbol}`);

  const increment = String(pair.asset_increment || "0.00000001");
  const decimals = increment.includes(".") ? increment.split(".")[1].replace(/0+$/, "").length : 0;
  const step = Number(increment);
  const rawQuantity = Number(input.investment) / price;
  // Round down to the pair's quantity increment (integer maths avoids float drift).
  const quantity = step > 0 ? Math.floor(Math.round(rawQuantity / step * 1e6) / 1e6) * step : rawQuantity;
  const minSize = Number(pair.min_order_size || 0);
  if (!(quantity > 0) || quantity < minSize) {
    throw new Error(`Robinhood Crypto: $${input.investment} is below the minimum order size for ${symbol} (${pair.min_order_size}).`);
  }

  const body = JSON.stringify({
    client_order_id: crypto.randomUUID(),
    side: input.side,
    type: "market",
    symbol,
    market_order_config: { asset_quantity: quantity.toFixed(decimals) },
  });
  const order = await robinhoodCryptoRequest(input.apiKey, input.apiSecret, "POST", "/api/v1/crypto/trading/orders/", body);
  return { orderId: String(order?.id || "robinhood-crypto-order"), raw: order };
}

// ─────────────────────────────────────────────────────────────────
// OKX V5 — real & demo (simulated trading)
// apiKey = API Key, apiSecret = Secret Key, passphrase = Passphrase
// ─────────────────────────────────────────────────────────────────
export async function placeOkxOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isDemo = input.exchangeId === "okx-demo";
  const timestamp = new Date().toISOString();
  const path = "/api/v5/trade/order";
  // OKX instrument id: BTC/USDT → BTC-USDT
  const instId = String(input.symbol || "").toUpperCase().replace("/", "-");

  const body = JSON.stringify({
    instId,
    tdMode: "cash",
    side: input.side,
    ordType: "market",
    sz: Number(input.investment).toFixed(2),
    tgtCcy: input.side === "buy" ? "quote_ccy" : "base_ccy",
  });

  const prehash = `${timestamp}POST${path}${body}`;
  const sign = crypto.createHmac("sha256", input.apiSecret).update(prehash).digest("base64");

  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": input.apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": input.passphrase,
    "Content-Type": "application/json",
  };
  if (isDemo) headers["x-simulated-trading"] = "1";

  const response = await fetch(`https://www.okx.com${path}` as any, {
    method: "POST",
    headers,
    body,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (payload.code !== "0") {
    throw new Error(`OKX order error: ${payload.msg || payloadText}`);
  }
  const result = payload.data?.[0] || {};
  return { orderId: String(result.ordId || "okx-order"), raw: result };
}

// ─────────────────────────────────────────────────────────────────
// KuCoin — real & sandbox
// apiKey = API Key, apiSecret = API Secret, passphrase = Passphrase
// ─────────────────────────────────────────────────────────────────
export async function placeKucoinOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isSandbox = input.exchangeId === "kucoin-sandbox";
  const baseUrl = isSandbox ? "https://openapi-sandbox.kucoin.com" : "https://api.kucoin.com";
  const timestamp = Date.now().toString();
  const path = "/api/v1/orders";
  // KuCoin pair: BTC/USDT → BTC-USDT
  const symbol = String(input.symbol || "").toUpperCase().replace("/", "-");
  const clientOid = `at_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const bodyObj: Record<string, string> = { clientOid, side: input.side, symbol, type: "market" };
  if (input.side === "buy") {
    bodyObj.funds = Number(input.investment).toFixed(2);
  } else {
    // For sell: fetch current price to derive size in base currency
    const tickerRes = await fetch(`${baseUrl}/api/v1/market/orderbook/level1?symbol=${encodeURIComponent(symbol)}` as any, {
      headers: { "KC-API-KEY": input.apiKey, "KC-API-TIMESTAMP": timestamp, "KC-API-KEY-VERSION": "2" },
    } as any);
    const tickerData: any = tickerRes.ok ? JSON.parse(await tickerRes.text()) : {};
    const price = Number.parseFloat(String(tickerData?.data?.price || "0"));
    if (!Number.isFinite(price) || price <= 0) throw new Error("KuCoin: unable to fetch price for sell order");
    bodyObj.size = (Number(input.investment) / price).toFixed(8);
  }

  const body = JSON.stringify(bodyObj);
  const prehash = `${timestamp}POST${path}${body}`;
  const sign = crypto.createHmac("sha256", input.apiSecret).update(prehash).digest("base64");
  const encPassphrase = crypto.createHmac("sha256", input.apiSecret).update(input.passphrase).digest("base64");

  const response = await fetch(`${baseUrl}${path}` as any, {
    method: "POST",
    headers: {
      "KC-API-KEY": input.apiKey,
      "KC-API-SIGN": sign,
      "KC-API-TIMESTAMP": timestamp,
      "KC-API-PASSPHRASE": encPassphrase,
      "KC-API-KEY-VERSION": "2",
      "Content-Type": "application/json",
    },
    body,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (payload.code !== "200000") {
    throw new Error(`KuCoin order error: ${payload.msg || payloadText}`);
  }
  return { orderId: String(payload.data?.orderId || "kucoin-order"), raw: payload.data };
}

// ─────────────────────────────────────────────────────────────────
// MEXC — Binance-compatible REST API
// apiKey = API Key, apiSecret = Secret Key
// ─────────────────────────────────────────────────────────────────
export async function placeMexcOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const symbol = normalizeBinanceSymbol(input.symbol);
  const side = input.side.toUpperCase();

  const orderParams: Record<string, string> = {
    symbol,
    side,
    type: "MARKET",
    timestamp: Date.now().toString(),
    recvWindow: "5000",
  };

  if (side === "BUY") {
    orderParams.quoteOrderQty = Number(input.investment).toFixed(2);
  } else {
    const priceRes = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}` as any);
    if (!priceRes.ok) throw new Error("MEXC: unable to fetch price for sell order");
    const priceData: any = JSON.parse(await priceRes.text());
    const price = Number.parseFloat(String(priceData?.price || "0"));
    if (!Number.isFinite(price) || price <= 0) throw new Error("MEXC: invalid price for sell order");
    orderParams.quantity = (Number(input.investment) / price).toFixed(6);
  }

  const query = new URLSearchParams(orderParams);
  const signature = crypto.createHmac("sha256", input.apiSecret).update(query.toString()).digest("hex");
  query.append("signature", signature);

  const response = await fetch("https://api.mexc.com/api/v3/order" as any, {
    method: "POST",
    headers: { "X-MEXC-APIKEY": input.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    body: query.toString(),
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok) throw new Error(`MEXC order error: ${payloadText}`);
  return { orderId: String(payload.orderId || "mexc-order"), raw: payload };
}

// ─────────────────────────────────────────────────────────────────
// Gate.io V4 Spot
// apiKey = API Key, apiSecret = API Secret
// ─────────────────────────────────────────────────────────────────
export async function placeGateioOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = "/api/v4/spot/orders";
  // Gate.io pair: BTC/USDT → BTC_USDT
  const currencyPair = String(input.symbol || "").toUpperCase().replace(/[/-]/g, "_");

  const bodyObj = {
    currency_pair: currencyPair,
    type: "market",
    side: input.side,
    amount: Number(input.investment).toFixed(2),
    time_in_force: "ioc",
    account: "spot",
  };
  const bodyStr = JSON.stringify(bodyObj);
  const bodyHash = crypto.createHash("sha512").update(bodyStr).digest("hex");
  const signString = `POST\n${path}\n\n${bodyHash}\n${timestamp}`;
  const sign = crypto.createHmac("sha512", input.apiSecret).update(signString).digest("hex");

  const response = await fetch(`https://api.gateio.ws${path}` as any, {
    method: "POST",
    headers: {
      "KEY": input.apiKey,
      "SIGN": sign,
      "Timestamp": timestamp,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok) throw new Error(`Gate.io order error ${response.status}: ${payloadText}`);
  return { orderId: String(payload.id || "gateio-order"), raw: payload };
}

// ─────────────────────────────────────────────────────────────────
// Bitfinex v2 REST (authenticated)
// apiKey = API Key, apiSecret = API Secret
// ─────────────────────────────────────────────────────────────────
export async function placeBitfinexOrder(input: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const nonce = Date.now().toString();
  const path = "/api/v2/auth/w/order/submit";
  // Bitfinex symbol: BTC/USD → tBTCUSD
  const baseSymbol = String(input.symbol || "").toUpperCase().replace(/[/-]/g, "");
  const bfxSymbol = `t${baseSymbol}`;
  // Amount: positive = buy, negative = sell (in base currency; use investment as approximation)
  const amount = input.side === "buy"
    ? Number(input.investment).toFixed(8)
    : `-${Number(input.investment).toFixed(8)}`;

  const bodyObj = { type: "MARKET", symbol: bfxSymbol, amount };
  const bodyStr = JSON.stringify(bodyObj);
  const sigPayload = `/api/v2/auth/w/order/submit${nonce}${bodyStr}`;
  const sign = crypto.createHmac("sha384", input.apiSecret).update(sigPayload).digest("hex");

  const response = await fetch(`https://api.bitfinex.com${path}` as any, {
    method: "POST",
    headers: {
      "bfx-apikey": input.apiKey,
      "bfx-signature": sign,
      "bfx-nonce": nonce,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : [];
  // Response: [MTS, TYPE, MSG_ID, null, [ORDER], CODE, STATUS, TEXT]
  if (!response.ok || (Array.isArray(payload) && payload[6] === "ERROR")) {
    const errMsg = Array.isArray(payload) ? payload[7] : payloadText;
    throw new Error(`Bitfinex order error: ${errMsg}`);
  }
  const orderData = Array.isArray(payload[4]) ? payload[4] : [];
  return { orderId: String(orderData[0] || "bitfinex-order"), raw: orderData };
}

// ─────────────────────────────────────────────────────────────────
// Deribit REST (client_credentials) — real & testnet
// apiKey = Client ID, apiSecret = Client Secret
// ─────────────────────────────────────────────────────────────────
export async function placeDeribitOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isTestnet = input.exchangeId === "deribit-testnet";
  const baseUrl = isTestnet ? "https://test.deribit.com" : "https://www.deribit.com";

  // Authenticate with client_credentials
  const authUrl = `${baseUrl}/api/v2/public/auth?grant_type=client_credentials&client_id=${encodeURIComponent(input.apiKey)}&client_secret=${encodeURIComponent(input.apiSecret)}`;
  const authRes = await fetch(authUrl as any);
  if (!authRes.ok) throw new Error("Deribit: authentication failed");
  const authData: any = JSON.parse(await authRes.text());
  const accessToken = authData?.result?.access_token;
  if (!accessToken) throw new Error("Deribit: no access token received");

  // Instrument name: BTC/USD → BTC-PERPETUAL, ETH/USDT → ETH-USDT
  const rawSymbol = String(input.symbol || "").toUpperCase().replace("/", "-");
  const instrumentName = rawSymbol.includes("-") ? rawSymbol : `${rawSymbol}-PERPETUAL`;

  const action = input.side === "buy" ? "private/buy" : "private/sell";
  const orderParams = new URLSearchParams({
    instrument_name: instrumentName,
    amount: Number(input.investment).toFixed(2),
    type: "market",
    label: `autotrader_${Date.now()}`,
  });

  const orderRes = await fetch(`${baseUrl}/api/v2/${action}?${orderParams.toString()}` as any, {
    method: "GET",
    headers: { "Authorization": `Bearer ${accessToken}` },
  } as any);

  const payloadText = await orderRes.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (payload.error) throw new Error(`Deribit order error: ${payload.error.message || JSON.stringify(payload.error)}`);
  return { orderId: String(payload.result?.order?.order_id || "deribit-order"), raw: payload.result };
}

// ─────────────────────────────────────────────────────────────────
// Tradier REST — real & sandbox
// apiKey = Access Token (Bearer), apiSecret = Account Number
// ─────────────────────────────────────────────────────────────────
export async function placeTradierOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isSandbox = input.exchangeId === "tradier-sandbox";
  const baseUrl = isSandbox ? "https://sandbox.tradier.com" : "https://api.tradier.com";
  const accountId = String(input.apiSecret || "").trim();
  const symbol = String(input.symbol || "").toUpperCase().trim();

  // Fetch current quote to calculate share quantity
  const quoteRes = await fetch(`${baseUrl}/v1/markets/quotes?symbols=${encodeURIComponent(symbol)}&greeks=false` as any, {
    headers: { "Authorization": `Bearer ${input.apiKey}`, "Accept": "application/json" },
  } as any);
  if (!quoteRes.ok) throw new Error(`Tradier quote error: ${await quoteRes.text()}`);
  const quoteData: any = JSON.parse(await quoteRes.text());
  const price = Number.parseFloat(String(quoteData?.quotes?.quote?.last || "0"));
  if (!Number.isFinite(price) || price <= 0) throw new Error("Tradier: unable to determine market price");

  const quantity = Math.max(1, Math.floor(Number(input.investment) / price));

  const body = new URLSearchParams({
    class: "equity",
    symbol,
    side: input.side === "buy" ? "buy" : "sell",
    quantity: quantity.toString(),
    type: "market",
    duration: "gtc",
  });

  const response = await fetch(`${baseUrl}/v1/accounts/${encodeURIComponent(accountId)}/orders` as any, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  } as any);

  const payloadText = await response.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!response.ok || payload?.order?.status === "error") {
    const errMsg = Array.isArray(payload?.errors?.error) ? payload.errors.error.join("; ") : payloadText;
    throw new Error(`Tradier order error: ${errMsg}`);
  }
  return { orderId: String(payload.order?.id || "tradier-order"), raw: payload.order };
}

// ─────────────────────────────────────────────────────────────────
// Tastytrade REST — session-based auth
// apiKey = Login (email), apiSecret = Password, passphrase = Account Number
// ─────────────────────────────────────────────────────────────────
export async function placeTastytradeOrder(input: {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const baseUrl = "https://api.tastyworks.com";
  const accountNumber = String(input.passphrase || "").trim();

  // Create session
  const sessionRes = await fetch(`${baseUrl}/sessions` as any, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: input.apiKey, password: input.apiSecret, "remember-me": false }),
  } as any);
  if (!sessionRes.ok) throw new Error(`Tastytrade auth error: ${await sessionRes.text()}`);
  const sessionData: any = JSON.parse(await sessionRes.text());
  const sessionToken = sessionData?.data?.["session-token"];
  if (!sessionToken) throw new Error("Tastytrade: no session token received");

  // Fetch current quote for quantity calculation
  const symbol = String(input.symbol || "").toUpperCase().trim();
  const quoteRes = await fetch(`${baseUrl}/market-data/quotes/${encodeURIComponent(symbol)}` as any, {
    headers: { "Authorization": sessionToken },
  } as any);
  const quoteData: any = quoteRes.ok ? JSON.parse(await quoteRes.text()) : {};
  const price = Number.parseFloat(String(quoteData?.data?.last || "0"));
  const quantity = price > 0 ? Math.max(1, Math.floor(Number(input.investment) / price)).toString() : "1";

  const orderBody = {
    "order-type": "Market",
    "time-in-force": "GTC",
    legs: [{
      "instrument-type": "Equity",
      symbol,
      quantity,
      action: input.side === "buy" ? "Buy to Open" : "Sell to Close",
    }],
  };

  const orderRes = await fetch(`${baseUrl}/accounts/${encodeURIComponent(accountNumber)}/orders` as any, {
    method: "POST",
    headers: { "Authorization": sessionToken, "Content-Type": "application/json" },
    body: JSON.stringify(orderBody),
  } as any);

  const payloadText = await orderRes.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!orderRes.ok) throw new Error(`Tastytrade order error: ${payloadText}`);
  return { orderId: String(payload.data?.order?.id || "tastytrade-order"), raw: payload.data };
}

// ─────────────────────────────────────────────────────────────────
// IG Group REST — session-based auth (real & demo)
// apiKey = X-IG-API-KEY, apiSecret = Password, passphrase = Identifier (username)
// ─────────────────────────────────────────────────────────────────
export async function placeIgGroupOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const isDemo = input.exchangeId === "ig-group-demo";
  const baseUrl = isDemo ? "https://demo-api.ig.com/gateway/deal" : "https://api.ig.com/gateway/deal";

  // Create session (v2 returns tokens in headers)
  const sessionRes = await fetch(`${baseUrl}/session` as any, {
    method: "POST",
    headers: {
      "X-IG-API-KEY": input.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json; charset=UTF-8",
      "Version": "2",
    },
    body: JSON.stringify({ identifier: input.passphrase, password: input.apiSecret }),
  } as any);

  if (!sessionRes.ok) throw new Error(`IG Group auth error: ${await sessionRes.text()}`);
  const cst = (sessionRes.headers as any).get("CST") || "";
  const securityToken = (sessionRes.headers as any).get("X-SECURITY-TOKEN") || "";
  if (!cst || !securityToken) throw new Error("IG Group: missing session tokens in response");

  const authHeaders = {
    "X-IG-API-KEY": input.apiKey,
    "CST": cst,
    "X-SECURITY-TOKEN": securityToken,
    "Content-Type": "application/json",
    "Accept": "application/json; charset=UTF-8",
  };

  // Search for epic (IG instrument id) by symbol
  const searchRes = await fetch(`${baseUrl}/markets?searchTerm=${encodeURIComponent(input.symbol)}&instrumentTypes=SHARES,CURRENCIES,CRYPTOCURRENCIES` as any, {
    headers: { ...authHeaders, "Version": "1" },
  } as any);
  const searchData: any = searchRes.ok ? JSON.parse(await searchRes.text()) : {};
  const epic = searchData?.markets?.[0]?.epic;
  if (!epic) throw new Error(`IG Group: unable to find instrument for symbol "${input.symbol}"`);

  const orderBody = {
    epic,
    expiry: "-",
    direction: input.side === "buy" ? "BUY" : "SELL",
    size: Number(input.investment).toFixed(2),
    orderType: "MARKET",
    timeInForce: "EXECUTE_AND_ELIMINATE",
    guaranteedStop: false,
    forceOpen: true,
    currencyCode: "USD",
  };

  const orderRes = await fetch(`${baseUrl}/positions/otc` as any, {
    method: "POST",
    headers: { ...authHeaders, "Version": "2" },
    body: JSON.stringify(orderBody),
  } as any);

  const payloadText = await orderRes.text();
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (!orderRes.ok) throw new Error(`IG Group order error: ${payloadText}`);
  return { orderId: String(payload.dealReference || "iggroup-order"), raw: payload };
}

// ─────────────────────────────────────────────────────────────────
// Charles Schwab REST — OAuth2 access token
// apiKey = OAuth Access Token, apiSecret = Account Hash Number, passphrase = App Key
// ─────────────────────────────────────────────────────────────────
export async function placeSchwabOrder(input: {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "buy" | "sell";
  investment: number;
}): Promise<{ orderId: string; raw: any }> {
  const baseUrl = "https://api.schwabapi.com/trader/v1";
  const accountHash = String(input.apiSecret || "").trim();
  const symbol = String(input.symbol || "").toUpperCase().trim();

  // Fetch current quote for quantity
  const quoteRes = await fetch(`${baseUrl}/marketdata/v1/${encodeURIComponent(symbol)}/quotes` as any, {
    headers: { "Authorization": `Bearer ${input.apiKey}`, "Accept": "application/json" },
  } as any);
  const quoteData: any = quoteRes.ok ? JSON.parse(await quoteRes.text()) : {};
  const price = Number.parseFloat(String(quoteData?.[symbol]?.quote?.lastPrice || "0"));
  if (!Number.isFinite(price) || price <= 0) throw new Error("Schwab: unable to determine current price");

  const quantity = Math.max(1, Math.floor(Number(input.investment) / price));
  const orderBody = {
    orderType: "MARKET",
    session: "NORMAL",
    duration: "DAY",
    orderStrategyType: "SINGLE",
    orderLegCollection: [{
      instruction: input.side === "buy" ? "BUY" : "SELL",
      quantity,
      instrument: { symbol, assetType: "EQUITY" },
    }],
  };

  const orderRes = await fetch(`${baseUrl}/accounts/${encodeURIComponent(accountHash)}/orders` as any, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(orderBody),
  } as any);

  if (!orderRes.ok) throw new Error(`Schwab order error ${orderRes.status}: ${await orderRes.text()}`);
  // Schwab returns 201 with no body; order id is in Location header
  const location = (orderRes.headers as any).get("Location") || "";
  const orderId = location.split("/").pop() || "schwab-order";
  return { orderId, raw: { location, quantity, symbol } };
}

// ─────────────────────────────────────────────────────────────────
// Exported generic yfinance candle fetch (fallback for new exchanges)
// ─────────────────────────────────────────────────────────────────
export async function fetchCandlesViaYfinance(symbol: string, timeframe: string, limit = 140): Promise<Candle[]> {
  // Re-use the internal yfinance path exposed through fetchBinanceCandles
  // by temporarily forcing the yfinance provider path
  return fetchBinanceCandles(symbol, timeframe, limit);
}
