/**
 * Asset-class routing for the analysis runner.
 *
 * Forex pairs and crypto pairs are both written `BASE/QUOTE`, but they need
 * different tickers upstream, and getting it wrong fails *silently*:
 * `normalizeSymbolForYfinance("EUR/USD")` yields `EUR-USD`, which Yahoo
 * resolves to a crypto token trading near 1.10 rather than the EUR/USD rate
 * near 1.16. Both return data, so nothing errors — the analysis is just wrong.
 * Hence an explicit currency list rather than a "contains a slash" guess.
 */

export type AnalysisAssetClass = "stock" | "crypto" | "forex";

/** ISO-4217 codes routed to Yahoo's `=X` forex tickers. */
const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "ZAR",
  "MXN", "SGD", "HKD", "CNY", "CNH", "INR", "BRL", "KRW",
]);

export function splitPair(symbol: string): [string, string] | null {
  const parts = symbol.toUpperCase().trim().split("/");
  if (parts.length !== 2) return null;
  const [base, quote] = parts.map((p) => p.replace(/[^A-Z0-9]/g, ""));
  return base && quote ? [base, quote] : null;
}

export function classifyAsset(symbol: string): AnalysisAssetClass {
  const pair = splitPair(symbol);
  if (!pair) return "stock";
  const [base, quote] = pair;
  // Both legs a national currency means forex. A crypto quoted in USD (BTC/USD)
  // has a non-fiat base and stays crypto.
  return FIAT.has(base) && FIAT.has(quote) ? "forex" : "crypto";
}

/** `EUR/USD` -> `EURUSD=X`, the only ticker Yahoo serves FX rates under. */
export function toYahooForexTicker(symbol: string): string {
  const pair = splitPair(symbol);
  if (!pair) return symbol.toUpperCase();
  return `${pair[0]}${pair[1]}=X`;
}

function easternParts(now: Date): { weekday: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  return {
    weekday: map.weekday || "",
    hour: Number.parseInt(map.hour || "0", 10),
    minute: Number.parseInt(map.minute || "0", 10),
  };
}

/**
 * The FX week runs continuously from Sunday 17:00 ET to Friday 17:00 ET.
 * Expressed in Eastern time so it tracks US daylight saving automatically,
 * matching how `marketSession.ts` handles equities.
 */
export function forexSession(now = new Date()): { isOpen: boolean; reason: string } {
  const { weekday, hour } = easternParts(now);
  if (weekday === "Sat") {
    return { isOpen: false, reason: "Forex market is closed from Fri 17:00 ET to Sun 17:00 ET." };
  }
  if (weekday === "Fri" && hour >= 17) {
    return { isOpen: false, reason: "Forex market closed for the week at Fri 17:00 ET." };
  }
  if (weekday === "Sun" && hour < 17) {
    return { isOpen: false, reason: "Forex market reopens Sun 17:00 ET." };
  }
  return { isOpen: true, reason: "Forex market is open (Sun 17:00 ET – Fri 17:00 ET)." };
}
