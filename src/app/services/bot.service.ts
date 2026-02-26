import { Injectable, signal, computed } from '@angular/core';

export type BotStatus = 'active' | 'paused' | 'stopped';

export interface Bot {
  id: string;
  name: string;
  strategyId: string;
  strategyName: string;
  exchangeLabel: string;
  exchangeId: string;
  symbol: string;
  timeframe: string;
  investment: number;
  stopLoss: number;
  takeProfit: number;
  status: BotStatus;
  trades: number;
  pnl: number;
  createdAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  icon: string;
  desc: string;
  risk: 'Low' | 'Medium' | 'High';
  riskColor: string;
  detail: string;
}

export const STRATEGIES: Strategy[] = [
  {
    id: 'dca',
    name: 'DCA (Dollar Cost Avg)',
    icon: '📅',
    desc: 'Buy fixed amounts at regular intervals, reducing average entry price over time.',
    risk: 'Low',
    riskColor: '#00d17a',
    detail: 'Best for long-term accumulation. Works well in volatile markets.',
  },
  {
    id: 'grid',
    name: 'Grid Trading',
    icon: '⚡',
    desc: 'Place buy/sell orders at set intervals to profit from price oscillations.',
    risk: 'Medium',
    riskColor: '#F7A600',
    detail: 'Great for ranging / sideways markets. Profits from both directions.',
  },
  {
    id: 'trend',
    name: 'Trend Following',
    icon: '📈',
    desc: 'Enter trades in the direction of the prevailing trend using moving averages.',
    risk: 'Medium',
    riskColor: '#F7A600',
    detail: 'Riding momentum. Uses EMA crossovers for entry and exit signals.',
  },
  {
    id: 'rsi',
    name: 'RSI Reversal',
    icon: '🔄',
    desc: 'Buy oversold and sell overbought conditions detected by the RSI indicator.',
    risk: 'Medium',
    riskColor: '#F7A600',
    detail: 'Counter-trend strategy. RSI thresholds configurable (default 30/70).',
  },
  {
    id: 'scalping',
    name: 'Scalping',
    icon: '⚡',
    desc: 'Exploit tiny price movements with high-frequency, short-duration trades.',
    risk: 'High',
    riskColor: '#ef4444',
    detail: 'High trade frequency on 1–5 min charts. Requires tight spreads.',
  },
  {
    id: 'mean',
    name: 'Mean Reversion',
    icon: '🎯',
    desc: 'Bet that prices will revert to their statistical average after deviation.',
    risk: 'High',
    riskColor: '#ef4444',
    detail: 'Uses Bollinger Bands or Z-score to identify extreme deviations.',
  },
];

export const SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT',
  'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOGE/USDT',
  'AAPL', 'TSLA', 'SPY', 'QQQ',
];

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

@Injectable({ providedIn: 'root' })
export class BotService {
  private readonly KEY = 'at_bots';

  bots = signal<Bot[]>(this.load());

  activeBots = computed(() => this.bots().filter(b => b.status === 'active'));

  add(bot: Bot) {
    this.bots.update(list => {
      const updated = [bot, ...list];
      localStorage.setItem(this.KEY, JSON.stringify(updated));
      return updated;
    });
  }

  setStatus(id: string, status: BotStatus) {
    this.bots.update(list => {
      const updated = list.map(b => b.id === id ? { ...b, status } : b);
      localStorage.setItem(this.KEY, JSON.stringify(updated));
      return updated;
    });
  }

  remove(id: string) {
    this.bots.update(list => {
      const updated = list.filter(b => b.id !== id);
      localStorage.setItem(this.KEY, JSON.stringify(updated));
      return updated;
    });
  }

  private load(): Bot[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) ?? '[]');
    } catch {
      return [];
    }
  }
}
