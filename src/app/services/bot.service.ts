import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs } from '@angular/fire/firestore';
import { SUPPORTED_EXCHANGES } from './exchange.service';
import { AccountMode } from './account-mode.service';

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

export interface SymbolEntry { symbol: string; name: string; }

export const SYMBOLS: SymbolEntry[] = [
  // Stocks & ETFs
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'TSLA',  name: 'Tesla, Inc.' },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ',   name: 'Invesco QQQ Trust (Nasdaq 100)' },
  // Tech Giants & Semiconductors
  { symbol: 'NVDA',  name: 'NVIDIA Corp.' },
  { symbol: 'INTC',  name: 'Intel Corp.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'AMZN',  name: 'Amazon.com, Inc.' },
  { symbol: 'PLTR',  name: 'Palantir Technologies Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A' },
  { symbol: 'GOOG',  name: 'Alphabet Inc. Class C' },
  { symbol: 'META',  name: 'Meta Platforms, Inc.' },
  { symbol: 'SMCI',  name: 'Super Micro Computer, Inc.' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.' },
  { symbol: 'MRVL',  name: 'Marvell Technology, Inc.' },
  { symbol: 'MU',    name: 'Micron Technology, Inc.' },
  { symbol: 'NFLX',  name: 'Netflix, Inc.' },
  { symbol: 'QCOM',  name: 'QUALCOMM Inc.' },
  { symbol: 'CSCO',  name: 'Cisco Systems, Inc.' },
  { symbol: 'ORCL',  name: 'Oracle Corp.' },
  { symbol: 'UBER',  name: 'Uber Technologies, Inc.' },
  { symbol: 'PANW',  name: 'Palo Alto Networks, Inc.' },
  { symbol: 'CRM',   name: 'Salesforce, Inc.' },
  { symbol: 'NOW',   name: 'ServiceNow, Inc.' },
  { symbol: 'SNOW',  name: 'Snowflake Inc.' },
  { symbol: 'CRWD',  name: 'CrowdStrike Holdings, Inc.' },
  { symbol: 'DELL',  name: 'Dell Technologies Inc.' },
  { symbol: 'HPE',   name: 'Hewlett Packard Enterprise Co.' },
  { symbol: 'HPQ',   name: 'HP Inc.' },
  { symbol: 'IBM',   name: 'International Business Machines Corp.' },
  { symbol: 'TXN',   name: 'Texas Instruments Inc.' },
  { symbol: 'INTU',  name: 'Intuit Inc.' },
  { symbol: 'ADI',   name: 'Analog Devices, Inc.' },
  { symbol: 'LRCX',  name: 'Lam Research Corp.' },
  { symbol: 'AMAT',  name: 'Applied Materials, Inc.' },
  { symbol: 'ASML',  name: 'ASML Holding N.V.' },
  { symbol: 'KLAC',  name: 'KLA Corp.' },
  { symbol: 'NXPI',  name: 'NXP Semiconductors N.V.' },
  { symbol: 'MCHP',  name: 'Microchip Technology Inc.' },
  { symbol: 'ON',    name: 'ON Semiconductor Corp.' },
  { symbol: 'ANET',  name: 'Arista Networks, Inc.' },
  { symbol: 'WDAY',  name: 'Workday, Inc.' },
  { symbol: 'ADBE',  name: 'Adobe Inc.' },
  { symbol: 'TEAM',  name: 'Atlassian Corp.' },
  { symbol: 'DDOG',  name: 'Datadog, Inc.' },
  { symbol: 'ZS',    name: 'Zscaler, Inc.' },
  // Volatile Growth & High-Turnover Equities
  { symbol: 'OPEN',  name: 'Opendoor Technologies Inc.' },
  { symbol: 'PLUG',  name: 'Plug Power, Inc.' },
  { symbol: 'BBAI',  name: 'BigBear.ai Holdings, Inc.' },
  { symbol: 'APLD',  name: 'Applied Digital Corp.' },
  { symbol: 'IREN',  name: 'IREN Limited' },
  { symbol: 'CIFR',  name: 'Cipher Digital Inc.' },
  { symbol: 'RGTI',  name: 'Rigetti Computing, Inc.' },
  { symbol: 'NIO',   name: 'NIO Inc. ADR' },
  { symbol: 'BABA',  name: 'Alibaba Group ADR' },
  { symbol: 'PDD',   name: 'PDD Holdings Inc. ADR' },
  { symbol: 'JD',    name: 'JD.com, Inc. ADR' },
  { symbol: 'LCID',  name: 'Lucid Group, Inc.' },
  { symbol: 'RIVN',  name: 'Rivian Automotive, Inc.' },
  { symbol: 'HOOD',  name: 'Robinhood Markets, Inc.' },
  { symbol: 'COIN',  name: 'Coinbase Global, Inc.' },
  { symbol: 'MARA',  name: 'MARA Holdings, Inc.' },
  { symbol: 'RIOT',  name: 'Riot Platforms, Inc.' },
  { symbol: 'DKNG',  name: 'DraftKings Inc.' },
  { symbol: 'SOFI',  name: 'SoFi Technologies, Inc.' },
  { symbol: 'AFRM',  name: 'Affirm Holdings, Inc.' },
  { symbol: 'UPST',  name: 'Upstart Holdings, Inc.' },
  { symbol: 'AI',    name: 'C3.ai, Inc.' },
  { symbol: 'PATH',  name: 'UiPath, Inc.' },
  { symbol: 'PINS',  name: 'Pinterest, Inc.' },
  { symbol: 'SNAP',  name: 'Snap Inc.' },
  { symbol: 'PYPL',  name: 'PayPal Holdings, Inc.' },
  { symbol: 'SHOP',  name: 'Shopify Inc.' },
  { symbol: 'SE',    name: 'Sea Limited ADR' },
  { symbol: 'GME',   name: 'GameStop Corp.' },
  { symbol: 'AMC',   name: 'AMC Entertainment Holdings, Inc.' },
  { symbol: 'CHPT',  name: 'ChargePoint Holdings, Inc.' },
  { symbol: 'RUN',   name: 'Sunrun Inc.' },
  { symbol: 'FSLR',  name: 'First Solar, Inc.' },
  { symbol: 'ENPH',  name: 'Enphase Energy, Inc.' },
  { symbol: 'SEDG',  name: 'SolarEdge Technologies, Inc.' },
  { symbol: 'XPEV',  name: 'XPeng Inc. ADR' },
  { symbol: 'LI',    name: 'Li Auto Inc. ADR' },
  { symbol: 'FUTU',  name: 'Futu Holdings Ltd. ADR' },
  { symbol: 'TIGR',  name: 'UP Fintech Holding ADR' },
  { symbol: 'RBLX',  name: 'Roblox Corp.' },
  { symbol: 'U',     name: 'Unity Software Inc.' },
  { symbol: 'NET',   name: 'Cloudflare, Inc.' },
  { symbol: 'OKTA',  name: 'Okta, Inc.' },
  { symbol: 'MDB',   name: 'MongoDB, Inc.' },
  { symbol: 'ESTC',  name: 'Elastic N.V.' },
  { symbol: 'NTNX',  name: 'Nutanix, Inc.' },
  // Industrial, Automotive & Energy
  { symbol: 'F',     name: 'Ford Motor Co.' },
  { symbol: 'GM',    name: 'General Motors Co.' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corp.' },
  { symbol: 'CVX',   name: 'Chevron Corp.' },
  { symbol: 'BP',    name: 'BP p.l.c. ADR' },
  { symbol: 'SHEL',  name: 'Shell plc ADR' },
  { symbol: 'COP',   name: 'ConocoPhillips' },
  { symbol: 'EOG',   name: 'EOG Resources, Inc.' },
  { symbol: 'SLB',   name: 'SLB Limited' },
  { symbol: 'HAL',   name: 'Halliburton Co.' },
  { symbol: 'BKR',   name: 'Baker Hughes Co.' },
  { symbol: 'OXY',   name: 'Occidental Petroleum Corp.' },
  { symbol: 'DVN',   name: 'Devon Energy Corp.' },
  { symbol: 'APA',   name: 'APA Corp.' },
  { symbol: 'MPC',   name: 'Marathon Petroleum Corp.' },
  { symbol: 'VLO',   name: 'Valero Energy Corp.' },
  { symbol: 'PSX',   name: 'Phillips 66' },
  { symbol: 'GE',    name: 'GE Aerospace' },
  { symbol: 'CAT',   name: 'Caterpillar Inc.' },
  { symbol: 'DE',    name: 'Deere & Co.' },
  { symbol: 'MMM',   name: '3M Company' },
  { symbol: 'HON',   name: 'Honeywell International Inc.' },
  { symbol: 'LMT',   name: 'Lockheed Martin Corp.' },
  { symbol: 'RTX',   name: 'RTX Corp.' },
  { symbol: 'BA',    name: 'Boeing Co.' },
  { symbol: 'NOC',   name: 'Northrop Grumman Corp.' },
  { symbol: 'GD',    name: 'General Dynamics Corp.' },
  { symbol: 'FCX',   name: 'Freeport-McMoRan Inc.' },
  { symbol: 'NUE',   name: 'Nucor Corp.' },
  { symbol: 'AA',    name: 'Alcoa Corp.' },
  { symbol: 'CLF',   name: 'Cleveland-Cliffs Inc.' },
  { symbol: 'VALE',  name: 'Vale S.A. ADR' },
  { symbol: 'BHP',   name: 'BHP Group ADR' },
  { symbol: 'RIO',   name: 'Rio Tinto plc ADR' },
  { symbol: 'CSX',   name: 'CSX Corp.' },
  { symbol: 'UNP',   name: 'Union Pacific Corp.' },
  // Financials, Consumer & Healthcare
  { symbol: 'BAC',   name: 'Bank of America Corp.' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'WFC',   name: 'Wells Fargo & Co.' },
  { symbol: 'C',     name: 'Citigroup Inc.' },
  { symbol: 'MS',    name: 'Morgan Stanley' },
  { symbol: 'GS',    name: 'Goldman Sachs Group Inc.' },
  { symbol: 'SCHW',  name: 'Charles Schwab Corp.' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'AXP',   name: 'American Express Co.' },
  { symbol: 'AAL',   name: 'American Airlines Group Inc.' },
  { symbol: 'DAL',   name: 'Delta Air Lines, Inc.' },
  { symbol: 'UAL',   name: 'United Airlines Holdings, Inc.' },
  { symbol: 'LUV',   name: 'Southwest Airlines Co.' },
  { symbol: 'CCL',   name: 'Carnival Corp.' },
  { symbol: 'RCL',   name: 'Royal Caribbean Group' },
  { symbol: 'NCLH',  name: 'Norwegian Cruise Line Holdings' },
  { symbol: 'DIS',   name: 'The Walt Disney Co.' },
  { symbol: 'CMCSA', name: 'Comcast Corp.' },
  { symbol: 'WBD',   name: 'Warner Bros. Discovery, Inc.' },
  { symbol: 'T',     name: 'AT&T Inc.' },
  { symbol: 'VZ',    name: 'Verizon Communications' },
  { symbol: 'TMUS',  name: 'T-Mobile US, Inc.' },
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'TGT',   name: 'Target Corp.' },
  { symbol: 'HD',    name: 'Home Depot, Inc.' },
  { symbol: 'LOW',   name: "Lowe's Companies Inc." },
  { symbol: 'COST',  name: 'Costco Wholesale Corp.' },
  { symbol: 'NKE',   name: 'Nike, Inc.' },
  { symbol: 'SBUX',  name: 'Starbucks Corp.' },
  { symbol: 'KO',    name: 'Coca-Cola Co.' },
  { symbol: 'PEP',   name: 'PepsiCo, Inc.' },
  { symbol: 'PG',    name: 'Procter & Gamble Co.' },
  { symbol: 'CL',    name: 'Colgate-Palmolive Co.' },
  { symbol: 'MDLZ',  name: 'Mondelez International, Inc.' },
  { symbol: 'MO',    name: 'Altria Group, Inc.' },
  { symbol: 'PM',    name: 'Philip Morris International Inc.' },
  { symbol: 'PFE',   name: 'Pfizer Inc.' },
  { symbol: 'MRK',   name: 'Merck & Co., Inc.' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.' },
  { symbol: 'BMY',   name: 'Bristol-Myers Squibb Co.' },
  { symbol: 'LLY',   name: 'Eli Lilly & Co.' },
  { symbol: 'AMGN',  name: 'Amgen Inc.' },
  { symbol: 'GILD',  name: 'Gilead Sciences, Inc.' },
  { symbol: 'BIIB',  name: 'Biogen Inc.' },
  { symbol: 'MRNA',  name: 'Moderna, Inc.' },
  { symbol: 'BNTX',  name: 'BioNTech SE ADR' },
  { symbol: 'VRTX',  name: 'Vertex Pharmaceuticals Inc.' },
  { symbol: 'UNH',   name: 'UnitedHealth Group Inc.' },
  { symbol: 'CVS',   name: 'CVS Health Corp.' },
  { symbol: 'CI',    name: 'The Cigna Group' },
  { symbol: 'HUM',   name: 'Humana Inc.' },
  { symbol: 'CNC',   name: 'Centene Corp.' },
  { symbol: 'EL',    name: 'Estée Lauder Companies Inc.' },
  { symbol: 'GIS',   name: 'General Mills, Inc.' },
  { symbol: 'KR',    name: 'The Kroger Co.' },
  { symbol: 'UPS',   name: 'United Parcel Service, Inc.' },
  { symbol: 'BX',    name: 'Blackstone Inc.' },
  { symbol: 'KKR',   name: 'KKR & Co. Inc.' },
  { symbol: 'APO',   name: 'Apollo Global Management, Inc.' },
  { symbol: 'BLK',   name: 'BlackRock, Inc.' },
  // Crypto – USD pairs
  { symbol: 'BTC/USD',    name: 'Bitcoin / US Dollar' },
  { symbol: 'ETH/USD',    name: 'Ethereum / US Dollar' },
  { symbol: 'SOL/USD',    name: 'Solana / US Dollar' },
  { symbol: 'XRP/USD',    name: 'XRP / US Dollar' },
  { symbol: 'ADA/USD',    name: 'Cardano / US Dollar' },
  { symbol: 'AVAX/USD',   name: 'Avalanche / US Dollar' },
  { symbol: 'DOGE/USD',   name: 'Dogecoin / US Dollar' },
  { symbol: 'LINK/USD',   name: 'Chainlink / US Dollar' },
  { symbol: 'LTC/USD',    name: 'Litecoin / US Dollar' },
  { symbol: 'BCH/USD',    name: 'Bitcoin Cash / US Dollar' },
  { symbol: 'DOT/USD',    name: 'Polkadot / US Dollar' },
  { symbol: 'UNI/USD',    name: 'Uniswap / US Dollar' },
  { symbol: 'AAVE/USD',   name: 'Aave / US Dollar' },
  { symbol: 'ARB/USD',    name: 'Arbitrum / US Dollar' },
  { symbol: 'BAT/USD',    name: 'Basic Attention Token / US Dollar' },
  { symbol: 'BONK/USD',   name: 'Bonk / US Dollar' },
  { symbol: 'CRV/USD',    name: 'Curve / US Dollar' },
  { symbol: 'FIL/USD',    name: 'Filecoin / US Dollar' },
  { symbol: 'GRT/USD',    name: 'The Graph / US Dollar' },
  { symbol: 'HYPE/USD',   name: 'Hype / US Dollar' },
  { symbol: 'LDO/USD',    name: 'Lido DAO / US Dollar' },
  { symbol: 'ONDO/USD',   name: 'Ondo / US Dollar' },
  { symbol: 'PAXG/USD',   name: 'Pax Gold / US Dollar' },
  { symbol: 'PEPE/USD',   name: 'Pepe / US Dollar' },
  { symbol: 'POL/USD',    name: 'Polygon / US Dollar' },
  { symbol: 'RENDER/USD', name: 'Render / US Dollar' },
  { symbol: 'SHIB/USD',   name: 'Shiba Inu / US Dollar' },
  { symbol: 'SKY/USD',    name: 'Sky / US Dollar' },
  { symbol: 'SUSHI/USD',  name: 'SushiSwap / US Dollar' },
  { symbol: 'TRUMP/USD',  name: 'Trump / US Dollar' },
  { symbol: 'WIF/USD',    name: 'dogwifhat / US Dollar' },
  { symbol: 'XTZ/USD',    name: 'Tezos / US Dollar' },
  { symbol: 'YFI/USD',    name: 'Yearn Finance / US Dollar' },
  // Crypto – USDT pairs
  { symbol: 'BTC/USDT',   name: 'Bitcoin / USD Tether' },
  { symbol: 'ETH/USDT',   name: 'Ethereum / USD Tether' },
  { symbol: 'SOL/USDT',   name: 'Solana / USD Tether' },
  { symbol: 'BNB/USDT',   name: 'BNB / USD Tether' },
  { symbol: 'XRP/USDT',   name: 'XRP / USD Tether' },
  { symbol: 'ADA/USDT',   name: 'Cardano / USD Tether' },
  { symbol: 'AVAX/USDT',  name: 'Avalanche / USD Tether' },
  { symbol: 'DOGE/USDT',  name: 'Dogecoin / USD Tether' },
  { symbol: 'LINK/USDT',  name: 'Chainlink / USD Tether' },
  { symbol: 'LTC/USDT',   name: 'Litecoin / USD Tether' },
  { symbol: 'BCH/USDT',   name: 'Bitcoin Cash / USD Tether' },
  { symbol: 'AAVE/USDT',  name: 'Aave / USD Tether' },
  { symbol: 'SHIB/USDT',  name: 'Shiba Inu / USD Tether' },
  { symbol: 'SUSHI/USDT', name: 'SushiSwap / USD Tether' },
  { symbol: 'UNI/USDT',   name: 'Uniswap / USD Tether' },
  { symbol: 'YFI/USDT',   name: 'Yearn Finance / USD Tether' },
  { symbol: 'USDT/USD',   name: 'USD Tether / US Dollar' },
  // Crypto – USDC pairs
  { symbol: 'BTC/USDC',   name: 'Bitcoin / USD Coin' },
  { symbol: 'ETH/USDC',   name: 'Ethereum / USD Coin' },
  { symbol: 'SOL/USDC',   name: 'Solana / USD Coin' },
  { symbol: 'AVAX/USDC',  name: 'Avalanche / USD Coin' },
  { symbol: 'DOGE/USDC',  name: 'Dogecoin / USD Coin' },
  { symbol: 'LINK/USDC',  name: 'Chainlink / USD Coin' },
  { symbol: 'LTC/USDC',   name: 'Litecoin / USD Coin' },
  { symbol: 'BCH/USDC',   name: 'Bitcoin Cash / USD Coin' },
  { symbol: 'DOT/USDC',   name: 'Polkadot / USD Coin' },
  { symbol: 'UNI/USDC',   name: 'Uniswap / USD Coin' },
  { symbol: 'AAVE/USDC',  name: 'Aave / USD Coin' },
  { symbol: 'BAT/USDC',   name: 'Basic Attention Token / USD Coin' },
  { symbol: 'CRV/USDC',   name: 'Curve / USD Coin' },
  { symbol: 'GRT/USDC',   name: 'The Graph / USD Coin' },
  { symbol: 'SHIB/USDC',  name: 'Shiba Inu / USD Coin' },
  { symbol: 'SUSHI/USDC', name: 'SushiSwap / USD Coin' },
  { symbol: 'XTZ/USDC',   name: 'Tezos / USD Coin' },
  { symbol: 'YFI/USDC',   name: 'Yearn Finance / USD Coin' },
  { symbol: 'USDC/USD',   name: 'USD Coin / US Dollar' },
  { symbol: 'USDT/USDC',  name: 'USD Tether / USD Coin' },
  // Crypto – BTC pairs
  { symbol: 'ETH/BTC',    name: 'Ethereum / Bitcoin' },
  { symbol: 'LINK/BTC',   name: 'Chainlink / Bitcoin' },
  { symbol: 'LTC/BTC',    name: 'Litecoin / Bitcoin' },
  { symbol: 'BCH/BTC',    name: 'Bitcoin Cash / Bitcoin' },
  { symbol: 'UNI/BTC',    name: 'Uniswap / Bitcoin' },
  // Stablecoins
  { symbol: 'USDG/USD',   name: 'USD Global / US Dollar' },
];

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

@Injectable({ providedIn: 'root' })
export class BotService {
  private auth = inject(AuthService);
  private subscription = inject(SubscriptionService);
  private firestore = inject(Firestore);

  bots = signal<Bot[]>([]);
  activeBots = computed(() => this.bots().filter(b => b.status === 'active'));

  private isPaperExchange(exchangeId: string): boolean {
    return SUPPORTED_EXCHANGES.find(exchange => exchange.id === exchangeId)?.isPaper ?? false;
  }

  botsByMode(mode: AccountMode): Bot[] {
    const showPaper = mode === 'paper';
    return this.bots().filter(bot => this.isPaperExchange(bot.exchangeId) === showPaper);
  }

  activeBotsByMode(mode: AccountMode): Bot[] {
    return this.botsByMode(mode).filter(bot => bot.status === 'active');
  }

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

    this.subscription.assertCanCreate('bot', this.bots().length);

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
