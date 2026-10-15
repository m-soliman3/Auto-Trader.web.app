import { Exchange, SUPPORTED_EXCHANGES } from '../../services/exchange.service';

/**
 * Asset classes a broker offers. Labels live in the locale files under
 * `brokerDetail.assetClasses.<key>`, so every broker page shares one vocabulary.
 */
export type BrokerAssetClass =
  | 'spotCrypto'
  | 'cryptoMargin'
  | 'cryptoPerpetuals'
  | 'cryptoFutures'
  | 'cryptoOptions'
  | 'usStocks'
  | 'globalStocks'
  | 'etfs'
  | 'options'
  | 'futures'
  | 'forex'
  | 'indices'
  | 'commodities'
  | 'bonds'
  | 'mutualFunds'
  | 'cfds';

/** A learn page that suits this broker's markets, linked from the broker page. */
export interface BrokerStrategyLink {
  /** A `LEARN_PAGES` slug (non-blog), rendered as `/:lang/learn/:slug`. */
  slug: string;
  reason: string;
}

export interface BrokerFaq {
  question: string;
  answer: string;
}

/**
 * The long-form, broker-specific half of a page: what keeps each page from being
 * the same template with a different name. Lives in `broker-guides.ts`.
 */
export interface BrokerGuide {
  /** Steps to create API credentials on this broker and connect them to AutoTrader. */
  apiSetup: string[];
  /** Paragraphs separated by a blank line. */
  feesAndAccounts: string;
  availability: string;
  strengths: string[];
  limitations: string[];
  strategies: BrokerStrategyLink[];
  faqs: BrokerFaq[];
}

/**
 * Content for one `/:lang/brokers/:slug` page. The slug is the live (non-paper)
 * exchange id from `SUPPORTED_EXCHANGES`; name, logo, colour and category are read
 * from there rather than duplicated.
 *
 * The English copy lives only here and in `broker-guides.ts`. `ar.json` carries
 * `brokerPages.<slug>.{tagline, headquarters, overview, metaTitle, metaDescription}` plus
 * every `BrokerGuide` field (arrays by index); symbols, URLs and years are never translated.
 * Only the lazy-loaded broker page imports this file, so it stays out of the initial bundle.
 */
export interface BrokerPageData {
  slug: string;
  /** Id of the paper/testnet/sandbox/demo variant in `SUPPORTED_EXCHANGES`, if any. */
  paperId?: string;
  homepageUrl: string;
  founded: number;
  headquarters: string;
  tagline: string;
  /** Paragraphs separated by a blank line. */
  overview: string;
  assetClasses: BrokerAssetClass[];
  cryptoSymbols?: string[];
  stockSymbols?: string[];
  /** Forex pairs, indices, commodities and futures contracts. */
  otherSymbols?: string[];
  metaTitle: string;
  metaDescription: string;
}

export const BROKER_PAGES: BrokerPageData[] = [
  // ── Stock / Equity Brokers ────────────────────────────────────────────────
  {
    slug: 'alpaca',
    paperId: 'alpaca-paper',
    homepageUrl: 'https://alpaca.markets/',
    founded: 2015,
    headquarters: 'San Mateo, California, USA',
    tagline: 'API-first, commission-free trading for US stocks, ETFs, options and crypto.',
    overview: `Alpaca is a developer-focused brokerage built around its trading API. Instead of a traditional desktop platform, everything — market data, order placement and account management — is exposed through clean REST and streaming endpoints, which makes it a natural fit for automated strategies.

AutoTrader connects to Alpaca with one-click OAuth (or manual API keys), so your strategies can place orders for US-listed stocks, ETFs and crypto pairs directly in your own account. Alpaca's free paper-trading environment mirrors the live API, letting you test any strategy with simulated money before you switch it to live.`,
    assetClasses: ['usStocks', 'etfs', 'options', 'spotCrypto'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'SPY', 'QQQ'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD', 'LINK/USD', 'AVAX/USD'],
    metaTitle: 'Alpaca Trading Bot — Automate Stocks & Crypto | Invest-Begin',
    metaDescription:
      'Automate Alpaca with AutoTrader: connect via OAuth, trade US stocks, ETFs and crypto with no-code strategies, and test risk-free on Alpaca paper trading.',
  },
  {
    slug: 'interactive-brokers',
    paperId: 'interactive-brokers-paper',
    homepageUrl: 'https://www.interactivebrokers.com/',
    founded: 1978,
    headquarters: 'Greenwich, Connecticut, USA',
    tagline: 'Institutional-grade access to stocks, options, futures and forex on 150+ markets.',
    overview: `Interactive Brokers (IBKR) is one of the largest electronic brokers in the world, known for low costs and exceptionally broad market access. From a single account you can trade stocks, ETFs, options, futures, currencies, bonds and funds across exchanges in North America, Europe and Asia.

AutoTrader works with IBKR through the official IB API, which requires IB Gateway or Trader Workstation running on your machine. Once the gateway is connected, your strategies can trade the instruments your IBKR account is approved for — and you can rehearse everything first on an IBKR paper-trading account.`,
    assetClasses: ['globalStocks', 'etfs', 'options', 'futures', 'forex', 'bonds', 'mutualFunds', 'spotCrypto'],
    stockSymbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'ASML', 'SPY', 'QQQ'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'LTC/USD', 'BCH/USD'],
    otherSymbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'ES (S&P 500 futures)', 'NQ (Nasdaq 100 futures)', 'GC (Gold futures)'],
    metaTitle: 'Interactive Brokers Trading Bot — Automate IBKR | Invest-Begin',
    metaDescription:
      'Automate Interactive Brokers with AutoTrader: run no-code strategies on global stocks, options, futures and forex, and test first on an IBKR paper account.',
  },
  {
    slug: 'tradier',
    paperId: 'tradier-sandbox',
    homepageUrl: 'https://tradier.com/',
    founded: 2012,
    headquarters: 'Charlotte, North Carolina, USA',
    tagline: 'A brokerage API built for equities and options traders.',
    overview: `Tradier is a US brokerage designed from the ground up as a platform for developers and trading apps. Its brokerage API offers equities, ETFs and a strong options offering, with subscription plans that remove per-trade commissions for active traders.

AutoTrader connects to Tradier using your API access token and account number. Strategies can then trade US stocks and ETFs in your Tradier account, and the Tradier sandbox gives you a free simulated environment to validate a strategy before it touches real money.`,
    assetClasses: ['usStocks', 'etfs', 'options'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'AMD', 'AMZN', 'SPY', 'QQQ', 'IWM'],
    metaTitle: 'Tradier Trading Bot — Automate Stocks & Options | Invest-Begin',
    metaDescription:
      'Automate Tradier with AutoTrader: connect your API token, run no-code strategies on US stocks and ETFs, and test them free in the Tradier sandbox.',
  },
  {
    slug: 'tastytrade',
    homepageUrl: 'https://tastytrade.com/',
    founded: 2017,
    headquarters: 'Chicago, Illinois, USA',
    tagline: 'An options-first broker with stocks, futures and crypto under one roof.',
    overview: `Tastytrade is a Chicago-based broker created by the team behind the tastylive financial network. It is popular with active options and futures traders thanks to its low, capped commissions and a platform built around derivatives, while also offering stocks, ETFs and crypto.

AutoTrader connects to Tastytrade using your login email, password and account number. Your strategies can then place orders on the US stocks and ETFs your account can trade, with AutoTrader's risk controls — stop-loss, take-profit and position sizing — applied to every order.`,
    assetClasses: ['usStocks', 'etfs', 'options', 'futures', 'spotCrypto'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'AMD', 'SPY', 'QQQ', 'IWM', 'TLT'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'LTC/USD'],
    metaTitle: 'Tastytrade Trading Bot — Automate Tastytrade | Invest-Begin',
    metaDescription:
      'Automate Tastytrade with AutoTrader: run no-code strategies on US stocks and ETFs with built-in stop-loss, take-profit and position sizing.',
  },
  {
    slug: 'schwab',
    paperId: 'schwab-paper',
    homepageUrl: 'https://www.schwab.com/',
    founded: 1971,
    headquarters: 'Westlake, Texas, USA',
    tagline: 'A full-service US broker with commission-free online stock and ETF trades.',
    overview: `Charles Schwab is one of the largest brokerage firms in the United States, offering commission-free online trading of US-listed stocks and ETFs alongside options, futures, bonds and mutual funds. Following its acquisition of TD Ameritrade, Schwab also runs the thinkorswim trading platform.

AutoTrader connects to Schwab through the Schwab Trader API using your OAuth access token, account number and app key. Your strategies can then trade US stocks and ETFs, with AutoTrader's stop-loss, take-profit and position sizing applied to every order.`,
    assetClasses: ['usStocks', 'etfs', 'options', 'futures', 'bonds', 'mutualFunds'],
    stockSymbols: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'SPY', 'VOO', 'QQQ', 'SCHD'],
    metaTitle: 'Charles Schwab Trading Bot — Automate Schwab | Invest-Begin',
    metaDescription:
      'Automate Charles Schwab with AutoTrader: connect the Schwab Trader API and run no-code strategies on US stocks and ETFs with built-in risk controls.',
  },
  {
    slug: 'ig-markets',
    paperId: 'ig-markets-demo',
    homepageUrl: 'https://www.ig.com/',
    founded: 1974,
    headquarters: 'London, United Kingdom',
    tagline: 'Global CFDs on forex, indices, shares and commodities from a pioneer of online trading.',
    overview: `IG is the trading platform of IG Group, a London-listed company that has offered financial markets to retail traders since 1974. IG is best known for CFDs and — in the UK and Ireland — spread betting across thousands of markets, including forex, stock indices, shares, commodities and cryptocurrencies.

AutoTrader connects to IG through the IG REST Trading API using your API key, password and username. A free IG demo account gives you virtual funds on the same markets, so you can see how a strategy behaves before trading live.`,
    assetClasses: ['cfds', 'forex', 'indices', 'globalStocks', 'commodities', 'spotCrypto'],
    stockSymbols: ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'VOD', 'BP', 'HSBA', 'SAP'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD'],
    otherSymbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'US 500', 'Germany 40', 'FTSE 100', 'Gold', 'Brent Crude'],
    metaTitle: 'IG Markets Trading Bot — Automate IG CFDs & Forex | Invest-Begin',
    metaDescription:
      'Automate IG Markets with AutoTrader: run no-code strategies on forex, indices, shares and commodities, and test first on a free IG demo account.',
  },

  // ── Crypto Exchanges ─────────────────────────────────────────────────────
  {
    slug: 'binance',
    homepageUrl: 'https://www.binance.com/',
    founded: 2017,
    headquarters: 'Global (no single headquarters)',
    tagline: "The world's largest crypto exchange by trading volume.",
    overview: `Binance is the largest cryptocurrency exchange in the world by trading volume, listing hundreds of coins with deep liquidity on its main pairs. Alongside spot trading it offers margin, perpetual and delivery futures, and options.

AutoTrader connects to Binance with an API key and secret. Your strategies trade spot pairs in your own Binance account, and because the key only needs trading permission — never withdrawal — your funds stay under your control at all times.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals', 'cryptoFutures', 'cryptoOptions'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'LINK/USDT'],
    metaTitle: 'Binance Trading Bot — Automate Binance Crypto | Invest-Begin',
    metaDescription:
      'Automate Binance with AutoTrader: connect an API key, run no-code strategies on BTC, ETH, BNB, SOL and hundreds of spot pairs, with built-in risk controls.',
  },
  {
    slug: 'coinbase',
    homepageUrl: 'https://www.coinbase.com/advanced-trade',
    founded: 2012,
    headquarters: 'United States (remote-first)',
    tagline: 'The advanced trading platform of the largest US-listed crypto exchange.',
    overview: `Coinbase Advanced is the professional trading interface of Coinbase, a publicly traded US company and one of the most regulated names in crypto. It offers spot trading on hundreds of assets with order-book charts and lower fees than the simple Coinbase app.

AutoTrader connects to Coinbase Advanced with an API key, secret and passphrase. Strategies trade in your own Coinbase account, and the key only needs view and trade permissions — AutoTrader never asks for the ability to move funds.`,
    assetClasses: ['spotCrypto', 'cryptoFutures'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD', 'LTC/USD', 'AVAX/USD', 'LINK/USD'],
    metaTitle: 'Coinbase Advanced Trading Bot — Automate Coinbase | Invest-Begin',
    metaDescription:
      'Automate Coinbase Advanced with AutoTrader: connect an API key and run no-code strategies on BTC, ETH, SOL and other USD crypto pairs.',
  },
  {
    slug: 'kraken',
    homepageUrl: 'https://www.kraken.com/',
    founded: 2011,
    headquarters: 'San Francisco, California, USA',
    tagline: 'One of the longest-running and most security-focused crypto exchanges.',
    overview: `Kraken launched in 2011 and is one of the oldest cryptocurrency exchanges still operating, with a reputation for security and regulatory compliance. It offers spot trading in USD, EUR, GBP and other fiat currencies, plus margin and futures trading.

AutoTrader connects to Kraken with an API key pair. Your strategies trade spot pairs in your own Kraken account using a key that only needs query and trade permissions, keeping withdrawals switched off.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoFutures', 'cryptoPerpetuals'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD', 'DOT/USD', 'BTC/EUR', 'ETH/EUR'],
    metaTitle: 'Kraken Trading Bot — Automate Kraken Crypto | Invest-Begin',
    metaDescription:
      'Automate Kraken with AutoTrader: connect an API key and run no-code strategies on BTC, ETH and other USD and EUR crypto pairs.',
  },
  {
    slug: 'bybit',
    paperId: 'bybit-testnet',
    homepageUrl: 'https://www.bybit.com/',
    founded: 2018,
    headquarters: 'Dubai, United Arab Emirates',
    tagline: 'A leading crypto derivatives exchange with a growing spot market.',
    overview: `Bybit is one of the largest crypto exchanges by derivatives volume, best known for its perpetual contracts. It also offers spot trading on hundreds of coins, delivery futures and options, all through a fast, well-documented API.

AutoTrader connects to Bybit with an API key and secret. Your strategies trade in your own Bybit account, and the Bybit testnet lets you run the exact same strategy with test funds before going live.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals', 'cryptoFutures', 'cryptoOptions'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'TON/USDT', 'SUI/USDT', 'LINK/USDT'],
    metaTitle: 'Bybit Trading Bot — Automate Bybit Crypto | Invest-Begin',
    metaDescription:
      'Automate Bybit with AutoTrader: run no-code strategies on BTC, ETH, SOL and other pairs, and test them risk-free on the Bybit testnet first.',
  },
  {
    slug: 'okx',
    paperId: 'okx-demo',
    homepageUrl: 'https://www.okx.com/',
    founded: 2017,
    headquarters: 'Victoria, Seychelles',
    tagline: 'A major global exchange for crypto spot, futures and options.',
    overview: `OKX is one of the largest crypto exchanges in the world, offering spot trading on hundreds of assets together with margin, perpetual swaps, delivery futures and options. Its unified account lets you use one balance across all of these markets.

AutoTrader connects to OKX with an API key, secret and passphrase. Your strategies trade in your own OKX account, and OKX Demo Trading gives you a simulated account to test strategies with no real funds at risk.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals', 'cryptoFutures', 'cryptoOptions'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'OKB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'TON/USDT', 'LTC/USDT'],
    metaTitle: 'OKX Trading Bot — Automate OKX Crypto | Invest-Begin',
    metaDescription:
      'Automate OKX with AutoTrader: run no-code strategies on BTC, ETH, SOL and hundreds of pairs, and test them first with OKX Demo Trading.',
  },
  {
    slug: 'kucoin',
    paperId: 'kucoin-sandbox',
    homepageUrl: 'https://www.kucoin.com/',
    founded: 2017,
    headquarters: 'Victoria, Seychelles',
    tagline: 'A huge altcoin selection with high liquidity.',
    overview: `KuCoin is known as a go-to exchange for altcoins, listing many tokens early and offering one of the widest selections of trading pairs in the market. Beyond spot it provides margin trading and perpetual futures.

AutoTrader connects to KuCoin with an API key, secret and passphrase. Your strategies trade spot pairs in your own KuCoin account, using a key limited to trading permissions.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'KCS/USDT', 'SOL/USDT', 'XRP/USDT', 'PEPE/USDT', 'DOGE/USDT', 'SUI/USDT'],
    metaTitle: 'KuCoin Trading Bot — Automate KuCoin Altcoins | Invest-Begin',
    metaDescription:
      'Automate KuCoin with AutoTrader: connect an API key and run no-code strategies on BTC, ETH and a wide range of altcoin pairs.',
  },
  {
    slug: 'bitfinex',
    homepageUrl: 'https://www.bitfinex.com/',
    founded: 2012,
    headquarters: 'British Virgin Islands',
    tagline: 'An advanced exchange for experienced traders, with margin and derivatives.',
    overview: `Bitfinex is one of the longest-established crypto exchanges, aimed at experienced traders. It offers deep order books on major pairs, peer-to-peer margin funding, and perpetual derivatives, with a comprehensive API for algorithmic trading.

AutoTrader connects to Bitfinex with an API key and secret. Your strategies trade spot pairs in your own Bitfinex account, using a key limited to trading permissions.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals'],
    cryptoSymbols: ['BTC/USD', 'ETH/USD', 'BTC/USDT', 'SOL/USD', 'XRP/USD', 'LEO/USD', 'LTC/USD', 'BTC/EUR'],
    metaTitle: 'Bitfinex Trading Bot — Automate Bitfinex Crypto | Invest-Begin',
    metaDescription:
      'Automate Bitfinex with AutoTrader: connect an API key and run no-code strategies on BTC, ETH and other major crypto pairs.',
  },
  {
    slug: 'gateio',
    homepageUrl: 'https://www.gate.io/',
    founded: 2013,
    headquarters: 'Global',
    tagline: 'A vast token selection with deep liquidity across spot and derivatives.',
    overview: `Gate.io has operated since 2013 and lists one of the largest selections of cryptocurrencies of any exchange, making it popular with traders hunting for newer tokens. It offers spot, margin, perpetual and delivery futures, and options.

AutoTrader connects to Gate.io with an API key and secret. Your strategies trade spot pairs in your own Gate.io account, with trading-only permissions on the key.`,
    assetClasses: ['spotCrypto', 'cryptoMargin', 'cryptoPerpetuals', 'cryptoFutures', 'cryptoOptions'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'GT/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'PEPE/USDT', 'SUI/USDT'],
    metaTitle: 'Gate.io Trading Bot — Automate Gate.io Crypto | Invest-Begin',
    metaDescription:
      'Automate Gate.io with AutoTrader: connect an API key and run no-code strategies on BTC, ETH and a huge range of altcoin pairs.',
  },
  {
    slug: 'mexc',
    homepageUrl: 'https://www.mexc.com/',
    founded: 2018,
    headquarters: 'Victoria, Seychelles',
    tagline: 'Low fees and an extensive altcoin catalogue.',
    overview: `MEXC is a global crypto exchange known for very low trading fees and for listing new tokens quickly. It offers spot trading on a very large number of pairs as well as perpetual futures.

AutoTrader connects to MEXC with an API key and secret. Your strategies trade spot pairs in your own MEXC account, and the key only needs trading permission.`,
    assetClasses: ['spotCrypto', 'cryptoPerpetuals'],
    cryptoSymbols: ['BTC/USDT', 'ETH/USDT', 'MX/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'PEPE/USDT', 'SUI/USDT'],
    metaTitle: 'MEXC Trading Bot — Automate MEXC Crypto | Invest-Begin',
    metaDescription:
      'Automate MEXC with AutoTrader: connect an API key and run no-code strategies on BTC, ETH and hundreds of low-fee altcoin pairs.',
  },
  {
    slug: 'deribit',
    paperId: 'deribit-testnet',
    homepageUrl: 'https://www.deribit.com/',
    founded: 2016,
    headquarters: 'Dubai, United Arab Emirates',
    tagline: 'The leading exchange for Bitcoin and Ether options.',
    overview: `Deribit is the dominant venue for crypto options, handling the large majority of global Bitcoin and Ether options volume. It also offers futures, perpetuals and spot trading, and is widely used by professional and institutional traders. Deribit is now part of Coinbase.

AutoTrader connects to Deribit with an API client ID and secret. Your strategies trade in your own Deribit account, and the Deribit testnet provides a full copy of the exchange with test funds for risk-free practice.`,
    assetClasses: ['cryptoOptions', 'cryptoFutures', 'cryptoPerpetuals', 'spotCrypto'],
    cryptoSymbols: ['BTC-PERPETUAL', 'ETH-PERPETUAL', 'BTC options', 'ETH options', 'BTC/USDC', 'ETH/USDC'],
    metaTitle: 'Deribit Trading Bot — Automate Deribit Crypto | Invest-Begin',
    metaDescription:
      'Automate Deribit with AutoTrader: run no-code strategies on BTC and ETH perpetuals, and test them risk-free on the Deribit testnet.',
  },
];

const BROKER_PAGES_BY_SLUG = new Map(BROKER_PAGES.map((page) => [page.slug, page]));
const EXCHANGES_BY_ID = new Map(SUPPORTED_EXCHANGES.map((exchange) => [exchange.id, exchange]));

export function brokerPage(slug: string): BrokerPageData | undefined {
  return BROKER_PAGES_BY_SLUG.get(slug);
}

/** The `SUPPORTED_EXCHANGES` entry behind a broker page (or its paper variant). */
export function brokerExchange(id: string): Exchange | undefined {
  return EXCHANGES_BY_ID.get(id);
}
