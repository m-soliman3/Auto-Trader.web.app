import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { Firestore, collection, doc, setDoc, deleteDoc, getDocs } from '@angular/fire/firestore';

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
  private firestore = inject(Firestore);

  connections = signal<ConnectedExchange[]>([]);

  hasExchange = computed(() => this.connections().length > 0);

  constructor() {
    // react to currentUser signal changes
    effect(() => {
      const user = this.auth.currentUser();
      if (user) this.loadFromFirestore(user.id);
      else this.connections.set([]);
    });
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
    // Credentials will be saved without validation
    // Validation can be implemented server-side later
    return Promise.resolve(true);
  }
}
