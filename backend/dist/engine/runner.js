"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runActiveStrategiesOnce = runActiveStrategiesOnce;
const firebase_1 = __importDefault(require("../infra/firebase"));
const execution_1 = require("./execution");
const marketSession_1 = require("./marketSession");
const repository_1 = require("./repository");
const signals_1 = require("./signals");
async function runActiveStrategiesOnce() {
    const nowMs = Date.now();
    const active = await (0, repository_1.listActiveStrategies)();
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
        const bot = await (0, repository_1.getBot)(uid, botId);
        if (!bot || bot.status !== "active") {
            skipped++;
            continue;
        }
        const exchange = await (0, repository_1.getExchangeByLabel)(uid, bot.exchangeLabel);
        const exchangeId = String(bot.exchangeId || exchange?.exchangeId || "");
        if (!exchange || !exchangeId) {
            skipped++;
            continue;
        }
        const session = (0, marketSession_1.marketSessionForExchange)(exchangeId, bot.symbol, new Date(nowMs));
        if (!session.isOpen) {
            skipped++;
            skippedMarketClosed++;
            await (0, repository_1.updateStrategy)(uid, strategyId, {
                lastEvaluationAt: new Date().toISOString(),
                lastEvaluationStatus: "market-closed",
                lastEvaluationReason: session.reason,
                updatedAt: new Date().toISOString(),
            });
            continue;
        }
        if (!(0, execution_1.shouldRunByTimeframe)(strategy, bot, nowMs)) {
            skipped++;
            continue;
        }
        let signalSide = String(strategy.pendingSignal?.side || "").toLowerCase();
        if (signalSide !== "buy" && signalSide !== "sell") {
            const generated = await (0, signals_1.evaluateStrategySignal)(strategy, bot, exchangeId, exchange);
            if (generated) {
                const nowIso = new Date().toISOString();
                await (0, repository_1.updateStrategy)(uid, strategyId, {
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
            await (0, execution_1.executeStrategyOrder)(uid, strategyId, signalSide);
            await (0, repository_1.updateStrategy)(uid, strategyId, {
                pendingSignal: firebase_1.default.firestore.FieldValue.delete(),
                lastEvaluationAt: new Date().toISOString(),
                lastEvaluationStatus: "executed",
                lastProcessedSignalAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            executed++;
        }
        catch (error) {
            failed++;
            await (0, repository_1.updateStrategy)(uid, strategyId, {
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
    const summary = {
        totalActiveStrategies: active.length,
        executed,
        skipped,
        skippedMarketClosed,
        failed,
        ranAt: new Date().toISOString(),
    };
    await (0, repository_1.saveRunnerSummary)(summary);
    return summary;
}
