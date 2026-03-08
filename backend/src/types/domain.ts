export type StrategyStatus = "active" | "paused";
export type TradeSide = "buy" | "sell";

export interface StrategyDoc {
  id: string;
  name: string;
  templateId: string;
  status: StrategyStatus;
  tradeSide: TradeSide;
  assignedBotId: string;
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
