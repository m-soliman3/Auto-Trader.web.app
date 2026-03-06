import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { Firestore, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from '@angular/fire/firestore';

export type RiskLevel  = 'Low' | 'Medium' | 'High';
export type MarketType = 'crypto' | 'stocks' | 'forex' | 'multi';
export type Category   = 'trend' | 'mean-reversion' | 'momentum' | 'arbitrage' | 'volatility' | 'income';

export interface StrategyTemplate {
  id: string;
  name: string;
  icon: string;
  shortDesc: string;
  longDesc: string;
  risk: RiskLevel;
  riskColor: string;
  category: Category;
  markets: MarketType[];
  tags: string[];
  winRate: number;        // percentage  e.g. 67
  avgReturn: number;      // monthly % e.g. 4.2
  maxDrawdown: number;    // percentage e.g. 12
  users: number;          // number of users running it
  minInvestment: number;  // USD
  timeframes: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  isNew?: boolean;
  isPopular?: boolean;
}

export interface UserStrategy {
  id: string;
  templateId: string;
  templateName: string;
  templateIcon: string;
  name: string;
  assignedBotId: string;
  assignedBotName: string;
  status: 'active' | 'paused';
  tradeSide: 'buy' | 'sell';
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastExecutionAt?: string;
}

export interface StrategyExecution {
  id: string;
  strategyId: string;
  strategyName: string;
  botId: string;
  botName: string;
  exchangeId: string;
  side: 'buy' | 'sell';
  symbol: string;
  investment: number;
  orderId: string;
  executedAt: string;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ── Trend ───────────────────────────────────────────────────────────────────
  {
    id: 'ema-crossover',
    name: 'EMA Crossover',
    icon: '📈',
    shortDesc: 'Enter trades when the fast EMA crosses above/below the slow EMA.',
    longDesc: 'Uses a 9/21 EMA crossover to capture trending moves. Golden cross triggers a long, death cross a short. Works best on 1h and 4h timeframes in strongly trending markets.',
    risk: 'Medium',
    riskColor: '#F7A600',
    category: 'trend',
    markets: ['crypto', 'stocks', 'forex'],
    tags: ['EMA', 'Trend', 'Crossover'],
    winRate: 58,
    avgReturn: 5.2,
    maxDrawdown: 14,
    users: 3840,
    minInvestment: 100,
    timeframes: ['1h', '4h', '1d'],
    difficulty: 'Beginner',
    isPopular: true,
  },
  {
    id: 'macd-trend',
    name: 'MACD Trend Rider',
    icon: '🚀',
    shortDesc: 'Ride macro trends using MACD histogram momentum shifts.',
    longDesc: 'Combines MACD signal line crossovers with histogram momentum to time entries in established trends. Exits on divergence. Filters out noise with ADX > 25.',
    risk: 'Medium',
    riskColor: '#F7A600',
    category: 'trend',
    markets: ['crypto', 'stocks'],
    tags: ['MACD', 'ADX', 'Momentum'],
    winRate: 54,
    avgReturn: 6.8,
    maxDrawdown: 18,
    users: 2210,
    minInvestment: 200,
    timeframes: ['4h', '1d'],
    difficulty: 'Intermediate',
    isPopular: true,
  },
  {
    id: 'supertrend',
    name: 'Supertrend Scalper',
    icon: '⚡',
    shortDesc: 'Fast trend-following using the Supertrend indicator.',
    longDesc: 'Uses ATR-based Supertrend flips as entry and exit signals. Designed for fast-moving markets on the 15m and 1h charts. Pairs well with volume confirmation.',
    risk: 'High',
    riskColor: '#ef4444',
    category: 'trend',
    markets: ['crypto', 'forex'],
    tags: ['Supertrend', 'ATR', 'Scalping'],
    winRate: 52,
    avgReturn: 9.1,
    maxDrawdown: 26,
    users: 1540,
    minInvestment: 500,
    timeframes: ['15m', '1h'],
    difficulty: 'Advanced',
  },
  // ── Mean Reversion ───────────────────────────────────────────────────────────
  {
    id: 'rsi-reversal',
    name: 'RSI Reversal',
    icon: '🔄',
    shortDesc: 'Buy oversold and sell overbought signals from the RSI.',
    longDesc: 'Enters long when RSI dips below 30 and short when RSI exceeds 70. Combines with Bollinger Bands for confirmation. Best in sideways/ranging markets.',
    risk: 'Medium',
    riskColor: '#F7A600',
    category: 'mean-reversion',
    markets: ['crypto', 'stocks', 'forex'],
    tags: ['RSI', 'Bollinger Bands', 'Counter-Trend'],
    winRate: 63,
    avgReturn: 3.9,
    maxDrawdown: 10,
    users: 4920,
    minInvestment: 100,
    timeframes: ['1h', '4h'],
    difficulty: 'Beginner',
    isPopular: true,
  },
  {
    id: 'bollinger-bounce',
    name: 'Bollinger Bounce',
    icon: '🎯',
    shortDesc: 'Trade mean reversion bounces off Bollinger Band extremes.',
    longDesc: 'Opens positions when price touches outer Bollinger Bands and closes as price returns to the middle band (20 SMA). Ideal for low-volatility, ranging pairs.',
    risk: 'Low',
    riskColor: '#00d17a',
    category: 'mean-reversion',
    markets: ['crypto', 'forex'],
    tags: ['Bollinger Bands', 'Mean Reversion', 'Ranging'],
    winRate: 66,
    avgReturn: 3.1,
    maxDrawdown: 8,
    users: 3100,
    minInvestment: 100,
    timeframes: ['1h', '4h', '1d'],
    difficulty: 'Beginner',
    isPopular: true,
  },
  {
    id: 'vwap-reversion',
    name: 'VWAP Reversion',
    icon: '📊',
    shortDesc: 'Trade pullbacks to the VWAP during trending sessions.',
    longDesc: 'Uses institutional VWAP as a mean-reversion anchor. Enters on pullbacks and fades extreme deviations. Particularly effective for stocks and high-liquidity crypto pairs during active sessions.',
    risk: 'Medium',
    riskColor: '#F7A600',
    category: 'mean-reversion',
    markets: ['stocks', 'crypto'],
    tags: ['VWAP', 'Intraday', 'Institutions'],
    winRate: 61,
    avgReturn: 4.4,
    maxDrawdown: 11,
    users: 1870,
    minInvestment: 250,
    timeframes: ['5m', '15m', '1h'],
    difficulty: 'Intermediate',
    isNew: true,
  },
  // ── Momentum ─────────────────────────────────────────────────────────────────
  {
    id: 'breakout',
    name: 'Breakout Momentum',
    icon: '💥',
    shortDesc: 'Enter long/short on confirmed breaks of key support/resistance.',
    longDesc: 'Detects consolidation ranges and fires entries on breakouts confirmed by volume surge. Targets a 2:1 R/R ratio. Uses ATR-based stop loss below the breakout level.',
    risk: 'High',
    riskColor: '#ef4444',
    category: 'momentum',
    markets: ['crypto', 'stocks'],
    tags: ['Breakout', 'Volume', 'S&R'],
    winRate: 49,
    avgReturn: 10.5,
    maxDrawdown: 24,
    users: 2640,
    minInvestment: 500,
    timeframes: ['1h', '4h', '1d'],
    difficulty: 'Intermediate',
    isPopular: true,
  },
  {
    id: 'dca',
    name: 'DCA Accumulator',
    icon: '📅',
    shortDesc: 'Buy fixed amounts at regular intervals to lower average entry.',
    longDesc: 'Dollar Cost Averaging strategy that purchases at fixed time intervals regardless of price, reducing impact of volatility. Optional RSI-weighted sizing buys more when RSI is low.',
    risk: 'Low',
    riskColor: '#00d17a',
    category: 'income',
    markets: ['crypto', 'stocks'],
    tags: ['DCA', 'Long-term', 'Accumulation'],
    winRate: 72,
    avgReturn: 2.8,
    maxDrawdown: 5,
    users: 8100,
    minInvestment: 50,
    timeframes: ['1d'],
    difficulty: 'Beginner',
    isPopular: true,
  },
  {
    id: 'momentum-roc',
    name: 'ROC Momentum',
    icon: '🎢',
    shortDesc: 'Trade strong momentum bursts detected by the Rate of Change indicator.',
    longDesc: 'Looks for assets with high positive ROC and enters in the direction of momentum. Exits when ROC decelerates or reverses. Works best on daily and 4h for crypto and stocks.',
    risk: 'High',
    riskColor: '#ef4444',
    category: 'momentum',
    markets: ['crypto', 'stocks'],
    tags: ['ROC', 'Momentum', 'Velocity'],
    winRate: 51,
    avgReturn: 11.3,
    maxDrawdown: 28,
    users: 980,
    minInvestment: 500,
    timeframes: ['4h', '1d'],
    difficulty: 'Advanced',
    isNew: true,
  },
  // ── Volatility ────────────────────────────────────────────────────────────────
  {
    id: 'grid',
    name: 'Grid Trading',
    icon: '🔲',
    shortDesc: 'Place laddered buy/sell orders to profit from price oscillations.',
    longDesc: 'Establishes a grid of limit orders above and below current price. Profits from each oscillation within the range. No trend prediction needed — ideal for sideways markets.',
    risk: 'Low',
    riskColor: '#00d17a',
    category: 'volatility',
    markets: ['crypto', 'forex'],
    tags: ['Grid', 'Range', 'Passive'],
    winRate: 74,
    avgReturn: 3.6,
    maxDrawdown: 7,
    users: 6700,
    minInvestment: 200,
    timeframes: ['15m', '1h'],
    difficulty: 'Beginner',
    isPopular: true,
  },
  {
    id: 'scalping',
    name: 'High-Frequency Scalping',
    icon: '⚡',
    shortDesc: 'Exploit micro price moves at high frequency on 1–5 min charts.',
    longDesc: 'Enters and exits within minutes using order flow imbalance and bid/ask spread dynamics. Requires low-latency connectivity and tight spreads. High win rate but small gains per trade.',
    risk: 'High',
    riskColor: '#ef4444',
    category: 'volatility',
    markets: ['crypto', 'forex'],
    tags: ['Scalping', 'HFT', 'Order Flow'],
    winRate: 68,
    avgReturn: 7.9,
    maxDrawdown: 20,
    users: 2300,
    minInvestment: 1000,
    timeframes: ['1m', '5m'],
    difficulty: 'Advanced',
  },
  // ── Arbitrage ─────────────────────────────────────────────────────────────────
  {
    id: 'triangular-arb',
    name: 'Triangular Arbitrage',
    icon: '🔺',
    shortDesc: 'Exploit price discrepancies across three currency pairs.',
    longDesc: 'Detects triangular arbitrage loops (e.g. BTC → ETH → BNB → BTC) across pairs on the same exchange. Executes three legs in rapid succession to capture risk-free spread.',
    risk: 'Low',
    riskColor: '#00d17a',
    category: 'arbitrage',
    markets: ['crypto'],
    tags: ['Arbitrage', 'Risk-Free', 'Speed'],
    winRate: 81,
    avgReturn: 1.8,
    maxDrawdown: 2,
    users: 760,
    minInvestment: 2000,
    timeframes: ['1m'],
    difficulty: 'Advanced',
    isNew: true,
  },
  // ── Income ────────────────────────────────────────────────────────────────────
  {
    id: 'covered-call',
    name: 'Covered Call Bot',
    icon: '🛡️',
    shortDesc: 'Generate premium income by selling call options against held stock.',
    longDesc: 'Automatically sells out-of-the-money call options each week against an existing long stock position. Collects premium as income. Best for low-to-moderate bullish outlook.',
    risk: 'Low',
    riskColor: '#00d17a',
    category: 'income',
    markets: ['stocks'],
    tags: ['Options', 'Income', 'Covered Call'],
    winRate: 75,
    avgReturn: 2.2,
    maxDrawdown: 6,
    users: 1420,
    minInvestment: 1000,
    timeframes: ['1d'],
    difficulty: 'Intermediate',
    isNew: true,
  },
];

@Injectable({ providedIn: 'root' })
export class StrategyService {
  private auth = inject(AuthService);
  private firestore = inject(Firestore);

  savedIds = signal<string[]>([]);
  userStrategies = signal<UserStrategy[]>([]);
  executions = signal<StrategyExecution[]>([]);
  all = computed(() => STRATEGY_TEMPLATES);

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.loadSavedFromFirestore(user.id);
        this.loadUserStrategiesFromFirestore(user.id);
        this.loadExecutionsFromFirestore(user.id);
      } else {
        this.savedIds.set([]);
        this.userStrategies.set([]);
        this.executions.set([]);
      }
    });
  }

  private async loadSavedFromFirestore(uid: string) {
    try {
      const ref = doc(this.firestore, 'users', uid);
      const snap = await getDoc(ref);
      const data = snap.data();
      this.savedIds.set(data?.['savedStrategies'] ?? []);
    } catch {
      this.savedIds.set([]);
    }
  }

  private async loadUserStrategiesFromFirestore(uid: string) {
    try {
      const col = collection(this.firestore, 'users', uid, 'strategies');
      const snap = await getDocs(col);
      this.userStrategies.set(snap.docs.map(d => {
        const data = d.data() as Partial<UserStrategy>;
        return {
          id: data.id ?? d.id,
          templateId: data.templateId ?? '',
          templateName: data.templateName ?? 'Strategy',
          templateIcon: data.templateIcon ?? '📊',
          name: data.name ?? 'Untitled Strategy',
          assignedBotId: data.assignedBotId ?? '',
          assignedBotName: data.assignedBotName ?? 'Unknown Bot',
          status: data.status ?? 'active',
          tradeSide: data.tradeSide ?? 'buy',
          notes: data.notes ?? '',
          createdAt: data.createdAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          lastExecutionAt: data.lastExecutionAt,
        } satisfies UserStrategy;
      }));
    } catch (err) {
      console.error('failed to load user strategies', err);
      this.userStrategies.set([]);
    }
  }

  private async loadExecutionsFromFirestore(uid: string) {
    try {
      const col = collection(this.firestore, 'users', uid, 'executions');
      const snap = await getDocs(col);
      const items = snap.docs.map(d => {
        const data = d.data() as Partial<StrategyExecution>;
        return {
          id: d.id,
          strategyId: data.strategyId ?? '',
          strategyName: data.strategyName ?? 'Strategy',
          botId: data.botId ?? '',
          botName: data.botName ?? 'Bot',
          exchangeId: data.exchangeId ?? '',
          side: (data.side ?? 'buy') as 'buy' | 'sell',
          symbol: data.symbol ?? '',
          investment: Number(data.investment ?? 0),
          orderId: data.orderId ?? '',
          executedAt: data.executedAt ?? '',
        } satisfies StrategyExecution;
      }).sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

      this.executions.set(items);
    } catch (err) {
      console.error('failed to load strategy executions', err);
      this.executions.set([]);
    }
  }

  isSaved(id: string) {
    return this.savedIds().includes(id);
  }

  async toggleSave(id: string) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('toggleSave called without user');
      return;
    }
    const next = this.savedIds().includes(id)
      ? this.savedIds().filter(i => i !== id)
      : [...this.savedIds(), id];
    this.savedIds.set(next);
    try {
      const ref = doc(this.firestore, 'users', uid);
      await setDoc(ref, { savedStrategies: next }, { merge: true });
    } catch (err) {
      console.error('failed to update saved strategies', err);
      throw err;
    }
  }

  async createUserStrategy(input: {
    templateId: string;
    templateName: string;
    templateIcon: string;
    name: string;
    assignedBotId: string;
    assignedBotName: string;
    status?: 'active' | 'paused';
    tradeSide?: 'buy' | 'sell';
    notes?: string;
  }): Promise<UserStrategy> {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      throw new Error('createUserStrategy called without user');
    }

    const now = new Date().toISOString();
    const initialStatus = input.status ?? 'active';
    const strategy: UserStrategy = {
      id: crypto.randomUUID(),
      templateId: input.templateId,
      templateName: input.templateName,
      templateIcon: input.templateIcon,
      name: input.name.trim(),
      assignedBotId: input.assignedBotId,
      assignedBotName: input.assignedBotName,
      status: initialStatus,
      tradeSide: input.tradeSide ?? 'buy',
      notes: input.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
      lastExecutionAt: initialStatus === 'active' ? now : undefined,
    };

    const ref = doc(this.firestore, 'users', uid, 'strategies', strategy.id);
    await setDoc(ref, strategy);
    this.userStrategies.update(list => [strategy, ...list]);
    return strategy;
  }

  async updateUserStrategy(id: string, updates: {
    name: string;
    assignedBotId: string;
    assignedBotName: string;
    status: 'active' | 'paused';
    tradeSide: 'buy' | 'sell';
    notes?: string;
  }): Promise<UserStrategy> {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      throw new Error('updateUserStrategy called without user');
    }

    const existing = this.userStrategies().find(strategy => strategy.id === id);
    if (!existing) {
      throw new Error('strategy not found');
    }

    const now = new Date().toISOString();
    const next: UserStrategy = {
      ...existing,
      name: updates.name.trim(),
      assignedBotId: updates.assignedBotId,
      assignedBotName: updates.assignedBotName,
      status: updates.status,
      tradeSide: updates.tradeSide,
      notes: updates.notes?.trim() ?? '',
      updatedAt: now,
      // Prevent an immediate execution after saving an already-active strategy.
      lastExecutionAt: updates.status === 'active' ? now : existing.lastExecutionAt,
    };

    const ref = doc(this.firestore, 'users', uid, 'strategies', id);
    await setDoc(ref, next);
    this.userStrategies.update(list => list.map(strategy => strategy.id === id ? next : strategy));
    return next;
  }

  async removeUserStrategy(id: string): Promise<void> {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      throw new Error('removeUserStrategy called without user');
    }

    const ref = doc(this.firestore, 'users', uid, 'strategies', id);
    await deleteDoc(ref);
    this.userStrategies.update(list => list.filter(strategy => strategy.id !== id));
  }

  search(query: string, market: string, risk: string, category: string): StrategyTemplate[] {
    const q = query.toLowerCase().trim();
    return STRATEGY_TEMPLATES.filter(s => {
      const matchQ = !q ||
        s.name.toLowerCase().includes(q) ||
        s.shortDesc.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q));
      const matchMarket   = !market   || market   === 'all' || s.markets.includes(market as MarketType);
      const matchRisk     = !risk     || risk     === 'all' || s.risk.toLowerCase() === risk.toLowerCase();
      const matchCategory = !category || category === 'all' || s.category === category;
      return matchQ && matchMarket && matchRisk && matchCategory;
    });
  }

}
