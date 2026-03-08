import { db } from "../infra/firebase";

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExecutionMetrics(rawOrder: unknown, fallbackInvestment: number): {
  executionPrice: number | null;
  shareQuantity: number | null;
  totalAmount: number | null;
} {
  const raw = (rawOrder ?? {}) as Record<string, unknown>;

  let executionPrice = [
    raw["filled_avg_price"],
    raw["avg_execution_price"],
    raw["average_price"],
    raw["avgPrice"],
    raw["price"],
  ]
    .map(toFiniteNumber)
    .find((value): value is number => !!value && value > 0) ?? null;

  let shareQuantity = [
    raw["filled_qty"],
    raw["qty"],
    raw["executedQty"],
    raw["origQty"],
    raw["filled"],
    raw["size"],
  ]
    .map(toFiniteNumber)
    .find((value): value is number => !!value && value > 0) ?? null;

  let totalAmount = [
    raw["filled_notional"],
    raw["notional"],
    raw["cummulativeQuoteQty"],
    raw["executed_value"],
    raw["amount"],
  ]
    .map(toFiniteNumber)
    .find((value): value is number => !!value && value > 0) ?? null;

  if (!executionPrice) {
    const fills = Array.isArray(raw["fills"]) ? (raw["fills"] as Array<Record<string, unknown>>) : [];
    if (fills.length > 0) {
      let quoteSum = 0;
      let qtySum = 0;
      for (const fill of fills) {
        const price = toFiniteNumber(fill["price"]) ?? 0;
        const qty = toFiniteNumber(fill["qty"]) ?? 0;
        if (price > 0 && qty > 0) {
          quoteSum += price * qty;
          qtySum += qty;
        }
      }
      if (qtySum > 0) {
        executionPrice = quoteSum / qtySum;
        if (!shareQuantity) shareQuantity = qtySum;
        if (!totalAmount) totalAmount = quoteSum;
      }
    }
  }

  if (!totalAmount && executionPrice && shareQuantity) totalAmount = executionPrice * shareQuantity;
  if (!executionPrice && totalAmount && shareQuantity && shareQuantity > 0) executionPrice = totalAmount / shareQuantity;
  if (!shareQuantity && totalAmount && executionPrice && executionPrice > 0) shareQuantity = totalAmount / executionPrice;
  if (!totalAmount && Number.isFinite(fallbackInvestment) && fallbackInvestment > 0) totalAmount = fallbackInvestment;

  return { executionPrice, shareQuantity, totalAmount };
}

function hasPositiveMetric(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

async function runBackfill() {
  console.log("Starting execution metrics backfill...");

  const usersSnap = await db.collection("users").get();
  let usersProcessed = 0;
  let docsScanned = 0;
  let docsUpdated = 0;

  for (const userDoc of usersSnap.docs) {
    usersProcessed += 1;
    const uid = userDoc.id;
    const executionsRef = db.collection(`users/${uid}/executions`);
    const executionsSnap = await executionsRef.get();

    if (executionsSnap.empty) {
      continue;
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const executionDoc of executionsSnap.docs) {
      docsScanned += 1;
      const data = executionDoc.data() as Record<string, unknown>;

      const alreadyHasAll = hasPositiveMetric(data.executionPrice)
        && hasPositiveMetric(data.shareQuantity)
        && hasPositiveMetric(data.totalAmount);
      if (alreadyHasAll) {
        continue;
      }

      const investment = Number(data.investment ?? 0);
      const metrics = normalizeExecutionMetrics(data.rawOrder, investment);

      const updatePayload: Record<string, number> = {};
      if (metrics.executionPrice && metrics.executionPrice > 0) {
        updatePayload.executionPrice = metrics.executionPrice;
      }
      if (metrics.shareQuantity && metrics.shareQuantity > 0) {
        updatePayload.shareQuantity = metrics.shareQuantity;
      }
      if (metrics.totalAmount && metrics.totalAmount > 0) {
        updatePayload.totalAmount = metrics.totalAmount;
      }

      if (Object.keys(updatePayload).length === 0) {
        continue;
      }

      batch.update(executionDoc.ref, updatePayload);
      batchCount += 1;
      docsUpdated += 1;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  console.log("Backfill completed.");
  console.log(`Users processed: ${usersProcessed}`);
  console.log(`Execution docs scanned: ${docsScanned}`);
  console.log(`Execution docs updated: ${docsUpdated}`);
}

runBackfill()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
