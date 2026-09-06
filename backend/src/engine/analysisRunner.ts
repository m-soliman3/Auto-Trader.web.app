import { config } from "../infra/config";
import { Candle } from "../types/domain";
import { analyzeCandles, AnalysisSnapshot } from "./analysis";
import { classifyAsset, forexSession, toYahooForexTicker } from "./analysisAssets";
import { getAnalysisSnapshot, saveAnalysisSnapshot, symbolsFromActiveStrategies } from "./analysisRepository";
import { fetchAlpacaStockBars, fetchBinanceCandles, fetchCandlesViaYfinance } from "./marketData";
import { marketSessionForExchange } from "./marketSession";

export interface AnalysisRunSummary {
  ranAt: string;
  requested: number;
  analyzed: number;
  skippedMarketClosed: number;
  analyzedWhileClosed: number;
  failed: number;
  durationMs: number;
  results: Array<{ symbol: string; timeframe: string; status: string; stance?: string; error?: string }>;
}

export interface WatchTarget {
  symbol: string;
  timeframe: string;
}

/**
 * The watchlist is the union of an operator-configured list and every symbol an
 * active strategy trades, so newly created bots are covered without a redeploy.
 */
export function configuredWatchlist(): WatchTarget[] {
  const symbols = config.analysisSymbols;
  const timeframes = config.analysisTimeframes;
  const targets: WatchTarget[] = [];
  for (const symbol of symbols) {
    for (const timeframe of timeframes) targets.push({ symbol, timeframe });
  }
  return targets;
}

function dedupe(targets: WatchTarget[]): WatchTarget[] {
  const seen = new Map<string, WatchTarget>();
  for (const target of targets) {
    const symbol = target.symbol.toUpperCase().trim();
    if (!symbol || !target.timeframe) continue;
    seen.set(`${symbol}_${target.timeframe}`, { symbol, timeframe: target.timeframe });
  }
  return [...seen.values()];
}

async function fetchCandles(symbol: string, timeframe: string): Promise<Candle[]> {
  // 200 bars keeps every indicator in `buildMarketContext` well past its warm-up.
  switch (classifyAsset(symbol)) {
    case "crypto":
      return fetchBinanceCandles(symbol, timeframe, 200);
    case "forex":
      // Passing the `=X` ticker directly: it has no slash, so the shared
      // yfinance normaliser leaves it alone instead of rewriting it to the
      // crypto form `EUR-USD`, which resolves to a different instrument.
      return fetchCandlesViaYfinance(toYahooForexTicker(symbol), timeframe, 200);
    default:
      // With MARKET_DATA_PROVIDER=yfinance this resolves without broker credentials.
      return fetchAlpacaStockBars("", "", symbol, timeframe, 200);
  }
}

function sessionFor(symbol: string): { isOpen: boolean; reason: string } {
  const assetClass = classifyAsset(symbol);
  if (assetClass === "forex") return forexSession(new Date());
  const exchangeId = assetClass === "crypto" ? "binance" : "alpaca";
  return marketSessionForExchange(exchangeId, symbol, new Date());
}

/**
 * Analyses every watchlist target once and persists the snapshots.
 *
 * Closed markets are analysed too. Someone asking about AAPL on a Sunday still
 * wants Friday's RSI and moving averages; the snapshot carries
 * `marketOpen: false` and its own timestamp so the answer stays honest about
 * what it is. The trading runner must skip closed markets because it cannot
 * place an order — reading indicators has no such constraint.
 *
 * While a market is closed the bars do not change, so a symbol is re-analysed
 * only once its stored snapshot has aged past
 * `ANALYSIS_CLOSED_REFRESH_MINUTES`. That keeps a weekend of 5-minute ticks
 * from re-fetching the same closing bars hundreds of times.
 */
export async function runAnalysisOnce(extra: WatchTarget[] = []): Promise<AnalysisRunSummary> {
  const started = Date.now();
  const ranAt = new Date().toISOString();

  const fromStrategies = config.analysisIncludeStrategySymbols
    ? await symbolsFromActiveStrategies().catch(() => [] as WatchTarget[])
    : [];
  const targets = dedupe([...configuredWatchlist(), ...fromStrategies, ...extra]);

  let analyzed = 0;
  let skippedMarketClosed = 0;
  let analyzedWhileClosed = 0;
  let failed = 0;
  const results: AnalysisRunSummary["results"] = [];

  for (const target of targets) {
    const session = sessionFor(target.symbol);

    if (!session.isOpen) {
      if (!config.analysisWhenClosed) {
        skippedMarketClosed++;
        results.push({ ...target, status: "market-closed" });
        continue;
      }

      const existing = await getAnalysisSnapshot(target.symbol, target.timeframe).catch(() => null);
      const ageMinutes = existing ? (Date.now() - Date.parse(existing.ranAt)) / 60_000 : Infinity;
      if (ageMinutes < config.analysisClosedRefreshMinutes) {
        skippedMarketClosed++;
        results.push({ ...target, status: "closed-cached", stance: existing?.stance });
        continue;
      }
      analyzedWhileClosed++;
    }

    try {
      const candles = await fetchCandles(target.symbol, target.timeframe);
      const snapshot: AnalysisSnapshot | null = analyzeCandles(
        target.symbol,
        target.timeframe,
        candles,
        session,
      );

      if (!snapshot) {
        failed++;
        results.push({ ...target, status: "insufficient-data", error: `${candles.length} candles` });
        continue;
      }

      await saveAnalysisSnapshot(snapshot);
      analyzed++;
      results.push({
        ...target,
        status: session.isOpen ? "analyzed" : "analyzed-closed",
        stance: snapshot.stance,
      });
    } catch (error: any) {
      failed++;
      results.push({ ...target, status: "failed", error: String(error?.message || error) });
    }
  }

  return {
    ranAt,
    requested: targets.length,
    analyzed,
    skippedMarketClosed,
    analyzedWhileClosed,
    failed,
    durationMs: Date.now() - started,
    results,
  };
}
