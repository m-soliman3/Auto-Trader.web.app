import { db } from "../infra/firebase";
import { BotDoc, ExchangeDoc, StrategyDoc } from "../types/domain";
import { RunnerSummary } from "./runner";

export async function listActiveStrategies(): Promise<Array<{ uid: string; strategyId: string; strategy: StrategyDoc }>> {
  const usersSnap = await db.collection("users").get();
  const result: Array<{ uid: string; strategyId: string; strategy: StrategyDoc }> = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const strategiesSnap = await db.collection(`users/${uid}/strategies`).where("status", "==", "active").get();
    for (const strategyDoc of strategiesSnap.docs) {
      result.push({
        uid,
        strategyId: strategyDoc.id,
        strategy: strategyDoc.data() as StrategyDoc,
      });
    }
  }

  return result;
}

export async function getStrategy(uid: string, strategyId: string): Promise<StrategyDoc | null> {
  const snap = await db.doc(`users/${uid}/strategies/${strategyId}`).get();
  return snap.exists ? (snap.data() as StrategyDoc) : null;
}

export async function getBot(uid: string, botId: string): Promise<BotDoc | null> {
  const snap = await db.doc(`users/${uid}/bots/${botId}`).get();
  return snap.exists ? (snap.data() as BotDoc) : null;
}

export async function getExchangeByLabel(uid: string, exchangeLabel: string): Promise<ExchangeDoc | null> {
  const snap = await db.doc(`users/${uid}/exchanges/${exchangeLabel}`).get();
  return snap.exists ? (snap.data() as ExchangeDoc) : null;
}

export async function writeExecution(
  uid: string,
  payload: {
    strategyId: string;
    strategyName: string;
    botId: string;
    botName: string;
    exchangeId: string;
    side: "buy" | "sell";
    symbol: string;
    investment: number;
    orderId: string;
    rawOrder: any;
    executionPrice?: number | null;
    shareQuantity?: number | null;
    totalAmount?: number | null;
    executedAt: string;
  },
): Promise<void> {
  await db.collection(`users/${uid}/executions`).add(payload);
}

export async function updateStrategy(uid: string, strategyId: string, updates: Record<string, unknown>): Promise<void> {
  await db.doc(`users/${uid}/strategies/${strategyId}`).set(updates, { merge: true });
}

export async function updateBot(uid: string, botId: string, updates: Record<string, unknown>): Promise<void> {
  await db.doc(`users/${uid}/bots/${botId}`).set(updates, { merge: true });
}

export async function saveRunnerSummary(summary: RunnerSummary): Promise<void> {
  await db.collection("backendRunnerSummaries").add(summary);
}

export async function saveUserRunnerSummary(uid: string, summary: RunnerSummary): Promise<void> {
  await db.collection(`users/${uid}/runnerSummaries`).add(summary);
}

export async function getRecentRunnerSummaries(limit = 20): Promise<RunnerSummary[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const snap = await db
    .collection("backendRunnerSummaries")
    .orderBy("ranAt", "desc")
    .limit(boundedLimit)
    .get();

  return snap.docs.map((doc) => doc.data() as RunnerSummary);
}

export async function getRecentUserRunnerSummaries(uid: string, limit = 20): Promise<RunnerSummary[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const snap = await db
    .collection(`users/${uid}/runnerSummaries`)
    .orderBy("ranAt", "desc")
    .limit(boundedLimit)
    .get();

  return snap.docs.map((doc) => doc.data() as RunnerSummary);
}
