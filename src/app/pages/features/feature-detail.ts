import { Component, DestroyRef, OnInit, SecurityContext, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface FeatureLink {
  label: string;
  url: string;
  description: string;
}

export interface FeatureBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface RelatedPageLink {
  label: string;
  slug: string;
}

export interface FeatureData {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  heroDescription: string;
  overview: string;
  howItWorks: string;
  benefits: FeatureBenefit[];
  externalLinks: FeatureLink[];
  relatedLinks: RelatedPageLink[];
  svgIllustration: string;
  metaTitle: string;
}

interface FeatureNavLink {
  slug: string;
  label: string;
  tagline: string;
  icon: string;
}

const FEATURES: Record<string, FeatureData> = {
  'ai-signals': {
    slug: 'ai-signals',
    icon: '⚡',
    title: 'AI-Powered Signals',
    tagline: 'Let machine intelligence find your next trade.',
    metaTitle: 'AI-Powered Signals — AutoTrader',
    heroDescription:
      'Harness the power of machine learning to detect high-probability trade setups across thousands of assets — before the market moves.',
    overview: `Artificial intelligence has fundamentally changed the way professional traders approach the markets. At auto-Trading, our AI-powered signals engine continuously scans thousands of assets across equities, cryptocurrencies, forex pairs, and commodities — 24 hours a day, 7 days a week — to identify patterns that human analysts would take days to spot manually.

Our proprietary signal models are built on a multi-layer neural network architecture trained on decades of tick-level price data, order-flow metrics, and macroeconomic indicators. Each model learns to recognise formations such as momentum breakouts, mean-reversion opportunities, volatility compression events, and cross-asset divergences. Once a high-probability setup is detected, the system generates a signal with an associated confidence score, recommended entry range, stop-loss level, and take-profit targets.

Unlike static rule-based indicators, our AI signals adapt over time. Models are continuously retrained as new market data arrives, ensuring they remain relevant across changing market regimes — trending, ranging, or high-volatility environments. The engine is also exchange-aware: it factors in liquidity depth and typical spread for each asset so that the signals it surfaces are realistic and executable.

Every signal is back-tested against out-of-sample historical data before it is promoted to the live environment. This means you can trust that what you see in the signal feed reflects genuine edge — not a curve-fit artefact.`,
    howItWorks: `The signals pipeline runs in three stages. First, a data-ingestion layer aggregates real-time price and volume feeds from all connected exchanges. Second, the feature-engineering module derives technical indicators, statistical moments, and market-microstructure features from the raw data. Third, the trained models score each asset and flag those that exceed the confidence threshold you set in your settings. Signals are surfaced instantly in the dashboard and, if you have alerts configured, delivered via push notification, email, or Telegram.`,
    benefits: [
      {
        icon: '🎯',
        title: 'High-probability setups',
        description:
          'Models are precision-tuned for win rate and risk-reward balance, filtering out low-quality noise.',
      },
      {
        icon: '🔄',
        title: 'Continuously learning',
        description:
          'Adaptive retraining keeps the models aligned with current market conditions.',
      },
      {
        icon: '📈',
        title: 'Multi-asset coverage',
        description:
          'Signals span crypto, equities, forex, and commodities — all in one feed.',
      },
      {
        icon: '⏱️',
        title: 'Real-time delivery',
        description:
          'Signals arrive in milliseconds, ensuring you never miss a fast-moving opportunity.',
      },
      {
        icon: '🔍',
        title: 'Transparent scoring',
        description:
          'Every signal includes a confidence score and the key factors that triggered it.',
      },
      {
        icon: '🛡️',
        title: 'Built-in risk parameters',
        description:
          'Each signal ships with a suggested stop-loss and take-profit so position sizing is straightforward.',
      },
    ],
    externalLinks: [
      {
        label: 'TradingView',
        url: 'https://www.tradingview.com',
        description: 'Visualise signal-triggered setups on professional-grade charts.',
      },
      {
        label: 'CoinGecko',
        url: 'https://www.coingecko.com',
        description: 'Track crypto market data and on-chain metrics alongside your signals.',
      },
      {
        label: 'Investopedia — Machine Learning in Finance',
        url: 'https://www.investopedia.com/terms/m/machine-learning.asp',
        description: 'Deep-dive into how ML models are reshaping financial markets.',
      },
    ],
    relatedLinks: [
      { slug: 'smart-alerts',      label: 'Smart Alerts' },
      { slug: 'risk-management',   label: 'Risk Management' },
      { slug: 'backtesting',       label: 'Advanced Backtesting' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sig-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00d17a" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#00d17a" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- grid lines -->
      <line x1="40" y1="230" x2="460" y2="230" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <line x1="40" y1="190" x2="460" y2="190" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <line x1="40" y1="150" x2="460" y2="150" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <line x1="40" y1="110" x2="460" y2="110" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <!-- price area fill -->
      <path d="M40,200 C80,195 110,185 150,170 C190,155 210,165 250,140 C290,115 310,125 350,95 C380,72 420,85 460,60 L460,230 L40,230 Z" fill="url(#sig-grad)"/>
      <!-- price line -->
      <path d="M40,200 C80,195 110,185 150,170 C190,155 210,165 250,140 C290,115 310,125 350,95 C380,72 420,85 460,60" fill="none" stroke="#00d17a" stroke-width="2.5" stroke-linecap="round"/>
      <!-- buy signal dot -->
      <circle cx="150" cy="170" r="7" fill="#00d17a" opacity="0.9"/>
      <line x1="150" y1="163" x2="150" y2="145" stroke="#00d17a" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="130" y="130" width="40" height="16" rx="4" fill="#00d17a" opacity="0.2"/>
      <text x="150" y="142" text-anchor="middle" fill="#00d17a" font-size="9" font-family="monospace">BUY ⚡</text>
      <!-- sell signal dot -->
      <circle cx="350" cy="95" r="7" fill="#ff6b6b" opacity="0.9"/>
      <line x1="350" y1="102" x2="350" y2="118" stroke="#ff6b6b" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="330" y="118" width="40" height="16" rx="4" fill="#ff6b6b" opacity="0.2"/>
      <text x="350" y="130" text-anchor="middle" fill="#ff6b6b" font-size="9" font-family="monospace">SELL ⚡</text>
      <!-- AI nodes -->
      <circle cx="240" cy="40" r="18" fill="rgba(0,209,122,0.15)" stroke="#00d17a" stroke-width="1.5"/>
      <text x="240" y="45" text-anchor="middle" fill="#00d17a" font-size="11">AI</text>
      <line x1="225" y1="48" x2="150" y2="170" stroke="rgba(0,209,122,0.2)" stroke-width="1"/>
      <line x1="255" y1="48" x2="350" y2="95" stroke="rgba(0,209,122,0.2)" stroke-width="1"/>
    </svg>`,
  },

  'multi-exchange': {
    slug: 'multi-exchange',
    icon: '🔗',
    title: 'Multi-Exchange Support',
    tagline: 'One platform. Every major exchange. Zero friction.',
    metaTitle: 'Multi-Exchange Support — AutoTrader',
    heroDescription:
      'Connect Binance, Coinbase, Kraken, Bybit, and 30+ more exchanges through a single unified API and manage everything from one dashboard.',
    overview: `Managing trading accounts across multiple exchanges has traditionally been a nightmare. Each platform has its own interface, its own API quirks, and its own risk model. auto-Trading eliminates that complexity by providing a single, unified integration layer that speaks the native language of every major exchange.

Our multi-exchange architecture is built around a standardised order-routing protocol. When you create a strategy or signal bot, you simply choose which exchange and trading pair you want to target. auto-Trading translates your instructions into the correct API call format for that exchange — handling authentication, rate-limit management, order-type mapping, and error recovery transparently in the background.

We currently support more than 30 spot and derivatives exchanges, including Binance (spot, futures, and margin), Coinbase Advanced Trade, Kraken Spot and Futures, Bybit, OKX, KuCoin, Gate.io, Bitfinex, MEXC, and many more. New exchange integrations are added regularly based on user demand. For traditional finance users, we also support select brokers via FIX and REST adapters.

Connecting an exchange is a straightforward three-step process: generate read-and-trade API keys in your exchange account settings, paste them into the auto-Trading secure vault, and run a connection test. Your API keys are encrypted at rest using AES-256 and never leave our secure key-management service. Withdrawal permissions are never requested — your funds remain under your control at all times.

Once connected, you can run multiple bots on the same exchange simultaneously, each with its own strategy, risk limits, and position sizing. Cross-exchange arbitrage strategies are also supported for advanced users who want to exploit price discrepancies across venues.`,
    howItWorks: `After connecting your exchange via API keys, auto-Trading maintains a persistent, authenticated session with the exchange's WebSocket feed to receive real-time price updates and order book data. When a bot triggers an order, our routing engine submits it directly to the exchange's order API, monitors its status, and handles partial fills, rejections, and network timeouts automatically. All trade history and P&L data is reconciled from the exchange's own records to ensure accuracy.`,
    benefits: [
      {
        icon: '🏦',
        title: '30+ exchanges supported',
        description:
          'Binance, Coinbase, Kraken, Bybit, OKX, KuCoin, and many more — all in one place.',
      },
      {
        icon: '🔐',
        title: 'AES-256 key encryption',
        description:
          'Your API keys are encrypted and stored in an isolated key-management vault.',
      },
      {
        icon: '⚡',
        title: 'WebSocket real-time data',
        description:
          'Live price feeds and order status updates with millisecond latency.',
      },
      {
        icon: '🤖',
        title: 'Simultaneous multi-bot execution',
        description:
          'Run multiple strategies on the same or different exchanges at the same time.',
      },
      {
        icon: '🔄',
        title: 'Automatic error recovery',
        description:
          'Rate-limit handling, order retry logic, and connection recovery built in.',
      },
      {
        icon: '📊',
        title: 'Unified P&L dashboard',
        description:
          'View aggregated performance across all connected exchanges in one place.',
      },
    ],
    externalLinks: [
      {
        label: 'Binance',
        url: 'https://www.binance.com',
        description: "The world's largest crypto exchange by volume — fully supported.",
      },
      {
        label: 'Coinbase Advanced Trade',
        url: 'https://advanced.coinbase.com',
        description: "Coinbase's professional trading platform with deep order books.",
      },
      {
        label: 'Kraken',
        url: 'https://www.kraken.com',
        description: 'A trusted exchange known for its security and futures products.',
      },
      {
        label: 'Bybit',
        url: 'https://www.bybit.com',
        description: 'Leading derivatives exchange with high-leverage perpetual contracts.',
      },
    ],
    relatedLinks: [
      { slug: 'no-code-builder',  label: 'No-Code Strategy Builder' },
      { slug: 'smart-alerts',     label: 'Smart Alerts' },
      { slug: 'risk-management',  label: 'Risk Management' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <!-- center hub -->
      <circle cx="240" cy="140" r="30" fill="rgba(0,209,122,0.15)" stroke="#00d17a" stroke-width="2"/>
      <text x="240" y="136" text-anchor="middle" fill="#00d17a" font-size="10" font-weight="bold">AUTO</text>
      <text x="240" y="150" text-anchor="middle" fill="#00d17a" font-size="10" font-weight="bold">TRADER</text>
      <!-- exchange nodes -->
      <circle cx="80" cy="70" r="22" fill="rgba(255,184,0,0.12)" stroke="rgba(255,184,0,0.5)" stroke-width="1.5"/>
      <text x="80" y="75" text-anchor="middle" fill="#ffb800" font-size="9" font-weight="bold">BNB</text>
      <line x1="100" y1="82" x2="212" y2="122" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>

      <circle cx="390" cy="70" r="22" fill="rgba(0,82,255,0.12)" stroke="rgba(0,82,255,0.5)" stroke-width="1.5"/>
      <text x="390" y="75" text-anchor="middle" fill="#4f82ff" font-size="9" font-weight="bold">CBP</text>
      <line x1="370" y1="82" x2="268" y2="122" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>

      <circle cx="60" cy="190" r="22" fill="rgba(94,0,255,0.12)" stroke="rgba(94,0,255,0.5)" stroke-width="1.5"/>
      <text x="60" y="195" text-anchor="middle" fill="#a064ff" font-size="9" font-weight="bold">KRK</text>
      <line x1="82" y1="180" x2="212" y2="155" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>

      <circle cx="400" cy="190" r="22" fill="rgba(255,99,0,0.12)" stroke="rgba(255,99,0,0.5)" stroke-width="1.5"/>
      <text x="400" y="195" text-anchor="middle" fill="#ff6300" font-size="9" font-weight="bold">BBT</text>
      <line x1="380" y1="180" x2="268" y2="155" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>

      <circle cx="240" cy="240" r="22" fill="rgba(0,168,255,0.12)" stroke="rgba(0,168,255,0.5)" stroke-width="1.5"/>
      <text x="240" y="245" text-anchor="middle" fill="#00a8ff" font-size="9" font-weight="bold">OKX</text>
      <line x1="240" y1="218" x2="240" y2="170" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>

      <circle cx="150" cy="35" r="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="150" y="40" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">+27</text>
      <line x1="158" y1="50" x2="215" y2="115" stroke="rgba(0,209,122,0.15)" stroke-width="1" stroke-dasharray="3 3"/>
    </svg>`,
  },

  'risk-management': {
    slug: 'risk-management',
    icon: '🛡️',
    title: 'Risk Management',
    tagline: 'Protect your capital with institutional-grade controls.',
    metaTitle: 'Risk Management — AutoTrader',
    heroDescription:
      'Customisable stop-loss, take-profit, position sizing, and portfolio exposure limits protect your capital around the clock — so one bad trade can never sink your account.',
    overview: `Risk management is the single most important discipline in trading — more important than any signal, strategy, or system. Even the best entry logic will fail over time without a robust framework for controlling losses. auto-Trading puts institutional-grade risk controls directly in your hands, regardless of your experience level.

At the trade level, every bot can be configured with a hard stop-loss (a price level at which the position is closed to cap downside), a take-profit target (where gains are locked in), and a trailing stop (which moves the exit price upward as the trade becomes profitable). These levels can be set as fixed prices, percentage offsets from entry, or ATR (Average True Range) multiples for a volatility-adjusted approach.

At the position level, you can enforce maximum position size as a percentage of your account equity, a fixed-dollar amount, or Kelly-criterion sizing based on historical win rate and risk-reward. This prevents any single trade from taking up an outsized share of your portfolio.

At the portfolio level, you can define maximum drawdown limits per bot, per exchange, and across your entire portfolio. When a drawdown limit is breached, auto-Trading automatically pauses the affected bot and sends you an alert, giving you time to review the situation before re-activating. You can also set daily loss limits to prevent a bot from trading after a certain amount of capital has been lost in a single day — a feature inspired by the risk controls used at professional trading firms.

Margin users benefit from additional safeguards including maximum leverage caps and automatic deleveraging if account margin falls below a configurable threshold. All risk parameters are audited and logged, providing a complete trail of every risk event for review and regulatory compliance.`,
    howItWorks: `Risk rules are enforced at the order submission layer — before any order reaches the exchange. When a bot attempts to open a new position, auto-Trading's risk engine checks the proposed trade against all active rules: position size limits, portfolio exposure, drawdown thresholds, and daily loss budgets. Only if all checks pass does the order proceed. Stop-loss and take-profit orders are submitted simultaneously with the entry order as limit or stop-market orders depending on your preference.`,
    benefits: [
      {
        icon: '🚫',
        title: 'Hard stop-loss & take-profit',
        description:
          'Fixed, percentage, or ATR-based levels ensure every trade has a defined exit.',
      },
      {
        icon: '📏',
        title: 'Flexible position sizing',
        description:
          'Fixed size, equity percentage, or Kelly-criterion sizing to match your risk tolerance.',
      },
      {
        icon: '📉',
        title: 'Drawdown circuit-breakers',
        description:
          'Auto-pause bots when drawdown limits are hit at trade, bot, or portfolio level.',
      },
      {
        icon: '📅',
        title: 'Daily loss limits',
        description:
          'Stop trading for the day after a preset loss threshold — just like professional desks.',
      },
      {
        icon: '📋',
        title: 'Risk audit log',
        description:
          'Every risk event is recorded for review, compliance, and strategy refinement.',
      },
      {
        icon: '💡',
        title: 'Pre-trade validation',
        description:
          'All rules are checked before order submission — risk is managed proactively, not reactively.',
      },
    ],
    externalLinks: [
      {
        label: 'Investopedia — Risk Management in Trading',
        url: 'https://www.investopedia.com/articles/trading/09/risk-management.asp',
        description: 'A comprehensive primer on managing risk across trading strategies.',
      },
      {
        label: 'TradingView — Pine Script Risk Tools',
        url: 'https://www.tradingview.com/pine-script-docs/en/v5/concepts/Strategies.html',
        description: 'Learn how risk parameters are modelled in strategy back-tests.',
      },
      {
        label: 'BabyPips — Risk Management Guide',
        url: 'https://www.babypips.com/learn/forex/risk-management',
        description: "BabyPips' trusted guide to position sizing and capital preservation.",
      },
    ],
    relatedLinks: [
      { slug: 'ai-signals',    label: 'AI-Powered Signals' },
      { slug: 'smart-alerts',  label: 'Smart Alerts' },
      { slug: 'backtesting',   label: 'Advanced Backtesting' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <!-- shield body -->
      <path d="M240,30 L330,70 L330,165 Q330,220 240,255 Q150,220 150,165 L150,70 Z" fill="rgba(0,209,122,0.1)" stroke="#00d17a" stroke-width="2"/>
      <!-- checkmark inside shield -->
      <polyline points="205,145 228,170 278,118" fill="none" stroke="#00d17a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- stop loss line -->
      <line x1="60" y1="200" x2="420" y2="200" stroke="#ff6b6b" stroke-width="1.5" stroke-dasharray="8 4"/>
      <text x="66" y="196" fill="#ff6b6b" font-size="10" font-family="monospace">Stop Loss</text>
      <!-- take profit line -->
      <line x1="60" y1="95" x2="420" y2="95" stroke="#00d17a" stroke-width="1.5" stroke-dasharray="8 4"/>
      <text x="66" y="91" fill="#00d17a" font-size="10" font-family="monospace">Take Profit</text>
      <!-- entry line -->
      <line x1="60" y1="148" x2="420" y2="148" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="4 3"/>
      <text x="66" y="144" fill="rgba(255,255,255,0.5)" font-size="10" font-family="monospace">Entry</text>
    </svg>`,
  },

  'backtesting': {
    slug: 'backtesting',
    icon: '📊',
    title: 'Advanced Backtesting',
    tagline: 'Prove your strategy before risking a single dollar.',
    metaTitle: 'Advanced Backtesting — AutoTrader',
    heroDescription:
      'Test your strategies against years of tick-level historical data before committing a single dollar to live trading.',
    overview: `Backtesting is the process of applying a trading strategy to historical market data to evaluate how it would have performed in the past. While past performance is never a guarantee of future results, rigorous backtesting is an indispensable step in validating that a strategy has genuine statistical edge — rather than being a lucky pattern that happened to fit one particular market period.

auto-Trading's backtesting engine is built for speed, accuracy, and depth. Our historical data library covers tick-level OHLCV (open, high, low, close, volume) data for thousands of trading pairs across all supported exchanges, with some datasets stretching back more than ten years. Tick-level granularity means your backtest accurately models slippage, spread, and partial fills — the details that matter most when you transition from a test environment to live trading.

Running a backtest is as simple as selecting your strategy, specifying the instrument and date range, and clicking run. Results are available within seconds for most strategies, even over multi-year windows. The results view shows the equity curve, maximum drawdown, Sharpe ratio, Sortino ratio, win rate, average win/loss, profit factor, and a full trade-by-trade breakdown. You can export results to CSV for further analysis in your preferred analytics tool.

For users who want to avoid overfitting, our walk-forward analysis tool automatically divides the historical window into in-sample (optimisation) and out-of-sample (validation) periods and reports performance across multiple out-of-sample segments. Monte Carlo simulation is also available: it randomly shuffles the order of historical trades to estimate the distribution of possible outcomes and the probability of ruin.

Strategy optimisation lets you sweep a range of parameter values (e.g., moving average periods or RSI thresholds) and identify configurations that maximise a chosen objective function — such as the Sharpe ratio or profit factor — while controlling for overfitting through parameter sensitivity analysis.`,
    howItWorks: `When you launch a backtest, the engine loads the requested historical data from our distributed time-series database and feeds it bar-by-bar through your strategy logic. Each bar triggers the same signal generation, order routing, and risk management code that runs in live trading — ensuring simulation fidelity. The engine tracks open positions, unrealised P&L, and margin usage at every tick, producing a precise equity curve that reflects realistic trading conditions including commissions, slippage estimates, and funding rates for perpetual contracts.`,
    benefits: [
      {
        icon: '📅',
        title: 'Years of tick-level history',
        description:
          'Data stretching back 10+ years at tick granularity for realistic simulation.',
      },
      {
        icon: '📈',
        title: 'Full performance analytics',
        description:
          'Sharpe, Sortino, max drawdown, win rate, profit factor, and more — all in one view.',
      },
      {
        icon: '🔄',
        title: 'Walk-forward validation',
        description:
          'Automatically test on out-of-sample periods to guard against overfitting.',
      },
      {
        icon: '🎲',
        title: 'Monte Carlo simulation',
        description:
          'Estimate outcome distributions and probability of ruin from your trade history.',
      },
      {
        icon: '⚙️',
        title: 'Parameter optimisation',
        description:
          'Sweep parameter ranges and identify robust configurations efficiently.',
      },
      {
        icon: '📤',
        title: 'CSV export',
        description:
          'Export full trade logs and equity curves for external analysis.',
      },
    ],
    externalLinks: [
      {
        label: 'TradingView Strategy Tester',
        url: 'https://www.tradingview.com/support/solutions/43000561982-strategy-tester-overview/',
        description: "TradingView's built-in backtesting documentation — great for understanding fundamentals.",
      },
      {
        label: 'Investopedia — Backtesting Definition',
        url: 'https://www.investopedia.com/terms/b/backtesting.asp',
        description: 'Clear explanation of backtesting concepts, limitations, and best practices.',
      },
      {
        label: 'QuantConnect',
        url: 'https://www.quantconnect.com',
        description: 'Algorithmic trading research platform — a great complement for advanced users.',
      },
    ],
    relatedLinks: [
      { slug: 'no-code-builder',  label: 'No-Code Strategy Builder' },
      { slug: 'risk-management',  label: 'Risk Management' },
      { slug: 'ai-signals',       label: 'AI-Powered Signals' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00d17a" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#00d17a" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff6b6b" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#ff6b6b" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- grid -->
      <line x1="50" y1="230" x2="450" y2="230" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <line x1="50" y1="185" x2="450" y2="185" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <line x1="50" y1="140" x2="450" y2="140" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <line x1="50" y1="95" x2="450" y2="95" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <line x1="50" y1="50" x2="450" y2="50" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <!-- in-sample area -->
      <rect x="50" y="40" width="200" height="200" fill="rgba(0,209,122,0.03)" stroke="rgba(0,209,122,0.15)" stroke-width="1" stroke-dasharray="4 3"/>
      <text x="150" y="58" text-anchor="middle" fill="rgba(0,209,122,0.5)" font-size="9">In-sample</text>
      <!-- out-of-sample area -->
      <rect x="250" y="40" width="200" height="200" fill="rgba(0,168,255,0.03)" stroke="rgba(0,168,255,0.15)" stroke-width="1" stroke-dasharray="4 3"/>
      <text x="350" y="58" text-anchor="middle" fill="rgba(0,168,255,0.5)" font-size="9">Out-of-sample</text>
      <!-- equity curve -->
      <path d="M50,220 C80,215 100,200 130,190 C160,180 175,188 200,170 C220,155 240,160 260,140 C280,122 300,115 330,95 C360,76 400,80 450,55" fill="none" stroke="#00d17a" stroke-width="2.5" stroke-linecap="round"/>
      <!-- drawdown -->
      <path d="M200,170 C210,173 218,177 225,185 C232,193 238,186 250,178" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="4 2"/>
      <!-- stat boxes -->
      <rect x="55" y="245" width="55" height="22" rx="4" fill="rgba(0,209,122,0.1)" stroke="rgba(0,209,122,0.3)" stroke-width="1"/>
      <text x="82" y="260" text-anchor="middle" fill="#00d17a" font-size="9">Win 68%</text>
      <rect x="118" y="245" width="55" height="22" rx="4" fill="rgba(0,209,122,0.1)" stroke="rgba(0,209,122,0.3)" stroke-width="1"/>
      <text x="145" y="260" text-anchor="middle" fill="#00d17a" font-size="9">PF 2.1</text>
      <rect x="181" y="245" width="55" height="22" rx="4" fill="rgba(0,209,122,0.1)" stroke="rgba(0,209,122,0.3)" stroke-width="1"/>
      <text x="208" y="260" text-anchor="middle" fill="#00d17a" font-size="9">SR 1.8</text>
    </svg>`,
  },

  'smart-alerts': {
    slug: 'smart-alerts',
    icon: '🔔',
    title: 'Smart Alerts',
    tagline: 'Stay informed, wherever you are.',
    metaTitle: 'Smart Alerts — AutoTrader',
    heroDescription:
      'Get real-time push, email, or Telegram notifications the moment trade conditions are met, positions open or close, or drawdown limits are breached.',
    overview: `In automated trading, staying informed is just as important as executing correctly. Markets move fast, and you need to know the moment something significant happens — whether that is a new signal firing, a position being opened or closed, a stop-loss being hit, or a bot encountering an unexpected error.

auto-Trading's Smart Alerts system is designed to keep you in the loop without overwhelming you with noise. You choose exactly what you want to be notified about, on which channels, and with what level of urgency. Notifications are dispatched in real time — typically within 100 milliseconds of the triggering event — ensuring you are never late to act.

Push Notifications are delivered directly to your mobile device via the auto-Trading app or your browser. They are the fastest channel and are ideal for time-sensitive events like new trade signals or risk-limit breaches. Push notifications are fully customisable: you can set quiet hours, choose which event types trigger them, and configure sounds and vibration patterns.

Email Alerts provide a more structured, audit-friendly record of your bot activity. Auto-Trading sends a formatted HTML email for each alert, containing the full details of the triggering event, current portfolio state, and a one-click deep-link back to the relevant section of the dashboard. You can set digest modes to batch non-urgent alerts into hourly or daily summaries.

Telegram Bot Integration connects your auto-Trading account to a private Telegram chat or group. This is particularly popular with traders who use Telegram as their primary communication tool and want trade updates alongside their messages. Setup takes less than two minutes: create a Telegram bot via @BotFather, copy the token into your auto-Trading settings, and start your first chat.

Custom Webhook Alerts let power users route notifications to any third-party system — Discord, Slack, a custom dashboard, or a serverless function — by posting a JSON payload to an endpoint of your choice.`,
    howItWorks: `Each alert is defined by a trigger condition, a message template, and one or more delivery channels. Trigger conditions include price-level crosses, indicator threshold events, order lifecycle events (filled, rejected, cancelled), risk-limit breaches, and scheduled time-based reports. Message templates support variable substitution so alerts include live data at the time of dispatch.`,
    benefits: [
      {
        icon: '📱',
        title: 'Push notifications',
        description:
          'Real-time alerts on your phone or browser within 100 ms of the triggering event.',
      },
      {
        icon: '📧',
        title: 'Email alerts',
        description:
          'Rich HTML emails with full context and a one-click link back to your dashboard.',
      },
      {
        icon: '💬',
        title: 'Telegram integration',
        description:
          'Receive trade updates in a private Telegram chat — set up in under two minutes.',
      },
      {
        icon: '🔗',
        title: 'Custom webhooks',
        description:
          'Route alerts to Discord, Slack, or any HTTP endpoint with a JSON payload.',
      },
      {
        icon: '🎛️',
        title: 'Granular control',
        description:
          'Choose exactly which events trigger alerts — signal, fill, error, drawdown, and more.',
      },
      {
        icon: '🌙',
        title: 'Quiet hours',
        description:
          'Suppress non-critical alerts during sleep hours so your rest is undisturbed.',
      },
    ],
    externalLinks: [
      {
        label: 'Telegram BotFather',
        url: 'https://t.me/botfather',
        description: "Create your Telegram bot token for auto-Trading's Telegram integration.",
      },
      {
        label: 'TradingView Alerts',
        url: 'https://www.tradingview.com/support/solutions/43000520149-what-is-an-alert/',
        description: "TradingView's alert system — a great comparison reference.",
      },
      {
        label: 'Discord Webhooks',
        url: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
        description: 'How to set up a Discord webhook to receive auto-Trading notifications.',
      },
    ],
    relatedLinks: [
      { slug: 'ai-signals',      label: 'AI-Powered Signals' },
      { slug: 'risk-management', label: 'Risk Management' },
      { slug: 'multi-exchange',  label: 'Multi-Exchange Support' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <!-- phone outline -->
      <rect x="170" y="30" width="140" height="220" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
      <rect x="180" y="50" width="120" height="160" rx="4" fill="rgba(0,209,122,0.06)" stroke="rgba(0,209,122,0.2)" stroke-width="1"/>
      <circle cx="240" cy="230" r="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <!-- notification cards -->
      <rect x="188" y="60" width="104" height="38" rx="6" fill="rgba(0,209,122,0.15)" stroke="rgba(0,209,122,0.4)" stroke-width="1"/>
      <text x="240" y="76" text-anchor="middle" fill="#00d17a" font-size="8" font-weight="bold">⚡ BUY Signal</text>
      <text x="240" y="89" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7">BTC/USDT · Conf 94%</text>

      <rect x="188" y="106" width="104" height="38" rx="6" fill="rgba(255,168,0,0.12)" stroke="rgba(255,168,0,0.4)" stroke-width="1"/>
      <text x="240" y="122" text-anchor="middle" fill="#ffa800" font-size="8" font-weight="bold">⚠️ Drawdown Alert</text>
      <text x="240" y="135" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7">Bot-3 reached 4.8%</text>

      <rect x="188" y="152" width="104" height="38" rx="6" fill="rgba(0,168,255,0.12)" stroke="rgba(0,168,255,0.4)" stroke-width="1"/>
      <text x="240" y="168" text-anchor="middle" fill="#00a8ff" font-size="8" font-weight="bold">✅ Trade Filled</text>
      <text x="240" y="181" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7">ETH/USDT +2.3%</text>
      <!-- notification bell -->
      <circle cx="80" cy="100" r="30" fill="rgba(0,209,122,0.1)" stroke="rgba(0,209,122,0.3)" stroke-width="1.5"/>
      <text x="80" y="108" text-anchor="middle" fill="#00d17a" font-size="22">🔔</text>
      <!-- Telegram icon area -->
      <circle cx="400" cy="150" r="30" fill="rgba(0,136,204,0.1)" stroke="rgba(0,136,204,0.3)" stroke-width="1.5"/>
      <text x="400" y="158" text-anchor="middle" fill="#0088cc" font-size="22">✈️</text>
      <!-- connecting lines -->
      <line x1="108" y1="110" x2="170" y2="130" stroke="rgba(0,209,122,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>
      <line x1="370" y1="150" x2="310" y2="150" stroke="rgba(0,136,204,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>
    </svg>`,
  },

  'no-code-builder': {
    slug: 'no-code-builder',
    icon: '🌐',
    title: 'No-Code Strategy Builder',
    tagline: 'Build powerful trading strategies without writing a single line of code.',
    metaTitle: 'No-Code Strategy Builder — AutoTrader',
    heroDescription:
      'Our drag-and-drop strategy builder lets you automate complex trading logic — entry conditions, filters, risk rules, and exit signals — without any programming knowledge.',
    overview: `Algorithmic trading was once the exclusive domain of software engineers and quant researchers. Writing robust, production-ready trading code requires expertise in programming languages, API integrations, concurrency management, error handling, and real-time data processing. auto-Trading's No-Code Strategy Builder changes all of that by providing a powerful visual interface that lets any trader — regardless of technical background — build, test, and deploy automated strategies.

The builder is organised around the concept of blocks. Each block represents a distinct piece of logic: a market data input, a technical indicator calculation, a conditional rule, an action (like opening or closing a position), or a risk parameter. You drag blocks from the side panel onto the canvas, connect them with arrows to define the flow of logic, and configure each block through a simple properties panel. The resulting strategy is compiled into an efficient execution graph that runs in auto-Trading's cloud infrastructure.

The indicator library currently includes over 80 standard technical indicators, including moving averages (SMA, EMA, WMA, DEMA, TEMA), momentum indicators (RSI, MACD, Stochastic, CCI, Williams %R), volatility indicators (Bollinger Bands, ATR, Keltner Channels, Donchian Channels), volume indicators (OBV, VWAP, MFI, CMF), and trend indicators (ADX, Ichimoku, Parabolic SAR). Custom indicator expressions are supported through a formula editor for users who want to combine standard indicators into bespoke calculations.

Condition blocks support logical operators (AND, OR, NOT), numeric comparisons, cross-over and cross-under detections, and time-of-day filters. Multi-timeframe analysis is also supported: you can reference indicator values from a higher timeframe (e.g., the daily trend direction) within a lower-timeframe strategy (e.g., a 15-minute entry signal).

Once you have built your strategy, you can paper-trade it to validate behaviour without any financial risk, run a full backtest over historical data, and then deploy it to live trading with a single click. Strategies can be duplicated, version-controlled, and shared with other auto-Trading users.`,
    howItWorks: `The visual strategy canvas is powered by a directed acyclic graph (DAG) engine. Each block you add to the canvas becomes a node in the DAG, and each connection between blocks defines a data dependency. When the strategy runs, the engine evaluates the DAG in topological order for every new market bar, ensuring that all upstream calculations are completed before downstream conditions and actions are evaluated. This design allows complex, multi-indicator strategies to run efficiently even at tick-level frequency.`,
    benefits: [
      {
        icon: '🖱️',
        title: 'True drag-and-drop',
        description:
          'Build strategies entirely with clicks and drags — no coding required.',
      },
      {
        icon: '📚',
        title: '80+ built-in indicators',
        description:
          'SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, Ichimoku, and many more.',
      },
      {
        icon: '🔀',
        title: 'Multi-timeframe support',
        description:
          'Reference higher-timeframe data inside lower-timeframe strategies.',
      },
      {
        icon: '📝',
        title: 'Version control',
        description:
          'Save and restore previous versions of your strategy at any time.',
      },
      {
        icon: '🧪',
        title: 'Integrated paper trading',
        description:
          'Test your strategy in a live market environment with virtual funds.',
      },
      {
        icon: '🚀',
        title: 'One-click live deployment',
        description:
          'Go from backtest to live trading in a single click — no code changes needed.',
      },
    ],
    externalLinks: [
      {
        label: 'TradingView Pine Script',
        url: 'https://www.tradingview.com/pine-script-docs/en/v5/',
        description: "TradingView's scripting language — great for understanding strategy logic concepts.",
      },
      {
        label: 'Investopedia — Algorithmic Trading',
        url: 'https://www.investopedia.com/terms/a/algorithmictrading.asp',
        description: 'Overview of algorithmic trading and how automation benefits traders.',
      },
      {
        label: 'QuantConnect — Algorithm Framework',
        url: 'https://www.quantconnect.com/docs/v2/writing-algorithms/algorithm-framework/overview',
        description: 'Advanced algorithmic trading framework for users ready to go beyond no-code.',
      },
    ],
    relatedLinks: [
      { slug: 'backtesting',     label: 'Advanced Backtesting' },
      { slug: 'multi-exchange',  label: 'Multi-Exchange Support' },
      { slug: 'smart-alerts',    label: 'Smart Alerts' },
    ],
    svgIllustration: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
      <!-- canvas background -->
      <rect x="40" y="30" width="400" height="220" rx="12" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <!-- grid dots -->
      <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="1" fill="rgba(255,255,255,0.06)"/>
      </pattern>
      <rect x="40" y="30" width="400" height="220" rx="12" fill="url(#dots)"/>
      <!-- block: data input -->
      <rect x="60" y="90" width="90" height="40" rx="8" fill="rgba(0,168,255,0.15)" stroke="rgba(0,168,255,0.5)" stroke-width="1.5"/>
      <text x="105" y="108" text-anchor="middle" fill="#00a8ff" font-size="9" font-weight="bold">📡 Price Data</text>
      <text x="105" y="122" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">BTC/USDT · 1h</text>
      <!-- block: indicator -->
      <rect x="190" y="65" width="100" height="40" rx="8" fill="rgba(255,168,0,0.15)" stroke="rgba(255,168,0,0.5)" stroke-width="1.5"/>
      <text x="240" y="83" text-anchor="middle" fill="#ffa800" font-size="9" font-weight="bold">📊 RSI (14)</text>
      <text x="240" y="97" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">Momentum</text>
      <!-- block: condition -->
      <rect x="190" y="120" width="100" height="40" rx="8" fill="rgba(168,0,255,0.15)" stroke="rgba(168,0,255,0.5)" stroke-width="1.5"/>
      <text x="240" y="138" text-anchor="middle" fill="#a800ff" font-size="9" font-weight="bold">🔀 RSI &lt; 30</text>
      <text x="240" y="152" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">Oversold</text>
      <!-- block: action -->
      <rect x="330" y="92" width="90" height="40" rx="8" fill="rgba(0,209,122,0.15)" stroke="rgba(0,209,122,0.5)" stroke-width="1.5"/>
      <text x="375" y="110" text-anchor="middle" fill="#00d17a" font-size="9" font-weight="bold">🟢 BUY</text>
      <text x="375" y="124" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">Market Order</text>
      <!-- connections -->
      <path d="M150,110 C165,110 180,83 190,83" fill="none" stroke="rgba(0,168,255,0.5)" stroke-width="1.5" marker-end="url(#arrow)"/>
      <path d="M150,110 C165,110 180,140 190,140" fill="none" stroke="rgba(0,168,255,0.5)" stroke-width="1.5"/>
      <path d="M290,140 C310,140 315,112 330,112" fill="none" stroke="rgba(0,209,122,0.5)" stroke-width="1.5"/>
      <!-- connector dots -->
      <circle cx="150" cy="110" r="4" fill="#00a8ff"/>
      <circle cx="290" cy="83" r="4" fill="#ffa800"/>
      <circle cx="290" cy="140" r="4" fill="#a800ff"/>
      <circle cx="330" cy="112" r="4" fill="#00d17a"/>
    </svg>`,
  },
};

@Component({
  selector: 'app-feature-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './feature-detail.html',
  styleUrl: './feature-detail.scss',
})
export class FeatureDetailPage implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  readonly auth     = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  languageService   = inject(LanguageService);
  private sanitizer = inject(DomSanitizer);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);

  private baseFeature: FeatureData | null = null;
  feature: FeatureData | null = null;
  safeSvg: SafeHtml | null = null;
  overviewParagraphs: string[] = [];
  howItWorksHtml = '';
  otherFeatures: FeatureNavLink[] = [];

  ngOnInit(): void {
    // Ensure first render has data even before the paramMap stream emits.
    this.loadFeature(this.route.snapshot.paramMap.get('slug') ?? '');

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.loadFeature(params.get('slug') ?? '');
      });

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTranslatedFeature());
  }

  private loadFeature(slug: string): void {
    const data = FEATURES[slug];
    if (!data) {
      void this.router.navigate(['/', this.languageService.currentLang()]);
      return;
    }

    this.baseFeature = data;
    this.safeSvg = this.sanitizer.bypassSecurityTrustHtml(data.svgIllustration);
    this.applyTranslatedFeature();
  }

  private t(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return translated === key ? fallback : translated;
  }

  private applyTranslatedFeature(): void {
    const base = this.baseFeature;
    if (!base) {
      return;
    }

    const keyRoot = `featurePages.${base.slug}`;
    const translatedOverview = this.t(`${keyRoot}.overview`, base.overview);
    const translatedHowItWorks = this.t(`${keyRoot}.howItWorks`, base.howItWorks);
    const translatedExternalLinks = base.externalLinks.map((link, index) => ({
      ...link,
      label: this.t(`${keyRoot}.externalLinks.${index}.label`, link.label),
      description: this.t(`${keyRoot}.externalLinks.${index}.description`, link.description),
    }));
    const translatedRelatedLinks = base.relatedLinks.map((link) => ({
      ...link,
      label: this.t(`featurePages.${link.slug}.title`, link.label),
    }));

    this.feature = {
      ...base,
      title: this.t(`${keyRoot}.title`, base.title),
      tagline: this.t(`${keyRoot}.tagline`, base.tagline),
      metaTitle: this.t(`${keyRoot}.metaTitle`, base.metaTitle),
      heroDescription: this.t(`${keyRoot}.heroDescription`, base.heroDescription),
      overview: translatedOverview,
      howItWorks: translatedHowItWorks,
      benefits: base.benefits.map((benefit, index) => ({
        ...benefit,
        title: this.t(`${keyRoot}.benefits.${index}.title`, benefit.title),
        description: this.t(`${keyRoot}.benefits.${index}.description`, benefit.description),
      })),
      externalLinks: translatedExternalLinks,
      relatedLinks: translatedRelatedLinks,
    };
    this.document.title = this.feature.metaTitle;

    const referencesHtml = this.inlineReferenceHtml(translatedExternalLinks, translatedRelatedLinks);

    this.overviewParagraphs = translatedOverview
      .split('\n\n')
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    this.overviewParagraphs = this.overviewParagraphs.map((paragraph) => this.sanitizeHtml(this.linkifyText(paragraph)));
    this.overviewParagraphs.push(this.sanitizeHtml(referencesHtml));
    this.howItWorksHtml = this.sanitizeHtml(`${this.linkifyText(translatedHowItWorks)}<br><br>${referencesHtml}`);

    this.otherFeatures = Object.values(FEATURES)
      .filter((feature) => feature.slug !== base.slug)
      .map((feature) => {
        const featureKeyRoot = `featurePages.${feature.slug}`;
        return {
          slug: feature.slug,
          icon: feature.icon,
          label: this.t(`${featureKeyRoot}.title`, feature.title),
          tagline: this.t(`${featureKeyRoot}.tagline`, feature.tagline),
        };
      });
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  featurePageUrl(slug: string): string {
    return `/${this.languageService.currentLang()}/features/${slug}`;
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  ctaLink(): string[] {
    return this.localizedLink(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  ctaHref(): string {
    return this.localizedHref(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  featureLanguageLink(languageCode: string): string[] {
    return ['/', languageCode, 'features', this.baseFeature?.slug ?? ''];
  }

  featureLanguageHref(languageCode: string): string {
    return `/${languageCode}/features/${this.baseFeature?.slug ?? ''}`;
  }

  private inlineReferenceHtml(externalLinks: FeatureLink[], relatedLinks: RelatedPageLink[]): string {
    const resourcesLabel = this.t('featureDetail.resources', 'Resources').replace(/[:：]\s*$/u, '');
    const exploreLabel = this.t('featureDetail.exploreAlso', 'Explore also').replace(/[:：]\s*$/u, '');
    const resources = externalLinks
      .slice(0, 2)
      .map((link) => this.inlineAnchor(link.url, link.label, true))
      .join(' · ');
    const related = relatedLinks
      .map((link) => this.inlineAnchor(this.featurePageUrl(link.slug), link.label, false))
      .join(' · ');
    return `${this.escapeHtml(resourcesLabel)}: ${resources}<br>${this.escapeHtml(exploreLabel)}: ${related}`;
  }

  private inlineAnchor(url: string, label: string, openInNewTab: boolean): string {
    const target = openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${this.escapeHtml(url)}"${target}>${this.escapeHtml(label)}</a>`;
  }

  private linkifyText(text: string): string {
    const escaped = this.escapeHtml(text);
    return escaped.replace(
      /\bhttps?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[^\s<>"']*)/gi,
      (rawUrl) => {
        const url = rawUrl.replace(/[.,!?;:)]+$/g, '');
        const trailing = rawUrl.slice(url.length);
        const normalizedUrl = this.normalizeUrl(url);
        if (!normalizedUrl) {
          return rawUrl;
        }
        return `<a href="${this.escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
      }
    );
  }

  private sanitizeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  private normalizeUrl(url: string): string | null {
    const decoded = url.replaceAll('&amp;', '&');
    try {
      const parsed = new URL(decoded);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
      return null;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
