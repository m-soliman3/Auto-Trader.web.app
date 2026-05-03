import admin from "../infra/firebase";
import { executeStrategyOrder, shouldRunByTimeframe } from "./execution";
import { marketSessionForExchange } from "./marketSession";
import { listActiveStrategies, getBot, getExchangeByLabel, saveRunnerSummary, saveUserRunnerSummary, updateStrategy } from "./repository";
import { evaluateStrategySignal } from "./signals";

export interface RunnerSummary {
  totalActiveStrategies: number;
  executed: number;
  skipped: number;
  skippedMarketClosed: number;
  failed: number;
  ranAt: string;
}

/** Per-user stat bucket accumulated during a single runner pass. */
interface UserStats {
  totalActiveStrategies: number;
  executed: number;
  skipped: number;
  skippedMarketClosed: number;
  failed: number;
}

function emptyUserStats(): UserStats {
  return { totalActiveStrategies: 0, executed: 0, skipped: 0, skippedMarketClosed: 0, failed: 0 };
}

export async function runActiveStrategiesOnce(): Promise<RunnerSummary> {
  const nowMs = Date.now();
  const ranAt = new Date().toISOString();
  const active = await listActiveStrategies();

  let executed = 0;
  let skipped = 0;
  let skippedMarketClosed = 0;
  let failed = 0;

  // Track per-user stats so each user sees only their own runner history.
  const perUser = new Map<string, UserStats>();

  for (const item of active) {
    const { uid, strategyId, strategy } = item;

    // Ensure a stats bucket exists for this user.
    if (uid && !perUser.has(uid)) {
      perUser.set(uid, emptyUserStats());
    }
    const userStats = uid ? perUser.get(uid)! : null;
    if (userStats) userStats.totalActiveStrategies++;

    if (!uid || !strategyId) {
      skipped++;
      if (userStats) userStats.skipped++;
      continue;
    }

    const botId = strategy.assignedBotId;
    if (!botId) {
      skipped++;
      userStats!.skipped++;
      continue;
    }

    const bot = await getBot(uid, botId);
    if (!bot || bot.status !== "active") {
      skipped++;
      userStats!.skipped++;
      continue;
    }

    const exchange = await getExchangeByLabel(uid, bot.exchangeLabel);
    const exchangeId = String(bot.exchangeId || exchange?.exchangeId || "");
    if (!exchange || !exchangeId) {
      skipped++;
      userStats!.skipped++;
      continue;
    }

    const session = marketSessionForExchange(exchangeId, bot.symbol, new Date(nowMs));
    if (!session.isOpen) {
      skipped++;
      skippedMarketClosed++;
      userStats!.skipped++;
      userStats!.skippedMarketClosed++;
      await updateStrategy(uid, strategyId, {
        lastEvaluationAt: new Date().toISOString(),
        lastEvaluationStatus: "market-closed",
        lastEvaluationReason: session.reason,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    if (!shouldRunByTimeframe(strategy, bot, nowMs)) {
      skipped++;
      userStats!.skipped++;
      continue;
    }

    let signalSide = String(strategy.pendingSignal?.side || "").toLowerCase();
    if (signalSide !== "buy" && signalSide !== "sell") {
      const generated = await evaluateStrategySignal(strategy, bot, exchangeId, exchange);
      if (generated) {
        const nowIso = new Date().toISOString();
        await updateStrategy(uid, strategyId, {
          pendingSignal: {
            side: generated.side,
            reason: generated.reason,
            detectedAt: nowIso,
            source: "cloud-run-evaluator",
            templateId: String(strategy.templateId || ""),
          },
          lastEvaluationAt: nowIso,
          lastEvaluationStatus: "signal-generated",
          lastEvaluationReason: generated.reason,
          updatedAt: nowIso,
        });
        signalSide = generated.side;
      }
    }

    if (signalSide !== "buy" && signalSide !== "sell") {
      skipped++;
      userStats!.skipped++;
      continue;
    }

    try {
      await executeStrategyOrder(uid, strategyId, signalSide as "buy" | "sell");
      await updateStrategy(uid, strategyId, {
        pendingSignal: admin.firestore.FieldValue.delete(),
        lastEvaluationAt: new Date().toISOString(),
        lastEvaluationStatus: "executed",
        lastProcessedSignalAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      executed++;
      userStats!.executed++;
    } catch (error: any) {
      failed++;
      userStats!.failed++;
      await updateStrategy(uid, strategyId, {
        lastEvaluationAt: new Date().toISOString(),
        lastEvaluationStatus: "execution-failed",
        lastEvaluationReason: error?.message || "unknown error",
        updatedAt: new Date().toISOString(),
      });
      console.error("runActiveStrategies execution error", {
        uid,
        strategyId,
        message: error?.message || "unknown error",
      });
    }
  }

  const summary: RunnerSummary = {
    totalActiveStrategies: active.length,
    executed,
    skipped,
    skippedMarketClosed,
    failed,
    ranAt,
  };

  // Save global summary (admin view) and per-user summaries in parallel.
  await Promise.all([
    saveRunnerSummary(summary),
    ...Array.from(perUser.entries()).map(([uid, stats]) =>
      saveUserRunnerSummary(uid, { ...stats, ranAt }),
    ),
  ]);

  return summary;
}

