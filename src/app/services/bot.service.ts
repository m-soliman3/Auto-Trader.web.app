import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs } from '@angular/fire/firestore';

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
  private auth = inject(AuthService);
  private firestore = inject(Firestore);

  bots = signal<Bot[]>([]);
  activeBots = computed(() => this.bots().filter(b => b.status === 'active'));

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) this.loadFromFirestore(user.id);
      else this.bots.set([]);
    });
  }

  private async loadFromFirestore(uid: string) {
    try {
      const col = collection(this.firestore, 'users', uid, 'bots');
      const snap = await getDocs(col);
      this.bots.set(snap.docs.map(d => d.data() as Bot));
    } catch (err) {
      console.error('failed to load bots from firestore', err);
      this.bots.set([]);
    }
  }

  async add(bot: Bot) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('add bot called without user');
      return;
    }
    try {
      const docRef = doc(this.firestore, 'users', uid, 'bots', bot.id);
      await setDoc(docRef, bot);
      this.bots.update(list => [bot, ...list]);
    } catch (err) {
      console.error('failed to add bot', err);
      throw err;
    }
  }

  async setStatus(id: string, status: BotStatus) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('setStatus called without user');
      return;
    }
    const existing = this.bots().find(b => b.id === id);
    if (!existing) return;
    const updatedBot = { ...existing, status };
    try {
      const docRef = doc(this.firestore, 'users', uid, 'bots', id);
      await setDoc(docRef, updatedBot);
      this.bots.update(list => list.map(b => b.id === id ? updatedBot : b));
    } catch (err) {
      console.error('failed to update bot status', err);
      throw err;
    }
  }

  async update(id: string, updates: Partial<Bot>) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('update bot called without user');
      return;
    }
    const existing = this.bots().find(b => b.id === id);
    if (!existing) return;
    
    // Check if trying to update restricted fields when bot is active
    const restrictedFields = ['investment', 'stopLoss', 'takeProfit', 'symbol', 'timeframe'];
    const isUpdatingRestricted = restrictedFields.some(field => field in updates);
    
    if (existing.status !== 'paused' && isUpdatingRestricted) {
      throw new Error('Bot must be paused to edit investment, stop loss, take profit, symbol, or timeframe');
    }

    const updatedBot = { ...existing, ...updates };
    try {
      const docRef = doc(this.firestore, 'users', uid, 'bots', id);
      await setDoc(docRef, updatedBot);
      this.bots.update(list => list.map(b => b.id === id ? updatedBot : b));
    } catch (err) {
      console.error('failed to update bot', err);
      throw err;
    }
  }

  async remove(id: string) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('remove bot called without user');
      return;
    }
    try {
      const docRef = doc(this.firestore, 'users', uid, 'bots', id);
      await deleteDoc(docRef);
      this.bots.update(list => list.filter(b => b.id !== id));
    } catch (err) {
      console.error('failed to remove bot', err);
      throw err;
    }
  }
}
