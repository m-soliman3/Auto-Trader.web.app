import admin from "../infra/firebase";
import { BotDoc, ExchangeDoc, StrategyDoc, TradeSide } from "../types/domain";
import { marketSessionForExchange } from "./marketSession";
import { placeAlpacaOrder, placeBinanceOrder } from "./marketData";
import { getBot, getExchangeByLabel, getStrategy, updateBot, updateStrategy, writeExecution } from "./repository";

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExecutionMetrics(rawOrder: any, fallbackInvestment: number): {
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

  return {
    executionPrice,
    shareQuantity,
    totalAmount,
  };
}

export async function executeStrategyOrder(uid: string, strategyId: string, sideOverride?: TradeSide) {
  const strategy = await getStrategy(uid, strategyId);
  if (!strategy) throw new Error("Strategy not found");
  if ((strategy.status || "active") !== "active") throw new Error("Strategy must be active before execution");

  const botId = strategy.assignedBotId;
  if (!botId) throw new Error("Strategy has no assigned bot");

  const bot = await getBot(uid, botId);
  if (!bot) throw new Error("Assigned bot not found");
  if ((bot.status || "paused") !== "active") throw new Error("Bot must be active before execution");

  const exchange = await getExchangeByLabel(uid, bot.exchangeLabel);
  if (!exchange) throw new Error("Exchange connection not found");

  const exchangeId = String(bot.exchangeId || exchange.exchangeId || "");
  const apiKey = String(exchange.apiKey || "").replace(/\s+/g, "");
  const apiSecret = String(exchange.secret || "").replace(/\s+/g, "");
  const symbol = String(bot.symbol || "");
  const investment = Number(bot.investment || 0);

  if (!exchangeId || !apiKey || !apiSecret) throw new Error("Missing exchange credentials");
  if (!symbol || !Number.isFinite(investment) || investment <= 0) throw new Error("Bot symbol or investment is invalid");

  const session = marketSessionForExchange(exchangeId, symbol, new Date());
  if (!session.isOpen) throw new Error(`Execution blocked: ${session.reason}`);

  const configuredSide: TradeSide = strategy.tradeSide === "sell" ? "sell" : "buy";
  const side: TradeSide = sideOverride === "sell" || sideOverride === "buy" ? sideOverride : configuredSide;

  let orderResult: { orderId: string; raw: any };
  if (exchangeId === "binance") {
    orderResult = await placeBinanceOrder({ apiKey, apiSecret, symbol, side, investment });
  } else if (exchangeId === "alpaca" || exchangeId === "alpaca-paper") {
    orderResult = await placeAlpacaOrder({ exchangeId, apiKey, apiSecret, symbol, side, investment });
  } else {
    throw new Error(`Exchange ${exchangeId} is not yet supported`);
  }

  const now = new Date().toISOString();
  const metrics = normalizeExecutionMetrics(orderResult.raw, investment);
  await updateBot(uid, botId, { trades: Number(bot.trades || 0) + 1, updatedAt: now });
  await updateStrategy(uid, strategyId, { lastExecutionAt: now, updatedAt: now });
  await writeExecution(uid, {
    strategyId,
    strategyName: strategy.name || "Strategy",
    botId,
    botName: bot.name || "Bot",
    exchangeId,
    side,
    symbol,
    investment,
    orderId: orderResult.orderId,
    rawOrder: orderResult.raw,
    executionPrice: metrics.executionPrice,
    shareQuantity: metrics.shareQuantity,
    totalAmount: metrics.totalAmount,
    executedAt: now,
  });

  return {
    success: true,
    side,
    orderId: orderResult.orderId,
    executedAt: now,
    message: `${side.toUpperCase()} order executed successfully`,
  };
}

export function timeframeToMs(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };
  return map[String(timeframe || "")] ?? 60 * 1000;
}

export function shouldRunByTimeframe(strategy: StrategyDoc, bot: BotDoc, nowMs: number): boolean {
  const cadence = timeframeToMs(bot.timeframe);
  const lastExecutionMs = strategy.lastExecutionAt ? new Date(strategy.lastExecutionAt).getTime() : NaN;

  if (Number.isFinite(lastExecutionMs) && lastExecutionMs > 0) {
    return nowMs - lastExecutionMs >= cadence;
  }

  const activationRaw = strategy.activatedAt || strategy.updatedAt || strategy.createdAt;
  const activationMs = new Date(String(activationRaw || "")).getTime();
  if (!Number.isFinite(activationMs) || activationMs <= 0) return false;

  return nowMs - activationMs >= cadence;
}
