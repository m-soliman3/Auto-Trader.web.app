/**
 * Offline check for the analysis engine: pulls real bars from Alpaca's
 * no-auth crypto endpoint and runs them through `analyzeCandles`.
 * Run with: npx tsx src/tools/analysisSmoke.ts
 */
import { analyzeCandles } from "../engine/analysis";
import { Candle } from "../types/domain";

const BAR_MS: Record<string, number> = { "1Hour": 3_600_000, "1Day": 86_400_000 };

async function fetchCryptoBars(pair: string, timeframe: string, limit: number): Promise<Candle[]> {
  // Alpaca defaults `start` to the beginning of the current day, so a daily
  // request without it returns a single bar.
  const start = new Date(Date.now() - BAR_MS[timeframe] * limit * 1.1).toISOString();
  const url =
    `https://data.alpaca.markets/v1beta3/crypto/us/bars` +
    `?symbols=${encodeURIComponent(pair)}&timeframe=${timeframe}&limit=${limit}` +
    `&start=${encodeURIComponent(start)}&sort=asc`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload: any = await response.json();
  return (payload?.bars?.[pair] ?? []).map((b: any) => ({
    time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
  }));
}

async function main() {
  for (const [pair, tf] of [["BTC/USD", "1Day"], ["ETH/USD", "1Hour"]] as const) {
    const candles = await fetchCryptoBars(pair, tf, 300);
    const snapshot = analyzeCandles(pair, tf, candles, { isOpen: true, reason: "Crypto is 24/7." });
    if (!snapshot) { console.log(`${pair}: insufficient data (${candles.length} candles)`); continue; }

    console.log(`\n===== ${pair} ${tf} — ${candles.length} candles =====`);
    console.log(snapshot.summary);
    console.log("\nindicators:", JSON.stringify(snapshot.indicators, null, 2));
    console.log("\nfiring templates:",
      snapshot.verdicts.filter((v) => v.side).map((v) => `${v.name}=${v.side} (${v.reason})`).join(" | ") || "none");
    console.log("quiet templates:", snapshot.verdicts.filter((v) => !v.side).length);
    console.log("\nrationale:"); snapshot.rationale.forEach((r) => console.log("  -", r));
    console.log(`\nstance=${snapshot.stance} score=${snapshot.score}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
