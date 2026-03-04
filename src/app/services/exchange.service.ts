import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs } from '@angular/fire/firestore';
import { AccountMode } from './account-mode.service';

export interface Exchange {
  id: string;
  name: string;
  logo: string;
  color: string;
  hasPassphrase: boolean;
  isPaper?: boolean;
  description?: string;
  apiDocsUrl?: string;
  category: 'crypto' | 'stocks';
}

export interface ConnectedExchange {
  exchangeId: string;
  label: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
  connectedAt: string;
}

export interface PortfolioData {
  portfolioValue: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  updatedAt: string;
}

export interface ExchangePortfolioBreakdown {
  label: string;
  exchangeId: string;
  exchangeName: string;
  isPaper: boolean;
  portfolioValue: number;
  unrealizedPnl: number;
  pnlPercentage: number;
  updatedAt: string;
}

export interface PortfolioError {
  message: string;
  isRetrying: boolean;
}

export const SUPPORTED_EXCHANGES: Exchange[] = [
  // Crypto Exchanges
  {
    id: 'binance',
    name: 'Binance',
    logo: '📊',
    color: '#F3BA2F',
    hasPassphrase: false,
    category: 'crypto',
    description: 'World\'s largest crypto exchange by volume',
    apiDocsUrl: 'https://binance-docs.github.io/apidocs/',
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    logo: '💙',
    color: '#0052FF',
    hasPassphrase: true,
    category: 'crypto',
    description: 'Secure US-based crypto trading platform',
    apiDocsUrl: 'https://docs.cloud.coinbase.com/',
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
  },
  // Stock Exchanges
  {
    id: 'alpaca',
    name: 'Alpaca',
    logo: '🦙',
    color: '#FF6A00',
    hasPassphrase: false,
    category: 'stocks',
    description: 'Commission-free stock trading API',
    apiDocsUrl: 'https://alpaca.markets/docs/',
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
  },
  {
    id: 'interactive-brokers',
    name: 'Interactive Brokers',
    logo: '🏦',
    color: '#0066CC',
    hasPassphrase: false,
    isPaper: true,
    category: 'stocks',
    description: 'Professional trading platform',
    apiDocsUrl: 'https://www.interactivebrokers.com/en/index.php?f=1286',
  },
];

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private auth = inject(AuthService);
  private firebaseAuth = inject(Auth);
  private http = inject(HttpClient);
  private firestore = inject(Firestore);

  connections = signal<ConnectedExchange[]>([]);
  portfolioData = signal<PortfolioData | null>(null);
  portfolioValuesByType = signal<{ real: number | null; paper: number | null }>({ real: null, paper: null });
  pnlValuesByType = signal<{ real: number | null; paper: number | null }>({ real: null, paper: null });
  portfolioBreakdown = signal<ExchangePortfolioBreakdown[]>([]);
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

  private retryAttempts = 0;
  private maxRetryAttempts = 3;
  private retryDelayMs = 5000;

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
        this.isLoadingPortfolio.set(true);
        this.portfolioError.set(null);
        this.retryAttempts = 0;
        this.fetchPortfolioDataForAllConnectionsWithRetry(this.connections());
      } else {
        this.portfolioData.set(null);
        this.portfolioValuesByType.set({ real: null, paper: null });
        this.pnlValuesByType.set({ real: null, paper: null });
        this.portfolioBreakdown.set([]);
        this.isLoadingPortfolio.set(false);
        this.portfolioError.set(null);
        this.retryAttempts = 0;
      }
    });
  }

  private async fetchPortfolioDataForAllConnectionsWithRetry(exchanges: ConnectedExchange[]) {
    try {
      let realPortfolioTotal = 0;
      let paperPortfolioTotal = 0;
      let realPnlTotal = 0;
      let paperPnlTotal = 0;
      let hasReal = false;
      let hasPaper = false;
      const breakdownRows: ExchangePortfolioBreakdown[] = [];

      let primaryPortfolio: PortfolioData | null = null;

      for (const exchange of exchanges) {
        const data = await this.fetchPortfolioData(exchange);
        const exchangeMeta = SUPPORTED_EXCHANGES.find(e => e.id === exchange.exchangeId);
        const isPaper = exchangeMeta?.isPaper ?? false;

        if (isPaper) {
          paperPortfolioTotal += data.portfolioValue;
          paperPnlTotal += data.unrealizedPnl;
          hasPaper = true;
        } else {
          realPortfolioTotal += data.portfolioValue;
          realPnlTotal += data.unrealizedPnl;
          hasReal = true;
        }

        breakdownRows.push({
          label: exchange.label,
          exchangeId: exchange.exchangeId,
          exchangeName: exchangeMeta?.name ?? exchange.exchangeId,
          isPaper,
          portfolioValue: data.portfolioValue,
          unrealizedPnl: data.unrealizedPnl,
          pnlPercentage: data.pnlPercentage,
          updatedAt: data.updatedAt,
        });

        if (!primaryPortfolio) {
          primaryPortfolio = data;
        }
      }

      this.portfolioValuesByType.set({
        real: hasReal ? realPortfolioTotal : null,
        paper: hasPaper ? paperPortfolioTotal : null,
      });
      this.pnlValuesByType.set({
        real: hasReal ? realPnlTotal : null,
        paper: hasPaper ? paperPnlTotal : null,
      });
      this.portfolioBreakdown.set(breakdownRows);
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
        
        setTimeout(() => {
          this.fetchPortfolioDataForAllConnectionsWithRetry(exchanges);
        }, this.retryDelayMs);
      } else {
        console.error('Failed to fetch portfolio after retries:', err);
        this.isLoadingPortfolio.set(false);
        this.portfolioValuesByType.set({ real: null, paper: null });
        this.pnlValuesByType.set({ real: null, paper: null });
        this.portfolioBreakdown.set([]);
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

  private async loadFromFirestore(uid: string) {
    try {
      const col = collection(this.firestore, 'users', uid, 'exchanges');
      const snap = await getDocs(col);
      const list = snap.docs.map((d: any) => d.data() as ConnectedExchange);
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
    try {
      // Remove undefined fields before saving to Firestore
      const dataToSave = {
        exchangeId: conn.exchangeId,
        label: conn.label,
        apiKey: conn.apiKey,
        secret: conn.secret,
        ...(conn.passphrase && { passphrase: conn.passphrase }),
        connectedAt: conn.connectedAt,
      };
      const docRef = doc(this.firestore, 'users', uid, 'exchanges', conn.label);
      await setDoc(docRef, dataToSave);
      this.connections.update(list => [conn, ...list]);
      // Portfolio data will auto-load triggered by the connections effect
    } catch (err: any) {
      console.error('failed to add exchange', err);
      throw new Error(`Failed to save exchange: ${err?.message || 'Unknown error'}`);
    }
  }

  async remove(label: string) {
    const uid = this.auth.currentUser()?.id;
    if (!uid) {
      console.warn('remove called without user');
      return;
    }
    try {
      const docRef = doc(this.firestore, 'users', uid, 'exchanges', label);
      await deleteDoc(docRef);
      this.connections.update(list => list.filter(c => c.label !== label));
    } catch (err) {
      console.error('failed to remove exchange', err);
      throw err;
    }
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


