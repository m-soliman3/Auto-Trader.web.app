export type StrategyStatus = "active" | "paused";
export type TradeSide = "buy" | "sell";
export type StrategyTradeSide = "buy" | "sell" | "buySell";

export interface StrategyDoc {
  id: string;
  name: string;
  templateId: string;
  status: StrategyStatus;
  tradeSide: StrategyTradeSide;
  /** Legacy: ID of a separately-stored bot document. May be absent in the unified model. */
  assignedBotId?: string;
  /** Unified model: bot config stored inline on the strategy. */
  exchangeId?: string;
  exchangeLabel?: string;
  symbol?: string;
  timeframe?: string;
  investment?: number;
  accountMode?: "paper" | "real";
  updatedAt?: string;
  createdAt?: string;
  activatedAt?: string;
  lastExecutionAt?: string;
  pendingSignal?: {
    side: TradeSide;
    reason: string;
    detectedAt: string;
    source: string;
    templateId: string;
  };
}

export interface BotDoc {
  id: string;
  name: string;
  status: "active" | "paused" | "stopped";
  exchangeLabel: string;
  exchangeId: string;
  symbol: string;
  timeframe: string;
  investment: number;
  trades?: number;
}

export interface ExchangeDoc {
  exchangeId: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
  brokerProvisioned?: boolean;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  side: TradeSide;
  reason: string;
}
