import admin from "../infra/firebase";
import { executeStrategyOrder, shouldRunByTimeframe } from "./execution";
import { marketSessionForExchange } from "./marketSession";
import { listActiveStrategies, getBot, getExchangeByLabel, saveRunnerSummary, updateStrategy } from "./repository";
import { evaluateStrategySignal } from "./signals";

export interface RunnerSummary {
  totalActiveStrategies: number;
  executed: number;
  skipped: number;
  skippedMarketClosed: number;
  failed: number;
  ranAt: string;
}

export async function runActiveStrategiesOnce(): Promise<RunnerSummary> {
  const nowMs = Date.now();
  const active = await listActiveStrategies();

  let executed = 0;
  let skipped = 0;
  let skippedMarketClosed = 0;
  let failed = 0;

  for (const item of active) {
    const { uid, strategyId, strategy } = item;
    if (!uid || !strategyId) {
      skipped++;
      continue;
    }

    const botId = strategy.assignedBotId;
    if (!botId) {
      skipped++;
      continue;
    }

    const bot = await getBot(uid, botId);
    if (!bot || bot.status !== "active") {
      skipped++;
      continue;
    }

    const exchange = await getExchangeByLabel(uid, bot.exchangeLabel);
    const exchangeId = String(bot.exchangeId || exchange?.exchangeId || "");
    if (!exchange || !exchangeId) {
      skipped++;
      continue;
    }

    const session = marketSessionForExchange(exchangeId, bot.symbol, new Date(nowMs));
    if (!session.isOpen) {
      skipped++;
      skippedMarketClosed++;
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
    } catch (error: any) {
      failed++;
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
    ranAt: new Date().toISOString(),
  };

  await saveRunnerSummary(summary);
  return summary;
}
