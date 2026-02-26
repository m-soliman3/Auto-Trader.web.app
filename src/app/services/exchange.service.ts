import { Injectable, signal, computed } from '@angular/core';

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
  // ── Crypto ────────────────────────────────────────────────────────────────
  { id: 'binance',      name: 'Binance',              logo: '𝗕',  color: '#F0B90B', hasPassphrase: false, category: 'crypto',  apiDocsUrl: 'https://www.binance.com/en/my/settings/api-management' },
  { id: 'coinbase',     name: 'Coinbase',              logo: '🔵', color: '#0052FF', hasPassphrase: true,  category: 'crypto',  apiDocsUrl: 'https://www.coinbase.com/settings/api' },
  { id: 'kraken',       name: 'Kraken',                logo: '🐙', color: '#5741D9', hasPassphrase: false, category: 'crypto',  apiDocsUrl: 'https://www.kraken.com/u/security/api' },
  { id: 'bybit',        name: 'Bybit',                 logo: '🟡', color: '#F7A600', hasPassphrase: false, category: 'crypto',  apiDocsUrl: 'https://www.bybit.com/app/user/api-management' },
  { id: 'okx',          name: 'OKX',                   logo: '⬛', color: '#FFFFFF', hasPassphrase: true,  category: 'crypto',  apiDocsUrl: 'https://www.okx.com/account/my-api' },
  { id: 'kucoin',       name: 'KuCoin',                logo: '🟢', color: '#00A650', hasPassphrase: true,  category: 'crypto',  apiDocsUrl: 'https://www.kucoin.com/account/api' },
  { id: 'alpaca-live',  name: 'Alpaca Markets',        logo: '🦙', color: '#FFCD00', hasPassphrase: false, category: 'stocks',  isPaper: false, description: 'Live trading — real funds',      apiDocsUrl: 'https://app.alpaca.markets/paper/dashboard/overview' },
  { id: 'alpaca-paper', name: 'Alpaca Markets',        logo: '🦙', color: '#FFCD00', hasPassphrase: false, category: 'stocks',  isPaper: true,  description: 'Paper trading — simulated funds', apiDocsUrl: 'https://app.alpaca.markets/paper/dashboard/overview' },
  // ── Stocks & Multi-Asset ──────────────────────────────────────────────────
  { id: 'ibkr',         name: 'Interactive Brokers',   logo: '🏦', color: '#E8001C', hasPassphrase: false, category: 'stocks',  description: 'Stocks, options, forex, futures', apiDocsUrl: 'https://www.interactivebrokers.com/en/trading/ib-api.php' },
  { id: 'tdameritrade',  name: 'TD Ameritrade',        logo: '📈', color: '#00A651', hasPassphrase: false, category: 'stocks',  description: 'US stocks & options',             apiDocsUrl: 'https://developer.tdameritrade.com/apis' },
  { id: 'tradier',      name: 'Tradier',               logo: '🔷', color: '#E8652A', hasPassphrase: false, category: 'stocks',  description: 'US stocks & options',             apiDocsUrl: 'https://documentation.tradier.com/brokerage-api' },
  { id: 'oanda',        name: 'OANDA',                 logo: '💱', color: '#E4002B', hasPassphrase: false, category: 'stocks',  description: 'Forex & CFDs',                    apiDocsUrl: 'https://www.oanda.com/us-en/trading/platforms/oanda-api/' },
  { id: 'fxcm',         name: 'FXCM',                  logo: '💹', color: '#E31837', hasPassphrase: false, category: 'stocks',  description: 'Forex & CFDs',                    apiDocsUrl: 'https://www.fxcm.com/markets/algorithmic-trading/api-trading/' },
  { id: 'saxo',         name: 'Saxo Bank',             logo: '🌐', color: '#003DA5', hasPassphrase: false, category: 'stocks',  description: 'Multi-asset OpenAPI',             apiDocsUrl: 'https://www.developer.saxo/openapi/learn' },
  { id: 'schwab',       name: 'Charles Schwab',        logo: '🔵', color: '#00A9CE', hasPassphrase: false, category: 'stocks',  description: 'US stocks & options',             apiDocsUrl: 'https://developer.schwab.com/' },
  { id: 'robinhood',    name: 'Robinhood',             logo: '🪶', color: '#00C805', hasPassphrase: false, category: 'stocks',  description: 'Commission-free US stocks',        apiDocsUrl: 'https://docs.robinhood.com/' },
  { id: 'webull',       name: 'Webull',                logo: '📊', color: '#1A75FF', hasPassphrase: false, category: 'stocks',  description: 'Commission-free US stocks & ETFs', apiDocsUrl: 'https://app.webull.com/openapi' },
  { id: 'tastytrade',   name: 'Tastytrade',            logo: '🌶️', color: '#E8003D', hasPassphrase: false, category: 'stocks',  description: 'Options & futures focused',        apiDocsUrl: 'https://developer.tastytrade.com/' },
  { id: 'igmarkets',    name: 'IG Markets',            logo: '🔶', color: '#FF6900', hasPassphrase: false, category: 'stocks',  description: 'Forex, CFDs & spread betting',     apiDocsUrl: 'https://labs.ig.com/rest-trading-api-reference' },
  { id: 'capitalcom',   name: 'Capital.com',           logo: '💠', color: '#0066FF', hasPassphrase: false, category: 'stocks',  description: 'Forex & CFDs REST/WebSocket API',  apiDocsUrl: 'https://open-api.capital.com/' },
  { id: 'deriv',        name: 'Deriv',                 logo: '🔴', color: '#FF444F', hasPassphrase: false, category: 'stocks',  description: 'Forex, synthetics & CFDs',         apiDocsUrl: 'https://api.deriv.com/' },
  { id: 'exante',       name: 'Exante',                logo: '🌍', color: '#1E3A5F', hasPassphrase: false, category: 'stocks',  description: 'Multi-asset European broker',      apiDocsUrl: 'https://exante.eu/api-trading/' },
];

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private readonly KEY = 'at_exchanges';

  connections = signal<ConnectedExchange[]>(this.load());

  hasExchange = computed(() => this.connections().length > 0);

  add(conn: ConnectedExchange) {
    this.connections.update(list => {
      const updated = [...list, conn];
      localStorage.setItem(this.KEY, JSON.stringify(updated));
      return updated;
    });
  }

  remove(label: string) {
    this.connections.update(list => {
      const updated = list.filter(c => c.label !== label);
      localStorage.setItem(this.KEY, JSON.stringify(updated));
      return updated;
    });
  }

  private load(): ConnectedExchange[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) ?? '[]');
    } catch {
      return [];
    }
  }
}
