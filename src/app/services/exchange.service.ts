import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs } from '@angular/fire/firestore';
import { AccountMode } from './account-mode.service';
import { environment } from '../../environments/environment';

export interface Exchange {
  id: string;
  name: string;
  logo: string;
  color: string;
  hasPassphrase: boolean;
  isPaper?: boolean;
  description?: string;
  apiDocsUrl?: string;
  apiCredentialGuideUrl?: string;
  category: 'crypto' | 'stocks';
}

export interface ConnectedExchange {
  exchangeId: string;
  label: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
  connectedAt: string;
  status?: 'active' | 'halted';
  /**
   * True when this alpaca-paper connection was auto-provisioned by the
   * top-up flow (broker sub-account). Portfolio is fetched via the
   * backend broker API (/v1/paper-portfolio).
   *
   * False/absent when the user connected their own Alpaca paper trading
   * keys via the exchange modal. Portfolio is fetched via the standard
   * Firebase function (/api/getPortfolio) using the stored keys.
   */
  brokerProvisioned?: boolean;
  /**
   * "oauth" for Alpaca connections made via the "Connect with Alpaca" OAuth
   * flow (Alpaca Connect Apps). apiKey/secret are empty strings in that case
   * — the access token lives server-side and is never sent to the client.
   * Absent/"apiKey" for every other connection (unchanged, manual keys).
   */
  authMethod?: 'apiKey' | 'oauth';
}

export interface PortfolioData {
  portfolioValue: number;
  unrealizedPnl: number | null;
  pnlPercentage: number | null;
  updatedAt: string;
  openPositions?: PortfolioPosition[];
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  marketValue: number;
  unrealizedPnl: number | null;
  pnlPercentage?: number | null;
  entryPrice: number | null;
  currentPrice: number | null;
  side: 'long' | 'short';
  marketOpen?: boolean;
  marketStatusReason?: string;
}

export interface PortfolioPositionRow extends PortfolioPosition {
  exchangeId: string;
  exchangeLabel: string;
  exchangeName: string;
  isPaper: boolean;
}

export interface ExchangePortfolioBreakdown {
  label: string;
  exchangeId: string;
  exchangeName: string;
  isPaper: boolean;
  portfolioValue: number;
  unrealizedPnl: number | null;
  pnlPercentage: number | null;
  updatedAt: string;
}

export interface PortfolioError {
  message: string;
  isRetrying: boolean;
}

export const SUPPORTED_EXCHANGES: Exchange[] = [
  // ── Crypto Exchanges ─────────────────────────────────────────────────────
  {
    id: 'binance',
    name: 'Binance',
    logo: '📊',
    color: '#F3BA2F',
    hasPassphrase: false,
    category: 'crypto',
    description: "World's largest crypto exchange by volume",
    apiDocsUrl: 'https://binance-docs.github.io/apidocs/',
    apiCredentialGuideUrl: 'https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072',
  },
  {
    id: 'coinbase',
    name: 'Coinbase Advanced',
    logo: '💙',
    color: '#0052FF',
    hasPassphrase: true,
    category: 'crypto',
    description: 'Secure US-based crypto trading platform',
    apiDocsUrl: 'https://docs.cdp.coinbase.com/advanced-trade/docs/welcome/',
    apiCredentialGuideUrl: 'https://docs.cdp.coinbase.com/advanced-trade/docs/auth',
  },
  {
    id: 'kraken',
    name: 'Kraken',
    logo: '🐙',
    color: '#564098',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Regulated cryptocurrency exchange',
    apiDocsUrl: 'https://docs.kraken.com/rest/',
    apiCredentialGuideUrl: 'https://support.kraken.com/hc/en-us/articles/360000919966-How-to-generate-an-API-key-pair',
  },
  {
    id: 'bybit',
    name: 'Bybit',
    logo: '⚡',
    color: '#F7931A',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Derivatives and spot trading platform',
    apiDocsUrl: 'https://bybit-exchange.github.io/docs/',
    apiCredentialGuideUrl: 'https://www.bybit.com/en/help-center/article/How-to-create-your-API-keys',
  },
  {
    id: 'bybit-testnet',
    name: 'Bybit Testnet',
    logo: '⚡',
    color: '#F7931A',
    hasPassphrase: false,
    isPaper: true,
    category: 'crypto',
    description: 'Risk-free paper trading on Bybit testnet',
    apiDocsUrl: 'https://bybit-exchange.github.io/docs/',
    apiCredentialGuideUrl: 'https://www.bybit.com/en/help-center/article/How-to-create-your-API-keys',
  },
  {
    id: 'okx',
    name: 'OKX',
    logo: '🔷',
    color: '#121212',
    hasPassphrase: true,
    category: 'crypto',
    description: 'Large derivatives and spot exchange',
    apiDocsUrl: 'https://www.okx.com/docs-v5/',
    apiCredentialGuideUrl: 'https://www.okx.com/help/how-do-i-create-an-api-key-on-okx',
  },
  {
    id: 'okx-demo',
    name: 'OKX Demo Trading',
    logo: '🔷',
    color: '#121212',
    hasPassphrase: true,
    isPaper: true,
    category: 'crypto',
    description: 'Risk-free simulated trading on OKX',
    apiDocsUrl: 'https://www.okx.com/docs-v5/',
    apiCredentialGuideUrl: 'https://www.okx.com/help/how-do-i-create-an-api-key-on-okx',
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    logo: '🟢',
    color: '#23AF91',
    hasPassphrase: true,
    category: 'crypto',
    description: 'Wide altcoin selection with high liquidity',
    apiDocsUrl: 'https://docs.kucoin.com/',
    apiCredentialGuideUrl: 'https://support.kucoin.plus/hc/en-us/articles/360015102174',
  },
  {
    id: 'kucoin-sandbox',
    name: 'KuCoin Sandbox',
    logo: '🟢',
    color: '#23AF91',
    hasPassphrase: true,
    isPaper: true,
    category: 'crypto',
    description: 'Risk-free paper trading on KuCoin sandbox',
    apiDocsUrl: 'https://docs.kucoin.com/',
    apiCredentialGuideUrl: 'https://support.kucoin.plus/hc/en-us/articles/360015102174',
  },
  {
    id: 'bitfinex',
    name: 'Bitfinex',
    logo: '🌊',
    color: '#16B157',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Advanced crypto exchange with margin trading',
    apiDocsUrl: 'https://docs.bitfinex.com/',
    apiCredentialGuideUrl: 'https://support.bitfinex.com/hc/en-us/articles/115002349625',
  },
  {
    id: 'gateio',
    name: 'Gate.io',
    logo: '🚪',
    color: '#2354E6',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Huge token variety with deep liquidity',
    apiDocsUrl: 'https://www.gate.io/docs/developers/apiv4/',
    apiCredentialGuideUrl: 'https://www.gate.io/help/apiv4/create-api-key',
  },
  {
    id: 'mexc',
    name: 'MEXC',
    logo: '💎',
    color: '#1DA2B4',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Low fees and extensive altcoin support',
    apiDocsUrl: 'https://mexcdevelop.github.io/apidocs/',
    apiCredentialGuideUrl: 'https://support.mexc.com/hc/en-us/articles/360055877071',
  },
  {
    id: 'deribit',
    name: 'Deribit',
    logo: '📐',
    color: '#02C176',
    hasPassphrase: false,
    category: 'crypto',
    description: 'Leading options and futures exchange',
    apiDocsUrl: 'https://docs.deribit.com/',
    apiCredentialGuideUrl: 'https://insights.deribit.com/exchange-updates/introduction-to-the-deribit-api/',
  },
  {
    id: 'deribit-testnet',
    name: 'Deribit Testnet',
    logo: '📐',
    color: '#02C176',
    hasPassphrase: false,
    isPaper: true,
    category: 'crypto',
    description: 'Risk-free paper trading on Deribit testnet',
    apiDocsUrl: 'https://docs.deribit.com/',
    apiCredentialGuideUrl: 'https://insights.deribit.com/exchange-updates/introduction-to-the-deribit-api/',
  },
  // ── Stock / Equity Brokers ────────────────────────────────────────────────
  {
    id: 'alpaca',
    name: 'Alpaca',
    logo: '🦙',
    color: '#FF6A00',
    hasPassphrase: false,
    category: 'stocks',
    description: 'Commission-free stock trading API',
    apiDocsUrl: 'https://alpaca.markets/docs/',
    apiCredentialGuideUrl: 'https://docs.alpaca.markets/docs/getting-started',
  },
  {
    id: 'alpaca-paper',
    name: 'Alpaca Paper Trading',
    logo: '🦙',
    color: '#FF6A00',
    hasPassphrase: false,
    isPaper: true,
    category: 'stocks',
    description: 'Risk-free stock trading simulation',
    apiDocsUrl: 'https://alpaca.markets/docs/',
    apiCredentialGuideUrl: 'https://docs.alpaca.markets/docs/getting-started',
  },
  {
    id: 'interactive-brokers',
    name: 'Interactive Brokers',
    logo: '🏦',
    color: '#0066CC',
    hasPassphrase: false,
    isPaper: false,
    category: 'stocks',
    description: 'Institutional-grade multi-asset trading platform. Requires IB Gateway running locally.',
    apiDocsUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
    apiCredentialGuideUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
  },
  {
    id: 'interactive-brokers-paper',
    name: 'IBKR Paper Trading',
    logo: '🏦',
    color: '#0066CC',
    hasPassphrase: false,
    isPaper: true,
    category: 'stocks',
    description: 'Risk-free paper trading via Interactive Brokers. Requires IB Gateway running locally.',
    apiDocsUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
    apiCredentialGuideUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php',
  },
  {
    id: 'tradier',
    name: 'Tradier',
    logo: '📈',
    color: '#E5360A',
    hasPassphrase: false,
    category: 'stocks',
    description: 'Commission-free options & equities. Use API key as Access Token and account number as Secret.',
    apiDocsUrl: 'https://documentation.tradier.com/',
    apiCredentialGuideUrl: 'https://documentation.tradier.com/brokerage-api/getting-started',
  },
  {
    id: 'tradier-sandbox',
    name: 'Tradier Sandbox',
    logo: '📈',
    color: '#E5360A',
    hasPassphrase: false,
    isPaper: true,
    category: 'stocks',
    description: 'Risk-free paper trading on Tradier sandbox. Use API key as Access Token and account number as Secret.',
    apiDocsUrl: 'https://documentation.tradier.com/',
    apiCredentialGuideUrl: 'https://documentation.tradier.com/brokerage-api/getting-started',
  },
  {
    id: 'tastytrade',
    name: 'Tastytrade',
    logo: '🎯',
    color: '#FF3D00',
    hasPassphrase: true,
    category: 'stocks',
    description: 'Options-focused broker API. Use email as API Key, password as Secret, and account number as Passphrase.',
    apiDocsUrl: 'https://developer.tastytrade.com/',
    apiCredentialGuideUrl: 'https://developer.tastytrade.com/open-api-reference/authentication/',
  },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    logo: '🏢',
    color: '#00A4B4',
    hasPassphrase: true,
    category: 'stocks',
    description: 'Full-service broker. Use OAuth access token as API Key, account number as Secret, and app key as Passphrase.',
    apiDocsUrl: 'https://developer.schwab.com/',
    apiCredentialGuideUrl: 'https://developer.schwab.com/get-started',
  },
  {
    id: 'schwab-paper',
    name: 'Schwab PaperMoney',
    logo: '🏢',
    color: '#00A4B4',
    hasPassphrase: true,
    isPaper: true,
    category: 'stocks',
    description: 'Risk-free paper trading via Schwab thinkorswim. Use OAuth access token as API Key, account number as Secret, and app key as Passphrase.',
    apiDocsUrl: 'https://developer.schwab.com/',
    apiCredentialGuideUrl: 'https://developer.schwab.com/get-started',
  },
  {
    id: 'ig-markets',
    name: 'IG Markets',
    logo: '🌐',
    color: '#0C3B6E',
    hasPassphrase: true,
    category: 'stocks',
    description: 'Global CFDs, forex, stocks & indices trading via the IG Markets API. Use your IG API key, password as Secret, and username/identifier as Passphrase.',
    apiDocsUrl: 'https://labs.ig.com/rest-trading-api-reference',
    apiCredentialGuideUrl: 'https://labs.ig.com/gettingstarted',
  },
  {
    id: 'ig-markets-demo',
    name: 'IG Markets Demo',
    logo: '🌐',
    color: '#0C3B6E',
    hasPassphrase: true,
    isPaper: true,
    category: 'stocks',
    description: 'Risk-free demo trading via IG Markets. Use your IG demo account API key, password as Secret, and username as Passphrase.',
    apiDocsUrl: 'https://labs.ig.com/rest-trading-api-reference',
    apiCredentialGuideUrl: 'https://labs.ig.com/gettingstarted',
  },
];

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private auth = inject(AuthService);
  private subscription = inject(SubscriptionService);
  private firebaseAuth = inject(Auth);
  private http = inject(HttpClient);
  private firestore = inject(Firestore);

  connections = signal<ConnectedExchange[]>([]);
  portfolioData = signal<PortfolioData | null>(null);
  portfolioValuesByType = signal<{ real: number | null; paper: number | null }>({ real: null, paper: null });
  pnlValuesByType = signal<{ real: number | null; paper: number | null }>({ real: null, paper: null });
  portfolioBreakdown = signal<ExchangePortfolioBreakdown[]>([]);
  portfolioPositions = signal<PortfolioPositionRow[]>([]);
  isLoadingPortfolio = signal(false);
  portfolioError = signal<string | null>(null);

  hasExchange = computed(() => this.connections().length > 0);

  isPaperExchange(exchangeId: string): boolean {
    return SUPPORTED_EXCHANGES.find(exchange => exchange.id === exchangeId)?.isPaper ?? false;
  }

  connectionsByMode(mode: AccountMode): ConnectedExchange[] {
    const showPaper = mode === 'paper';
    return this.connections().filter(conn => this.isPaperExchange(conn.exchangeId) === showPaper);
  }

  hasExchangeByMode(mode: AccountMode): boolean {
    return this.connectionsByMode(mode).length > 0;
  }

  portfolioBreakdownByMode(mode: AccountMode): ExchangePortfolioBreakdown[] {
    const showPaper = mode === 'paper';
    return this.portfolioBreakdown().filter(row => row.isPaper === showPaper);
  }

  portfolioPositionsByMode(mode: AccountMode): PortfolioPositionRow[] {
    const showPaper = mode === 'paper';
    return this.portfolioPositions().filter((row) => row.isPaper === showPaper);
  }

  private retryAttempts = 0;
  private maxRetryAttempts = 3;
  private retryDelayMs = 5000;
  private portfolioRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly portfolioRefreshMs = 10000;
  private portfolioRefreshInFlight = false;

  constructor() {
    // react to currentUser signal changes
    effect(() => {
      const user = this.auth.currentUser();
      if (user) this.loadFromFirestore(user.id);
      else this.connections.set([]);
    });
    
    // Auto-fetch portfolio when exchanges change
    effect(() => {
      if (this.connections().length > 0) {
        this.startPortfolioPolling();
        void this.refreshPortfolioData(true);
      } else {
        this.stopPortfolioPolling();
        this.portfolioData.set(null);
        this.portfolioValuesByType.set({ real: null, paper: null });
        this.pnlValuesByType.set({ real: null, paper: null });
        this.portfolioBreakdown.set([]);
        this.portfolioPositions.set([]);
        this.isLoadingPortfolio.set(false);
        this.portfolioError.set(null);
        this.retryAttempts = 0;
      }
    });
  }

  private startPortfolioPolling() {
    this.stopPortfolioPolling();
    this.portfolioRefreshTimer = setInterval(() => {
      void this.refreshPortfolioData(false);
    }, this.portfolioRefreshMs);
  }

  private stopPortfolioPolling() {
    if (this.portfolioRefreshTimer) {
      clearInterval(this.portfolioRefreshTimer);
      this.portfolioRefreshTimer = null;
    }
  }

  async refreshPortfolioData(showLoader = true) {
    if (this.portfolioRefreshInFlight) {
      return;
    }

    this.portfolioRefreshInFlight = true;
    const currentConnections = this.connections();
    if (currentConnections.length === 0) {
      this.stopPortfolioPolling();
      this.portfolioData.set(null);
      this.portfolioValuesByType.set({ real: null, paper: null });
      this.pnlValuesByType.set({ real: null, paper: null });
      this.portfolioBreakdown.set([]);
      this.portfolioPositions.set([]);
      this.isLoadingPortfolio.set(false);
      this.portfolioError.set(null);
      this.retryAttempts = 0;
      this.portfolioRefreshInFlight = false;
      return;
    }

    if (showLoader) {
      this.isLoadingPortfolio.set(true);
    }
    this.portfolioError.set(null);
    this.retryAttempts = 0;
    try {
      await this.fetchPortfolioDataForAllConnectionsWithRetry(currentConnections);
    } finally {
      this.portfolioRefreshInFlight = false;
    }
  }

  private async fetchPortfolioDataForAllConnectionsWithRetry(exchanges: ConnectedExchange[]) {
    try {
      let realPortfolioTotal = 0;
      let paperPortfolioTotal = 0;
      let realPnlTotal = 0;
      let paperPnlTotal = 0;
      let hasReal = false;
      let hasPaper = false;
      let hasRealPnl = false;
      let hasPaperPnl = false;
      const breakdownRows: ExchangePortfolioBreakdown[] = [];
      const positionRows: PortfolioPositionRow[] = [];

      let primaryPortfolio: PortfolioData | null = null;

      for (const exchange of exchanges) {
        const data = await this.fetchPortfolioData(exchange);
        const exchangeMeta = SUPPORTED_EXCHANGES.find(e => e.id === exchange.exchangeId);
        const isPaper = exchangeMeta?.isPaper ?? false;
        const sourcePositions = Array.isArray(data.openPositions) ? data.openPositions : [];

        // Unrlzd P&L must reflect the sum of individual positions.
        const positionPnlSum = sourcePositions.reduce((sum, position) => {
          const value = Number(position.unrealizedPnl);
          return Number.isFinite(value) ? sum + value : sum;
        }, 0);

        if (isPaper) {
          paperPortfolioTotal += data.portfolioValue;
          paperPnlTotal += positionPnlSum;
          hasPaperPnl = true;
          hasPaper = true;
        } else {
          realPortfolioTotal += data.portfolioValue;
          realPnlTotal += positionPnlSum;
          hasRealPnl = true;
          hasReal = true;
        }

        breakdownRows.push({
          label: exchange.label,
          exchangeId: exchange.exchangeId,
          exchangeName: exchangeMeta?.name ?? exchange.exchangeId,
          isPaper,
          portfolioValue: data.portfolioValue,
          unrealizedPnl: positionPnlSum,
          pnlPercentage: data.pnlPercentage === null || data.pnlPercentage === undefined ? null : Number(data.pnlPercentage),
          updatedAt: data.updatedAt,
        });

        for (const sourcePosition of sourcePositions) {
          const quantity = Number(sourcePosition.quantity);
          const marketValue = Number(sourcePosition.marketValue);

          positionRows.push({
            symbol: String(sourcePosition.symbol || ''),
            quantity: Number.isFinite(quantity) ? quantity : 0,
            marketValue: Number.isFinite(marketValue) ? marketValue : 0,
            unrealizedPnl: sourcePosition.unrealizedPnl === null || sourcePosition.unrealizedPnl === undefined
              ? null
              : Number(sourcePosition.unrealizedPnl),
            pnlPercentage: sourcePosition.pnlPercentage === null || sourcePosition.pnlPercentage === undefined
              ? null
              : Number(sourcePosition.pnlPercentage),
            entryPrice: sourcePosition.entryPrice === null || sourcePosition.entryPrice === undefined
              ? null
              : Number(sourcePosition.entryPrice),
            currentPrice: sourcePosition.currentPrice === null || sourcePosition.currentPrice === undefined
              ? null
              : Number(sourcePosition.currentPrice),
            side: String(sourcePosition.side || 'long').toLowerCase() === 'short' ? 'short' : 'long',
            marketOpen: typeof sourcePosition.marketOpen === 'boolean' ? sourcePosition.marketOpen : undefined,
            marketStatusReason: sourcePosition.marketStatusReason ? String(sourcePosition.marketStatusReason) : '',
            exchangeId: exchange.exchangeId,
            exchangeLabel: exchange.label,
            exchangeName: exchangeMeta?.name ?? exchange.exchangeId,
            isPaper,
          });
        }

        if (!primaryPortfolio) {
          primaryPortfolio = data;
        }
      }

      this.portfolioValuesByType.set({
        real: hasReal ? realPortfolioTotal : null,
        paper: hasPaper ? paperPortfolioTotal : null,
      });
      this.pnlValuesByType.set({
        real: hasRealPnl ? realPnlTotal : null,
        paper: hasPaperPnl ? paperPnlTotal : null,
      });
      this.portfolioBreakdown.set(breakdownRows);
      this.portfolioPositions.set(positionRows);
      this.portfolioData.set(primaryPortfolio);
      this.isLoadingPortfolio.set(false);
      this.portfolioError.set(null);
    } catch (err: any) {
      this.retryAttempts++;
      
      console.error('API Error Details:', {
        message: err.message,
        status: err.status,
        statusText: err.statusText,
        response: err.error,
        fullError: err,
      });
      
      if (this.retryAttempts < this.maxRetryAttempts) {
        console.warn(`Portfolio fetch failed, retrying (${this.retryAttempts}/${this.maxRetryAttempts})...`, err.message);
        this.portfolioError.set(`Retrying... (${this.retryAttempts}/${this.maxRetryAttempts})`);

        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        await this.fetchPortfolioDataForAllConnectionsWithRetry(exchanges);
        return;
      } else {
        console.error('Failed to fetch portfolio after retries:', err);
        this.isLoadingPortfolio.set(false);
        this.portfolioValuesByType.set({ real: null, paper: null });
        this.pnlValuesByType.set({ real: null, paper: null });
        this.portfolioBreakdown.set([]);
        this.portfolioPositions.set([]);
        this.portfolioData.set(null);
        
        let errorMsg = 'Unable to fetch portfolio data';
        if (err.message?.includes('401') || err.message?.includes('403')) {
          errorMsg = 'Invalid API credentials - please reconnect';
        } else if (err.message?.includes('timeout')) {
          errorMsg = 'Request timeout - check your internet connection';
        } else if (err.message?.includes('network')) {
          errorMsg = 'Network error - please try again';
        } else if (err.error?.error) {
          errorMsg = `API Error: ${err.error.error}`;
        }
        
        this.portfolioError.set(errorMsg);
      }
    }
  }

  /** Reloads connected exchanges from Firestore for the current user. */
  async reloadFromFirestore(): Promise<void> {
    const uid = this.auth.currentUser()?.id;
    if (uid) await this.loadFromFirestore(uid);
  }

  private async loadFromFirestore(uid: string) {
    try {
      const col = collection(this.firestore, 'users', uid, 'exchanges');
      const snap = await getDocs(col);
      const list = snap.docs.map((d: any) => {
        const data = d.data() as ConnectedExchange;
        return {
          ...data,
          status: data.status === 'halted' ? 'halted' : 'active',
        } as ConnectedExchange;
      });
      this.connections.set(list);
    } catch (err) {
      console.error('failed to load exchanges from firestore', err);
      this.connections.set([]);
    }
  }

  async add(conn: ConnectedExchange) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      const msg = 'Cannot save exchange: user not authenticated';
      console.warn(msg);
      throw new Error(msg);
    }

    this.subscription.assertCanCreate('exchange', this.connections().length);

    try {
      // Remove undefined fields before saving to Firestore
      const dataToSave = {
        exchangeId: conn.exchangeId,
        label: conn.label,
        apiKey: conn.apiKey,
        secret: conn.secret,
        ...(conn.passphrase && { passphrase: conn.passphrase }),
        connectedAt: conn.connectedAt,
        status: conn.status === 'halted' ? 'halted' : 'active',
        ...(conn.brokerProvisioned !== undefined && { brokerProvisioned: conn.brokerProvisioned }),
      };
      const docRef = doc(this.firestore, 'users', uid, 'exchanges', conn.label);
      await setDoc(docRef, dataToSave);
      const normalizedConn: ConnectedExchange = {
        ...conn,
        status: conn.status === 'halted' ? 'halted' : 'active',
      };
      this.connections.update(list => [normalizedConn, ...list]);
      // Portfolio data will auto-load triggered by the connections effect
    } catch (err: any) {
      console.error('failed to add exchange', err);
      throw new Error(`Failed to save exchange: ${err?.message || 'Unknown error'}`);
    }
  }

  async setConnectionStatus(label: string, status: 'active' | 'halted') {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('setConnectionStatus called without user');
      return;
    }

    const existing = this.connections().find((conn) => conn.label === label);
    if (!existing) {
      return;
    }

    const updated: ConnectedExchange = {
      ...existing,
      status,
    };

    try {
      const docRef = doc(this.firestore, 'users', uid, 'exchanges', label);
      await setDoc(docRef, updated);
      this.connections.update((list) =>
        list.map((conn) => (conn.label === label ? updated : conn)),
      );
    } catch (err) {
      console.error('failed to update exchange status', err);
      throw err;
    }
  }

  async remove(label: string) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('remove called without user');
      return;
    }
    try {
      // If this is an Alpaca paper trading account, delete the broker account first
      const conn = this.connections().find(c => c.label === label);
      if (conn?.exchangeId === 'alpaca-paper') {
        const backendBase = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');
        if (backendBase) {
          const currentUser = this.firebaseAuth.currentUser;
          if (currentUser) {
            const idToken = await currentUser.getIdToken();
            try {
              await firstValueFrom(this.http.delete(
                `${backendBase}/v1/paper-account`,
                { headers: { Authorization: `Bearer ${idToken}` } },
              ));
            } catch (deleteErr: any) {
              // Log but don't block the local disconnect
              console.error('Failed to delete Alpaca broker account', deleteErr);
            }
          }
        }
      }

      const docRef = doc(this.firestore, 'users', uid, 'exchanges', label);
      await deleteDoc(docRef);
      this.connections.update(list => list.filter(c => c.label !== label));
    } catch (err) {
      console.error('failed to remove exchange', err);
      throw err;
    }
  }

  /**
   * Starts the "Connect with Alpaca" OAuth flow (Alpaca Connect Apps) and
   * navigates the browser to Alpaca's authorize page. On approval, Alpaca
   * redirects back through our OAuth callback, which stores the connection
   * and lands the user back on /exchanges?alpaca_connect=success — see
   * ExchangesPage, which reloads connections when it sees that param.
   */
  async startAlpacaConnect(env: 'live' | 'paper'): Promise<void> {
    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error('You must be logged in to connect Alpaca.');
    }
    const idToken = await currentUser.getIdToken();

    const response = await firstValueFrom(this.http.post<{ authorizeUrl: string }>(
      '/api/alpaca/oauth/start',
      { env },
      { headers: { Authorization: `Bearer ${idToken}` } },
    ));

    if (!response?.authorizeUrl) {
      throw new Error('Alpaca did not return an authorization URL.');
    }

    window.location.href = response.authorizeUrl;
  }

  /**
   * Starts the "Connect with tastytrade" OAuth flow and navigates the browser
   * to tastytrade's authorize page. On approval, tastytrade redirects back
   * through our callback, which stores the connection and lands the user back
   * on /exchanges?tastytrade_connect=success.
   */
  async startTastytradeConnect(): Promise<void> {
    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error('You must be logged in to connect tastytrade.');
    }
    const idToken = await currentUser.getIdToken();

    const response = await firstValueFrom(this.http.post<{ authorizeUrl: string }>(
      '/api/tastytrade/oauth/start',
      {},
      { headers: { Authorization: `Bearer ${idToken}` } },
    ));

    if (!response?.authorizeUrl) {
      throw new Error('tastytrade did not return an authorization URL.');
    }

    window.location.href = response.authorizeUrl;
  }

  async validateCredentials(exchangeId: string, apiKey: string, secret: string, passphrase?: string): Promise<boolean> {
    try {
      const currentUser = this.firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const idToken = await currentUser.getIdToken();
      const endpoint = '/api/getPortfolio';

      const response = await Promise.race([
        firstValueFrom(this.http.post<PortfolioData>(
          endpoint,
          {
            exchangeId,
            apiKey: apiKey?.replace(/\s+/g, ''),
            apiSecret: secret?.replace(/\s+/g, ''),
            ...(passphrase ? { passphrase: passphrase.replace(/\s+/g, '') } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        )),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
        ),
      ]);

      const data = response as PortfolioData;
      if (data && data.portfolioValue !== undefined) {
        return true;
      }

      throw new Error('Invalid validation response');
    } catch (err: any) {
      console.error('Credential validation failed:', {
        message: err?.message,
        status: err?.status,
        response: err?.error,
        exchangeId,
      });

      const status = err?.status;
      const rawMessage = String(err?.error?.error || err?.message || '').toLowerCase();

      if (
        status === 401 ||
        status === 403 ||
        rawMessage.includes('invalid api-key') ||
        rawMessage.includes('invalid signature') ||
        rawMessage.includes('unauthorized') ||
        rawMessage.includes('forbidden') ||
        rawMessage.includes('authentication')
      ) {
        throw new Error('API key or API secret are incorrect. The keys must be copied from exchange. Refer to the website of this exchange for getting these data.');
      }

      if (rawMessage.includes('timeout')) {
        throw new Error('Credential validation timed out. Please try again.');
      }

      throw new Error('API key or API secret are incorrect. The keys must be copied from exchange. Refer to the website of this exchange for getting these data.');
    }
  }

  private async fetchPortfolioData(exchange: ConnectedExchange): Promise<PortfolioData> {
    try {
      const currentUser = this.firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      const idToken = await currentUser.getIdToken();

      // OAuth-connected Alpaca accounts (Connect Apps) have no apiKey/secret
      // to send — the backend looks up the stored access token by uid+env.
      if (exchange.authMethod === 'oauth') {
        const response = await Promise.race([
          firstValueFrom(this.http.post<PortfolioData>(
            '/api/getPortfolio',
            { exchangeId: exchange.exchangeId, authMethod: 'oauth' },
            { headers: { Authorization: `Bearer ${idToken}` } },
          )),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
          ),
        ]);
        const data = response as PortfolioData;
        if (data && data.portfolioValue !== undefined) {
          return data;
        }
        throw new Error('Invalid portfolio data response for OAuth-connected Alpaca account');
      }

      // Broker-provisioned alpaca-paper accounts (created via the top-up flow)
      // must be queried via the Cloud Run backend broker API, which uses
      // OAuth2 broker credentials and the stored alpacaBrokerAccountId.
      //
      // User-connected alpaca-paper accounts (connected via the exchange modal
      // with the user's own Alpaca paper trading keys) use the standard
      // /api/getPortfolio path, exactly like any other exchange.
      if (exchange.exchangeId === 'alpaca-paper' && exchange.brokerProvisioned === true) {
        const backendBase = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');
        if (!backendBase) {
          throw new Error('Trading backend URL is not configured.');
        }
        const response = await Promise.race([
          firstValueFrom(this.http.get<PortfolioData>(
            `${backendBase}/v1/paper-portfolio`,
            { headers: { Authorization: `Bearer ${idToken}` } },
          )),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
          ),
        ]);
        const data = response as PortfolioData;
        if (data && data.portfolioValue !== undefined) {
          return data;
        }
        throw new Error('Invalid portfolio data response from paper-portfolio endpoint');
      }

      const endpoint = '/api/getPortfolio';

      const response = await Promise.race([
        firstValueFrom(this.http.post<PortfolioData>(
          endpoint,
          {
            exchangeId: exchange.exchangeId,
            apiKey: exchange.apiKey?.replace(/\s+/g, ''),
            apiSecret: exchange.secret?.replace(/\s+/g, ''),
          },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        )),
        // 15 second timeout
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
        ),
      ]);

      const data = response as PortfolioData;
      if (data && data.portfolioValue !== undefined) {
        return data;
      } else {
        throw new Error('Invalid portfolio data response');
      }
    } catch (err: any) {
      console.error('Portfolio fetch error:', {
        message: err.message,
        code: err.code,
        exchangeId: exchange.exchangeId,
      });
      
      throw new Error(`Failed to fetch portfolio from ${exchange.exchangeId}: ${err.message}`);
    }
  }

  async liquidatePosition(position: PortfolioPositionRow) {
    const exchange = this.connections().find((conn) => conn.label === position.exchangeLabel);
    if (!exchange) {
      throw new Error('Exchange credentials not found for this position.');
    }

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const idToken = await currentUser.getIdToken();
    try {
      await firstValueFrom(this.http.post<{ success: boolean; message: string }>(
        '/api/liquidatePosition',
        {
          exchangeId: exchange.exchangeId,
          apiKey: exchange.apiKey?.replace(/\s+/g, ''),
          apiSecret: exchange.secret?.replace(/\s+/g, ''),
          symbol: position.symbol,
          quantity: position.quantity,
          side: position.side,
          limitPrice: position.currentPrice ?? undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      ));
    } catch (err: any) {
      const apiMessage = String(err?.error?.error || err?.error?.message || '').trim();
      if (apiMessage) {
        throw new Error(apiMessage);
      }

      throw new Error(err?.message || 'Unable to liquidate this position right now.');
    }

    await this.refreshPortfolioData();
  }

  // DEBUG: Test Alpaca Paper API call with stored credentials
  async testAlpacaPaperAPI() {
    const alpacaPaper = this.connections().find(c => c.exchangeId === 'alpaca-paper');
    
    if (!alpacaPaper) {
      console.warn('❌ No Alpaca Paper account connected. Please connect first.');
      return;
    }

    console.log('🧪 Testing Alpaca Paper API with stored credentials...');
    console.log('Exchange:', alpacaPaper);

    try {
      const currentUser = this.firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      const idToken = await currentUser.getIdToken();

      const response = await firstValueFrom(this.http.post<PortfolioData>(
        '/api/getPortfolio',
        {
          exchangeId: alpacaPaper.exchangeId,
          apiKey: alpacaPaper.apiKey,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      ));

      console.log('✅ SUCCESS! Portfolio Data:', response);
      return response;
    } catch (err: any) {
      console.error('❌ ERROR fetching portfolio:', {
        message: err.message,
        code: err.code,
      });
      return null;
    }
  }

}


