import { Component, DestroyRef, OnInit, SecurityContext, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';

export type LearnCategory = 'strategy' | 'signal';

export interface LearnLink {
  label: string;
  url: string;
  description: string;
}

export interface LearnData {
  slug: string;
  category: LearnCategory;
  icon: string;
  title: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  overview: string;
  howItWorks: string;
  externalLinks: LearnLink[];
  relatedSlugs: string[];
}

interface LearnCodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
}

type CodeAccessStep = 'collect' | 'verify' | 'unlocked';

export const LEARN_PAGES: Record<string, LearnData> = {

  // ─────────────────────────── TRADING STRATEGIES ───────────────────────────

  'moving-average-crossover': {
    slug: 'moving-average-crossover',
    category: 'strategy',
    icon: '📈',
    title: 'Moving Average Crossover Strategy',
    tagline: 'One of the oldest and most widely used trend-following techniques.',
    metaTitle: 'Moving Average Crossover Strategy — AutoTrader Learn',
    metaDescription: 'Learn the moving average crossover strategy: how it works, when to use it, and how to automate it with auto-Trading.',
    overview: `The moving average crossover is among the most widely taught trend-following strategies in technical analysis. The core idea is straightforward: you plot two moving averages of different lengths on a price chart and generate a trade signal whenever the faster average crosses above or below the slower one.

A bullish crossover — sometimes called a "golden cross" when the 50-day MA crosses above the 200-day MA — occurs when the short-period average rises above the long-period average. This indicates that recent prices are climbing faster than the longer-term trend and is interpreted as a buy signal. The opposite, a bearish or "death cross", occurs when the short-period average falls below the long-period average.

Popular combinations include the 5/20 pair for intraday trading, the 20/50 pair for swing trading, and the 50/200 pair for longer-term position trading. The choice of periods affects the sensitivity of the signals: shorter periods generate more signals with more false positives, while longer periods are slower to react but tend to produce cleaner signals.

The main limitation of the strategy is that it is a lagging indicator — by definition, a crossover can only occur after price has already moved. In ranging markets, this can lead to repeated whipsaws. Traders typically add a filter such as a volume confirmation or an ADX reading above 25 to avoid trading crossovers in low-volatility, directionless markets.

auto-Trading allows you to automate crossover strategies using the no-code strategy builder. You simply select two EMA or SMA blocks, wire them into a crossover condition block, and attach a buy or sell action — no programming required.`,
    howItWorks: `When the faster moving average (e.g., the 9-period EMA) crosses above the slower moving average (e.g., the 21-period EMA), auto-Trading generates a long entry signal. The bot submits a market or limit order depending on your settings. When the crossover reverses — the fast MA drops below the slow MA — the system closes the position and optionally opens a short. Risk parameters such as stop-loss distance and position size are set in the risk management module.`,
    externalLinks: [
      { label: 'Investopedia — Moving Average Crossover', url: 'https://www.investopedia.com/terms/g/goldencross.asp', description: 'Comprehensive explanation of golden cross and death cross signals.' },
      { label: 'TradingView — Moving Averages', url: 'https://www.tradingview.com/scripts/movingaverage/', description: 'Browse community scripts for crossover strategies on TradingView.' },
      { label: 'BabyPips — MA Crossover Guide', url: 'https://www.babypips.com/learn/forex/moving-average-crossover-trading', description: "BabyPips' beginner-friendly guide to crossover trading." },
    ],
    relatedSlugs: ['ema-indicator', 'sma-indicator', 'macd-indicator', 'trend-following'],
  },

  'fair-value-gap': {
    slug: 'fair-value-gap',
    category: 'strategy',
    icon: '🕳️',
    title: 'Fair Value Gap (FVG) Strategy',
    tagline: 'Trade imbalances left behind by rapid institutional moves.',
    metaTitle: 'Fair Value Gap (FVG) Strategy — AutoTrader Learn',
    metaDescription: 'Understand the Fair Value Gap strategy: how institutional order imbalances create high-probability trade setups.',
    overview: `A Fair Value Gap (FVG) is a three-candle price imbalance pattern that forms when price moves so aggressively in one direction that the wicks of the first and third candles do not overlap. The resulting gap represents a zone where no two-sided trading took place — in other words, supply and demand never had a chance to reach equilibrium.

The concept is rooted in Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology. Institutional participants routinely move price in quick, aggressive bursts to accumulate or distribute large positions. These rapid moves leave behind an unfilled void — the FVG — that price frequently returns to fill before resuming in the original direction.

Traders identify bullish FVGs as zones of support and bearish FVGs as zones of resistance. A bullish setup involves price dropping back into a bullish FVG and reversing upward; a bearish setup involves price rising into a bearish FVG and rolling over. The FVG zone itself is often used as the entry area, with a stop placed just beyond the zone and a take-profit at the next significant high or low.

FVGs are particularly effective on higher timeframes (4H, daily) where institutional activity is most visible, and can be used to time entries on lower timeframes for precision. Combining FVG analysis with liquidity sweeps (stop hunts) and market structure breaks significantly improves signal quality.`,
    howItWorks: `auto-Trading's strategy engine can scan for FVG patterns by identifying three consecutive candles where the third candle's low is above the first candle's high (bearish FVG) or the third candle's high is below the first candle's low (bullish FVG). When price re-enters the gap zone, a signal is generated. Risk is defined by the gap boundaries, making position sizing straightforward.`,
    externalLinks: [
      { label: 'Investopedia — Price Gaps', url: 'https://www.investopedia.com/terms/g/gap.asp', description: 'Background on price gaps and their significance in technical analysis.' },
      { label: 'TradingView — FVG Indicators', url: 'https://www.tradingview.com/scripts/fairvaluegap/', description: 'Community-built Fair Value Gap indicators on TradingView.' },
      { label: 'BabyPips — Price Action', url: 'https://www.babypips.com/learn/forex/price-action', description: 'Price action foundations that underpin FVG trading.' },
    ],
    relatedSlugs: ['smart-money-concepts', 'order-blocks', 'liquidity-sweeps', 'breaker-blocks'],
  },

  'smart-money-concepts': {
    slug: 'smart-money-concepts',
    category: 'strategy',
    icon: '🧠',
    title: 'Smart Money Concepts (SMC)',
    tagline: 'Align your trades with institutional order flow.',
    metaTitle: 'Smart Money Concepts (SMC) Strategy — AutoTrader Learn',
    metaDescription: 'Learn Smart Money Concepts: how to read institutional order flow, identify order blocks, and trade with the big players.',
    overview: `Smart Money Concepts (SMC) is a trading framework that attempts to model the behaviour of large institutional participants — banks, hedge funds, and market makers — who collectively move prices in search of liquidity. Unlike retail-oriented approaches that focus on lagging indicators, SMC emphasises reading raw price action to understand where institutions are accumulating or distributing positions.

The framework is built on several core concepts. Liquidity refers to clusters of stop-loss orders sitting above swing highs or below swing lows. Institutions drive price into these zones to "hunt" the stops, triggering a large pool of orders that they use to fill their own positions. After the sweep, price reverses sharply.

Market structure is analysed through the identification of Higher Highs (HH), Higher Lows (HL), Lower Highs (LH), and Lower Lows (LL). A Break of Structure (BOS) or Change of Character (CHoCH) signals a potential trend reversal or continuation. Order Blocks — the last up or down candle before a significant impulsive move — serve as high-probability re-entry zones. Fair Value Gaps (FVGs) and Breaker Blocks are used to fine-tune entry timing and set precise risk levels.

SMC is holistic: it combines liquidity analysis, market structure, order blocks, FVGs, and time-of-day considerations into a comprehensive methodology for identifying high-probability trade setups with well-defined risk.`,
    howItWorks: `In auto-Trading, SMC strategies are implemented by combining multiple analysis blocks: a market structure detector identifies the current trend bias; an order block scanner flags institutional candles; an FVG detector highlights imbalance zones; and a liquidity sweep detector confirms when stop runs have occurred. These inputs feed a composite signal that triggers entries only when multiple confluences align.`,
    externalLinks: [
      { label: 'Investopedia — Institutional Trading', url: 'https://www.investopedia.com/terms/i/institutionaltrader.asp', description: 'Overview of how institutional traders operate and move markets.' },
      { label: 'TradingView — SMC Scripts', url: 'https://www.tradingview.com/scripts/smc/', description: 'Community indicators for Smart Money Concepts analysis.' },
      { label: 'BabyPips — Market Structure', url: 'https://www.babypips.com/learn/forex/market-structure', description: 'Market structure basics essential to understanding SMC.' },
    ],
    relatedSlugs: ['fair-value-gap', 'order-blocks', 'liquidity-sweeps', 'breaker-blocks'],
  },

  'order-blocks': {
    slug: 'order-blocks',
    category: 'strategy',
    icon: '🧱',
    title: 'Order Blocks Strategy',
    tagline: 'Identify the candles where institutions loaded their positions.',
    metaTitle: 'Order Blocks Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn how to trade order blocks: identify institutional candles and use them as high-probability support and resistance zones.',
    overview: `An Order Block (OB) is the last bearish candle before a bullish impulse move, or the last bullish candle before a bearish impulse move. The logic is that large institutions must execute their orders over time and often return to the price zone where they began their initial entry to add to or complete their position.

Bullish order blocks form when price makes a significant upward move: the last down-close candle before the impulse becomes the bullish OB. When price returns to that zone, institutional buyers are expected to re-enter, creating a support reaction. Bearish OBs work in reverse.

The strength of an OB increases when it is also coincident with a Fair Value Gap or when the move away from it was highly impulsive (large candles, expanding ranges, high volume). An OB that has been "mitigated" — meaning price has already returned and traded through it — is no longer valid and should be removed from analysis.

Order blocks are best used on higher timeframes (1H, 4H, Daily) to define the directional bias, then drill into lower timeframes (15M, 5M) to find precise entries within the OB zone. The stop-loss is placed just beyond the OB, providing a tight risk-to-reward ratio.`,
    howItWorks: `auto-Trading's order block detector scans for the last opposite-direction candle before a qualifying impulsive move. A qualifying move is defined as a move of at least N times the ATR that also creates a Break of Structure. The detected OB zone is stored and monitored; when price re-enters the zone, a signal is issued. Position size is calculated automatically based on the zone width and your configured risk percentage.`,
    externalLinks: [
      { label: 'Investopedia — Support and Resistance', url: 'https://www.investopedia.com/trading/support-and-resistance-basics/', description: 'Foundational article on S&R levels which order blocks represent.' },
      { label: 'TradingView — Order Block Scripts', url: 'https://www.tradingview.com/scripts/orderblock/', description: 'Community-built order block detection scripts.' },
      { label: 'BabyPips — Candlestick Patterns', url: 'https://www.babypips.com/learn/forex/japanese-candlesticks', description: 'Candlestick literacy required for order block identification.' },
    ],
    relatedSlugs: ['smart-money-concepts', 'fair-value-gap', 'breaker-blocks', 'liquidity-sweeps'],
  },

  'liquidity-sweeps': {
    slug: 'liquidity-sweeps',
    category: 'strategy',
    icon: '🌊',
    title: 'Liquidity Sweeps Strategy',
    tagline: 'Trade the stop hunts that precede major institutional moves.',
    metaTitle: 'Liquidity Sweeps Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn liquidity sweeps: how smart money hunts retail stops above highs and below lows before reversing price sharply.',
    overview: `Liquidity Sweeps — also called stop hunts or liquidity grabs — are a cornerstone of the Smart Money Concepts framework. Retail traders tend to place their stop-loss orders at obvious levels: just below a swing low or just above a swing high. This creates a predictable cluster of orders that institutional players actively seek to trigger.

When an institution needs to fill a large buy order, it may first push price downward to trigger the sell stops below a significant swing low. Those triggered sell orders provide the buy-side liquidity the institution needs. Once filled, the institution reverses price aggressively upward — leaving behind a sharp wick and stranded retail traders.

Trading liquidity sweeps involves monitoring for price to breach a well-established swing level, waiting for a rapid reversal candle (pin bar, engulfing, or doji) that signals the sweep is complete, and entering in the direction of the reversal. The key is distinguishing a true sweep from a genuine breakout — sweeps are characterised by a fast return within the prior range, while breakouts consolidate above or below the level.

Combining sweep analysis with market structure and time-of-day filters (London open, New York open) significantly improves accuracy, as institutional activity is highest during these sessions.`,
    howItWorks: `auto-Trading detects liquidity sweeps by monitoring swing highs and lows over a user-defined lookback period. When price briefly exceeds a swing level and then closes back within the range within a configurable number of candles, a sweep event is flagged. The reversal signal is confirmed by a momentum or volume filter before an entry order is placed.`,
    externalLinks: [
      { label: 'Investopedia — Stop-Loss Orders', url: 'https://www.investopedia.com/terms/s/stop-lossorder.asp', description: 'Understanding stop-loss mechanics — the foundation of liquidity concepts.' },
      { label: 'TradingView — Liquidity Scripts', url: 'https://www.tradingview.com/scripts/liquidity/', description: 'Community indicators for mapping liquidity zones.' },
      { label: 'BabyPips — Trading Sessions', url: 'https://www.babypips.com/learn/forex/forex-trading-sessions', description: 'Session timing is critical for high-probability liquidity sweeps.' },
    ],
    relatedSlugs: ['smart-money-concepts', 'order-blocks', 'fair-value-gap', 'breaker-blocks'],
  },

  'breaker-blocks': {
    slug: 'breaker-blocks',
    category: 'strategy',
    icon: '⚡',
    title: 'Breaker Blocks Strategy',
    tagline: 'Trade failed order blocks that flip from support to resistance.',
    metaTitle: 'Breaker Blocks Trading Strategy — AutoTrader Learn',
    metaDescription: 'Understand breaker blocks: when order blocks fail and flip polarity, creating new high-probability trade zones.',
    overview: `A Breaker Block is a failed Order Block. When an order block is violated — price trades through it without reversing — it flips polarity and becomes a breaker: what was support becomes resistance, and vice versa. This flip occurs because the institutional orders that originally defended the order block have now been absorbed or reversed.

Bullish breakers form when a bearish order block (resistance) is broken by a bullish impulse. The broken OB zone, now acting as support, is expected to hold on the first retest. Bearish breakers form when a bullish order block (support) is violated: the zone becomes resistance on re-test.

The high-probability setup involves waiting for price to return to the breaker zone after the initial violation, watching for a reversal confirmation candle, and entering in the direction of the break. The stop is placed beyond the breaker zone, and the target is the next significant liquidity pool.

Breakers are particularly powerful when they coincide with FVGs or when the initial break was accompanied by a liquidity sweep. Multi-timeframe confluence — identifying the breaker on a higher timeframe and entering on a lower timeframe — improves the precision of the entry.`,
    howItWorks: `auto-Trading identifies breaker blocks by first detecting order blocks on the chart, then monitoring whether price trades through each OB with sufficient momentum (defined as a multiple of ATR). Once an OB is violated, it is reclassified as a breaker. The system then monitors for a re-test of the breaker zone and triggers an entry signal on the first confirming reversal candle inside the zone.`,
    externalLinks: [
      { label: 'Investopedia — Support Becomes Resistance', url: 'https://www.investopedia.com/articles/trading/09/using-support-and-resistance.asp', description: 'Classic article on polarity flips in technical analysis.' },
      { label: 'TradingView — Breaker Block Indicators', url: 'https://www.tradingview.com/scripts/breakerblock/', description: 'Community indicators for detecting breaker zones.' },
      { label: 'BabyPips — Price Action Reversals', url: 'https://www.babypips.com/learn/forex/reversal-candlestick-patterns', description: 'Reversal candlestick patterns used to confirm breaker entries.' },
    ],
    relatedSlugs: ['order-blocks', 'smart-money-concepts', 'fair-value-gap', 'liquidity-sweeps'],
  },

  'trend-following': {
    slug: 'trend-following',
    category: 'strategy',
    icon: '📊',
    title: 'Trend Following Strategy',
    tagline: 'Ride the momentum — let your winners run.',
    metaTitle: 'Trend Following Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn trend following: one of the most time-tested strategies in trading, used by CTAs, hedge funds, and systematic traders worldwide.',
    overview: `Trend following is one of the oldest and most rigorously tested systematic trading approaches. Its core principle is simple: identify an established trend and trade in its direction until evidence of reversal emerges. The philosophy is captured in the adage "the trend is your friend — until it ends."

The strategy is inherently reactive — it does not predict where price will go, only identifies which direction it is currently moving and positions accordingly. Trend followers accept that they will miss the beginning and end of every trend but seek to capture the substantial middle portion.

Entry signals are typically generated by breakouts of recent highs or lows, moving average crossovers, or Donchian channel breakouts. Position sizing often uses ATR-based volatility targeting: larger positions in low-volatility environments, smaller ones when volatility spikes, so that every trade represents a roughly equal risk. Exits are governed by trailing stops rather than fixed profit targets — the position rides as long as the trend continues.

The strategy performs best in strongly trending markets (commodities, currencies, crypto during bull runs) and struggles in range-bound or mean-reverting environments. Diversification across many uncorrelated markets is the standard approach to smooth the inevitable drawdown periods.`,
    howItWorks: `auto-Trading implements trend following by combining a trend detection indicator (ADX > 25 or price above/below a 200-period EMA) with a breakout entry trigger. Once in a trade, a dynamic trailing stop based on ATR multiples moves in the direction of the trend to lock in profits while allowing the position to breathe.`,
    externalLinks: [
      { label: 'Investopedia — Trend Following', url: 'https://www.investopedia.com/terms/t/trendtrading.asp', description: 'Overview of trend-following strategies and key concepts.' },
      { label: 'TradingView — Trend Indicators', url: 'https://www.tradingview.com/scripts/trend/', description: 'Popular trend detection scripts on TradingView.' },
      { label: 'BabyPips — Trading the Trend', url: 'https://www.babypips.com/learn/forex/trading-the-trend', description: "BabyPips' guide to identifying and trading with the trend." },
    ],
    relatedSlugs: ['moving-average-crossover', 'breakout-strategy', 'adx-indicator', 'donchian-channel'],
  },

  'mean-reversion': {
    slug: 'mean-reversion',
    category: 'strategy',
    icon: '🔄',
    title: 'Mean Reversion Strategy',
    tagline: 'Buy the dip, sell the rip — profit from price returning to average.',
    metaTitle: 'Mean Reversion Trading Strategy — AutoTrader Learn',
    metaDescription: 'Discover mean reversion trading: how to profit when overextended prices snap back to their statistical average.',
    overview: `Mean reversion is based on the statistical observation that extreme price deviations from a long-run average tend to be temporary. Just as a stretched rubber band snaps back, overextended prices tend to return to their mean over time. This principle is especially reliable in markets that exhibit stationary or co-integrated behaviour.

The strategy involves identifying when price has moved significantly away from a measure of central tendency — such as a moving average, the VWAP, or a regression line — and taking a position anticipating the return. Common entry triggers include price crossing more than two standard deviations outside a Bollinger Band, an RSI reading above 70 or below 30, or a Z-score exceeding ±2 on a rolling regression.

Risk management is critical in mean reversion: the strategy can suffer large losses if a trending market extends far beyond expected bounds. Position sizing must account for the possibility of further extension before reversal. Traders often scale into positions as price moves further from the mean (pyramiding into a contrarian trade) and use wide stops to avoid premature exit.

Mean reversion works best in range-bound equity markets, currency pairs with long-term equilibrium rates, and in pair trading where two co-integrated assets temporarily diverge.`,
    howItWorks: `auto-Trading implements mean reversion by monitoring the Z-score of price relative to a rolling mean and standard deviation. When the Z-score exceeds a configurable threshold (default ±2.0), a counter-trend order is placed. The take-profit is set at the mean, and the stop-loss is set at a further standard deviation multiple to account for continued deviation.`,
    externalLinks: [
      { label: 'Investopedia — Mean Reversion', url: 'https://www.investopedia.com/terms/m/meanreversion.asp', description: 'Explanation of mean reversion theory and its applications in finance.' },
      { label: 'TradingView — Bollinger Bands', url: 'https://www.tradingview.com/scripts/bollingerbands/', description: 'Bollinger Band scripts commonly used in mean reversion strategies.' },
      { label: 'BabyPips — RSI Strategy', url: 'https://www.babypips.com/learn/forex/rsi', description: 'RSI-based mean reversion entries on BabyPips.' },
    ],
    relatedSlugs: ['rsi-indicator', 'bollinger-bands', 'vwap-indicator', 'stochastic-oscillator'],
  },

  'breakout-strategy': {
    slug: 'breakout-strategy',
    category: 'strategy',
    icon: '🚀',
    title: 'Breakout Trading Strategy',
    tagline: 'Catch explosive moves the moment price escapes its range.',
    metaTitle: 'Breakout Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn breakout trading: how to identify consolidation zones and trade the explosive moves when price breaks free.',
    overview: `Breakout trading seeks to capture explosive price moves that occur when price escapes a period of consolidation or breaks through a significant technical level. The premise is that periods of low volatility and tight ranges compress potential energy, and when price eventually breaks out, the resulting move is often large and fast.

Breakout traders look for price to close above resistance or below support with above-average volume, signalling genuine conviction. A common entry technique is to place a buy stop just above the high of the consolidation range (for bullish breakouts) so the order triggers automatically when the breakout occurs.

The main challenge is distinguishing real breakouts from fakeouts. Filters that improve accuracy include: waiting for a candle close beyond the level (rather than just a wick), requiring volume to be at least 1.5x the 20-period average, using a higher timeframe to confirm the breakout direction, and entering only breakouts in the direction of the prevailing trend.

Donchian channels, which plot the highest high and lowest low over a lookback period, are a classic breakout tool. Richard Dennis's famous Turtle Trading system used Donchian channel breakouts as its primary entry signal, making it one of the most historically documented breakout strategies.`,
    howItWorks: `auto-Trading's breakout module tracks the highest high and lowest low over a configurable lookback window. When price closes outside this range on a candle with above-average volume, a breakout signal is generated. The initial stop is placed at the midpoint of the prior range, and a trailing stop then follows price as the breakout progresses.`,
    externalLinks: [
      { label: 'Investopedia — Breakout Trading', url: 'https://www.investopedia.com/terms/b/breakout.asp', description: 'Comprehensive overview of breakout trading principles.' },
      { label: 'TradingView — Donchian Channel', url: 'https://www.tradingview.com/scripts/donchianchannels/', description: 'Donchian channel indicators popular for breakout detection.' },
      { label: 'BabyPips — Trading Breakouts', url: 'https://www.babypips.com/learn/forex/trading-breakouts', description: "BabyPips' guide to trading price breakouts effectively." },
    ],
    relatedSlugs: ['trend-following', 'donchian-channel', 'atr-indicator', 'volume-analysis'],
  },

  'scalping-strategy': {
    slug: 'scalping-strategy',
    category: 'strategy',
    icon: '⚡',
    title: 'Scalping Strategy',
    tagline: 'Profit from tiny price moves with high-frequency precision.',
    metaTitle: 'Scalping Trading Strategy — AutoTrader Learn',
    metaDescription: 'Understand scalping: the high-frequency strategy that targets small profits on many trades, demanding speed and strict discipline.',
    overview: `Scalping is a short-term trading strategy that seeks to profit from small price movements, typically holding positions for seconds to a few minutes. A scalper makes dozens or even hundreds of trades per day, targeting a small number of pips or ticks on each, with the goal of accumulating significant gains through volume.

The strategy requires an extremely disciplined approach to risk management because the small profit targets mean a single large loss can erase many winning trades. Scalpers typically use very tight stop-losses and take-profits, often operating with a 1:1 or even less-than-1:1 risk-reward ratio, relying on a high win rate to remain profitable.

Key conditions for effective scalping include high liquidity (tight bid-ask spreads), low transaction costs (commissions eat significantly into small-profit targets), and fast execution. Scalping is most common in major forex pairs, crypto perpetuals with high volume, and equity index futures.

Automation is particularly well-suited to scalping: manual traders struggle to maintain the speed and emotional discipline required over hundreds of trades, while automated bots execute consistently without fatigue or second-guessing.`,
    howItWorks: `auto-Trading's scalping module executes trades based on microstructure signals: bid-ask imbalances, order flow divergence, level-2 data, and short-period momentum indicators. Positions are closed automatically when the profit target or stop-loss tick distance is reached. Auto-Trading's cloud infrastructure minimises latency, which is critical for scalping strategies.`,
    externalLinks: [
      { label: 'Investopedia — Scalping', url: 'https://www.investopedia.com/terms/s/scalping.asp', description: 'Definition and mechanics of scalping as a trading strategy.' },
      { label: 'TradingView — Scalping Scripts', url: 'https://www.tradingview.com/scripts/scalping/', description: 'Community scalping indicator scripts on TradingView.' },
      { label: 'BabyPips — Scalping', url: 'https://www.babypips.com/learn/forex/scalping', description: "BabyPips' introduction to forex scalping techniques." },
    ],
    relatedSlugs: ['vwap-indicator', 'rsi-indicator', 'moving-average-crossover', 'bollinger-bands'],
  },

  'swing-trading': {
    slug: 'swing-trading',
    category: 'strategy',
    icon: '🏌️',
    title: 'Swing Trading Strategy',
    tagline: 'Capture multi-day price swings with a balanced risk approach.',
    metaTitle: 'Swing Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn swing trading: capturing price moves over days to weeks, balancing technical analysis with disciplined position management.',
    overview: `Swing trading sits between scalping and position trading, targeting price moves that develop over one to several days or weeks. Swing traders aim to capture a single "swing" — the move from a swing low to a swing high or vice versa — and exit before the move reverses.

The strategy relies heavily on technical analysis: identifying key support and resistance levels, trend structure, chart patterns (flags, triangles, head and shoulders), and momentum indicators. The holding period of a few days allows traders to use daily and 4-hour charts as their primary timeframes, avoiding the noise of lower timeframes while remaining more active than long-term investors.

Swing trading is popular because it accommodates traders with day jobs — positions are managed once or twice a day rather than requiring constant monitoring. Overnight and weekend risk must be factored in, however: gaps at open can quickly invalidate a trade setup.

Successful swing traders develop clear rules for entry (e.g., a daily close above a key resistance with RSI < 70), stop placement (below the last swing low), and profit targets (next resistance level or a fixed R:R ratio such as 2:1 or 3:1). Automation handles the position management while the trader focuses on identifying the next opportunity.`,
    howItWorks: `auto-Trading monitors daily and 4H candles for swing setups. When a qualifying pattern is detected — such as a pull-back to a trend-line with bullish RSI divergence — a limit entry order is placed. The bot manages the open position with a trailing stop that tightens as price approaches the target zone.`,
    externalLinks: [
      { label: 'Investopedia — Swing Trading', url: 'https://www.investopedia.com/terms/s/swingtrading.asp', description: 'Overview of swing trading strategies and techniques.' },
      { label: 'TradingView — Swing Trading Ideas', url: 'https://www.tradingview.com/ideas/swingtrading/', description: 'Community swing trading ideas and analysis on TradingView.' },
      { label: 'BabyPips — Swing Trading', url: 'https://www.babypips.com/learn/forex/swing-trading', description: "BabyPips' comprehensive guide to swing trading strategies." },
    ],
    relatedSlugs: ['trend-following', 'rsi-indicator', 'macd-indicator', 'fibonacci-retracement'],
  },

  'fibonacci-retracement': {
    slug: 'fibonacci-retracement',
    category: 'strategy',
    icon: '🐚',
    title: 'Fibonacci Retracement Strategy',
    tagline: 'Use mathematical ratios to identify high-probability pull-back entries.',
    metaTitle: 'Fibonacci Retracement Strategy — AutoTrader Learn',
    metaDescription: 'Master Fibonacci retracement: how to use the 38.2%, 50%, and 61.8% levels to time pull-back entries in trending markets.',
    overview: `Fibonacci retracement is a technical analysis tool based on the mathematical ratios derived from the Fibonacci sequence: 23.6%, 38.2%, 50%, 61.8%, and 78.6%. Traders draw retracement levels between a significant swing high and swing low (or vice versa) and use these levels to anticipate where a pull-back might find support or resistance before the trend resumes.

The rationale is partly mathematical and partly self-fulfilling: because so many traders and algorithmic systems use these levels, they tend to act as coordination points where buy and sell decisions cluster. The 61.8% level — the "golden ratio" — is particularly significant and often marks the deepest pull-back that still preserves the trend structure.

A typical long setup involves: identifying a clear uptrend, waiting for a pull-back, drawing Fibonacci levels from the swing low to the swing high, and placing a limit buy order at the 50% or 61.8% level with a stop below the 78.6% level. Confluence with other indicators (RSI oversold, a key horizontal support, an order block) increases the probability of success.

Fibonacci extensions are used to project profit targets beyond the swing high, with the 127.2%, 161.8%, and 261.8% levels serving as common take-profit zones.`,
    howItWorks: `auto-Trading automatically identifies swing highs and lows using a configurable zig-zag algorithm, then calculates Fibonacci retracement and extension levels for each significant swing. When price pulls back to a major Fib level and a momentum confirmation signal fires, a limit entry order is placed at that level with the stop and target pre-calculated.`,
    externalLinks: [
      { label: 'Investopedia — Fibonacci Retracement', url: 'https://www.investopedia.com/terms/f/fibonacciretracement.asp', description: 'Detailed explanation of Fibonacci levels and their application.' },
      { label: 'TradingView — Fibonacci Tools', url: 'https://www.tradingview.com/support/solutions/43000594359-fibonacci-retracement/', description: 'How to use Fibonacci tools on TradingView charts.' },
      { label: 'BabyPips — Fibonacci Trading', url: 'https://www.babypips.com/learn/forex/fibonacci-fan', description: "BabyPips' guide to Fibonacci analysis in forex and crypto." },
    ],
    relatedSlugs: ['swing-trading', 'trend-following', 'order-blocks', 'smart-money-concepts'],
  },

  'ichimoku-strategy': {
    slug: 'ichimoku-strategy',
    category: 'strategy',
    icon: '🗻',
    title: 'Ichimoku Cloud Strategy',
    tagline: 'A complete trading system built from a single indicator.',
    metaTitle: 'Ichimoku Cloud Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn the Ichimoku Cloud strategy: a complete all-in-one trend, support/resistance, and momentum system from Japan.',
    overview: `The Ichimoku Cloud (Ichimoku Kinko Hyo) is a comprehensive technical indicator developed by Japanese journalist Goichi Hosoda in the 1960s. Unlike most indicators that provide a single line of information, Ichimoku delivers trend direction, momentum, support and resistance levels, and even future price projections — all in one view.

The indicator consists of five components: the Tenkan-sen (conversion line, 9-period midpoint), Kijun-sen (base line, 26-period midpoint), Senkou Span A (average of Tenkan and Kijun, plotted 26 periods forward), Senkou Span B (52-period midpoint, plotted 26 periods forward), and the Chikou Span (current close plotted 26 periods back). The area between Span A and Span B forms the "cloud" (Kumo).

A bullish signal occurs when price is above the cloud, the Tenkan-sen is above the Kijun-sen, and the cloud ahead is bullish (Span A > Span B). A bearish signal is the mirror image. The cloud acts as dynamic support and resistance: a thin cloud is easily penetrated; a thick cloud represents strong support or resistance.

The Chikou Span — current price projected back in time — provides a final confirmation: it should be above past price action for a bullish signal, confirming that current momentum is genuinely strong.`,
    howItWorks: `auto-Trading computes all five Ichimoku components in real time. The strategy module fires a long signal when all four bullish conditions align simultaneously: price above cloud, Tenkan > Kijun, cloud ahead is green, and Chikou above historical price. The stop is placed at the bottom of the cloud (Span B level) and the target at the next resistance structure.`,
    externalLinks: [
      { label: 'Investopedia — Ichimoku Cloud', url: 'https://www.investopedia.com/terms/i/ichimoku-cloud.asp', description: 'Comprehensive guide to the Ichimoku Cloud indicator and its signals.' },
      { label: 'TradingView — Ichimoku', url: 'https://www.tradingview.com/scripts/ichimoku/', description: 'Ichimoku Cloud implementations and community strategies.' },
      { label: 'BabyPips — Ichimoku', url: 'https://www.babypips.com/learn/forex/ichimoku-kinko-hyo', description: "BabyPips' friendly introduction to the Ichimoku system." },
    ],
    relatedSlugs: ['trend-following', 'moving-average-crossover', 'adx-indicator', 'swing-trading'],
  },

  'price-action-strategy': {
    slug: 'price-action-strategy',
    category: 'strategy',
    icon: '🕯️',
    title: 'Price Action Strategy',
    tagline: 'Trade naked charts — let price tell you what to do next.',
    metaTitle: 'Price Action Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn price action trading: read candles, patterns, and structure without indicators to identify high-probability trade setups.',
    overview: `Price action trading is the discipline of making trading decisions based solely on the movement of price — without the use of lagging indicators. Practitioners argue that all relevant market information is already reflected in the price, and that indicators simply repackage this information with an added delay.

The foundation is candlestick analysis: understanding what each candle — and sequences of candles — reveals about the battle between buyers and sellers. Key candlestick patterns include pin bars (rejection wicks), engulfing candles (momentum shifts), inside bars (consolidation), and doji candles (indecision). These patterns derive their significance from the context in which they appear: a pin bar at a key support level carries far more weight than one in the middle of a range.

Market structure — the sequence of swing highs and swing lows — defines the trend. In an uptrend, higher highs and higher lows form a "staircase" pattern. When this structure breaks down, it may signal a trend change. Horizontal support and resistance levels, trend lines, and channels provide the framework within which patterns are evaluated.

Pure price action strategies require no indicators beyond perhaps a volume bar and a simple moving average for trend context. This makes them robust and adaptable across markets and timeframes.`,
    howItWorks: `auto-Trading's price action module recognises key candlestick patterns at significant structural levels. When a pin bar or engulfing candle forms at a level that matches a pre-defined support, resistance, or supply/demand zone, a signal is generated. The entry is placed at the open of the next candle, stop behind the pattern's extreme, and target at the next structural level.`,
    externalLinks: [
      { label: 'Investopedia — Price Action Trading', url: 'https://www.investopedia.com/terms/p/price-action.asp', description: 'Introduction to price action trading and its key concepts.' },
      { label: 'TradingView — Price Action Scripts', url: 'https://www.tradingview.com/scripts/priceaction/', description: 'Community price action pattern detection scripts.' },
      { label: 'BabyPips — Candlestick Patterns', url: 'https://www.babypips.com/learn/forex/japanese-candlesticks', description: "BabyPips' full candlestick encyclopedia." },
    ],
    relatedSlugs: ['smart-money-concepts', 'order-blocks', 'fair-value-gap', 'swing-trading'],
  },

  'grid-trading': {
    slug: 'grid-trading',
    category: 'strategy',
    icon: '🗂️',
    title: 'Grid Trading Strategy',
    tagline: 'Profit automatically from market volatility without predicting direction.',
    metaTitle: 'Grid Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn grid trading: how placing a grid of buy and sell orders captures profits from price oscillations in any market condition.',
    overview: `Grid trading is an automated strategy that places a series of buy and sell orders at preset price intervals above and below a central price level, forming a grid. As price oscillates up and down within the grid, the bot continuously buys at lower levels and sells at higher ones, accumulating profits from each completed buy-sell cycle.

The strategy requires no directional prediction: it is purely mechanical and profits from volatility. A symmetric grid places equal-spaced orders both above and below the current price. An asymmetric grid can be biased toward one direction if the trader has a directional view.

Key parameters are the grid spacing (how far apart each level is), the number of grid levels, and the total capital allocated. Grid spacing should ideally match the average daily range of the instrument, ensuring the grid captures the natural oscillations without requiring extreme moves to complete cycles.

The main risk is a sustained directional trend: if price moves far in one direction and never returns, the grid accumulates a large one-sided position that may move into significant unrealised loss. Grid traders typically set a maximum position size limit and a stop-loss for the overall grid to protect against trend risk.`,
    howItWorks: `auto-Trading's grid bot creates a configurable number of limit orders above and below the starting price at equal intervals. When a buy order fills, a corresponding sell order is placed at one grid level above. When a sell fills, a buy is placed one level below. The cycle continues indefinitely, with P&L accruing from each completed cycle. The grid is paused if a user-defined drawdown limit is reached.`,
    externalLinks: [
      { label: 'Investopedia — Grid Trading', url: 'https://www.investopedia.com/articles/forex/07/grid-trading.asp', description: 'Introduction to grid trading mechanics and applications.' },
      { label: 'Binance Academy — Grid Trading', url: 'https://academy.binance.com/en/articles/what-is-grid-trading', description: "Binance's practical guide to crypto grid trading bots." },
      { label: 'TradingView — Grid Scripts', url: 'https://www.tradingview.com/scripts/grid/', description: 'Community grid trading strategy scripts on TradingView.' },
    ],
    relatedSlugs: ['mean-reversion', 'bollinger-bands', 'scalping-strategy', 'atr-indicator'],
  },

  'dollar-cost-averaging': {
    slug: 'dollar-cost-averaging',
    category: 'strategy',
    icon: '💰',
    title: 'Dollar-Cost Averaging (DCA) Strategy',
    tagline: 'Reduce timing risk by spreading purchases over time.',
    metaTitle: 'Dollar-Cost Averaging (DCA) Strategy — AutoTrader Learn',
    metaDescription: 'Understand dollar-cost averaging (DCA): the disciplined strategy of buying fixed amounts at regular intervals to reduce timing risk.',
    overview: `Dollar-Cost Averaging (DCA) is an investment strategy where a fixed dollar amount is invested at regular intervals regardless of the asset's price. By buying more units when prices are low and fewer when prices are high, DCA reduces the impact of short-term volatility on the average cost basis.

In the context of cryptocurrency and automated trading, DCA bots have become extremely popular. A DCA bot purchases a fixed amount of Bitcoin, Ethereum, or another asset daily, weekly, or monthly. Over time, if the asset appreciates, the accumulated position generates returns. The strategy sidesteps the impossible challenge of timing the market perfectly.

Advanced DCA strategies add conditional triggers: instead of buying on a fixed schedule, the bot buys only when price drops by a certain percentage below the last buy price. This "smart DCA" concentrates purchases at lower prices, lowering the average cost even further. Combining smart DCA with RSI oversold signals (buying additional units when RSI < 30) refines entries further.

DCA is most effective for assets with long-term positive growth expectations held over extended periods. It is not suitable for assets in sustained downtrends with no fundamental recovery case.`,
    howItWorks: `auto-Trading's DCA module schedules recurring buy orders based on a user-defined interval (daily, weekly, monthly) and fixed dollar amount. The smart DCA option adds a price-drop trigger: additional buys are placed when price falls by a configurable percentage below the last fill price. The bot tracks the average cost basis and total accumulated position in the dashboard.`,
    externalLinks: [
      { label: 'Investopedia — Dollar-Cost Averaging', url: 'https://www.investopedia.com/terms/d/dollarcostaveraging.asp', description: 'Classic explanation of DCA and its mathematical benefits.' },
      { label: 'CoinGecko — DCA Calculator', url: 'https://www.coingecko.com/en/coins/bitcoin#dca-calculator', description: 'Interactive DCA calculator for Bitcoin and other cryptos.' },
      { label: 'Binance Academy — DCA', url: 'https://academy.binance.com/en/articles/dollar-cost-averaging-dca-explained', description: "Binance's guide to DCA in cryptocurrency trading." },
    ],
    relatedSlugs: ['grid-trading', 'mean-reversion', 'rsi-indicator', 'breakout-strategy'],
  },

  'arbitrage-strategy': {
    slug: 'arbitrage-strategy',
    category: 'strategy',
    icon: '⚖️',
    title: 'Arbitrage Strategy',
    tagline: 'Exploit price differences across exchanges for risk-free profit.',
    metaTitle: 'Arbitrage Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn arbitrage trading: how to profit from price discrepancies across exchanges or asset pairs with minimal directional risk.',
    overview: `Arbitrage is the practice of simultaneously buying and selling the same asset (or economically equivalent assets) in different markets to profit from a price discrepancy. In theory, it is risk-free — if Bitcoin is priced at $50,000 on Exchange A and $50,100 on Exchange B, buying on A and selling on B locks in a $100 profit per coin.

In practice, execution costs (trading fees, withdrawal fees, and funding costs), transfer latency, and the speed at which other arbitrageurs close the gap mean that opportunities are fleeting and margins thin. This makes automation essential: a bot can monitor dozens of exchange pairs simultaneously and execute in milliseconds.

Several types of arbitrage exist in crypto markets. Simple cross-exchange arbitrage exploits price differences for the same pair across venues. Triangular arbitrage exploits inefficiencies in exchange rates between three currency pairs on the same exchange (e.g., BTC→ETH→USDT→BTC). Funding rate arbitrage exploits the periodic funding payments on perpetual futures: when funding is positive, traders short the perpetual and long the spot, collecting the funding rate as income.

The strategy is most effective during periods of high market volatility when price discrepancies widen, or in less liquid markets where fewer participants can close gaps quickly.`,
    howItWorks: `auto-Trading monitors price feeds across all connected exchanges simultaneously. When the spread between the same pair on two exchanges exceeds a user-defined threshold (net of fees), the system simultaneously places a buy order on the cheaper exchange and a sell order on the more expensive one. Funding rate arbitrage bots monitor the perpetual funding rate and automatically open the hedge position when the rate exceeds the target threshold.`,
    externalLinks: [
      { label: 'Investopedia — Arbitrage', url: 'https://www.investopedia.com/terms/a/arbitrage.asp', description: 'Definition and explanation of arbitrage in financial markets.' },
      { label: 'CoinGecko — Funding Rates', url: 'https://www.coingecko.com/en/derivatives', description: 'Live funding rate data across major crypto derivatives exchanges.' },
      { label: 'Binance Academy — Crypto Arbitrage', url: 'https://academy.binance.com/en/articles/what-is-arbitrage-trading', description: "Binance's guide to arbitrage in cryptocurrency markets." },
    ],
    relatedSlugs: ['grid-trading', 'scalping-strategy', 'trend-following', 'breakout-strategy'],
  },

  // ─────────────────────────── TRADING SIGNALS / INDICATORS ────────────────

  'ema-indicator': {
    slug: 'ema-indicator',
    category: 'signal',
    icon: '📉',
    title: 'Exponential Moving Average (EMA)',
    tagline: 'A weighted average that reacts faster to recent price changes.',
    metaTitle: 'Exponential Moving Average (EMA) — AutoTrader Learn',
    metaDescription: 'Learn the EMA indicator: how it differs from SMA, how to calculate it, and how to use it for trading signals.',
    overview: `The Exponential Moving Average (EMA) is a type of moving average that places greater weight on the most recent price data, making it more responsive to recent market changes than the Simple Moving Average (SMA). This sensitivity makes the EMA especially popular among shorter-term traders who need signals that react quickly to developing momentum.

The EMA is calculated using a multiplier: Multiplier = 2 ÷ (N + 1), where N is the number of periods. Each new EMA value is then: EMA = (Current Price × Multiplier) + (Previous EMA × (1 − Multiplier)). This recursive formula means that older prices gradually carry less weight but never drop to zero entirely.

Common EMA periods and their uses: 9 and 21 EMA for short-term momentum signals; 20 and 50 EMA for medium-term trend detection; 50 and 200 EMA for long-term trend identification (the golden/death cross). The 200 EMA is widely watched by institutional traders as a dividing line between long-term bullish and bearish regimes.

EMAs serve multiple purposes: as dynamic support and resistance levels (price often bounces off the 20 or 50 EMA in trending markets), as crossover signals, as trend-direction filters, and as components of more complex indicators like MACD.`,
    howItWorks: `In auto-Trading, EMA values are computed using streaming tick data to ensure accuracy at any timeframe. Users configure the EMA period in the strategy builder and choose whether to use it as a trend filter, crossover trigger, or dynamic support/resistance level. The builder visualises the EMA overlay on the chart preview so users can validate their settings before deployment.`,
    externalLinks: [
      { label: 'Investopedia — EMA', url: 'https://www.investopedia.com/terms/e/ema.asp', description: 'Full explanation of the EMA formula, calculation, and trading applications.' },
      { label: 'TradingView — EMA Indicator', url: 'https://www.tradingview.com/scripts/ema/', description: 'EMA scripts and community strategies on TradingView.' },
      { label: 'BabyPips — Moving Averages', url: 'https://www.babypips.com/learn/forex/moving-averages', description: "BabyPips' introduction to EMAs, SMAs, and their trading uses." },
    ],
    relatedSlugs: ['sma-indicator', 'macd-indicator', 'moving-average-crossover', 'trend-following'],
  },

  'sma-indicator': {
    slug: 'sma-indicator',
    category: 'signal',
    icon: '📊',
    title: 'Simple Moving Average (SMA)',
    tagline: 'The foundational trend indicator every trader should know.',
    metaTitle: 'Simple Moving Average (SMA) — AutoTrader Learn',
    metaDescription: 'Understand the SMA: how to calculate it, how to use it for trend detection, and why it is still relevant in modern trading.',
    overview: `The Simple Moving Average (SMA) is the arithmetic mean of a specified number of price periods. It is the most basic form of moving average and the starting point for understanding all other moving average derivatives. The 200-day SMA, for example, is one of the most widely cited technical levels in all of financial markets.

Calculation is straightforward: sum the closing prices over N periods and divide by N. As a new candle closes, the oldest price drops off and the newest is added. This creates a smooth line that filters out short-term noise and reveals the underlying trend direction.

The SMA is slower to react to price changes than the EMA, which makes it less prone to false signals in choppy markets but means it lags more on fast-moving trends. For long-term trend analysis — where the goal is to identify the broad direction rather than precise entry timing — the SMA's smoothness is an advantage.

Key uses include: the 50 and 200 SMA as major support/resistance levels; the 200 SMA as a bull/bear market divider; SMA crossovers as trend change signals; and SMAs applied to volume or RSI (rather than price) for smoothed momentum readings.`,
    howItWorks: `auto-Trading supports SMA calculation on price (open, high, low, close), volume, and any derived indicator value. In the strategy builder, users configure the SMA period and source and connect the output to a crossover block, a threshold comparison, or a support/resistance monitor. Multiple SMAs can be stacked on the same chart to create multi-timeframe trend frameworks.`,
    externalLinks: [
      { label: 'Investopedia — SMA', url: 'https://www.investopedia.com/terms/s/sma.asp', description: 'Definition, formula, and practical use cases for the SMA.' },
      { label: 'TradingView — SMA Scripts', url: 'https://www.tradingview.com/scripts/simplemovingaverage/', description: 'SMA-based strategies and indicators on TradingView.' },
      { label: 'BabyPips — SMA vs EMA', url: 'https://www.babypips.com/learn/forex/sma-vs-ema', description: 'Side-by-side comparison of SMA and EMA to help choose the right one.' },
    ],
    relatedSlugs: ['ema-indicator', 'macd-indicator', 'moving-average-crossover', 'bollinger-bands'],
  },

  'rsi-indicator': {
    slug: 'rsi-indicator',
    category: 'signal',
    icon: '🔋',
    title: 'Relative Strength Index (RSI)',
    tagline: 'Measure momentum and identify overbought/oversold conditions.',
    metaTitle: 'RSI — Relative Strength Index — AutoTrader Learn',
    metaDescription: 'Master the RSI indicator: how it works, its overbought/oversold signals, divergence patterns, and how to integrate it in automated strategies.',
    overview: `The Relative Strength Index (RSI) is a momentum oscillator developed by J. Welles Wilder Jr. and introduced in his 1978 book "New Concepts in Technical Trading Systems." It measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions on a scale of 0 to 100.

The standard calculation uses 14 periods: RSI = 100 − (100 ÷ (1 + RS)), where RS is the average of up-closes divided by the average of down-closes over 14 periods. A reading above 70 is traditionally considered overbought (potential reversal down), and below 30 is considered oversold (potential reversal up).

RSI divergence is one of the most powerful signals in technical analysis. Bullish divergence occurs when price makes a lower low but RSI makes a higher low — indicating waning bearish momentum and a potential reversal up. Bearish divergence is the opposite. These divergences often precede significant trend reversals and are most reliable on higher timeframes (4H, daily).

RSI can also be used in trending markets by adjusting the overbought/oversold thresholds: in uptrends, use 40 as oversold (instead of 30) and 80 as overbought; in downtrends, use 60 as overbought. This avoids the common mistake of shorting strong uptrends just because RSI reads above 70.`,
    howItWorks: `auto-Trading computes RSI in real time on any timeframe. The strategy builder supports RSI threshold signals (above/below a level), RSI crossovers (crossing the 50 midline for trend bias), and divergence detection (comparing RSI peaks and troughs with price peaks and troughs over a configurable lookback). Each signal type can be combined with other indicators for high-confluence entries.`,
    externalLinks: [
      { label: 'Investopedia — RSI', url: 'https://www.investopedia.com/terms/r/rsi.asp', description: 'Complete guide to the RSI: formula, interpretation, and trading signals.' },
      { label: 'TradingView — RSI Indicator', url: 'https://www.tradingview.com/scripts/rsi/', description: 'RSI variations and community strategies on TradingView.' },
      { label: 'BabyPips — RSI', url: 'https://www.babypips.com/learn/forex/rsi', description: "BabyPips' beginner-friendly RSI tutorial." },
    ],
    relatedSlugs: ['macd-indicator', 'stochastic-oscillator', 'mean-reversion', 'bollinger-bands'],
  },

  'macd-indicator': {
    slug: 'macd-indicator',
    category: 'signal',
    icon: '🌊',
    title: 'MACD — Moving Average Convergence Divergence',
    tagline: 'A momentum indicator that doubles as a trend signal.',
    metaTitle: 'MACD Indicator — AutoTrader Learn',
    metaDescription: 'Learn MACD: how this dual-purpose indicator measures both momentum and trend direction, and how to trade its crossover and divergence signals.',
    overview: `The MACD (Moving Average Convergence Divergence) is one of the most widely used technical indicators, serving as both a trend-following and momentum tool. Developed by Gerald Appel in the late 1970s, it is built from three components: the MACD line (difference between the 12-period EMA and 26-period EMA), the signal line (9-period EMA of the MACD line), and the histogram (MACD line minus signal line).

The primary trading signals are: (1) MACD line crosses above/below the signal line — a bullish/bearish signal; (2) MACD crosses above/below zero — the "centreline crossover," confirming trend direction; and (3) divergence between MACD and price — one of the most reliable reversal signals.

The histogram is particularly valuable for gauging momentum: expanding bars indicate increasing momentum in the direction of the trend, while shrinking bars suggest the move is losing steam before a potential reversal. A histogram that peaks and begins to contract is an early warning of a signal line crossover ahead.

MACD works best as a trend-confirmation tool on timeframes of 1H and above. On lower timeframes it generates excessive noise. Combining MACD signals with structure analysis (support/resistance) and volume confirmation significantly improves signal quality.`,
    howItWorks: `auto-Trading computes the MACD line, signal line, and histogram values bar by bar. In the strategy builder, users can trigger on: MACD/signal crossovers, centreline crossovers, histogram direction changes, or divergence events. The divergence detector compares price swing extremes with MACD histogram extremes over a configurable lookback period.`,
    externalLinks: [
      { label: 'Investopedia — MACD', url: 'https://www.investopedia.com/terms/m/macd.asp', description: 'Full explanation of MACD calculation, signals, and best practices.' },
      { label: 'TradingView — MACD', url: 'https://www.tradingview.com/scripts/macd/', description: 'MACD variations and divergence detectors on TradingView.' },
      { label: 'BabyPips — MACD', url: 'https://www.babypips.com/learn/forex/macd', description: "BabyPips' MACD tutorial with clear visual examples." },
    ],
    relatedSlugs: ['ema-indicator', 'rsi-indicator', 'moving-average-crossover', 'trend-following'],
  },

  'stochastic-oscillator': {
    slug: 'stochastic-oscillator',
    category: 'signal',
    icon: '🎢',
    title: 'Stochastic Oscillator',
    tagline: 'Compare closing price to its range to detect momentum shifts.',
    metaTitle: 'Stochastic Oscillator — AutoTrader Learn',
    metaDescription: 'Learn the Stochastic Oscillator: how this momentum indicator identifies overbought/oversold conditions and generates %K/%D crossover signals.',
    overview: `The Stochastic Oscillator, developed by George Lane in the 1950s, measures the closing price relative to the high-low range over a specified period. The premise is that in uptrending markets, prices tend to close near the high of the range, and in downtrending markets near the low. Divergence from this pattern signals a potential reversal.

The indicator consists of two lines: %K (the raw oscillator = (Current Close − Lowest Low) ÷ (Highest High − Lowest Low) × 100) and %D (a 3-period SMA of %K, which acts as the signal line). Both oscillate between 0 and 100. Readings above 80 indicate overbought conditions; below 20 indicates oversold.

Trading signals include: %K crossing above %D from below in the oversold zone (bullish), %K crossing below %D from above in the overbought zone (bearish), and divergence between the oscillator and price. The "Stoch RSI" variant applies the stochastic formula to RSI values rather than price, making it even more sensitive for short-term trading.

Like RSI, the Stochastic works best in ranging markets and should be used with a trend filter in trending environments to avoid shorting strong uptrends or buying into strong downtrends.`,
    howItWorks: `auto-Trading computes both Fast Stochastic (%K, %D) and Slow Stochastic (which applies additional smoothing). The strategy builder supports %K/%D crossover signals, overbought/oversold threshold alerts, and divergence detection. Users configure the lookback period (default 14) and smoothing periods through the properties panel.`,
    externalLinks: [
      { label: 'Investopedia — Stochastic Oscillator', url: 'https://www.investopedia.com/terms/s/stochasticoscillator.asp', description: 'Complete guide to the Stochastic Oscillator and its trading signals.' },
      { label: 'TradingView — Stochastic', url: 'https://www.tradingview.com/scripts/stochastic/', description: 'Stochastic indicator scripts and community strategies.' },
      { label: 'BabyPips — Stochastic', url: 'https://www.babypips.com/learn/forex/stochastic', description: "BabyPips' accessible introduction to stochastic trading." },
    ],
    relatedSlugs: ['rsi-indicator', 'macd-indicator', 'mean-reversion', 'bollinger-bands'],
  },

  'bollinger-bands': {
    slug: 'bollinger-bands',
    category: 'signal',
    icon: '📏',
    title: 'Bollinger Bands',
    tagline: 'Dynamic volatility envelopes that reveal price extremes.',
    metaTitle: 'Bollinger Bands Indicator — AutoTrader Learn',
    metaDescription: 'Master Bollinger Bands: how these volatility-adaptive envelopes identify squeeze setups, mean reversion trades, and breakout signals.',
    overview: `Bollinger Bands, created by John Bollinger in the 1980s, consist of three lines plotted around a 20-period SMA: an upper band at +2 standard deviations and a lower band at −2 standard deviations. Approximately 95% of price action falls within the bands under normal volatility conditions.

The width of the bands is dynamic — they expand during high-volatility periods and contract during low-volatility periods. This adaptability is the indicator's key feature. The "Bollinger Squeeze" occurs when bands contract to unusually narrow widths, indicating a period of compressed volatility that historically precedes a significant move (breakout in either direction). Traders prepare for the squeeze by setting breakout orders above and below the bands.

Mean reversion strategies use the bands as extreme zones: when price touches or closes outside the upper band, it may be stretched upward and likely to revert toward the middle band (SMA). When price touches the lower band, it may be oversold. This approach works well in ranging markets.

The %B indicator (derived from Bollinger Bands) measures where price is relative to the bands on a scale of 0–1, making it easier to programmatically test band-related conditions without manual chart analysis.`,
    howItWorks: `auto-Trading computes the 20-SMA and the upper/lower Bollinger Bands in real time. Strategy blocks include: band touch alerts, %B threshold signals, Bollinger Squeeze detection (based on band width falling below a historical percentile), and band breakout signals. The squeeze detector automatically flags instruments approaching historically narrow band widths across the platform.`,
    externalLinks: [
      { label: 'Investopedia — Bollinger Bands', url: 'https://www.investopedia.com/terms/b/bollingerbands.asp', description: "Definitive guide to Bollinger Bands by John Bollinger's own documentation." },
      { label: 'TradingView — Bollinger Bands', url: 'https://www.tradingview.com/scripts/bollingerbands/', description: 'Bollinger Band scripts including squeeze detectors.' },
      { label: 'BabyPips — Bollinger Bands', url: 'https://www.babypips.com/learn/forex/bollinger-bands', description: "BabyPips' practical Bollinger Bands trading guide." },
    ],
    relatedSlugs: ['mean-reversion', 'rsi-indicator', 'atr-indicator', 'scalping-strategy'],
  },

  'vwap-indicator': {
    slug: 'vwap-indicator',
    category: 'signal',
    icon: '⚖️',
    title: 'VWAP — Volume Weighted Average Price',
    tagline: 'The benchmark price that institutions use to evaluate trade quality.',
    metaTitle: 'VWAP Indicator — AutoTrader Learn',
    metaDescription: 'Learn VWAP: how institutions use volume-weighted average price as a trading benchmark and how retail traders use it for intraday signals.',
    overview: `VWAP (Volume Weighted Average Price) is the average price of an asset weighted by volume, calculated from the open of the trading session. It represents the "true average price" paid by all market participants during the day and is the primary benchmark used by institutional traders to evaluate whether they executed their orders at a good price.

VWAP = Cumulative (Price × Volume) ÷ Cumulative Volume

Because VWAP resets at the start of each session, it is primarily an intraday tool. Price above VWAP is considered bullish (buyers are in control); price below VWAP is considered bearish. Institutional algorithms often target VWAP when executing large orders to avoid moving the market, which means VWAP acts as a strong magnet for intraday price.

Anchored VWAP (AVWAP) extends the concept by allowing traders to anchor the calculation to any significant event: an earnings announcement, a swing high, the start of an uptrend. This makes AVWAP useful beyond the intraday context for swing and position traders.

Common VWAP strategies include: buying pull-backs to VWAP in uptrending sessions, using VWAP as a dynamic intraday support/resistance, and trading VWAP band expansions (similar to Bollinger Bands but volume-weighted).`,
    howItWorks: `auto-Trading calculates session VWAP and AVWAP in real time, with user-configurable anchor points. Strategy blocks include VWAP crossover signals, deviation band alerts, and session open relative to VWAP (bullish if price opens above). The VWAP band indicator displays ±1 and ±2 standard deviation bands around the VWAP for additional context.`,
    externalLinks: [
      { label: 'Investopedia — VWAP', url: 'https://www.investopedia.com/terms/v/vwap.asp', description: 'Comprehensive guide to VWAP calculation and institutional usage.' },
      { label: 'TradingView — VWAP', url: 'https://www.tradingview.com/scripts/vwap/', description: 'VWAP and Anchored VWAP scripts on TradingView.' },
      { label: 'BabyPips — VWAP Trading', url: 'https://www.babypips.com/learn/forex/vwap', description: "BabyPips' introduction to VWAP for retail traders." },
    ],
    relatedSlugs: ['bollinger-bands', 'scalping-strategy', 'mean-reversion', 'volume-analysis'],
  },

  'atr-indicator': {
    slug: 'atr-indicator',
    category: 'signal',
    icon: '📐',
    title: 'Average True Range (ATR)',
    tagline: 'Measure volatility and size your stops intelligently.',
    metaTitle: 'ATR — Average True Range — AutoTrader Learn',
    metaDescription: 'Learn ATR: the go-to volatility indicator for setting dynamic stop-losses, measuring market activity, and sizing positions.',
    overview: `The Average True Range (ATR), developed by J. Welles Wilder Jr. in his 1978 book, measures market volatility by calculating the average of the "true range" over a specified period. The true range is the greatest of: (current high − current low), (|current high − previous close|), and (|current low − previous close|), ensuring gaps are captured.

ATR does not indicate direction — it measures only the magnitude of price movement. A high ATR indicates a volatile market; a low ATR indicates a calm one. This makes it invaluable for stop-loss calibration: a 2× ATR stop, for example, is set far enough away to avoid being triggered by normal market noise, yet close enough to limit losses meaningfully.

The Chandelier Exit is a popular trailing stop technique based on ATR: the stop trails at 3× ATR below the highest high reached during the trade. As the trade becomes profitable and price climbs, the stop rises with it, protecting profits while allowing the trend to breathe.

ATR is also used in position sizing: many systematic traders risk a fixed fraction of equity per trade and set position size = Risk Amount ÷ (ATR × multiplier), ensuring every trade represents an equal real-money risk regardless of the asset's absolute price.`,
    howItWorks: `auto-Trading uses ATR to calculate dynamic stop-loss distances for every trade. In the risk management module, users set their stop as an ATR multiple (default 2× ATR). Position size is automatically computed based on the dollar risk per trade and the ATR stop distance, ensuring consistent position sizing across volatile and calm market conditions.`,
    externalLinks: [
      { label: 'Investopedia — ATR', url: 'https://www.investopedia.com/terms/a/atr.asp', description: 'Wilder\'s ATR explained: formula, interpretation, and stop-loss applications.' },
      { label: 'TradingView — ATR Scripts', url: 'https://www.tradingview.com/scripts/averagetruerange/', description: 'ATR-based stop and trailing stop scripts on TradingView.' },
      { label: 'BabyPips — ATR', url: 'https://www.babypips.com/learn/forex/atr', description: "BabyPips' guide to using ATR for stop placement." },
    ],
    relatedSlugs: ['bollinger-bands', 'breakout-strategy', 'trend-following', 'grid-trading'],
  },

  'adx-indicator': {
    slug: 'adx-indicator',
    category: 'signal',
    icon: '🧭',
    title: 'ADX — Average Directional Index',
    tagline: 'Quantify trend strength to filter low-quality setups.',
    metaTitle: 'ADX — Average Directional Index — AutoTrader Learn',
    metaDescription: 'Learn ADX: how to measure trend strength with the Average Directional Index and filter out range-bound false signals.',
    overview: `The Average Directional Index (ADX) is a trend strength indicator, also developed by J. Welles Wilder Jr., that measures how strong a trend is — regardless of direction. It is always plotted alongside two directional movement lines: +DI (positive directional indicator) and −DI (negative directional indicator).

ADX values range from 0 to 100. A reading below 20 indicates a weak or absent trend (range-bound market). Values between 20–25 mark the beginning of a trend. Above 25 indicates a strong trend; above 40 signals a very strong trend; above 50 is rare and indicates an extremely powerful move.

The key insight is that trend-following strategies (moving average crossovers, breakouts) perform poorly in markets with low ADX. Adding an ADX > 25 filter dramatically reduces false signals. Conversely, mean-reversion strategies work best when ADX is below 20.

The +DI/−DI crossover provides directional signals: when +DI crosses above −DI, the market is strengthening upward; the reverse for downward moves. Combined with the ADX reading, this creates a three-part signal: ADX is rising (trend is strengthening), +DI > −DI (bullish), ADX > 25 (trend is valid).`,
    howItWorks: `auto-Trading computes ADX, +DI, and −DI on any timeframe. The strategy builder allows ADX to be used as a regime filter: trend strategies are enabled only when ADX > 25, and mean-reversion strategies are enabled only when ADX < 20. The +DI/−DI crossover block can trigger direct entry signals or act as a directional bias filter for other strategy logic.`,
    externalLinks: [
      { label: 'Investopedia — ADX', url: 'https://www.investopedia.com/terms/a/adx.asp', description: 'Full guide to ADX, +DI, and −DI with practical trading examples.' },
      { label: 'TradingView — ADX Scripts', url: 'https://www.tradingview.com/scripts/adx/', description: 'ADX-based trend filter scripts and strategies.' },
      { label: 'BabyPips — ADX', url: 'https://www.babypips.com/learn/forex/adx', description: "BabyPips' explanation of ADX and its role in confirming trend signals." },
    ],
    relatedSlugs: ['trend-following', 'moving-average-crossover', 'atr-indicator', 'breakout-strategy'],
  },

  'donchian-channel': {
    slug: 'donchian-channel',
    category: 'signal',
    icon: '🏛️',
    title: 'Donchian Channels',
    tagline: 'The breakout indicator behind the famous Turtle Trading system.',
    metaTitle: 'Donchian Channels — AutoTrader Learn',
    metaDescription: 'Learn Donchian Channels: the breakout indicator used by the legendary Turtle Traders to generate systematic entry and exit signals.',
    overview: `Donchian Channels, developed by commodity trader Richard Donchian, plot the highest high and lowest low over a user-defined period as upper and lower bands, with a midline at the average. Price above the upper band signals a new N-period high (bullish breakout); price below the lower band signals a new N-period low (bearish breakout).

The indicator became famous as the core of the Turtle Trading System, where Richard Dennis used 20-day and 55-day Donchian channel breakouts as entry signals. The Turtle Traders, a group of novice traders trained by Dennis in 1983, famously became highly profitable by rigorously following these breakout rules — demonstrating that systematic, rules-based trading can succeed without intuition or experience.

A long entry is triggered when price closes above the 20-day upper band; a short when it closes below the lower band. Exits use the 10-day channel: a long is exited when price hits the 10-day lower band, and a short when it hits the 10-day upper band. Position sizing is ATR-based as described in the Turtle rulebook.

Donchian Channels are equally useful as a trend-following entry mechanism and as a support/resistance visualisation tool, with the midline acting as a dynamic mean.`,
    howItWorks: `auto-Trading implements Donchian Channels with configurable period settings for entries (default 20) and exits (default 10), following the Turtle Trading specification. Users can also use a single-period Donchian for simplified breakout entries. The breakout signal integrates with the ATR-based position sizing module to fully implement the Turtle position-sizing formula.`,
    externalLinks: [
      { label: 'Investopedia — Donchian Channels', url: 'https://www.investopedia.com/terms/d/donchianchannel.asp', description: 'Guide to Donchian Channels and their use in breakout trading.' },
      { label: 'TradingView — Donchian', url: 'https://www.tradingview.com/scripts/donchianchannels/', description: 'Donchian Channel scripts including Turtle Trading implementations.' },
      { label: 'BabyPips — Donchian Channels', url: 'https://www.babypips.com/learn/forex/donchian-channels', description: "BabyPips' Donchian Channel tutorial." },
    ],
    relatedSlugs: ['breakout-strategy', 'trend-following', 'atr-indicator', 'adx-indicator'],
  },

  'volume-analysis': {
    slug: 'volume-analysis',
    category: 'signal',
    icon: '📦',
    title: 'Volume Analysis',
    tagline: 'Confirm price moves by following the money.',
    metaTitle: 'Volume Analysis in Trading — AutoTrader Learn',
    metaDescription: 'Learn volume analysis: how to use trading volume to confirm price moves, detect distribution, and identify institutional activity.',
    overview: `Volume is the number of units traded in a given period, and it is one of the most direct measures of market participation and conviction. The principle of "volume precedes price" reflects the observation that significant institutional activity — which drives major price moves — must involve large transaction volumes.

Key volume analysis concepts include: volume confirmation (a breakout or reversal accompanied by above-average volume is more likely to be genuine), volume divergence (price making new highs on declining volume suggests diminishing buying interest and potential reversal), and volume climaxes (extremely high volume bars after a sustained trend often mark exhaustion and reversal points — known as "selling climaxes" at bottoms and "buying climaxes" at tops).

On-Balance Volume (OBV) accumulates volume on up-days and subtracts it on down-days, creating a running total that acts as a momentum indicator. When OBV diverges from price, it often foreshadows a price reversal. The Money Flow Index (MFI) combines price and volume to create a volume-weighted RSI.

Volume Profile analysis maps volume by price level rather than by time, revealing the "Point of Control" (POC) — the price level with the highest traded volume — which acts as a magnetic anchor for price. High Volume Nodes (HVN) act as support/resistance; Low Volume Nodes (LVN) act as areas of fast price travel.`,
    howItWorks: `auto-Trading monitors volume relative to the 20-period average on each bar. Above-average volume on a breakout confirms the signal; below-average volume triggers a filter that delays or cancels the entry. The OBV indicator and volume divergence detector are available as signal blocks in the strategy builder.`,
    externalLinks: [
      { label: 'Investopedia — Volume Analysis', url: 'https://www.investopedia.com/terms/v/volume.asp', description: 'Overview of volume in trading and its analytical uses.' },
      { label: 'TradingView — Volume Scripts', url: 'https://www.tradingview.com/scripts/volume/', description: 'Community volume analysis indicators on TradingView.' },
      { label: 'BabyPips — Trading Volume', url: 'https://www.babypips.com/learn/forex/volume-analysis', description: "BabyPips' volume analysis guide for forex and crypto traders." },
    ],
    relatedSlugs: ['breakout-strategy', 'vwap-indicator', 'trend-following', 'smart-money-concepts'],
  },

  'cci-indicator': {
    slug: 'cci-indicator',
    category: 'signal',
    icon: '🔭',
    title: 'Commodity Channel Index (CCI)',
    tagline: 'Identify cyclical turns and overbought/oversold extremes.',
    metaTitle: 'CCI — Commodity Channel Index — AutoTrader Learn',
    metaDescription: 'Learn the CCI indicator: how it measures price deviation from its average and generates overbought/oversold and divergence signals.',
    overview: `The Commodity Channel Index (CCI) was developed by Donald Lambert and published in 1980. Despite its name, it is widely used across all asset classes. The indicator measures how far the current typical price has deviated from its recent average, scaled by the mean absolute deviation to normalise the result.

CCI = (Typical Price − N-period SMA of Typical Price) ÷ (0.015 × Mean Absolute Deviation)

The constant 0.015 was chosen so that approximately 70–80% of CCI values fall within the ±100 range under normal conditions. Values above +100 indicate the price is significantly above its recent average (overbought in ranging markets; a strong momentum signal in trending markets). Values below −100 indicate the price is significantly below its average (oversold or strong bearish momentum).

Trading applications include: counter-trend entries when CCI exceeds ±100 in ranging markets, trend-following entries after CCI rises above +100 (buy) or falls below −100 (sell) in trending markets, and divergence between CCI and price as a reversal signal.

When used on higher timeframes (weekly or monthly), CCI is particularly effective at identifying major cyclical turning points in commodities and equities.`,
    howItWorks: `auto-Trading computes CCI using the typical price ((high + low + close) ÷ 3) over the configured period (default 20). The strategy builder supports CCI level crossovers, zone entries, and divergence detection. CCI can be applied to any timeframe and combined with trend filters to distinguish between trending and ranging regimes.`,
    externalLinks: [
      { label: 'Investopedia — CCI', url: 'https://www.investopedia.com/terms/c/commoditychannelindex.asp', description: 'Full guide to CCI: formula, signals, and interpretation.' },
      { label: 'TradingView — CCI Scripts', url: 'https://www.tradingview.com/scripts/commoditychannelindex/', description: 'CCI-based strategies and scripts on TradingView.' },
      { label: 'BabyPips — CCI', url: 'https://www.babypips.com/learn/forex/cci', description: "BabyPips' CCI tutorial with practical forex examples." },
    ],
    relatedSlugs: ['rsi-indicator', 'stochastic-oscillator', 'mean-reversion', 'macd-indicator'],
  },

  'williams-percent-r': {
    slug: 'williams-percent-r',
    category: 'signal',
    icon: '📡',
    title: 'Williams %R',
    tagline: 'A fast, sensitive overbought/oversold indicator by Larry Williams.',
    metaTitle: 'Williams %R Indicator — AutoTrader Learn',
    metaDescription: 'Learn Williams %R: how this momentum oscillator identifies overbought and oversold levels and generates short-term reversal signals.',
    overview: `Williams %R (pronounced "Williams Percent R") is a momentum indicator developed by Larry Williams, similar to the Stochastic Oscillator but inverted. It measures the close price relative to the highest high over a lookback period, scaled from −100 to 0. Values near 0 indicate overbought conditions; values near −100 indicate oversold.

Formula: %R = (Highest High − Close) ÷ (Highest High − Lowest Low) × −100

Readings above −20 (near 0) indicate overbought conditions — price is closing near the top of its recent range. Readings below −80 indicate oversold conditions — price is closing near the bottom of its recent range. Buy signals occur when %R crosses back up through −80 from below (exiting oversold territory); sell signals when it crosses back down through −20 from above.

Williams %R is known for its ability to predict reversals 1–2 periods before other oscillators, making it popular for short-term and intraday traders. Like all oscillators, it works best in range-bound markets and should be used with a trend filter in trending environments.

The indicator also generates powerful divergence signals: when price makes a new low but %R fails to reach new oversold readings, bullish divergence suggests a reversal is approaching.`,
    howItWorks: `auto-Trading computes Williams %R over a configurable period (default 14). The strategy builder supports level crossover signals (crossing −20/−80 thresholds), divergence detection, and combination with trend filters. %R can be used as a standalone entry signal or as a timing filter within a larger strategy framework.`,
    externalLinks: [
      { label: 'Investopedia — Williams %R', url: 'https://www.investopedia.com/terms/w/williamsr.asp', description: 'Complete guide to Williams %R and its trading applications.' },
      { label: 'TradingView — Williams %R', url: 'https://www.tradingview.com/scripts/williamsr/', description: 'Williams %R scripts and strategies on TradingView.' },
      { label: 'BabyPips — Williams %R', url: 'https://www.babypips.com/learn/forex/williams-percent-r', description: "BabyPips' tutorial on Williams %R for forex trading." },
    ],
    relatedSlugs: ['stochastic-oscillator', 'rsi-indicator', 'cci-indicator', 'mean-reversion'],
  },

  'parabolic-sar': {
    slug: 'parabolic-sar',
    category: 'signal',
    icon: '🌀',
    title: 'Parabolic SAR',
    tagline: 'An automatic trailing stop system that follows the trend.',
    metaTitle: 'Parabolic SAR Indicator — AutoTrader Learn',
    metaDescription: 'Learn Parabolic SAR: how this trend-following indicator generates automatic trailing stop and reversal signals for trending markets.',
    overview: `The Parabolic SAR (Stop and Reverse), developed by J. Welles Wilder Jr., is a trend-following indicator that places dots above or below price to indicate direction and potential reversal points. When dots are below price, the trend is up; when dots are above price, the trend is down. The indicator is named for the parabolic curve the dots trace as a trend accelerates.

The SAR value is computed using an Acceleration Factor (AF) that starts at 0.02 and increases by 0.02 each time a new extreme price is recorded during the trend, up to a maximum of 0.20. As the AF increases, the SAR dot moves closer to price, meaning a reversal signal is triggered sooner as the trend matures — protecting profits in extended moves.

A reversal signal occurs when price touches or crosses the SAR dot. The SAR immediately flips to the other side of price and the AF resets to 0.02. This makes Parabolic SAR a "stop and reverse" system: when it signals a reversal, it simultaneously suggests closing the current trade and opening an opposite one.

Parabolic SAR is most effective in strongly trending markets. In sideways markets, the frequent dot flips produce many false signals. Traders typically use ADX to confirm a trend is present before relying on SAR signals.`,
    howItWorks: `auto-Trading implements Parabolic SAR with configurable starting AF, step size, and maximum AF. The strategy builder supports SAR flip signals (dots crossing price) as trade entry/exit triggers. The SAR value is used directly as a dynamic trailing stop: the open position's stop-loss is updated to the current SAR value at each bar close.`,
    externalLinks: [
      { label: 'Investopedia — Parabolic SAR', url: 'https://www.investopedia.com/terms/p/parabolicindicator.asp', description: 'Full explanation of Parabolic SAR calculation and trading use.' },
      { label: 'TradingView — Parabolic SAR', url: 'https://www.tradingview.com/scripts/parabolicsar/', description: 'Parabolic SAR scripts and trend-following strategies on TradingView.' },
      { label: 'BabyPips — Parabolic SAR', url: 'https://www.babypips.com/learn/forex/parabolic-sar', description: "BabyPips' guide to using Parabolic SAR in trend trading." },
    ],
    relatedSlugs: ['adx-indicator', 'trend-following', 'atr-indicator', 'moving-average-crossover'],
  },

  'obv-indicator': {
    slug: 'obv-indicator',
    category: 'signal',
    icon: '🔊',
    title: 'On-Balance Volume (OBV)',
    tagline: 'Track cumulative buying and selling pressure through volume flow.',
    metaTitle: 'OBV — On-Balance Volume — AutoTrader Learn',
    metaDescription: 'Learn On-Balance Volume (OBV): how this volume flow indicator confirms trends and detects divergences that signal price reversals.',
    overview: `On-Balance Volume (OBV) was developed by Joseph Granville and introduced in his 1963 book "Granville's New Key to Stock Market Profits." The concept is elegantly simple: on days when price closes higher, the day's volume is added to a running total; on days when price closes lower, the volume is subtracted. The result is a cumulative volume line that trends alongside — and often ahead of — price.

The core premise is that OBV captures the accumulation (buying) and distribution (selling) of institutional smart money. Large investors accumulate positions quietly over time, which shows up as consistently positive OBV without necessarily moving price significantly — until enough shares are accumulated that price must rise. This "divergence before breakout" pattern makes OBV a leading indicator.

A rising OBV in concert with rising price confirms the uptrend. A divergence — OBV declining while price rises — is a bearish warning that the rally is not being supported by volume and may reverse. The reverse holds for downtrends.

OBV is also used to detect "stealth accumulation": when price is range-bound but OBV is steadily rising, smart money may be building a position ahead of an upside breakout.`,
    howItWorks: `auto-Trading computes OBV as a running cumulative sum updated on each bar close. The strategy builder provides OBV crossover signals (OBV crossing above/below its own moving average), OBV divergence detection, and OBV trend analysis. Combining OBV breakouts with price breakout signals creates high-confluence entry signals.`,
    externalLinks: [
      { label: 'Investopedia — OBV', url: 'https://www.investopedia.com/terms/o/onbalancevolume.asp', description: "Complete guide to Granville's On-Balance Volume indicator." },
      { label: 'TradingView — OBV Scripts', url: 'https://www.tradingview.com/scripts/onbalancevolume/', description: 'OBV indicators and strategies on TradingView.' },
      { label: 'BabyPips — OBV', url: 'https://www.babypips.com/learn/forex/obv', description: "BabyPips' introduction to On-Balance Volume." },
    ],
    relatedSlugs: ['volume-analysis', 'vwap-indicator', 'macd-indicator', 'trend-following'],
  },

  // ── Extra Signals ────────────────────────────────────────────────────────

  'pivot-points': {
    slug: 'pivot-points',
    category: 'signal',
    icon: '🔵',
    title: 'Pivot Points',
    tagline: 'Calculate key support and resistance levels from the previous session.',
    metaTitle: 'Pivot Points — Support & Resistance Levels — AutoTrader Learn',
    metaDescription: 'Learn Pivot Points: how traders use daily, weekly, and monthly pivot levels to identify support, resistance, and high-probability reversals.',
    overview: `Pivot Points are one of the oldest and most widely used technical analysis tools, predating the computer era — floor traders in futures pits calculated them by hand each morning. The central pivot (P) is the average of the prior session's high, low, and close. From that single level, support levels (S1, S2, S3) and resistance levels (R1, R2, R3) are derived mathematically.

The key insight is that because so many participants are watching the same levels, those levels often become self-fulfilling. Price tends to react at pivot levels not necessarily because of fundamental value, but because of the concentration of buy and sell orders placed there.

Standard pivots are calculated daily, but weekly and monthly pivots are used by swing and position traders for longer timeframes. Camarilla pivots and Woodie's pivots are popular variants that weight the close more heavily, producing tighter intraday levels preferred by scalpers.

Pivot points are especially effective in range-bound markets where price oscillates between support and resistance. In trending markets, price often runs through levels — but even then, pauses and consolidations frequently occur at pivot lines, offering entry opportunities.`,
    howItWorks: `auto-Trading calculates all pivot variants (Standard, Camarilla, Woodie's, Fibonacci) across all timeframes automatically. You can build strategies that trigger buy orders near S1/S2 with a target at P or R1, or set dynamic stop-losses based on the nearest pivot level below entry.`,
    externalLinks: [
      { label: 'Investopedia — Pivot Points', url: 'https://www.investopedia.com/terms/p/pivotpoint.asp', description: 'Comprehensive guide to pivot point calculation and trading.' },
      { label: 'TradingView — Pivot Points', url: 'https://www.tradingview.com/scripts/pivotpoints/', description: 'Pivot point scripts and strategies on TradingView.' },
      { label: 'BabyPips — Pivot Points', url: 'https://www.babypips.com/learn/forex/pivot-points', description: "BabyPips' beginner guide to pivot point trading." },
    ],
    relatedSlugs: ['fibonacci-retracement', 'rsi-indicator', 'breakout-strategy', 'price-action-strategy'],
  },

  'keltner-channels': {
    slug: 'keltner-channels',
    category: 'signal',
    icon: '🌊',
    title: 'Keltner Channels',
    tagline: 'Volatility-based envelopes built on ATR to identify trend strength and breakouts.',
    metaTitle: 'Keltner Channels — ATR-Based Volatility Bands — AutoTrader Learn',
    metaDescription: 'Learn Keltner Channels: how this ATR-based indicator identifies trend direction, volatility squeezes, and high-momentum breakout opportunities.',
    overview: `Keltner Channels were originally developed by Chester Keltner in the 1960s and later modernized by Linda Bradford Raschke, who replaced Keltner's original construction with an EMA center-line and ATR-based bands — the version used today. The indicator places an upper and lower band at a multiple of the Average True Range above and below an Exponential Moving Average.

Unlike Bollinger Bands (which use standard deviation), Keltner Channels use ATR — a measure of true range volatility — which makes the bands smoother and less prone to sudden expansions during brief price spikes. This smoothness makes them useful for identifying sustained trend moves rather than just momentary volatility events.

When price consistently closes above the upper band, it signals a strong uptrend — bearish signals within that context should be ignored. When price closes below the lower band, a strong downtrend is in place. The center EMA acts as a dynamic support/resistance line and a mean-reversion target.

One of the most popular strategies is the "Keltner-Bollinger Squeeze": when Bollinger Bands contract inside the Keltner Channel, it identifies an extreme volatility compression that often precedes an explosive directional move. Traders wait for bands to expand and price to break out to determine direction.`,
    howItWorks: `auto-Trading implements Keltner Channels with configurable EMA period and ATR multiplier. Built-in squeeze detection alerts you when Bollinger Bands compress inside the Keltner Channel. Strategy triggers include upper/lower band touches, EMA crossovers, and momentum-confirmed breakouts.`,
    externalLinks: [
      { label: 'Investopedia — Keltner Channel', url: 'https://www.investopedia.com/terms/k/keltnerchannel.asp', description: 'Full explanation of Keltner Channel construction and use.' },
      { label: 'TradingView — Keltner Scripts', url: 'https://www.tradingview.com/scripts/keltnerchannel/', description: 'Keltner Channel indicators on TradingView.' },
      { label: 'StockCharts — Keltner Channels', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:keltner_channels', description: "StockCharts' in-depth article on Keltner Channels." },
    ],
    relatedSlugs: ['bollinger-bands', 'atr-indicator', 'breakout-strategy', 'ema-indicator'],
  },

  'supertrend-indicator': {
    slug: 'supertrend-indicator',
    category: 'signal',
    icon: '🚀',
    title: 'Supertrend Indicator',
    tagline: 'A dynamic trailing stop and trend-direction indicator built on ATR.',
    metaTitle: 'Supertrend Indicator — Dynamic Trend Trailing Stop — AutoTrader Learn',
    metaDescription: 'Learn the Supertrend Indicator: how this ATR-based tool signals trend direction, provides trailing stops, and generates clear buy/sell signals.',
    overview: `The Supertrend Indicator, developed by Olivier Seban, is a deceptively simple trend-following tool that produces remarkably clean buy and sell signals. It plots a single line on price: green below price during uptrends, red above price during downtrends. The line also functions as a dynamic trailing stop.

The indicator is constructed using the Average True Range. The upper band is calculated as (High + Low) / 2 + multiplier × ATR, and the lower band as (High + Low) / 2 − multiplier × ATR. When price crosses above the upper band, Supertrend flips to a buy signal; when price falls below the lower band, it flips to a sell.

The default settings (ATR period 10, multiplier 3) work well across multiple timeframes and asset classes, making Supertrend one of the few indicators that is genuinely useful "out of the box." The multiplier controls sensitivity — lower values generate more signals with more noise; higher values produce fewer, more reliable signals with larger stop distances.

Supertrend is particularly effective for identifying the beginning of trending moves and providing objective exit criteria. Its trailing nature means profits are protected automatically as the trend extends, eliminating emotional decisions about when to exit.`,
    howItWorks: `auto-Trading's Supertrend implementation supports all parameter configurations and timeframes. Strategy rules can trigger entries on Supertrend color change with volume confirmation, and exits when Supertrend flips. You can combine Supertrend with RSI to filter signals — only taking Supertrend buys when RSI is above 50.`,
    externalLinks: [
      { label: 'Investopedia — Supertrend', url: 'https://www.investopedia.com/supertrend-indicator-7976167', description: 'Investopedia overview of the Supertrend indicator.' },
      { label: 'TradingView — Supertrend', url: 'https://www.tradingview.com/scripts/supertrend/', description: 'Popular Supertrend scripts on TradingView.' },
      { label: 'StockCharts — ATR', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:average_true_range_atr', description: 'ATR explanation — the foundation of Supertrend.' },
    ],
    relatedSlugs: ['atr-indicator', 'trend-following', 'ema-indicator', 'adx-indicator'],
  },

  'mfi-indicator': {
    slug: 'mfi-indicator',
    category: 'signal',
    icon: '💰',
    title: 'Money Flow Index (MFI)',
    tagline: 'A volume-weighted RSI that measures buying and selling pressure.',
    metaTitle: 'Money Flow Index (MFI) — Volume-Weighted RSI — AutoTrader Learn',
    metaDescription: 'Learn the Money Flow Index (MFI): a volume-weighted momentum oscillator that identifies overbought and oversold conditions with greater accuracy than price-only indicators.',
    overview: `The Money Flow Index (MFI) was developed by Gene Quong and Avrum Soudack and is sometimes called the "volume-weighted RSI" because its construction mirrors RSI's logic but incorporates volume into each period's calculation. This makes MFI a more comprehensive measure of money flow — the actual buying and selling pressure — rather than just price momentum.

The indicator starts with Typical Price (High + Low + Close) / 3. When typical price rises from the prior period, the day's Raw Money Flow (Typical Price × Volume) is positive; when it falls, it is negative. The ratio of positive to negative money flow over the lookback period is transformed through the same RSI formula to produce a 0–100 oscillator.

Like RSI, values above 80 are considered overbought and values below 20 oversold — but because volume is included, these signals are considered more reliable than RSI alone. A security with high price but declining MFI suggests that the rally is not supported by increasing participation, which is bearish.

MFI divergence is particularly valued: when price makes new highs but MFI fails to confirm, it suggests distribution is occurring. The reverse signals accumulation before an upside move. This makes MFI a leading indicator capable of anticipating reversals before they appear in price alone.`,
    howItWorks: `auto-Trading uses MFI as a standalone signal generator and as a confirmation filter. Build strategies that buy oversold MFI readings (< 20) in uptrending assets, or sell overbought readings (> 80) in downtrends. MFI divergence scanning is available across all instruments to find accumulation/distribution setups automatically.`,
    externalLinks: [
      { label: 'Investopedia — MFI', url: 'https://www.investopedia.com/terms/m/mfi.asp', description: 'Full guide to the Money Flow Index and its calculation.' },
      { label: 'TradingView — MFI Scripts', url: 'https://www.tradingview.com/scripts/moneyflowindex/', description: 'MFI indicators and strategies on TradingView.' },
      { label: 'StockCharts — MFI', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:money_flow_index_mfi', description: "StockCharts' detailed MFI article with examples." },
    ],
    relatedSlugs: ['rsi-indicator', 'volume-analysis', 'obv-indicator', 'cci-indicator'],
  },

  'fibonacci-indicator': {
    slug: 'fibonacci-indicator',
    category: 'signal',
    icon: '🌀',
    title: 'Fibonacci Retracement & Extensions',
    tagline: 'Use the golden ratio to locate high-probability support, resistance, and profit targets.',
    metaTitle: 'Fibonacci Retracement & Extensions — Golden Ratio Trading — AutoTrader Learn',
    metaDescription: 'Learn Fibonacci Retracement and Extension levels: how the golden ratio identifies support, resistance, and profit targets used by institutional traders worldwide.',
    overview: `Fibonacci analysis in trading derives from the mathematical sequence discovered by Leonardo Fibonacci in the 13th century. The key ratios — 23.6%, 38.2%, 50%, 61.8% (the "golden ratio"), and 78.6% — represent proportional relationships that appear repeatedly in natural and financial systems. The 61.8% level, derived from dividing a Fibonacci number by the next, is considered the most significant.

In trading, Fibonacci Retracement levels are drawn between two significant swing points (a major high and low). The resulting levels identify potential support during pullbacks in an uptrend, or resistance during rallies in a downtrend. The 38.2%–61.8% zone is considered the "golden zone" where the highest probability retracement entries occur.

Fibonacci Extension levels project price targets beyond the original move, calculated from the swing high, swing low, and retracement point. The 161.8%, 261.8%, and 423.6% extensions provide profit targets for breakout trades. When Fibonacci levels confluence with other technical factors — round numbers, moving averages, previous swing highs/lows — their significance is greatly amplified.

Smart Money Concepts heavily incorporate Fibonacci, using the 0.79 and 0.886 levels as "optimal trade entry" zones within the golden zone. The 0.5 level, while not a true Fibonacci ratio, is included by convention because many traders reference it.`,
    howItWorks: `auto-Trading's Fibonacci tool automatically identifies major swing points and draws retracement and extension levels. Strategy signals can trigger when price touches a Fibonacci level with a reversal candlestick pattern, when RSI reaches oversold at a key Fibonacci level, or when an order block aligns with the 61.8% retracement.`,
    externalLinks: [
      { label: 'Investopedia — Fibonacci Retracement', url: 'https://www.investopedia.com/terms/f/fibonacciretracement.asp', description: 'Complete guide to Fibonacci retracement levels in trading.' },
      { label: 'TradingView — Fibonacci Tools', url: 'https://www.tradingview.com/support/solutions/43000350261/', description: 'TradingView guide to using Fibonacci drawing tools.' },
      { label: 'BabyPips — Fibonacci', url: 'https://www.babypips.com/learn/forex/fibonacci', description: "BabyPips' comprehensive Fibonacci trading guide." },
    ],
    relatedSlugs: ['fibonacci-retracement', 'smart-money-concepts', 'price-action-strategy', 'order-blocks'],
  },

  // ── Extra Strategies ─────────────────────────────────────────────────────

  'supply-demand-zones': {
    slug: 'supply-demand-zones',
    category: 'strategy',
    icon: '⚖️',
    title: 'Supply & Demand Zones',
    tagline: 'Trade institutional order imbalances where price reversal probability is highest.',
    metaTitle: 'Supply & Demand Zones Strategy — AutoTrader Learn',
    metaDescription: 'Learn Supply and Demand Zone trading: how to identify institutional order imbalances on the chart and execute high-probability reversal trades.',
    overview: `Supply and Demand Zone trading is one of the most robust forms of technical analysis because it is rooted in basic economics: price moves when there is an imbalance between buyers and sellers. A Demand Zone is a price area where buying orders overwhelmed selling orders so intensely that price left rapidly — these unfilled buy orders are theorized to remain in the market, creating a high-probability bounce area when price returns.

Supply Zones are the inverse: areas where massive selling pressure overwhelmed buyers, causing a sharp drop. The visual signature of a strong zone is a "basing" candle (or candles) followed by an explosive directional move. The stronger and faster the original move away from the zone, the more significant the unfilled orders, and the higher the probability of a reaction when price revisits.

The strategy's edge comes from its asymmetric risk/reward: entries are placed at the near edge of the zone with stops just beyond the far edge, targeting at least 2:1 or 3:1 reward. A zone is considered "used up" and weakened after multiple retests, as the original orders are progressively filled.

Supply and Demand analysis closely overlaps with Smart Money Concepts — both look for areas of institutional activity. The key difference is that S&D purists focus on the visual imbalance pattern, while SMC practitioners incorporate additional concepts like order blocks, liquidity, and market structure.`,
    howItWorks: `auto-Trading identifies Supply and Demand zones automatically by scanning for basing patterns followed by impulse moves exceeding a configurable threshold. Zones are ranked by freshness, strength, and distance from current price. Automated strategies execute limit orders at zone proximal levels with stop-losses defined by the distal edge.`,
    externalLinks: [
      { label: 'Investopedia — Supply and Demand', url: 'https://www.investopedia.com/terms/s/supply-demand.asp', description: 'Fundamental supply and demand economics applied to trading.' },
      { label: 'TradingView — S&D Zone Indicators', url: 'https://www.tradingview.com/scripts/supplyanddemand/', description: 'Supply and demand zone indicators on TradingView.' },
      { label: 'BabyPips — Support & Resistance', url: 'https://www.babypips.com/learn/forex/support-and-resistance', description: 'BabyPips guide to support and resistance (closely related concept).' },
    ],
    relatedSlugs: ['order-blocks', 'smart-money-concepts', 'liquidity-sweeps', 'price-action-strategy'],
  },

  'wyckoff-method': {
    slug: 'wyckoff-method',
    category: 'strategy',
    icon: '🏛️',
    title: 'Wyckoff Method',
    tagline: 'Decode institutional accumulation and distribution cycles using price-volume analysis.',
    metaTitle: 'Wyckoff Method — Institutional Accumulation & Distribution — AutoTrader Learn',
    metaDescription: 'Learn the Wyckoff Method: how to identify institutional accumulation, distribution, and re-accumulation phases to trade with the smart money.',
    overview: `Richard Wyckoff was a pioneer of technical analysis in the early 20th century. Working as a stockbroker and publisher in the 1910s-1930s, he had unparalleled insight into how large operators — institutions and market makers — accumulated and distributed large positions without moving markets adversely. He distilled these observations into a coherent framework still used by sophisticated traders today.

The Wyckoff Method identifies four phases of market behavior: Accumulation (large operators quietly buying while retail sells), Markup (the resulting uptrend), Distribution (large operators selling into retail demand near the top), and Markdown (the resulting downtrend). Each phase contains identifiable sub-events such as Preliminary Support, Selling Climax, Automatic Rally, Secondary Test, Spring, and Sign of Strength for accumulation schematics.

The "Spring" — a false breakdown below support that shakes out weak hands before the markup phase — is one of the most tradable Wyckoff events. It looks like a breakdown but is actually a final shakeout by institutions before a significant move higher. Confirmation comes from increased volume and a rapid recovery above the support level.

Wyckoff's three laws — Supply and Demand, Cause and Effect, and Effort vs. Result — provide a logical framework for understanding why markets move, not just how. The Cause and Effect law is particularly powerful: the larger the accumulation (cause), the greater the eventual markup (effect). This allows estimation of price targets using Point and Figure charts.`,
    howItWorks: `auto-Trading incorporates Wyckoff analysis by combining price structure recognition with volume analysis. The platform can identify potential Springs, Tests, and Signs of Strength automatically. Automated strategies can enter on confirmed Spring patterns with volume confirmation, with targets based on the projected Cause and Effect price objective.`,
    externalLinks: [
      { label: 'Investopedia — Wyckoff Method', url: 'https://www.investopedia.com/articles/active-trading/070715/making-money-wyckoff-way.asp', description: 'Investopedia explanation of the Wyckoff trading method.' },
      { label: 'StockCharts — Wyckoff', url: 'https://school.stockcharts.com/doku.php?id=market_analysis:the_wyckoff_method', description: "StockCharts' comprehensive Wyckoff Method school." },
      { label: 'TradingView — Wyckoff Scripts', url: 'https://www.tradingview.com/scripts/wyckoff/', description: 'Wyckoff analysis tools and scripts on TradingView.' },
    ],
    relatedSlugs: ['smart-money-concepts', 'volume-analysis', 'order-blocks', 'supply-demand-zones'],
  },

  'elliott-wave': {
    slug: 'elliott-wave',
    category: 'strategy',
    icon: '🌊',
    title: 'Elliott Wave Theory',
    tagline: 'Identify recurring wave patterns that reflect crowd psychology and market cycles.',
    metaTitle: 'Elliott Wave Theory — Market Cycle Trading — AutoTrader Learn',
    metaDescription: 'Learn Elliott Wave Theory: how to identify five-wave impulse and three-wave corrective patterns that reveal market cycles and high-probability trade setups.',
    overview: `Elliott Wave Theory was developed by Ralph Nelson Elliott in the 1930s, who noticed that financial markets move in repetitive patterns that reflect the collective psychology of market participants. The core principle is that price moves in a five-wave impulse pattern in the direction of the main trend (waves 1-2-3-4-5), followed by a three-wave corrective pattern against the trend (waves A-B-C).

Within this basic structure, waves 1, 3, and 5 are "motive" waves in the direction of the trend, while waves 2 and 4 are "corrective" waves. Wave 3 is typically the longest and strongest, and never the shortest of waves 1, 3, and 5 — this is a key rule used for wave counting. Wave 4 rarely overlaps with the price range of Wave 1, providing an objective invalidation level.

Elliott Wave is fractal: each wave is composed of smaller waves of the same pattern, and each is a component of a larger wave of the same pattern. This fractal nature means Elliott Wave analysis applies equally from monthly charts down to 1-minute charts. Fibonacci ratios govern the relationships between waves — Wave 3 commonly extends to 1.618× the length of Wave 1, and corrections commonly retrace 38.2%–61.8% of the prior impulse.

The most actionable trade in Elliott Wave is entering Wave 3 after Wave 2's correction completes at a Fibonacci support level with a target at Wave 1's peak and beyond. The entry is defined, the stop is logical (below the Wave 1 high), and the target is calculated — making it a complete, rule-based setup.`,
    howItWorks: `auto-Trading assists with Elliott Wave analysis by automatically labeling potential wave counts and highlighting Fibonacci confluence zones between wave relationships. Strategy automation can trigger on confirmed Wave 2 completions — where the correction reaches a key Fibonacci level and shows a reversal signal — for Wave 3 entry with a pre-calculated target.`,
    externalLinks: [
      { label: 'Investopedia — Elliott Wave', url: 'https://www.investopedia.com/terms/e/elliottwavetheory.asp', description: 'Investopedia comprehensive guide to Elliott Wave Theory.' },
      { label: 'TradingView — Elliott Wave', url: 'https://www.tradingview.com/scripts/elliottwaves/', description: 'Elliott Wave counting tools on TradingView.' },
      { label: 'EWI — Elliott Wave International', url: 'https://www.elliottwave.com/educational', description: 'Educational resources from Elliott Wave International.' },
    ],
    relatedSlugs: ['fibonacci-retracement', 'fibonacci-indicator', 'wyckoff-method', 'trend-following'],
  },

  // ─────────────────────── NEW STRATEGIES ────────────────────────────────

  'position-trading': {
    slug: 'position-trading',
    category: 'strategy',
    icon: '🏦',
    title: 'Position Trading Strategy',
    tagline: 'Hold for weeks or months and let fundamentals drive large gains.',
    metaTitle: 'Position Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn position trading: the long-term strategy used by professional fund managers to capture major market moves while minimising transaction costs.',
    overview: `Position trading is the longest-duration active trading style, with trades held from several weeks to multiple months or even years. Unlike day traders and swing traders who focus on short-term technical patterns, position traders combine fundamental analysis with high-timeframe technical analysis to identify major trend turning points and ride them for substantial gains.\n\nThe strategy suits traders who cannot monitor markets constantly. Positions are sized conservatively — typically 5–10% of portfolio per trade — and risk is managed by wide stop-losses placed at major technical levels such as the 200-day SMA, a multi-month swing low, or a key Fibonacci level.\n\nEntry timing uses weekly and monthly charts to identify trend resumption signals: golden cross formations, breakouts from multi-month bases, or Wyckoff accumulation completions. Fundamental catalysts — earnings growth, sector rotation, macro regime changes — provide the underlying reason for the trade; technicals provide the entry timing.\n\nPosition trading has one of the best risk-reward profiles of any trading style when executed correctly: entry costs are low (few trades), and winners can run for hundreds of percent, while losers are cut at defined technical levels. The main challenge is psychological — holding through normal pullbacks of 10–20% requires conviction in the original thesis.`,
    howItWorks: `auto-Trading's position trading module monitors weekly and monthly chart signals using long-period EMAs (50 and 200), ADX trend strength, and Donchian channel breakouts. Entry signals are filtered by fundamental momentum screens. Trailing stops are set at ATR multiples on the weekly chart to allow the position to breathe through normal fluctuations while protecting the bulk of accumulated gains.`,
    externalLinks: [
      { label: 'Investopedia — Position Trading', url: 'https://www.investopedia.com/terms/p/position-trader.asp', description: 'Overview of position trading and how it differs from other styles.' },
      { label: 'TradingView — Weekly Chart Strategies', url: 'https://www.tradingview.com/ideas/weeklytrading/', description: 'Long-term position trading ideas on TradingView.' },
      { label: 'BabyPips — Position Trading', url: 'https://www.babypips.com/learn/forex/position-trading', description: "BabyPips' guide to position trading in forex markets." },
    ],
    relatedSlugs: ['trend-following', 'swing-trading', 'donchian-channel', 'wyckoff-method'],
  },

  'pairs-trading': {
    slug: 'pairs-trading',
    category: 'strategy',
    icon: '🔄',
    title: 'Pairs Trading Strategy',
    tagline: 'Profit from diverging co-integrated assets regardless of market direction.',
    metaTitle: 'Pairs Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn pairs trading: a market-neutral strategy that profits when two co-integrated assets temporarily diverge from their historical price relationship.',
    overview: `Pairs trading is a market-neutral strategy that simultaneously buys one asset and short-sells a closely related asset when their price ratio or spread diverges significantly from its historical mean. Because the position is hedged (long one, short the other), it is largely insulated from broad market moves — the trade profits purely from the relative movement between the two assets.\n\nThe strategy requires identifying two assets with a strong co-integration relationship — meaning their prices tend to move together over time due to shared fundamentals. Classic pairs include: Coca-Cola vs Pepsi, Gold vs Silver, two ETFs tracking the same index, or a stock vs its sector ETF. Statistical tests (Augmented Dickey-Fuller, Johansen) verify co-integration before deploying capital.\n\nWhen the spread between the two assets exceeds a threshold (typically 2 standard deviations from the historical mean), the trader shorts the outperformer and buys the underperformer, betting on mean reversion of the spread. The position is closed when the spread reverts to the mean.\n\nRisk management focuses on the spread — not the individual assets. A stop-loss is placed at a further standard deviation expansion (e.g., 3 SD) to protect against co-integration breakdown, which occurs when the fundamental relationship between the two assets changes permanently.`,
    howItWorks: `auto-Trading's pairs trading module runs co-integration tests on user-specified asset pairs and monitors the rolling spread Z-score continuously. When the Z-score exceeds the configured entry threshold, the system simultaneously places long and short orders with position sizes matched by beta or dollar value. The exit trigger and stop-loss are set at configurable Z-score levels.`,
    externalLinks: [
      { label: 'Investopedia — Pairs Trading', url: 'https://www.investopedia.com/terms/p/pairstrade.asp', description: 'Comprehensive guide to pairs trading and statistical arbitrage.' },
      { label: 'QuantConnect — Pairs Trading Tutorial', url: 'https://www.quantconnect.com/tutorials/introduction-to-financial-python/pairs-trading', description: 'Quantitative pairs trading tutorial with Python code.' },
      { label: 'TradingView — Spread Charts', url: 'https://www.tradingview.com/support/solutions/43000502079/', description: 'How to chart spreads between two assets on TradingView.' },
    ],
    relatedSlugs: ['arbitrage-strategy', 'mean-reversion', 'bollinger-bands', 'linear-regression'],
  },

  'momentum-trading': {
    slug: 'momentum-trading',
    category: 'strategy',
    icon: '⚡',
    title: 'Momentum Trading Strategy',
    tagline: 'Buy the strongest assets, sell the weakest — let relative strength guide you.',
    metaTitle: 'Momentum Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn momentum trading: how to identify and trade the strongest-performing assets using relative strength, rate of change, and momentum signals.',
    overview: `Momentum trading is based on the empirical observation that assets which have performed well recently tend to continue outperforming in the near term, and vice versa. This "momentum effect" is one of the most consistently documented anomalies in financial markets, identified across equities, currencies, commodities, and crypto.\n\nThe strategy comes in two forms. Cross-sectional momentum ranks a universe of assets by recent return (e.g., 12-month return minus the most recent month) and buys the top decile while selling or avoiding the bottom decile. Time-series (absolute) momentum, popularised by AQR Capital, simply buys an asset if its recent return is positive and sells or holds cash if it is negative.\n\nKey momentum indicators include: Rate of Change (ROC), which measures percentage price change over N periods; Relative Strength (not RSI, but comparing asset return to a benchmark); and moving average momentum (price above a long-period moving average = positive momentum). MACD and the Awesome Oscillator also serve as momentum indicators.\n\nMomentum strategies are subject to "momentum crashes" — sharp, fast reversals that occur when market regimes change suddenly. Proper risk management uses volatility targeting to reduce position size when volatility spikes, and mean-reversion filters to avoid entering at extreme overextension.`,
    howItWorks: `auto-Trading's momentum module calculates 1-month, 3-month, 6-month, and 12-month returns for all instruments in your portfolio universe and ranks them dynamically. The bot rebalances the portfolio at a configured frequency, buying the top-ranked assets and reducing or exiting the bottom-ranked ones. Volatility-adjusted position sizing ensures each asset contributes equal risk.`,
    externalLinks: [
      { label: 'Investopedia — Momentum Investing', url: 'https://www.investopedia.com/trading/introduction-to-momentum-trading/', description: 'Introduction to momentum investing and trading strategies.' },
      { label: 'AQR — Momentum Everywhere', url: 'https://www.aqr.com/Insights/Research/Journal-Article/Momentum-Everywhere', description: 'Landmark academic paper on cross-asset momentum by AQR Capital.' },
      { label: 'TradingView — Momentum Indicators', url: 'https://www.tradingview.com/scripts/momentum/', description: 'Momentum indicator scripts on TradingView.' },
    ],
    relatedSlugs: ['trend-following', 'rate-of-change', 'macd-indicator', 'breakout-strategy'],
  },

  'range-trading': {
    slug: 'range-trading',
    category: 'strategy',
    icon: '↔️',
    title: 'Range Trading Strategy',
    tagline: 'Profit from oscillating prices between well-defined support and resistance.',
    metaTitle: 'Range Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn range trading: how to identify consolidation ranges and profitably trade price bounces between support and resistance in sideways markets.',
    overview: `Range trading is a strategy that profits when an asset's price oscillates back and forth within a well-defined horizontal channel. It is most effective when the broader market is in a consolidation phase — after a significant move, when price digests by trading sideways between a support floor and a resistance ceiling.\n\nIdentifying a valid range requires the price to have touched support and resistance at least twice each, with the touches being relatively equal (not a series of declining highs or rising lows, which would indicate a trend). The range should be wide enough relative to transaction costs to allow profitable trades — typically at least 2–3% between support and resistance in crypto and 0.5–1% in liquid forex pairs.\n\nThe standard entry is to buy near support and sell near resistance. Confirmation techniques include: waiting for a bounce candle (a rejection wick or engulfing pattern at the level), requiring RSI to be oversold at support (below 40) and overbought at resistance (above 60), or using Stochastic crossovers at the extremes.\n\nRange trades are exited when price closes convincingly beyond one of the range boundaries — a signal that a breakout (or breakdown) is underway and the range has been invalidated. Alternatively, a fixed take-profit near the opposite boundary locks in the gain before risk increases.`,
    howItWorks: `auto-Trading detects ranges by scanning for instruments where price has oscillated within a defined band for a configurable number of bars, with ADX below 20 (confirming low trend strength). The bot places limit buy orders near support and limit sell orders near resistance, with stop-losses just outside the range boundaries. Range invalidation automatically cancels pending orders.`,
    externalLinks: [
      { label: 'Investopedia — Range-Bound Trading', url: 'https://www.investopedia.com/terms/r/rangeboundtrading.asp', description: 'Introduction to range-bound trading techniques and strategies.' },
      { label: 'TradingView — Range Indicators', url: 'https://www.tradingview.com/scripts/range/', description: 'Range detection and trading scripts on TradingView.' },
      { label: 'BabyPips — Trading Ranges', url: 'https://www.babypips.com/learn/forex/trading-ranges', description: "BabyPips' guide to identifying and trading sideways markets." },
    ],
    relatedSlugs: ['mean-reversion', 'bollinger-bands', 'rsi-indicator', 'stochastic-oscillator'],
  },

  'news-trading': {
    slug: 'news-trading',
    category: 'strategy',
    icon: '📰',
    title: 'News Trading Strategy',
    tagline: 'Capitalise on price volatility triggered by scheduled and surprise news events.',
    metaTitle: 'News Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn news trading: how to trade economic data releases, earnings announcements, and central bank decisions for fast, volatility-driven profits.',
    overview: `News trading exploits the sharp price movements that follow significant economic, corporate, or geopolitical events. Markets price in expectations before announcements, and when the actual data deviates from consensus forecasts, the repricing can be rapid and violent — creating opportunities for traders who act quickly.\n\nThe two main approaches are "trade the release" (entering immediately after the announcement) and "trade the reaction" (waiting for the initial knee-jerk move to exhaust before entering in a more considered direction). The latter is often more reliable, as initial reactions are frequently reversed within minutes as algorithms re-price and human traders panic-cover.\n\nKey event types include: central bank rate decisions and forward guidance (Fed, ECB, BoE, BoJ), major economic releases (Non-Farm Payrolls, CPI, GDP, PMI), corporate earnings announcements, and geopolitical shocks. Economic calendars rank releases by expected market impact — "high impact" events (3-star releases on Forex Factory or equivalent) are the primary targets.\n\nRisk management is critical: position sizes should be reduced before major news to avoid being caught on the wrong side of a binary outcome. Slippage can be severe during the first few seconds after a release, so limit orders are generally preferable to market orders in the immediate post-release window.`,
    howItWorks: `auto-Trading integrates a live economic calendar that automatically flags upcoming high-impact events. Users configure pre-event position reduction rules (e.g., reduce size by 50% 30 minutes before NFP), post-event breakout entry rules (enter if price moves more than X pips/ATR within the first 60 seconds), and volatility filters to avoid entering in the initial chaotic spike.`,
    externalLinks: [
      { label: 'Investing.com Economic Calendar', url: 'https://www.investing.com/economic-calendar/', description: 'Live economic calendar with impact ratings for all major releases.' },
      { label: 'Forex Factory Calendar', url: 'https://www.forexfactory.com/calendar', description: 'The most widely used forex economic calendar by traders worldwide.' },
      { label: 'BabyPips — Trading the News', url: 'https://www.babypips.com/learn/forex/trading-the-news', description: "BabyPips' comprehensive guide to news trading strategies." },
    ],
    relatedSlugs: ['breakout-strategy', 'volatility-trading', 'atr-indicator', 'scalping-strategy'],
  },

  'harmonic-patterns': {
    slug: 'harmonic-patterns',
    category: 'strategy',
    icon: '🎯',
    title: 'Harmonic Pattern Strategy',
    tagline: 'Trade precise geometric price patterns defined by Fibonacci ratios.',
    metaTitle: 'Harmonic Pattern Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn harmonic pattern trading: how Gartley, Bat, Butterfly, and Crab patterns use Fibonacci ratios to identify high-probability reversal zones.',
    overview: `Harmonic patterns are geometric price structures that incorporate Fibonacci ratios to identify potential reversal zones with exceptional precision. Developed by H.M. Gartley in 1935 and later extended by Scott Carney, these patterns require every leg of the structure to conform to specific Fibonacci relationships — making them one of the most objective pattern-based trading approaches.\n\nThe four most traded harmonic patterns are: the Gartley (38.2% XA retracement at B, 61.8–78.6% at D — the "Potential Reversal Zone"); the Bat (50% retracement at B, 88.6% at D — a deep, precise pattern); the Butterfly (78.6% at B, 127.2–161.8% extension at D — trades beyond the original X point); and the Crab (61.8% at B, 161.8% at D — the most extreme pattern, offering the widest reversal zones).\n\nAll patterns follow the same XABCD structure. Point X is the origin; A is the first significant move; B retraces A; C retraces B; D is the completion point (the Potential Reversal Zone) where the trade is entered. The critical measurement is the XA leg: all other legs are defined as Fibonacci ratios of XA.\n\nThe PRZ (Potential Reversal Zone) at point D is the entry area. Traders look for reversal confirmation candles (pin bars, engulfing patterns) within the PRZ before entering. Stop-losses are placed beyond the outer boundary of the PRZ. Targets are the BC leg midpoint and the A level.`,
    howItWorks: `auto-Trading's harmonic pattern scanner automatically detects XABCD structures across all timeframes and instruments, comparing each leg's Fibonacci ratio against the tolerances for Gartley, Bat, Butterfly, and Crab patterns. When a valid PRZ is identified, the system alerts you and can automatically place a limit entry order within the PRZ with pre-calculated stop and target levels.`,
    externalLinks: [
      { label: 'Investopedia — Harmonic Patterns', url: 'https://www.investopedia.com/terms/h/harmonics.asp', description: 'Overview of harmonic price patterns and their trading application.' },
      { label: 'TradingView — Harmonic Patterns', url: 'https://www.tradingview.com/scripts/harmonicpatterns/', description: 'Harmonic pattern scanner scripts on TradingView.' },
      { label: 'BabyPips — Harmonic Trading', url: 'https://www.babypips.com/learn/forex/gartley-pattern', description: "BabyPips' guide to the Gartley pattern and harmonic trading." },
    ],
    relatedSlugs: ['fibonacci-retracement', 'fibonacci-indicator', 'price-action-strategy', 'smart-money-concepts'],
  },

  'chart-patterns': {
    slug: 'chart-patterns',
    category: 'strategy',
    icon: '📐',
    title: 'Chart Pattern Trading Strategy',
    tagline: 'Trade classical formations — triangles, flags, and head & shoulders — with precision.',
    metaTitle: 'Chart Pattern Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn chart pattern trading: how to identify and trade classical formations including head and shoulders, triangles, flags, and wedges for high-probability breakouts.',
    overview: `Chart patterns are recurring formations in price action that have been documented and studied since the early 20th century. They represent predictable behavioural cycles of market participants — accumulation, indecision, and resolution — and provide structured, objective trade setups with clear entry, stop, and target levels.\n\nContinuation patterns suggest the existing trend will resume after a brief consolidation. Key types: Bull and Bear Flags (tight, parallel consolidation against the trend), Pennants (converging consolidation), Ascending and Descending Triangles (breakout in the direction of the flat side), and Rectangles (horizontal consolidation).\n\nReversal patterns signal a potential trend change. The most reliable: Head and Shoulders (three-peak structure with the middle peak highest, signalling bearish reversal), Inverse Head and Shoulders (bullish reversal), Double Top and Bottom (two failed attempts at an extreme), and Rounding Bottom (long-term bullish accumulation arc).\n\nThe "measured move" technique provides price targets: for most patterns, the target distance equals the height of the pattern projected from the breakout point. Volume is critical — genuine breakouts are accompanied by a significant surge in volume, confirming that new participants are entering in the breakout direction.`,
    howItWorks: `auto-Trading scans for classical chart patterns using structural recognition algorithms that identify converging trendlines, support/resistance retests, and neckline formations. When a high-probability pattern is detected, the system places a breakout order above (or below) the pattern's boundary with volume confirmation. The measured-move target and ATR-based stop are calculated automatically.`,
    externalLinks: [
      { label: 'Investopedia — Chart Patterns', url: 'https://www.investopedia.com/articles/technical/112601.asp', description: 'Comprehensive guide to all major classical chart patterns.' },
      { label: 'TradingView — Pattern Recognition', url: 'https://www.tradingview.com/scripts/chartpattern/', description: 'Chart pattern detection scripts and tools on TradingView.' },
      { label: 'StockCharts — Chart School', url: 'https://school.stockcharts.com/doku.php?id=chart_analysis:chart_patterns', description: "StockCharts' classic Chart School on technical patterns." },
    ],
    relatedSlugs: ['breakout-strategy', 'price-action-strategy', 'volume-analysis', 'trend-following'],
  },

  'carry-trade': {
    slug: 'carry-trade',
    category: 'strategy',
    icon: '💱',
    title: 'Carry Trade Strategy',
    tagline: 'Earn interest rate differentials while holding currency positions overnight.',
    metaTitle: 'Carry Trade Strategy — Forex & Crypto — AutoTrader Learn',
    metaDescription: 'Learn the carry trade: how to profit from interest rate differentials by holding high-yielding currencies against low-yielding ones, and its crypto equivalent.',
    overview: `The carry trade is one of the most consistently profitable strategies in foreign exchange markets over long periods. The basic concept: borrow in a low interest-rate currency (the "funding currency"), convert to a high interest-rate currency (the "target currency"), and collect the interest rate differential (the "carry") as daily profit.\n\nClassic carry trades involve borrowing Japanese Yen (historically near 0% rates) or Swiss Francs to fund positions in Australian Dollars, New Zealand Dollars, or emerging market currencies with significantly higher rates. The profit accumulates each day the position is held, making it especially appealing in stable, low-volatility market environments.\n\nThe strategy's primary risk is the "carry trade unwind" — a sudden rush to close all carry positions simultaneously during risk-off episodes. When volatility spikes (a global crisis, a central bank surprise), carry traders rush to exit, causing the funding currency to appreciate sharply against the target currency. These unwinds can wipe out months of accumulated carry income in a single day.\n\nIn crypto, the carry trade equivalent is the funding rate arbitrage on perpetual futures: when the perpetual trades at a premium to spot (positive funding rate), short the perpetual and hold spot to collect the funding rate as income. Rates can be extremely high during bull markets, making this one of the most lucrative low-risk crypto strategies.`,
    howItWorks: `auto-Trading monitors funding rate data across all connected exchanges for perpetual futures carry opportunities. When the annualised funding rate exceeds a user-defined threshold, the system simultaneously opens a short perpetual position and a long spot position of equal notional value, delta-neutralising the trade. The strategy automatically closes when funding rates normalise below the exit threshold.`,
    externalLinks: [
      { label: 'Investopedia — Carry Trade', url: 'https://www.investopedia.com/terms/c/currencycarrytrade.asp', description: 'Full explanation of the currency carry trade mechanics and risks.' },
      { label: 'BabyPips — Carry Trading', url: 'https://www.babypips.com/learn/forex/carry-trading', description: "BabyPips' detailed guide to forex carry trading." },
      { label: 'CoinGlass — Funding Rates', url: 'https://www.coinglass.com/FundingRate', description: 'Live funding rates across all major crypto perpetual exchanges.' },
    ],
    relatedSlugs: ['arbitrage-strategy', 'mean-reversion', 'vwap-indicator', 'position-trading'],
  },

  'gap-trading': {
    slug: 'gap-trading',
    category: 'strategy',
    icon: '🕳️',
    title: 'Gap Trading Strategy',
    tagline: 'Trade the market opening gaps that signal overnight conviction or overreaction.',
    metaTitle: 'Gap Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn gap trading: how to identify and trade opening price gaps in stocks and crypto, distinguishing gap fills from continuation gaps.',
    overview: `A price gap occurs when an asset opens significantly higher or lower than the previous close, leaving an empty zone on the chart where no trading took place. Gaps are among the most emotionally charged price events, representing overnight conviction (sentiment shifts, news, earnings) that materialises the moment markets reopen.\n\nThere are four types of gaps: Common gaps (routine, fill quickly, no trading significance), Breakaway gaps (occur at the start of a new trend, high volume, rarely fill), Runaway/Continuation gaps (occur mid-trend, confirm momentum), and Exhaustion gaps (occur at trend extremes on declining volume, quickly fill).\n\nGap fill strategies exploit the tendency of gaps to be "filled" — meaning price returns to the pre-gap level. Studies show that approximately 70% of gaps eventually fill, making fade strategies statistically sound. The trade: if price gaps up at open, short near the gap high and target the previous close. If it gaps down, buy near the gap low and target the fill.\n\nGap continuation strategies (particularly for breakaway and runaway gaps) take the opposite approach: buy the gap-up open after a valid breakout, holding for a continuation move. These gaps often mark the beginning or middle of strong trending moves and should not be faded.`,
    howItWorks: `auto-Trading detects opening gaps by comparing the current candle open to the previous candle close. The system classifies gaps using volume and trend context: low-volume gaps in ranging markets trigger gap-fill limit orders; high-volume breakaway gaps trigger momentum continuation signals. Users configure minimum gap size (as percentage or ATR multiple) to filter noise.`,
    externalLinks: [
      { label: 'Investopedia — Gaps', url: 'https://www.investopedia.com/terms/g/gap.asp', description: 'Complete overview of price gaps and their trading significance.' },
      { label: 'TradingView — Gap Scripts', url: 'https://www.tradingview.com/scripts/gap/', description: 'Gap detection and trading scripts on TradingView.' },
      { label: 'StockCharts — Gap Analysis', url: 'https://school.stockcharts.com/doku.php?id=chart_analysis:gaps_and_gap_analysis', description: "StockCharts' detailed guide to gap analysis." },
    ],
    relatedSlugs: ['breakout-strategy', 'volume-analysis', 'news-trading', 'price-action-strategy'],
  },

  'triple-screen-strategy': {
    slug: 'triple-screen-strategy',
    category: 'strategy',
    icon: '🖥️',
    title: 'Triple Screen Trading System',
    tagline: 'Alexander Elder\'s three-timeframe system that filters trades with military precision.',
    metaTitle: 'Triple Screen Trading System — Alexander Elder — AutoTrader Learn',
    metaDescription: 'Learn the Triple Screen Trading System: Dr. Alexander Elder\'s three-timeframe approach that combines trend following with oscillator timing for high-probability entries.',
    overview: `The Triple Screen Trading System was developed by Dr. Alexander Elder and first published in Futures magazine in 1986. It addresses one of trading's fundamental paradoxes: trend-following indicators and oscillators often give conflicting signals. The solution is to use different indicator types on multiple timeframes, each serving a distinct purpose.\n\nScreen 1 (Weekly / Long Timeframe): Apply a trend-following indicator such as the MACD histogram or a 13-week EMA slope to a timeframe five times longer than your intended trading timeframe. This screen defines the tide — the major direction you must trade with. If the weekly MACD histogram is rising, only look for buy signals. If falling, only look for shorts.\n\nScreen 2 (Daily / Intermediate Timeframe): Apply an oscillator (Stochastic, Force Index, Williams %R) to the trading timeframe. The oscillator hunts for pullbacks against the weekly trend: buy when the daily oscillator dips to oversold in a weekly uptrend; sell when it rises to overbought in a weekly downtrend.\n\nScreen 3 (Intraday Entry): A trailing buy-stop is placed one tick above the high of the previous bar (for longs) after Screens 1 and 2 are aligned. The stop trails, so if the trade doesn't immediately move in your favour, the order is never triggered. This makes Screen 3 unique — it is a "hard" entry that only fills when price confirms the anticipated move is beginning.`,
    howItWorks: `auto-Trading implements Triple Screen by running two simultaneous indicator calculations — a trend indicator on the weekly timeframe and an oscillator on the daily — and only generating entry signals when both align. Trailing buy/sell stop orders are automatically managed for Screen 3 entries, updating with each new bar until filled or invalidated by a counter-signal.`,
    externalLinks: [
      { label: 'Investopedia — Triple Screen', url: 'https://www.investopedia.com/articles/trading/08/three-screen-trading-system.asp', description: "Full explanation of Elder's Triple Screen Trading System." },
      { label: 'TradingView — Triple Screen Scripts', url: 'https://www.tradingview.com/scripts/triplescreen/', description: 'Triple Screen implementations on TradingView.' },
      { label: 'Elder.com — Trading', url: 'https://www.elder.com', description: "Dr. Alexander Elder's official site with educational resources." },
    ],
    relatedSlugs: ['macd-indicator', 'stochastic-oscillator', 'trend-following', 'swing-trading'],
  },

  // ─────────────────────── NEW INDICATORS ────────────────────────────────

  'chaikin-money-flow': {
    slug: 'chaikin-money-flow',
    category: 'signal',
    icon: '💧',
    title: 'Chaikin Money Flow (CMF)',
    tagline: 'Measure institutional buying and selling pressure using price and volume.',
    metaTitle: 'Chaikin Money Flow (CMF) Indicator — AutoTrader Learn',
    metaDescription: 'Learn the Chaikin Money Flow indicator: how it combines price and volume to measure accumulation and distribution pressure over a rolling period.',
    overview: `The Chaikin Money Flow (CMF) indicator, developed by Marc Chaikin, measures the amount of money flow volume over a specific period (typically 20 or 21 periods). It combines price location within the daily range with volume to determine whether a security is under accumulation (buying pressure) or distribution (selling pressure).\n\nThe calculation involves two steps. First, the Money Flow Multiplier = ((Close − Low) − (High − Close)) ÷ (High − Low). This places the close relative to the daily range on a scale from −1 (close at the low) to +1 (close at the high). Second, the Money Flow Volume = Multiplier × Volume. CMF = Sum of Money Flow Volumes over N periods ÷ Sum of Volumes over N periods.\n\nThe result oscillates between −1 and +1. Values above 0 indicate net buying pressure (accumulation); below 0 indicate net selling pressure (distribution). Sustained CMF above +0.25 signals strong institutional buying; below −0.25 signals strong distribution. The zero-line crossover is the primary signal.\n\nDivergence is a powerful application: if price makes new highs but CMF fails to confirm (remains in negative territory or declines), it signals that the rally is not backed by real buying pressure — a bearish warning. The reverse applies for bullish divergence.`,
    howItWorks: `auto-Trading computes CMF using configurable periods (default 20). Strategy blocks include: CMF zero-line crossovers, threshold breach alerts (+0.25/−0.25), and divergence detection against price. CMF is particularly effective as a confirmation filter — entries are only taken when CMF is positive (for longs) or negative (for shorts), ensuring institutional money flow aligns with the trade direction.`,
    externalLinks: [
      { label: 'Investopedia — Chaikin Money Flow', url: 'https://www.investopedia.com/terms/c/chaikinoscillator.asp', description: 'Guide to CMF calculation and its application in trend confirmation.' },
      { label: 'TradingView — CMF Scripts', url: 'https://www.tradingview.com/scripts/chaikinmoneyflow/', description: 'Chaikin Money Flow indicators and strategies on TradingView.' },
      { label: 'StockCharts — CMF', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:chaikin_money_flow_cmf', description: "StockCharts' detailed CMF tutorial with visual examples." },
    ],
    relatedSlugs: ['obv-indicator', 'mfi-indicator', 'volume-analysis', 'vwap-indicator'],
  },

  'awesome-oscillator': {
    slug: 'awesome-oscillator',
    category: 'signal',
    icon: '⚡',
    title: 'Awesome Oscillator',
    tagline: 'Bill Williams\' momentum indicator that detects market driving force.',
    metaTitle: 'Awesome Oscillator — Bill Williams Momentum Indicator — AutoTrader Learn',
    metaDescription: 'Learn the Awesome Oscillator: Bill Williams\' momentum indicator that measures market driving force and generates saucer, zero-line cross, and twin peaks signals.',
    overview: `The Awesome Oscillator (AO), developed by Bill Williams, measures the difference between a 5-period and 34-period simple moving average of the bar's midpoint ((High + Low) ÷ 2). This produces a histogram that oscillates above and below zero, visualising the momentum of the market driving force.\n\nAO belongs to Bill Williams' trading system described in his books "Trading Chaos" and "New Trading Dimensions," which includes the Alligator indicator, Fractals, and the Accelerator Oscillator. Together these indicators form a complete trading system that Williams used to identify the beginning and end of trends.\n\nThe three primary AO signals are: (1) The Saucer — the histogram is above zero and forms a two-bar dip (two bars lower than the previous, then back up), signalling a continuation buy; (2) Zero-line Crossover — the histogram crosses from negative to positive (buy) or positive to negative (sell), confirming a trend change; and (3) Twin Peaks — two successive negative histogram peaks (for a bullish signal) where the second peak is higher than the first, indicating diminishing bearish momentum.\n\nAO works best in trending markets for identifying pullback entries and momentum confirmation. In ranging markets, zero-line crossovers generate excessive false signals. Combining AO with the Alligator (for trend direction) and Fractals (for entry timing) creates the complete Williams trading system.`,
    howItWorks: `auto-Trading computes the Awesome Oscillator and supports all three signal types: Saucer alerts (configurable sensitivity), zero-line crossover triggers, and Twin Peaks detection. AO can be used standalone or combined with the Alligator indicator and Fractal blocks in the strategy builder to implement the complete Bill Williams trading system.`,
    externalLinks: [
      { label: 'Investopedia — Awesome Oscillator', url: 'https://www.investopedia.com/terms/a/awesome-oscillator.asp', description: 'Bill Williams Awesome Oscillator explained with signal examples.' },
      { label: 'TradingView — Awesome Oscillator', url: 'https://www.tradingview.com/scripts/awesomeoscillator/', description: 'AO scripts and Bill Williams system implementations.' },
      { label: 'BabyPips — Awesome Oscillator', url: 'https://www.babypips.com/learn/forex/awesome-oscillator', description: "BabyPips' guide to the Awesome Oscillator and its signals." },
    ],
    relatedSlugs: ['alligator-indicator', 'macd-indicator', 'momentum-trading', 'rate-of-change'],
  },

  'alligator-indicator': {
    slug: 'alligator-indicator',
    category: 'signal',
    icon: '🐊',
    title: 'Williams Alligator Indicator',
    tagline: 'Three smoothed moving averages that identify when the market is trending or sleeping.',
    metaTitle: 'Williams Alligator Indicator — Trend Detection — AutoTrader Learn',
    metaDescription: 'Learn the Williams Alligator: how three offset smoothed moving averages identify trending (eating) and non-trending (sleeping) market conditions.',
    overview: `The Alligator indicator, developed by Bill Williams, consists of three Smoothed Moving Averages (SMAs) with distinct periods and forward offsets, each named after parts of an alligator: the Jaw (13-period SMMA, shifted 8 bars forward), the Teeth (8-period SMMA, shifted 5 bars forward), and the Lips (5-period SMMA, shifted 3 bars forward).\n\nThe metaphor is apt: when all three lines are intertwined and flat, the alligator is "sleeping" — the market is ranging and not suitable for trend-following strategies. When the lines diverge and begin to separate, the alligator is "awakening" — a trend is beginning. When the lines are widely spread and moving together, the alligator is "eating" — the trend is in full swing and momentum is strongest.\n\nTrading rules: enter long when the Lips cross above the Teeth, which crosses above the Jaw (all three lines fanning upward). Enter short when the Lips cross below the Teeth, which crosses below the Jaw. Exit when the lines begin to converge again (the alligator is "sated"). The beauty of the indicator is that it simultaneously identifies both trend direction and trend strength.\n\nThe offset feature is key: the forward shift means each line represents what would have been the average of those bars projected forward in time — making the Alligator a unique leading/confirming indicator hybrid rather than a purely lagging one.`,
    howItWorks: `auto-Trading computes all three Alligator lines with their correct SMMA periods and forward offsets. The strategy builder supports crossover triggers between Lips/Teeth/Jaw for entries, convergence detection for exits, and sleeping/eating market state classification. The Alligator integrates natively with the Awesome Oscillator and Fractal blocks for a complete Bill Williams system.`,
    externalLinks: [
      { label: 'Investopedia — Alligator Indicator', url: 'https://www.investopedia.com/terms/a/alligator-indicator.asp', description: 'Complete guide to the Williams Alligator and its trading signals.' },
      { label: 'TradingView — Alligator Scripts', url: 'https://www.tradingview.com/scripts/alligator/', description: 'Alligator indicator implementations on TradingView.' },
      { label: 'BabyPips — Williams Alligator', url: 'https://www.babypips.com/learn/forex/williams-alligator', description: "BabyPips' explanation of the Alligator indicator." },
    ],
    relatedSlugs: ['awesome-oscillator', 'ema-indicator', 'trend-following', 'adx-indicator'],
  },

  'hull-moving-average': {
    slug: 'hull-moving-average',
    category: 'signal',
    icon: '🌊',
    title: 'Hull Moving Average (HMA)',
    tagline: 'A fast, smooth moving average that nearly eliminates lag.',
    metaTitle: 'Hull Moving Average (HMA) — Ultra-Smooth Trend Indicator — AutoTrader Learn',
    metaDescription: 'Learn the Hull Moving Average: Alan Hull\'s innovative formula that dramatically reduces lag while maintaining smoothness, making it ideal for precise trend entry signals.',
    overview: `The Hull Moving Average (HMA), created by Alan Hull in 2005, is designed to address the fundamental flaw of all traditional moving averages: lag. Standard SMAs and EMAs are inherently backward-looking, causing entries and exits to occur well after trends have already begun. The HMA dramatically reduces this lag while maintaining a smooth output line.\n\nThe formula is: HMA(n) = WMA(2 × WMA(n/2) − WMA(n), sqrt(n)), where WMA is a Weighted Moving Average. By computing the WMA of half the period, doubling it, subtracting the full-period WMA, and then taking the WMA of the square root of the period on the result, Hull created an average that can actually anticipate trends rather than just follow them.\n\nThe key difference is visual: while an SMA or EMA turns after the price has already moved, the HMA begins turning at or sometimes before the price reversal. This makes the HMA more suitable for entries and exits than traditional MAs, particularly for swing and intraday traders who prioritise speed.\n\nThe HMA also stays smooth even with shorter periods — a 9-period HMA tracks price closely without the noise of a 9-period SMA or EMA. This makes it excellent for identifying momentum shifts at pivotal price levels. Color-coded HMAs (green when rising, red when falling) provide instant visual trend context.`,
    howItWorks: `auto-Trading implements the Hull Moving Average for any period and price source. Strategy triggers include: HMA direction changes (rising to falling or vice versa), price crossing the HMA, and HMA crossovers with other moving averages. The HMA is particularly effective as a dynamic stop-loss reference — stops placed at the current HMA value trail the trend cleanly.`,
    externalLinks: [
      { label: 'Investopedia — Hull Moving Average', url: 'https://www.investopedia.com/articles/technical/02/091702.asp', description: 'Overview of moving average types including the HMA.' },
      { label: 'TradingView — HMA Scripts', url: 'https://www.tradingview.com/scripts/hullma/', description: 'Hull Moving Average scripts and strategies on TradingView.' },
      { label: 'Alan Hull\'s Site', url: 'https://alanhull.com/hull-moving-average', description: 'The original HMA documentation from its creator Alan Hull.' },
    ],
    relatedSlugs: ['ema-indicator', 'sma-indicator', 'trend-following', 'moving-average-crossover'],
  },

  'rate-of-change': {
    slug: 'rate-of-change',
    category: 'signal',
    icon: '📈',
    title: 'Rate of Change (ROC)',
    tagline: 'Measure price momentum as a percentage change over a defined lookback period.',
    metaTitle: 'Rate of Change (ROC) — Price Momentum Indicator — AutoTrader Learn',
    metaDescription: 'Learn the Rate of Change indicator: how ROC measures the speed of price movement and generates overbought/oversold and divergence signals for momentum traders.',
    overview: `The Rate of Change (ROC) indicator measures the percentage change in price between the current period and a specified number of periods ago. It is one of the purest expressions of price momentum — directly answering the question: "How much has this asset moved in the last N periods?"\n\nFormula: ROC = ((Current Close − Close N Periods Ago) ÷ Close N Periods Ago) × 100\n\nROC oscillates around zero. A positive ROC indicates prices are higher than N periods ago (upward momentum); a negative ROC indicates prices are lower (downward momentum). The magnitude indicates the speed of the move: a ROC of +20% means price is 20% higher than it was N periods ago, indicating strong momentum.\n\nCommon applications include: overbought/oversold signals (ROC reaching extreme positive values often precedes a pullback), divergence analysis (price making new highs while ROC makes lower highs signals weakening momentum), and zero-line crossovers as trend change signals.\n\nROC is mathematically equivalent to Momentum (price difference rather than percentage difference), and is closely related to the 12-period minus 26-period EMA difference that underlies MACD. For cross-asset momentum strategies, ROC is the preferred metric for ranking assets by their relative return over a standard lookback period.`,
    howItWorks: `auto-Trading computes ROC for any period and price source. In the strategy builder, ROC can be used for: cross-asset momentum ranking (selecting the highest ROC assets for long positions), overbought/oversold threshold alerts, zero-line crossovers, and divergence detection. The multi-asset momentum scanner uses ROC to rank instruments and rebalance the portfolio toward the strongest-performing assets.`,
    externalLinks: [
      { label: 'Investopedia — Rate of Change', url: 'https://www.investopedia.com/terms/r/rateofchange.asp', description: 'Full explanation of ROC calculation and momentum trading applications.' },
      { label: 'TradingView — ROC Scripts', url: 'https://www.tradingview.com/scripts/rateofchange/', description: 'ROC-based momentum strategies on TradingView.' },
      { label: 'BabyPips — Momentum Indicators', url: 'https://www.babypips.com/learn/forex/momentum-indicators', description: "BabyPips' guide to momentum indicators including ROC." },
    ],
    relatedSlugs: ['macd-indicator', 'momentum-trading', 'rsi-indicator', 'trix-indicator'],
  },

  'aroon-indicator': {
    slug: 'aroon-indicator',
    category: 'signal',
    icon: '🌅',
    title: 'Aroon Indicator',
    tagline: 'Identify new trend emergence and trend strength with precision timing.',
    metaTitle: 'Aroon Indicator — Trend Detection & Strength — AutoTrader Learn',
    metaDescription: 'Learn the Aroon indicator: how Aroon Up and Aroon Down identify the timing of new highs and lows to detect trend emergence and measure trend strength.',
    overview: `The Aroon indicator, developed by Tushar Chande in 1995, measures how recently a new high or low has been recorded within a lookback period. "Aroon" is a Sanskrit word meaning "dawn's early light" — appropriate for an indicator designed to detect the earliest signs of a new trend.\n\nThe indicator has two lines: Aroon Up = ((N − Bars Since N-Period High) ÷ N) × 100 and Aroon Down = ((N − Bars Since N-Period Low) ÷ N) × 100. Both range from 0 to 100. The default period is 25.\n\nHigh Aroon Up (above 70) indicates that price recently made a high near the top of the lookback period — bullish strength. High Aroon Down (above 70) indicates a recent low — bearish strength. When Aroon Up is above 70 and Aroon Down is below 30 simultaneously, a strong uptrend is likely in place.\n\nThe Aroon Oscillator (Aroon Up − Aroon Down) simplifies interpretation: positive values indicate bullishness, negative values bearishness. Crossovers of the two Aroon lines provide trend change signals — when Aroon Up crosses above Aroon Down, a bullish trend may be emerging; the reverse for a bearish trend.\n\nAroon is particularly useful for identifying the very early stages of a trend — before most momentum indicators confirm. This makes it valuable for position traders and trend followers looking to enter at the earliest possible point with controlled risk.`,
    howItWorks: `auto-Trading computes Aroon Up, Aroon Down, and the Aroon Oscillator for any period. The strategy builder supports crossover signals, high/low threshold alerts (above 70 / below 30), and oscillator zero-line crossovers. Aroon is effectively used as a regime filter: activate trend-following strategies only when Aroon Up is dominant.`,
    externalLinks: [
      { label: 'Investopedia — Aroon Indicator', url: 'https://www.investopedia.com/terms/a/aroon.asp', description: 'Complete guide to the Aroon indicator and its trading signals.' },
      { label: 'TradingView — Aroon Scripts', url: 'https://www.tradingview.com/scripts/aroon/', description: 'Aroon indicator scripts and strategies on TradingView.' },
      { label: 'StockCharts — Aroon', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:aroon', description: "StockCharts' Aroon tutorial with detailed examples." },
    ],
    relatedSlugs: ['adx-indicator', 'trend-following', 'donchian-channel', 'rate-of-change'],
  },

  'trix-indicator': {
    slug: 'trix-indicator',
    category: 'signal',
    icon: '📊',
    title: 'TRIX Indicator',
    tagline: 'A triple-smoothed momentum oscillator that filters out short-term noise.',
    metaTitle: 'TRIX Indicator — Triple Exponential Average Oscillator — AutoTrader Learn',
    metaDescription: 'Learn the TRIX indicator: a triple-smoothed momentum oscillator that filters minor price cycles and generates reliable trend change and divergence signals.',
    overview: `TRIX (Triple Exponential Average) is a momentum oscillator developed by Jack Hutson and published in Technical Analysis of Stocks & Commodities magazine in 1983. It calculates the percentage rate of change of a triple-smoothed EMA, making it exceptionally effective at filtering out short-term price cycles that cause false signals in single or double-smoothed oscillators.\n\nCalculation: Apply an EMA of period N to price. Apply a second EMA of period N to the first EMA. Apply a third EMA of period N to the second EMA. TRIX = Percentage change in the triple EMA from the previous period.\n\nThe triple smoothing removes noise so effectively that TRIX can be used as a slow, reliable trend indicator or as a faster oscillator depending on the period chosen. A 12-period TRIX behaves as a smooth MACD-like oscillator; a 30-period TRIX provides long-term trend confirmation.\n\nSignals: Zero-line crossovers indicate trend changes (above zero = bullish momentum, below zero = bearish). Divergence between TRIX and price is among the most reliable reversal signals — particularly on higher timeframes. A signal line (9-period SMA of TRIX) is often added to generate crossover signals analogous to MACD's signal line.\n\nTRIX is particularly effective for identifying the trend's strength: a TRIX that is rising steeply indicates strong momentum, while a TRIX that is flat or turning indicates momentum exhaustion.`,
    howItWorks: `auto-Trading computes TRIX and its signal line with configurable period settings. The strategy builder supports TRIX/signal line crossovers (faster signals), TRIX zero-line crossovers (slower, more reliable trend changes), and divergence detection. TRIX is effective as a standalone signal generator and as a confirmation filter alongside price breakout signals.`,
    externalLinks: [
      { label: 'Investopedia — TRIX', url: 'https://www.investopedia.com/terms/t/trix.asp', description: 'Full explanation of the TRIX indicator and its trading applications.' },
      { label: 'TradingView — TRIX Scripts', url: 'https://www.tradingview.com/scripts/trix/', description: 'TRIX indicator strategies and scripts on TradingView.' },
      { label: 'StockCharts — TRIX', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:trix', description: "StockCharts' detailed TRIX tutorial with signal examples." },
    ],
    relatedSlugs: ['macd-indicator', 'ema-indicator', 'rate-of-change', 'momentum-trading'],
  },

  'elder-ray': {
    slug: 'elder-ray',
    category: 'signal',
    icon: '☀️',
    title: 'Elder Ray Index (Bull & Bear Power)',
    tagline: 'Measure the strength of buyers and sellers relative to the trend.',
    metaTitle: 'Elder Ray Index — Bull Power & Bear Power — AutoTrader Learn',
    metaDescription: 'Learn the Elder Ray Index: Dr. Alexander Elder\'s Bull Power and Bear Power indicators that measure buying and selling strength relative to an exponential moving average.',
    overview: `The Elder Ray Index, developed by Dr. Alexander Elder and introduced in his landmark book "Trading for a Living" (1993), consists of two separate indicators: Bull Power and Bear Power. Together, they measure how far above or below a 13-period EMA the daily high and low reach — capturing the relative strength of buyers and sellers.\n\nBull Power = Daily High − 13-period EMA. A positive Bull Power indicates buyers are strong enough to push price above the average; negative Bull Power indicates buyers are unusually weak. Bear Power = Daily Low − 13-period EMA. A negative Bear Power indicates sellers can push price below the average; a positive Bear Power indicates sellers are unusually weak.\n\nElder's trading rules combine both components with the EMA trend direction: in an uptrend (rising 13-EMA), buy when Bear Power is negative (sellers are active but buyers have structural control) and Bear Power is rising from its lowest recent value (selling pressure is diminishing). In a downtrend (falling 13-EMA), sell when Bull Power is positive but declining.\n\nThe genius of Elder Ray is that it identifies the ideal entry point: the brief, temporary weakness within a strong trend where risk is minimised. A slight pullback in Bull Power during an uptrend is exactly where long entries should be considered, not at peaks of bullish momentum.`,
    howItWorks: `auto-Trading computes Bull Power and Bear Power with a configurable EMA period (default 13). The strategy builder supports conditional triggers: Bull Power crossing above/below zero, Bear Power divergence from price, and combined Elder Rule signals (EMA trend + oscillator position). Elder Ray signals integrate natively with the Triple Screen system for refined entry timing.`,
    externalLinks: [
      { label: 'Investopedia — Elder Ray Index', url: 'https://www.investopedia.com/terms/e/elderray.asp', description: 'Overview of the Elder Ray Index and its component indicators.' },
      { label: 'TradingView — Elder Ray Scripts', url: 'https://www.tradingview.com/scripts/elderray/', description: 'Elder Ray Bull and Bear Power scripts on TradingView.' },
      { label: 'Elder.com', url: 'https://www.elder.com/trading-indicators/', description: "Dr. Elder's official resources on Bull Power and Bear Power." },
    ],
    relatedSlugs: ['triple-screen-strategy', 'macd-indicator', 'ema-indicator', 'adx-indicator'],
  },

  'detrended-price-oscillator': {
    slug: 'detrended-price-oscillator',
    category: 'signal',
    icon: '📉',
    title: 'Detrended Price Oscillator (DPO)',
    tagline: 'Isolate short-term price cycles by removing the long-term trend.',
    metaTitle: 'Detrended Price Oscillator (DPO) — Cycle Analysis — AutoTrader Learn',
    metaDescription: 'Learn the Detrended Price Oscillator: how DPO removes the long-term trend from price to reveal short-term cycles and identify overbought/oversold conditions within the cycle.',
    overview: `The Detrended Price Oscillator (DPO) is a unique indicator that removes the long-term trend from price action to isolate short-term price cycles. Unlike most oscillators that measure momentum relative to recent price action, the DPO shifts a moving average backward in time and subtracts it from price — effectively "detrending" the data to reveal the natural price cycle.\n\nFormula: DPO = Close − Simple Moving Average(N/2 + 1 periods ago). By using a displaced (shifted back) moving average, the DPO aligns the cycle peaks and troughs with the actual price peaks and troughs — making it easier to identify the cycle length and time entries at cycle lows.\n\nThe primary use is cycle timing: count the number of bars between consecutive DPO peaks (or troughs) to determine the dominant cycle length of an instrument. Once the cycle is known, traders anticipate when the next cycle low will occur and position for a bounce. This is particularly valuable for instruments with consistent seasonal patterns or well-defined trading cycles.\n\nDPO also identifies overbought/oversold conditions relative to the cycle: when DPO reaches its historically highest readings, price is at a cycle peak and a correction is likely. When DPO is at its historically lowest readings, price is at a cycle trough and a bounce is expected.\n\nImportant note: the DPO is not designed as a momentum indicator for trend trading — it is a cycle analysis tool. Using it to trade against strong trends will result in many premature entries.`,
    howItWorks: `auto-Trading implements DPO with configurable period and displacement. The strategy builder supports DPO overbought/oversold threshold signals, zero-line crossovers, and peak/trough detection for cycle analysis. DPO is most effective when combined with a trend filter (trade DPO cycle lows only when the 200 EMA is rising) to avoid counter-trend entries in strong moves.`,
    externalLinks: [
      { label: 'Investopedia — DPO', url: 'https://www.investopedia.com/terms/d/detrended-price-oscillator-dpo.asp', description: 'Full guide to the Detrended Price Oscillator and cycle analysis.' },
      { label: 'TradingView — DPO Scripts', url: 'https://www.tradingview.com/scripts/detrendedpriceoscillator/', description: 'DPO scripts and cycle analysis strategies on TradingView.' },
      { label: 'StockCharts — DPO', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:detrended_price_oscillator_dpo', description: "StockCharts' detailed DPO article with cycle examples." },
    ],
    relatedSlugs: ['rsi-indicator', 'stochastic-oscillator', 'bollinger-bands', 'range-trading'],
  },

  'linear-regression': {
    slug: 'linear-regression',
    category: 'signal',
    icon: '📏',
    title: 'Linear Regression Channel',
    tagline: 'Project statistical price trends and identify deviation extremes.',
    metaTitle: 'Linear Regression Channel — Statistical Trend Analysis — AutoTrader Learn',
    metaDescription: 'Learn the Linear Regression Channel: how statistical regression fits a trend line through price data and identifies overbought/oversold deviations for high-probability mean reversion trades.',
    overview: `The Linear Regression Channel is a statistical tool that fits the best-fit straight line through a specified number of price bars using the least-squares method, then draws parallel channel lines at one and two standard deviations above and below the regression line. Unlike hand-drawn trend channels that rely on connecting specific highs/lows, the linear regression is mathematically objective — it is the statistically optimal trend line for the selected data.\n\nThe centre line (regression line) represents the statistical "fair value" of price during the selected period. The outer channel bands represent how far price typically deviates from this mean. Prices that reach the +2 SD upper channel are considered statistically overextended and likely to revert toward the centre; prices at −2 SD are oversold on the same basis.\n\nThe slope of the regression line quantifies the trend: a steeply positive slope indicates strong upward momentum; a near-flat slope indicates consolidation; a steep negative slope indicates a downtrend. The slope can be used as a quantitative momentum signal in algorithmic strategies.\n\nThe "R-squared" value (coefficient of determination) measures how well the regression fits the price data. A high R² (above 0.8) means price is trending cleanly along the regression line — ideal for trend-following strategies. A low R² means price is choppy and not well-described by a linear model — better suited for range-based approaches.\n\nLinear regression is also used in the Kirshenbaum Bands, the Raff Regression Channel, and various quantitative pairs trading implementations.`,
    howItWorks: `auto-Trading's linear regression tool calculates the regression line, standard deviation channels, slope, and R² value dynamically on any timeframe and lookback period. Strategy blocks include: price crossing the upper/lower channel bands (mean reversion signals), slope-based momentum filters, and R² regime classification (high R² enables trend following; low R² enables range trading).`,
    externalLinks: [
      { label: 'Investopedia — Linear Regression', url: 'https://www.investopedia.com/terms/l/linearregression.asp', description: 'Statistical foundation of linear regression applied to financial markets.' },
      { label: 'TradingView — Linear Regression Channel', url: 'https://www.tradingview.com/scripts/linearregression/', description: 'Linear regression channel scripts and strategies on TradingView.' },
      { label: 'StockCharts — Linear Regression', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:linear_regression', description: "StockCharts' guide to linear regression in technical analysis." },
    ],
    relatedSlugs: ['bollinger-bands', 'pairs-trading', 'mean-reversion', 'keltner-channels'],
  },

  // ─────────────────────── NEW INDICATORS (2026-05-09) ───────────────────────

  'stochastic-rsi': {
    slug: 'stochastic-rsi',
    category: 'signal',
    icon: '🔬',
    title: 'Stochastic RSI (StochRSI)',
    tagline: 'Ultra-sensitive momentum oscillator combining RSI and Stochastic for faster signals.',
    metaTitle: 'Stochastic RSI (StochRSI) — AutoTrader Learn',
    metaDescription: 'Learn Stochastic RSI: how this double-smoothed momentum indicator generates faster overbought/oversold signals than standard RSI for precise entry timing.',
    overview: `The Stochastic RSI (StochRSI) was developed by Tushar Chande and Stanley Kroll and introduced in their 1994 book "The New Technical Trader." Rather than applying the Stochastic formula to price (as the classic Stochastic Oscillator does), StochRSI applies it to RSI values — creating a double-filtered oscillator that is far more sensitive and faster-acting than either indicator alone.

Formula: StochRSI = (RSI − Lowest RSI over N periods) ÷ (Highest RSI over N periods − Lowest RSI over N periods)

The result oscillates between 0 and 1 (or 0 to 100 when scaled). Values above 0.80 indicate the RSI is near the top of its recent range (overbought); values below 0.20 indicate the RSI is near the bottom (oversold). A smoothed signal line (%D) is typically plotted alongside the raw StochRSI (%K) line, with %D crossovers providing the entry signals — exactly as in the standard Stochastic Oscillator.

The advantage of StochRSI over plain RSI is speed and sensitivity: RSI can remain in overbought territory for extended periods during strong trends without generating a buy signal, while StochRSI cycles through overbought and oversold more rapidly, identifying shorter-term entry and exit windows within the broader RSI move. This makes it especially useful for swing traders and intraday traders.

StochRSI is most powerful when used in combination with a trend filter — for example, taking only buy signals (StochRSI crossing above 0.20 from below) when price is above the 200 EMA, and only sell signals when price is below. In ranging markets, straightforward overbought/oversold reversals work well. In trending markets, use the crossing of the 0.50 midline as a trend-confirmation signal rather than the extreme levels.

Divergence between price and StochRSI is another high-probability signal: when price makes a new high but StochRSI fails to reach its own recent high, bearish divergence warns of exhaustion. This pattern is particularly reliable on the 4-hour and daily timeframes.`,
    howItWorks: `auto-Trading computes StochRSI using fully configurable RSI period, Stochastic period, %K smoothing, and %D signal line. Strategy blocks support: %K/%D crossover signals in oversold/overbought zones, midline (0.50) crossovers for trend bias, and divergence detection against price. StochRSI is available on all timeframes and integrates directly with the RSI and Stochastic Oscillator blocks for multi-indicator confluence setups.`,
    externalLinks: [
      { label: 'Investopedia — Stochastic RSI', url: 'https://www.investopedia.com/terms/s/stochrsi.asp', description: 'Full guide to StochRSI: formula, interpretation, and trading applications.' },
      { label: 'TradingView — StochRSI Scripts', url: 'https://www.tradingview.com/scripts/stochasticrsi/', description: 'StochRSI indicators and divergence strategies on TradingView.' },
      { label: 'BabyPips — Stochastic RSI', url: 'https://www.babypips.com/learn/forex/stochastic-rsi', description: "BabyPips' explanation of StochRSI with practical trading examples." },
    ],
    relatedSlugs: ['rsi-indicator', 'stochastic-oscillator', 'macd-indicator', 'mean-reversion'],
  },

  'force-index': {
    slug: 'force-index',
    category: 'signal',
    icon: '⚡',
    title: 'Force Index',
    tagline: 'Quantify the actual power behind price moves using price change and volume.',
    metaTitle: 'Force Index — Power Behind Price Moves — AutoTrader Learn',
    metaDescription: 'Learn the Force Index indicator: Dr. Alexander Elder\'s measure of buying and selling force that combines price change direction, magnitude, and volume into one clear signal.',
    overview: `The Force Index was developed by Dr. Alexander Elder and introduced in his seminal 1993 book "Trading for a Living." It is one of the most logically satisfying indicators in technical analysis because it directly measures the three elements that determine market force: the direction of price change, the magnitude of price change, and the trading volume that accompanied the move.

Formula: Force Index = (Current Close − Previous Close) × Volume

A positive Force Index means the session closed higher with positive buying force; a negative Force Index means sellers were in control. The raw Force Index is extremely spiky, so it is almost always smoothed with a short-period EMA (2-period for short-term signals) or a longer-period EMA (13-period for trend confirmation).

The 2-period EMA of the Force Index is used for precise entry timing within the context of the prevailing trend. When the 2-period Force Index dips below zero in an uptrend (the trend is confirmed by the 13-period EMA direction), it signals a minor pullback — an ideal buying opportunity. In a downtrend (EMA pointing down), a 2-period Force Index spike above zero represents a temporary counter-rally — a selling opportunity.

The 13-period EMA of the Force Index serves as a trend confirmation tool. When it is above zero for an extended period, bulls are dominant. When it is below zero, bears control the market. A crossover of the 13-period Force Index through zero often coincides with a significant trend change and provides a high-probability trading signal on daily and weekly charts.

Divergence between the Force Index and price is a powerful reversal signal: when price makes new highs but the Force Index fails to confirm (the Force Index peaks are declining), it reveals that the rally is being driven by diminishing volume — a warning that the trend is about to reverse. This pattern is particularly reliable at major market tops and bottoms.`,
    howItWorks: `auto-Trading computes the raw Force Index and both the 2-period and 13-period EMA versions simultaneously. The strategy builder supports 2-period zero-line dips as pullback entry signals, 13-period zero-line crossovers as trend change signals, and divergence detection against price. Force Index integrates natively with the Triple Screen system and Elder Ray indicators for a complete Dr. Elder trading framework.`,
    externalLinks: [
      { label: 'Investopedia — Force Index', url: 'https://www.investopedia.com/terms/f/force-index.asp', description: 'Full explanation of the Force Index, its formula, and Elder\'s trading rules.' },
      { label: 'TradingView — Force Index Scripts', url: 'https://www.tradingview.com/scripts/forceindex/', description: 'Force Index implementations and Elder system strategies on TradingView.' },
      { label: 'Elder.com — Force Index', url: 'https://www.elder.com/trading-indicators/force-index/', description: "Dr. Elder's official documentation on the Force Index indicator." },
    ],
    relatedSlugs: ['elder-ray', 'triple-screen-strategy', 'obv-indicator', 'volume-analysis'],
  },

  'ultimate-oscillator': {
    slug: 'ultimate-oscillator',
    category: 'signal',
    icon: '🎯',
    title: 'Ultimate Oscillator',
    tagline: 'Larry Williams\' multi-timeframe momentum oscillator that reduces false signals.',
    metaTitle: 'Ultimate Oscillator — Multi-Timeframe Momentum — AutoTrader Learn',
    metaDescription: 'Learn the Ultimate Oscillator: Larry Williams\' three-timeframe momentum indicator that reduces whipsaws and generates reliable divergence signals across short, medium, and long cycles.',
    overview: `The Ultimate Oscillator was developed by Larry Williams and published in Technical Analysis of Stocks & Commodities magazine in 1985. Williams designed it to solve a persistent flaw in single-period oscillators: the tendency to produce conflicting signals depending on which lookback period is chosen. By incorporating three different timeframes simultaneously — short (7 periods), medium (14 periods), and long (28 periods) — the Ultimate Oscillator produces a more balanced, less whipsaw-prone reading.

The calculation begins with the "Buying Pressure" for each bar: BP = Close − Minimum(Low, Previous Close). The "True Range" accounts for gaps: TR = Maximum(High, Previous Close) − Minimum(Low, Previous Close). The Average for each period is BP ÷ TR over that period. The three averages are then combined with a weighted sum: UO = 100 × ((4 × Average7) + (2 × Average14) + (1 × Average28)) ÷ 7. The short period receives the highest weight (4), ensuring the oscillator is still responsive to near-term price action.

The oscillator ranges from 0 to 100. Values above 70 indicate overbought conditions; values below 30 indicate oversold. However, Williams' original trading rules are specifically based on divergence, not simple threshold signals: a bullish divergence setup requires the oscillator to fall below 30, form a bullish divergence with price, and then break above the most recent oscillator peak before the entry is triggered. The sell side mirrors this with bearish divergence.

Williams emphasised that the divergence-based signals are far more reliable than simple overbought/oversold readings, because they require a specific sequence of events that confirms both momentum exhaustion and reversal initiation. A basic oscillator reading above 70 might stay there for many bars in a strong trend, but a confirmed divergence followed by a peak/trough break is a specific, actionable signal.`,
    howItWorks: `auto-Trading computes the Ultimate Oscillator with fully configurable short, medium, and long periods (defaults 7/14/28) and their weighting multipliers. Strategy modules support: threshold alerts (above 70, below 30), Williams' original divergence-and-break signals (automated detection and breakout confirmation), and simpler crossover triggers for high-frequency use. The multi-period structure makes it effective across asset classes from forex to crypto.`,
    externalLinks: [
      { label: 'Investopedia — Ultimate Oscillator', url: 'https://www.investopedia.com/terms/u/ultimateoscillator.asp', description: 'Complete guide to the Ultimate Oscillator and Williams\' original trading rules.' },
      { label: 'TradingView — Ultimate Oscillator', url: 'https://www.tradingview.com/scripts/ultimateoscillator/', description: 'Ultimate Oscillator scripts and divergence strategies on TradingView.' },
      { label: 'StockCharts — Ultimate Oscillator', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:ultimate_oscillator', description: "StockCharts' detailed tutorial on the Ultimate Oscillator." },
    ],
    relatedSlugs: ['williams-percent-r', 'rsi-indicator', 'stochastic-oscillator', 'cci-indicator'],
  },

  'vortex-indicator': {
    slug: 'vortex-indicator',
    category: 'signal',
    icon: '🌀',
    title: 'Vortex Indicator',
    tagline: 'Two oscillating lines that identify new trend initiation with remarkable clarity.',
    metaTitle: 'Vortex Indicator — Trend Initiation & Reversal — AutoTrader Learn',
    metaDescription: 'Learn the Vortex Indicator: how VI+ and VI− lines identify the start of new trends and trend reversals by measuring the relationship between current and prior highs and lows.',
    overview: `The Vortex Indicator was developed by Etienne Botes and Douglas Siepman and introduced in Technical Analysis of Stocks & Commodities magazine in January 2010. Inspired by the movement of water in a vortex, the indicator uses the relationship between the current bar's range and the prior bar's extreme points to measure upward and downward trend movements.

The indicator consists of two lines: VI+ (positive vortex) measures upward trend movement, and VI− (negative vortex) measures downward trend movement. Both are calculated as rolling sums of directional movement divided by the rolling sum of True Range over a lookback period (default 14).

VI+ = Sum of |Current High − Previous Low| over N periods ÷ Sum of True Range over N periods
VI− = Sum of |Current Low − Previous High| over N periods ÷ Sum of True Range over N periods

When VI+ crosses above VI−, a new upward trend is beginning — this is the buy signal. When VI− crosses above VI+, a new downward trend is initiating — this is the sell signal. The magnitude of the separation between the two lines indicates the strength of the current trend.

The Vortex Indicator has an important distinction from similar crossover indicators: it is designed specifically to identify trend initiation (the beginning of new trends), not continuation. The clearest signals occur after periods of consolidation when the two lines are crossing frequently, indicating the market is deciding its direction. Once the lines separate clearly, the new trend is confirmed.

The indicator performs best on daily and weekly timeframes for equity and crypto markets. Combined with an ADX filter (trade VI crossovers only when ADX is rising above 20), it dramatically reduces false signals during choppy markets.`,
    howItWorks: `auto-Trading computes VI+ and VI− with configurable lookback periods (default 14). Strategy blocks support: VI+/VI− crossover signals (primary entry), separation magnitude filters (enter only when the spread exceeds a threshold), and trend strength confirmations using ADX. The Vortex Indicator is particularly effective as an automated trend-change scanner across large watchlists, alerting you when new trends are beginning.`,
    externalLinks: [
      { label: 'Investopedia — Vortex Indicator', url: 'https://www.investopedia.com/terms/v/vortex-indicator-vi.asp', description: 'Full guide to the Vortex Indicator and its trend-change signals.' },
      { label: 'TradingView — Vortex Indicator Scripts', url: 'https://www.tradingview.com/scripts/vortexindicator/', description: 'Vortex Indicator strategies and crossover implementations on TradingView.' },
      { label: 'StockCharts — Vortex Indicator', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:vortex_indicator', description: "StockCharts' detailed Vortex Indicator tutorial." },
    ],
    relatedSlugs: ['adx-indicator', 'dmi-indicator', 'trend-following', 'aroon-indicator'],
  },

  'dmi-indicator': {
    slug: 'dmi-indicator',
    category: 'signal',
    icon: '🧭',
    title: 'Directional Movement Index (DMI)',
    tagline: 'The foundation of ADX: identify trend direction with +DI and −DI crossovers.',
    metaTitle: 'Directional Movement Index (DMI) — +DI and −DI Explained — AutoTrader Learn',
    metaDescription: 'Learn the Directional Movement Index: how +DI and −DI measure directional force, generate crossover signals, and form the basis of the ADX trend strength indicator.',
    overview: `The Directional Movement Index (DMI) was developed by J. Welles Wilder Jr. and introduced in his 1978 book "New Concepts in Technical Trading Systems" — the same work that gave us the RSI and ATR. While ADX (which is derived from DMI) measures trend strength, the DMI itself focuses specifically on trend direction through two component lines: +DI (Positive Directional Indicator) and −DI (Negative Directional Indicator).

+DI measures upward directional movement: the portion of each bar's range that represents new ground covered above the prior bar's high. −DI measures downward directional movement: the portion that covers new ground below the prior bar's low. Both are smoothed over a 14-period window (by default) and expressed as percentages of the Average True Range, making them comparable across different instruments.

The primary trading signal is the +DI/−DI crossover: when +DI crosses above −DI, upward directional force exceeds downward force — a buy signal. When −DI crosses above +DI, downward force dominates — a sell signal. Wilder's original Directional Movement System added a refinement: the "Extreme Point Rule," which requires price to exceed the high of the crossover bar (for buys) before entry, reducing false signals.

The separation between +DI and −DI also provides valuable information: when the lines are far apart, the dominant force is strong and clear; when they are close together or frequently crossing, the market is trendless and choppy. This is exactly the information ADX summarises: ADX is derived from the difference between +DI and −DI, smoothed over time.

Understanding DMI separately from ADX helps traders appreciate the direction component distinct from the strength component: a rising ADX with +DI above −DI = a strengthening uptrend. A rising ADX with −DI above +DI = a strengthening downtrend.`,
    howItWorks: `auto-Trading computes +DI, −DI, and ADX together as a unified Directional Movement System. Strategy blocks support: +DI/−DI crossovers with optional Extreme Point Rule confirmation, threshold-based directional bias signals (+DI > 30 for strong bullish regime), and combined ADX/DMI regime filters (strong trend + bullish direction = trend-following mode active). The DMI suite is a standard component of any trend-following strategy in the auto-Trading builder.`,
    externalLinks: [
      { label: 'Investopedia — DMI', url: 'https://www.investopedia.com/terms/d/dmi.asp', description: 'Detailed explanation of DMI, +DI, −DI, and their relationship to ADX.' },
      { label: 'TradingView — DMI Scripts', url: 'https://www.tradingview.com/scripts/dmi/', description: 'DMI crossover strategies and Directional Movement systems on TradingView.' },
      { label: 'StockCharts — DMI', url: 'https://school.stockcharts.com/doku.php?id=technical_indicators:directional_movement_index', description: "StockCharts' comprehensive DMI and ADX tutorial." },
    ],
    relatedSlugs: ['adx-indicator', 'vortex-indicator', 'trend-following', 'atr-indicator'],
  },

  // ─────────────────────── NEW STRATEGIES (2026-05-09) ───────────────────────

  'volatility-trading': {
    slug: 'volatility-trading',
    category: 'strategy',
    icon: '🌩️',
    title: 'Volatility Trading Strategy',
    tagline: 'Profit from expansions and contractions in market volatility itself.',
    metaTitle: 'Volatility Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn volatility trading: how to profit from changes in market volatility using options, VIX instruments, and volatility-based position strategies.',
    overview: `Volatility trading is a category of strategies that aims to profit not from the direction of price movement, but from changes in the level of volatility itself. Markets oscillate between periods of calm (low volatility) and turbulence (high volatility), and these cycles are as predictable as price trends — if you know how to read them.

At the core of volatility analysis is the VIX (Volatility Index), which measures the implied volatility of S&P 500 options and is widely known as the "fear gauge." A rising VIX signals increasing uncertainty and tends to coincide with equity market declines; a falling VIX indicates complacency and often correlates with rallies. Extreme VIX readings — above 30 for stocks, or equivalent extremes in crypto volatility indices — historically represent panic bottoms that offer high-probability long equity entry points.

The Bollinger Band Squeeze is a practical volatility-based strategy for all asset classes: when Bollinger Bands narrow to historically tight widths, volatility has compressed to an extreme. This compression precedes an explosive directional move. Traders set breakout orders above and below the squeeze and enter whichever direction the first decisive breakout occurs, using the ATR at the time of breakout for position sizing.

Volatility-adjusted position sizing is another application: during high-volatility regimes (ATR above its 20-period average), reduce position sizes to maintain constant dollar risk. During low-volatility regimes, increase size. This systematic approach prevents large losses during market crashes and maximises gains during calm, trending periods.

In crypto markets, perpetual futures funding rates are closely linked to volatility: during high-volatility bull runs, funding rates become extremely elevated, making short-perpetual / long-spot carry trades highly lucrative. Monitoring volatility provides context for choosing between directional and carry strategies.`,
    howItWorks: `auto-Trading's volatility trading module monitors ATR, Bollinger Band width, and Keltner Channel relationships across all instruments. When a Bollinger Squeeze is detected, breakout alerts are generated automatically. The risk management engine adjusts position sizes dynamically based on the current volatility regime — high ATR reduces size; low ATR increases it — ensuring consistent risk exposure regardless of market conditions.`,
    externalLinks: [
      { label: 'Investopedia — Volatility Trading', url: 'https://www.investopedia.com/articles/optioninvestor/08/implied-volatility.asp', description: 'Overview of trading with implied and realised volatility.' },
      { label: 'CBOE — VIX Overview', url: 'https://www.cboe.com/tradable_products/vix/', description: 'Official CBOE page on the VIX Volatility Index.' },
      { label: 'TradingView — Volatility Indicators', url: 'https://www.tradingview.com/scripts/volatility/', description: 'Volatility measurement and squeeze detection scripts on TradingView.' },
    ],
    relatedSlugs: ['bollinger-bands', 'keltner-channels', 'atr-indicator', 'breakout-strategy'],
  },

  'market-making-strategy': {
    slug: 'market-making-strategy',
    category: 'strategy',
    icon: '🏛️',
    title: 'Market Making Strategy',
    tagline: 'Profit from the bid-ask spread by continuously providing liquidity on both sides.',
    metaTitle: 'Market Making Strategy — AutoTrader Learn',
    metaDescription: 'Learn market making: how algorithmic bots profit by simultaneously posting buy and sell orders around the mid-price, earning the spread while managing inventory risk.',
    overview: `Market making is the practice of simultaneously placing both a bid (buy) order and an ask (sell) order slightly below and above the current market price, profiting from the difference between the two — the bid-ask spread. Professional market makers — designated by exchanges to maintain liquidity — are the most visible practitioners, but algorithmic retail market making has become viable on crypto exchanges with deep order books.

The fundamental profit mechanism is simple: if you buy at $100.00 and sell at $100.05, you earn $0.05 per unit regardless of the underlying asset's direction. The challenge is "inventory risk": if price trends strongly upward while you are holding sell orders, you accumulate a growing short position that loses more than your accumulated spread income.

Avellaneda-Stoikov optimal market making (a landmark 2008 academic paper) introduced the concept of a "reservation price" — the market maker should adjust their quotes based on their current inventory: if long too much, shift both bid and ask slightly downward to attract sellers; if short too much, shift upward to attract buyers. This asymmetric quoting prevents the inventory from drifting too far in one direction.

Effective market making requires: low latency execution (quotes must be updated faster than competitors), high liquidity instruments (wider spreads exist in thin markets), tight risk management (maximum inventory limits prevent catastrophic directional exposure), and careful fee optimisation (exchanges that pay "maker rebates" to liquidity providers are ideal targets).

In cryptocurrency markets, market making bots are especially popular on perpetual futures and spot pairs with high daily volume. The strategy is most effective during periods of low volatility when prices oscillate within a narrow range and the spread income exceeds directional risk.`,
    howItWorks: `auto-Trading's market making module places dual limit orders around a configurable mid-price with adjustable spread width. The Avellaneda-Stoikov inventory skewing algorithm automatically adjusts quote positioning based on the accumulated net position. Maximum inventory limits define the point at which one side of quotes is cancelled to prevent excessive directional exposure. Maker rebate optimisation selects exchanges and pairs with the best net economics.`,
    externalLinks: [
      { label: 'Investopedia — Market Maker', url: 'https://www.investopedia.com/terms/m/marketmaker.asp', description: 'Overview of market makers, their role, and how they profit from spreads.' },
      { label: 'Avellaneda-Stoikov Paper', url: 'https://math.nyu.edu/~avellane/HighFrequencyTrading.pdf', description: 'The seminal academic paper on optimal market making algorithms.' },
      { label: 'Binance Academy — Market Making', url: 'https://academy.binance.com/en/articles/what-is-a-market-maker', description: "Binance's accessible introduction to market making in crypto." },
    ],
    relatedSlugs: ['arbitrage-strategy', 'grid-trading', 'scalping-strategy', 'vwap-indicator'],
  },

  'counter-trend-strategy': {
    slug: 'counter-trend-strategy',
    category: 'strategy',
    icon: '↩️',
    title: 'Counter-Trend Trading Strategy',
    tagline: 'Fade overextended moves and profit when momentum reverses.',
    metaTitle: 'Counter-Trend Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn counter-trend trading: how to identify overextended price moves and profit from reversals using momentum exhaustion, divergence, and overbought/oversold signals.',
    overview: `Counter-trend trading is the practice of taking positions against the prevailing trend — buying when price has fallen significantly and appears oversold, or selling when price has risen sharply and appears overbought. It is the conceptual opposite of trend-following, and while it can be extremely profitable, it carries higher inherent risk because you are deliberately fighting the established direction of price.

The strategy's edge comes from "reversion to the mean" dynamics: no price move lasts forever, and extreme moves are statistically likely to correct. The challenge is distinguishing a genuine, high-probability reversal setup from a stock or asset that is in free-fall or in an unstoppable bull run. This distinction is what separates profitable counter-trend traders from those who repeatedly "catch falling knives."

Key tools for counter-trend trading include: oscillators in extreme territory (RSI below 20 or above 80 on a higher timeframe), price trading multiple standard deviations outside Bollinger Bands, bullish or bearish divergence between price and momentum indicators (RSI, MACD, or Stochastic), candlestick reversal patterns at key support/resistance levels (pin bars, engulfing candles), and volume climaxes (a sudden surge in volume after a prolonged trend often marks exhaustion).

Risk management is especially critical in counter-trend strategies. Since you are entering against momentum, the probability of being wrong initially is higher than with trend-following. Position sizing should be conservative (typically 0.5%–1% of capital per trade), and stops must be defined and respected. Many professionals use a scaled-entry approach: taking a partial position at the first reversal signal and adding only if price confirms the reversal.

The most successful counter-trend traders combine strict entry criteria (requiring multiple confluences), accept that they will miss some reversals (better to miss a trade than to be early), and exit quickly if the trade does not move in the expected direction within a defined time period.`,
    howItWorks: `auto-Trading's counter-trend module identifies extreme price deviations using multi-indicator confluence: RSI in extreme territory, Bollinger Band breaches, StochRSI oversold/overbought crossovers, and candlestick reversal pattern detection at key levels. Entries are confirmed by requiring at least two confluence factors simultaneously. Position sizes are automatically reduced relative to trend-following settings to reflect the higher risk profile.`,
    externalLinks: [
      { label: 'Investopedia — Contrarian Investing', url: 'https://www.investopedia.com/terms/c/contrarian.asp', description: 'Overview of contrarian and counter-trend approaches in trading.' },
      { label: 'TradingView — Mean Reversion Scripts', url: 'https://www.tradingview.com/scripts/meanreversion/', description: 'Mean reversion and counter-trend strategy scripts on TradingView.' },
      { label: 'BabyPips — Counter-Trend Trading', url: 'https://www.babypips.com/learn/forex/counter-trend-trading', description: "BabyPips' guide to trading against the trend safely." },
    ],
    relatedSlugs: ['mean-reversion', 'rsi-indicator', 'stochastic-rsi', 'bollinger-bands'],
  },

  'machine-learning-strategy': {
    slug: 'machine-learning-strategy',
    category: 'strategy',
    icon: '🤖',
    title: 'Machine Learning Trading Strategy',
    tagline: 'Use AI and ML models to discover non-linear patterns in market data.',
    metaTitle: 'Machine Learning Trading Strategy — AutoTrader Learn',
    metaDescription: 'Learn ML-based trading: how machine learning models find non-linear patterns in price, volume, and alternative data that traditional indicators cannot capture.',
    overview: `Machine learning (ML) trading strategies use statistical algorithms to discover patterns in historical market data that may not be obvious to human analysts or expressible as simple rule-based conditions. Unlike traditional technical indicators that follow explicit formulas, ML models learn from data and adapt their internal parameters to maximise predictive accuracy on historical examples.

The most widely used ML approaches in trading include: Gradient Boosting (XGBoost, LightGBM) for structured feature-based prediction (predicting next-bar returns or directional probability using technical indicators as inputs), Random Forests for ensemble-based classification (categorising market regimes), Recurrent Neural Networks and LSTMs for sequence modelling (capturing temporal dependencies in price series), and Reinforcement Learning (RL) for training agents that learn optimal execution policies through simulated trading.

Feature engineering is the most important step in any ML trading pipeline. Raw price data alone is rarely sufficient — the model needs informative features derived from price: moving average ratios, momentum measures, volatility indicators, volume metrics, order book imbalances, sentiment scores from news and social media, and macroeconomic data. The quality of features determines the ceiling of model performance far more than the choice of algorithm.

Critical pitfalls to avoid include: look-ahead bias (accidentally using future data in features), overfitting (models that perform perfectly on training data but fail out-of-sample), data snooping bias (testing too many models on the same dataset), and ignoring transaction costs and slippage (which can eliminate theoretically profitable signals). Walk-forward validation — training on a rolling window and testing on the immediately subsequent period — is the gold-standard backtesting approach for ML strategies.

The most practical ML strategies for retail traders use gradient boosted trees with carefully engineered technical features and strict regularisation to prevent overfitting. They generate a probabilistic signal (probability that the next bar will close higher) rather than a binary buy/sell, allowing position sizing to scale with model confidence.`,
    howItWorks: `auto-Trading's AI signals engine uses gradient boosted models trained on rolling walk-forward windows across multiple asset classes. Feature sets include 50+ technical indicators, volume metrics, cross-asset correlations, and funding rate data for crypto. The model outputs a signal confidence score that scales position size proportionally — high-confidence signals receive full allocation; borderline signals receive reduced size. Models are retrained on a weekly schedule to adapt to evolving market conditions.`,
    externalLinks: [
      { label: 'Investopedia — Algorithmic Trading', url: 'https://www.investopedia.com/articles/active-trading/101014/basics-algorithmic-trading-concepts-and-examples.asp', description: 'Foundation concepts in algorithmic and quantitative trading.' },
      { label: 'QuantConnect — ML Trading Tutorial', url: 'https://www.quantconnect.com/learning/articles/introduction-to-machine-learning-in-trading', description: 'Practical introduction to machine learning for algorithmic trading.' },
      { label: 'TradingView — ML Scripts', url: 'https://www.tradingview.com/scripts/machinelearning/', description: 'Community machine learning indicator scripts on TradingView.' },
    ],
    relatedSlugs: ['momentum-trading', 'trend-following', 'mean-reversion', 'arbitrage-strategy'],
  },

  'rebalancing-strategy': {
    slug: 'rebalancing-strategy',
    category: 'strategy',
    icon: '⚖️',
    title: 'Portfolio Rebalancing Strategy',
    tagline: 'Automatically restore your target asset allocation to control risk and lock in gains.',
    metaTitle: 'Portfolio Rebalancing Strategy — AutoTrader Learn',
    metaDescription: 'Learn portfolio rebalancing: how systematic rebalancing restores your target allocation, reduces risk concentration, and can generate additional returns through disciplined selling of winners.',
    overview: `Portfolio rebalancing is the process of periodically adjusting the weightings of assets in a portfolio to maintain a desired target allocation. Over time, winning assets appreciate and grow to represent a larger proportion of the portfolio than intended, while losing assets shrink — creating unplanned concentration risk. Rebalancing restores the original balance by selling a portion of the outperformers and buying more of the underperformers.

The strategy has two primary benefits. First, it enforces systematic risk control: if a single crypto asset appreciates from 10% of your portfolio to 40%, your risk exposure has quadrupled beyond your original plan. Rebalancing forces you to trim the position. Second, it can enhance returns through a mechanism called "volatility harvesting": by selling assets that have recently risen and buying those that have fallen, you are systematically selling high and buying low — capturing the mean-reversion premium that exists at the portfolio level even when individual assets are trending.

Three rebalancing approaches are common: calendar rebalancing (monthly, quarterly — simple and transparent), threshold rebalancing (rebalance when any asset drifts beyond a defined percentage from its target, e.g., ±5%), and hybrid rebalancing (calendar-based but with a threshold trigger that brings the rebalance forward if a large drift occurs before the scheduled date). Threshold rebalancing is generally preferred because it reacts to market conditions rather than arbitrary dates.

Transaction costs and taxes are important considerations: excessive rebalancing frequency erodes returns through fees and, in taxable accounts, triggers capital gains events. In crypto with no capital gains tax (in some jurisdictions) and low trading fees, more frequent rebalancing is viable. The optimal frequency depends on the volatility of the assets — more volatile portfolios drift faster and benefit from more frequent rebalancing.

Rebalancing is particularly powerful for multi-asset crypto portfolios (e.g., BTC/ETH/USDC) and for risk-parity portfolios where each asset contributes equal volatility-adjusted risk rather than equal dollar allocation.`,
    howItWorks: `auto-Trading's rebalancing bot monitors each asset's current portfolio weight against its target allocation on every candle close. When any asset drifts beyond the configured threshold (default ±5%), the bot calculates the precise trades needed to restore all targets simultaneously and executes them as limit orders near the current price. Rebalancing activity is logged with before/after allocations and performance impact for each event.`,
    externalLinks: [
      { label: 'Investopedia — Portfolio Rebalancing', url: 'https://www.investopedia.com/terms/r/rebalancing.asp', description: 'Complete guide to portfolio rebalancing theory and practice.' },
      { label: 'CoinGecko — Crypto Portfolio Tools', url: 'https://www.coingecko.com/en/portfolio', description: 'Portfolio tracking tools for monitoring crypto allocation drift.' },
      { label: 'Binance Academy — Rebalancing', url: 'https://academy.binance.com/en/articles/what-is-portfolio-rebalancing', description: "Binance's guide to rebalancing a cryptocurrency portfolio." },
    ],
    relatedSlugs: ['dollar-cost-averaging', 'mean-reversion', 'grid-trading', 'momentum-trading'],
  },

};

@Component({
  selector: 'app-learn-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './learn-detail.html',
  styleUrl: './learn-detail.scss',
})
export class LearnDetailPage implements OnInit {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  readonly auth      = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  languageService    = inject(LanguageService);
  private sanitizer  = inject(DomSanitizer);
  private translate  = inject(TranslateService);
  private document   = inject(DOCUMENT);
  private meta       = inject(Meta);

  page: LearnData | null = null;
  relatedPages: LearnData[] = [];
  overviewParagraphs: string[] = [];
  howItWorksHtml: SafeHtml = '';
  allStrategies: LearnData[] = [];
  allSignals: LearnData[] = [];
  strategyCodeExamples: LearnCodeExample[] = [];
  copiedCodeExampleId: string | null = null;
  codeAccessStep: CodeAccessStep = 'collect';
  codeAccessName = '';
  codeAccessEmail = '';
  codeAccessVerificationCode = '';
  codeAccessNameTouched = false;
  codeAccessEmailTouched = false;
  codeAccessNameFieldError = '';
  codeAccessEmailFieldError = '';
  codeAccessBusy = false;
  codeAccessError = '';
  codeAccessNotice = '';

  private currentSlug = '';
  private copyFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly codePreviewLines = 5;

  ngOnInit(): void {
    this.loadPage(this.route.snapshot.paramMap.get('slug') ?? '');
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.loadPage(p.get('slug') ?? ''));

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTranslatedPage());
  }

  private loadPage(slug: string): void {
    const data = LEARN_PAGES[slug];
    if (!data) {
      void this.router.navigate(['/', this.languageService.currentLang()]);
      return;
    }

    if (this.currentSlug !== slug) {
      this.resetCodeAccessState();
    }
    this.currentSlug = slug;

    this.allStrategies = Object.values(LEARN_PAGES)
      .filter(p => p.category === 'strategy' && p.slug !== slug);
    this.allSignals = Object.values(LEARN_PAGES)
      .filter(p => p.category === 'signal' && p.slug !== slug);

    this.applyTranslatedPage();
  }

  private t(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return translated === key ? fallback : translated;
  }

  private applyTranslatedPage(): void {
    const base = LEARN_PAGES[this.currentSlug];
    if (!base) {
      return;
    }

    const keyRoot = `learnPages.${base.slug}`;
    const translatedOverview = this.t(`${keyRoot}.overview`, base.overview);
    const translatedHowItWorks = this.t(`${keyRoot}.howItWorks`, base.howItWorks);

    this.page = {
      ...base,
      title: this.t(`${keyRoot}.title`, base.title),
      tagline: this.t(`${keyRoot}.tagline`, base.tagline),
      metaTitle: this.t(`${keyRoot}.metaTitle`, base.metaTitle),
      metaDescription: this.t(`${keyRoot}.metaDescription`, base.metaDescription),
      overview: translatedOverview,
      howItWorks: translatedHowItWorks,
      externalLinks: base.externalLinks.map((link, index) => ({
        ...link,
        label: this.t(`${keyRoot}.externalLinks.${index}.label`, link.label),
        description: this.t(`${keyRoot}.externalLinks.${index}.description`, link.description),
      })),
    };

    this.document.title = this.page.metaTitle;
    this.meta.updateTag({ name: 'description', content: this.page.metaDescription });

    const canonicalHref = this.canonicalHref();
    this.setCanonical(canonicalHref);

    this.meta.updateTag({ property: 'og:title', content: this.page.metaTitle });
    this.meta.updateTag({ property: 'og:description', content: this.page.metaDescription });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ property: 'og:url', content: canonicalHref });
    this.meta.updateTag({ property: 'og:locale', content: this.ogLocale(this.languageService.currentLang()) });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: this.page.metaTitle });
    this.meta.updateTag({ name: 'twitter:description', content: this.page.metaDescription });

    const keywords = [this.page.title, this.page.tagline, 'AutoTrader', 'auto-Trading'];
    if (this.languageService.currentLang() === 'ar' && this.currentSlug === 'smart-money-concepts') {
      keywords.push('التحليل الاستراتيجي', 'تحليل استراتيجي', 'مفاهيم الأموال الذكية', 'SMC');
    }
    this.meta.updateTag({ name: 'keywords', content: keywords.join(', ') });

    this.relatedPages = base.relatedSlugs
      .map(s => LEARN_PAGES[s])
      .filter(Boolean);

    this.strategyCodeExamples = this.buildStrategyCodeExamples(base.slug);

    this.overviewParagraphs = translatedOverview
      .split('\n\n')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => this.sanitizer.sanitize(SecurityContext.HTML, this.escapeHtml(p)) ?? '');

    const howHtml = this.sanitizer.sanitize(SecurityContext.HTML, this.escapeHtml(translatedHowItWorks)) ?? '';
    this.howItWorksHtml = this.sanitizer.bypassSecurityTrustHtml(howHtml);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private canonicalHref(): string {
    const origin = this.document.location?.origin ?? '';
    const lang = this.languageService.currentLang();
    return `${origin}/${lang}/learn/${this.currentSlug}`;
  }

  private setCanonical(href: string): void {
    let canonicalEl = this.document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = this.document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', href);
  }

  private ogLocale(lang: string): string {
    switch (lang) {
      case 'ar': return 'ar_AR';
      case 'de': return 'de_DE';
      case 'es': return 'es_ES';
      case 'fr': return 'fr_FR';
      case 'pt': return 'pt_PT';
      default: return 'en_US';
    }
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  ctaLink(): string[] {
    return this.localizedLink(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  ctaHref(): string {
    return this.localizedHref(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  learnLanguageHref(langCode: string): string {
    return `/${langCode}/learn/${this.page?.slug ?? ''}`;
  }

  learnLanguageLink(langCode: string): string[] {
    return ['/', langCode, 'learn', this.page?.slug ?? ''];
  }

  async copyCodeExample(example: LearnCodeExample): Promise<void> {
    if (this.codeAccessStep !== 'unlocked') {
      return;
    }

    const navigator = this.document.defaultView?.navigator;
    let copied = false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(example.code);
        copied = true;
      } catch {
        copied = this.copyWithTextarea(example.code);
      }
    } else {
      copied = this.copyWithTextarea(example.code);
    }

    if (!copied) {
      return;
    }

    this.copiedCodeExampleId = example.id;
    if (this.copyFeedbackTimeoutId) {
      clearTimeout(this.copyFeedbackTimeoutId);
    }
    this.copyFeedbackTimeoutId = setTimeout(() => {
      this.copiedCodeExampleId = null;
      this.copyFeedbackTimeoutId = null;
    }, 2000);
  }

  private buildStrategyCodeExamples(slug: string): LearnCodeExample[] {
    const page = LEARN_PAGES[slug];
    if (!page) {
      return [];
    }

    const profile = this.codeProfileForPage(page);
    const pineCode = this.pineCodeForProfile(profile, page.title);
    const thinkCode = this.thinkCodeForProfile(profile, page.title);

    return [
      {
        id: `${page.slug}-pinescript`,
        title: this.t('learnDetail.codePineScriptTitle', 'Pine Script (TradingView)'),
        description: this.t(
          page.category === 'signal'
            ? 'learnDetail.codePineScriptIndicatorDescription'
            : 'learnDetail.codePineScriptStrategyDescription',
          page.category === 'signal'
            ? 'This is a TradingView Pine Script example for this indicator. Paste it into the TradingView Pine Editor, add it to your chart, and adjust inputs for your market and timeframe.'
            : 'This is a TradingView Pine Script strategy example for this page concept. Paste it into the TradingView Pine Editor, add it to your chart, and run it in the Strategy Tester.'
        ),
        code: pineCode,
      },
      {
        id: `${page.slug}-thinkscript`,
        title: this.t('learnDetail.codeThinkScriptTitle', 'ThinkScript (thinkorswim)'),
        description: this.t(
          page.category === 'signal'
            ? 'learnDetail.codeThinkScriptIndicatorDescription'
            : 'learnDetail.codeThinkScriptStrategyDescription',
          page.category === 'signal'
            ? 'This is a thinkorswim ThinkScript example for this indicator. Open thinkorswim, create a custom study, paste the script, and apply it to your chart.'
            : 'This is a thinkorswim ThinkScript strategy example for this page concept. Open thinkorswim, create a custom strategy, paste the script, and apply it to your chart.'
        ),
        code: thinkCode,
      },
    ];
  }

  private codeProfileForPage(page: LearnData): string {
    const bySlug: Record<string, string> = {
      'moving-average-crossover': 'ma-crossover',
      'fair-value-gap': 'fvg',
      'smart-money-concepts': 'smc',
      'order-blocks': 'order-block',
      'liquidity-sweeps': 'liquidity-sweep',
      'breaker-blocks': 'breaker-block',
      'trend-following': 'trend-following',
      'mean-reversion': 'mean-reversion',
      'breakout-strategy': 'breakout',
      'scalping-strategy': 'price-action',
      'swing-trading': 'price-action',
      'fibonacci-retracement': 'structure',
      'ichimoku-strategy': 'ichimoku',
      'price-action-strategy': 'price-action',
      'grid-trading': 'grid',
      'dollar-cost-averaging': 'dca',
      'arbitrage-strategy': 'multi-factor',
      'ema-indicator': 'ema',
      'sma-indicator': 'sma',
      'rsi-indicator': 'rsi',
      'macd-indicator': 'macd',
      'stochastic-oscillator': 'stochastic',
      'bollinger-bands': 'bollinger',
      'vwap-indicator': 'vwap',
      'atr-indicator': 'atr',
      'adx-indicator': 'adx',
      'donchian-channel': 'donchian',
      'volume-analysis': 'volume',
      'cci-indicator': 'cci',
      'williams-percent-r': 'williams',
      'parabolic-sar': 'parabolic',
      'obv-indicator': 'obv',
      'pivot-points': 'pivot',
      'keltner-channels': 'keltner',
      'supertrend-indicator': 'supertrend',
      'mfi-indicator': 'mfi',
      'fibonacci-indicator': 'fibonacci',
      'supply-demand-zones': 'structure',
      'wyckoff-method': 'structure',
      'elliott-wave': 'structure',
      'position-trading': 'trend-following',
      'pairs-trading': 'mean-reversion',
      'momentum-trading': 'momentum',
      'range-trading': 'mean-reversion',
      'news-trading': 'price-action',
      'harmonic-patterns': 'price-action',
      'chart-patterns': 'price-action',
      'carry-trade': 'momentum',
      'gap-trading': 'volatility',
      'triple-screen-strategy': 'triple-screen',
      'chaikin-money-flow': 'chaikin',
      'awesome-oscillator': 'awesome',
      'alligator-indicator': 'alligator',
      'hull-moving-average': 'hma',
      'rate-of-change': 'roc',
      'aroon-indicator': 'aroon',
      'trix-indicator': 'trix',
      'elder-ray': 'elder',
      'detrended-price-oscillator': 'dpo',
      'linear-regression': 'linear-reg',
      'stochastic-rsi': 'stochrsi',
      'force-index': 'force',
      'ultimate-oscillator': 'ultimate',
      'vortex-indicator': 'vortex',
      'dmi-indicator': 'adx',
      'volatility-trading': 'volatility',
      'market-making-strategy': 'grid',
      'counter-trend-strategy': 'mean-reversion',
      'machine-learning-strategy': 'multi-factor',
      'rebalancing-strategy': 'mean-reversion',
    };

    const profile = bySlug[page.slug];
    if (!profile) {
      throw new Error(`Missing strategy code profile mapping for learn page slug: ${page.slug}`);
    }
    return profile;
  }

  private pineCodeForProfile(profile: string, title: string): string {
    const safeTitle = title.replace(/"/g, '\\"');
    switch (profile) {
      case 'rsi':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
rsiLen = input.int(14, "RSI Length")
oversold = input.int(30, "Oversold")
overbought = input.int(70, "Overbought")
r = ta.rsi(close, rsiLen)
longSignal = ta.crossover(r, oversold)
exitSignal = ta.crossunder(r, overbought)
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(r, "RSI", color=color.new(color.aqua, 0))`;
      case 'macd':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
fast = input.int(12, "Fast")
slow = input.int(26, "Slow")
sig = input.int(9, "Signal")
[macdLine, signalLine, _] = ta.macd(close, fast, slow, sig)
longSignal = ta.crossover(macdLine, signalLine)
shortSignal = ta.crossunder(macdLine, signalLine)
if longSignal
    strategy.entry("Long", strategy.long)
if shortSignal
    strategy.close("Long")
plot(macdLine, "MACD", color=color.teal)
plot(signalLine, "Signal", color=color.orange)`;
      case 'stochastic':
      case 'stochrsi':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
length = input.int(14, "Length")
smooth = input.int(3, "Smoothing")
k = ta.sma(ta.stoch(close, high, low, length), smooth)
d = ta.sma(k, smooth)
longSignal = ta.crossover(k, d) and k < 25
exitSignal = ta.crossunder(k, d) and k > 75
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(k, "K", color=color.aqua)
plot(d, "D", color=color.fuchsia)`;
      case 'bollinger':
      case 'mean-reversion':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
len = input.int(20, "BB Length")
mult = input.float(2.0, "Std Dev")
basis = ta.sma(close, len)
dev = ta.stdev(close, len) * mult
upper = basis + dev
lower = basis - dev
longSignal = close < lower
exitSignal = close > basis
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(upper, "Upper", color=color.orange)
plot(lower, "Lower", color=color.orange)`;
      case 'vwap':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
v = ta.vwap(close)
emaLen = input.int(20, "Trend EMA")
trend = ta.ema(close, emaLen)
longSignal = ta.crossover(close, v) and close > trend
exitSignal = ta.crossunder(close, v)
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(v, "VWAP", color=color.fuchsia)
plot(trend, "EMA", color=color.new(color.aqua, 0))`;
      case 'donchian':
      case 'breakout':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
len = input.int(20, "Breakout Length")
upper = ta.highest(high, len)
lower = ta.lowest(low, len)
longSignal = close > upper[1]
exitSignal = close < lower[1]
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(upper, "Upper", color=color.lime)
plot(lower, "Lower", color=color.red)`;
      case 'atr':
      case 'volatility':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
atrLen = input.int(14, "ATR Length")
atrMult = input.float(2.0, "ATR Mult")
emaLen = input.int(50, "Trend EMA")
ema = ta.ema(close, emaLen)
atr = ta.atr(atrLen)
longSignal = ta.crossover(close, ema)
stop = strategy.position_avg_price - atr * atrMult
if longSignal
    strategy.entry("Long", strategy.long)
strategy.exit("ATR Exit", "Long", stop=stop)
plot(ema, "EMA", color=color.new(color.orange, 0))`;
      case 'adx':
      case 'trend-following':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
adxLen = input.int(14, "ADX Length")
emaLen = input.int(100, "Trend EMA")
adx = ta.adx(adxLen)
ema = ta.ema(close, emaLen)
longSignal = close > ema and adx > 25
exitSignal = close < ema
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(ema, "EMA", color=color.orange)`;
      case 'fvg':
      case 'smc':
      case 'order-block':
      case 'liquidity-sweep':
      case 'breaker-block':
      case 'structure':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
emaFast = ta.ema(close, 20)
emaSlow = ta.ema(close, 50)
bullStructure = close > emaFast and emaFast > emaSlow
bearStructure = close < emaFast and emaFast < emaSlow
liquidityGrab = low < ta.lowest(low, 10)[1] and close > open
longSignal = bullStructure and liquidityGrab
exitSignal = bearStructure
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(emaFast, "Fast", color=color.aqua)
plot(emaSlow, "Slow", color=color.orange)`;
      case 'ichimoku':
        return `//@version=6
strategy("${safeTitle}", overlay=true)
conv = (ta.highest(high, 9) + ta.lowest(low, 9)) / 2
base = (ta.highest(high, 26) + ta.lowest(low, 26)) / 2
spanA = (conv + base) / 2
spanB = (ta.highest(high, 52) + ta.lowest(low, 52)) / 2
longSignal = close > math.max(spanA, spanB) and conv > base
exitSignal = close < base
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(conv, "Conversion", color=color.aqua)
plot(base, "Base", color=color.orange)`;
    case 'volume':
    return `//@version=6
strategy("${safeTitle}", overlay=true)
obv = ta.obv(close, volume)
obvEma = ta.ema(obv, 21)
trend = ta.ema(close, 50)
longSignal = ta.crossover(obv, obvEma) and close > trend
exitSignal = ta.crossunder(obv, obvEma) or close < trend
if longSignal
  strategy.entry("Long", strategy.long)
if exitSignal
  strategy.close("Long")
plot(obv, "OBV", color=color.aqua)
plot(obvEma, "OBV EMA", color=color.orange)`;
    case 'fibonacci':
    return `//@version=6
strategy("${safeTitle}", overlay=true)
lookback = input.int(100, "Swing Lookback")
hi = ta.highest(high, lookback)
lo = ta.lowest(low, lookback)
range = hi - lo
fib50 = hi - range * 0.5
fib618 = hi - range * 0.618
trend = ta.ema(close, 55)
longSignal = close > trend and close < fib50 and close > fib618
exitSignal = close > hi or close < fib618
if longSignal
  strategy.entry("Long", strategy.long)
if exitSignal
  strategy.close("Long")
plot(fib50, "Fib 0.5", color=color.orange)
plot(fib618, "Fib 0.618", color=color.aqua)`;
      case 'grid':
      case 'dca':
      case 'price-action':
      case 'momentum':
      case 'triple-screen':
      case 'multi-factor':
      case 'ema':
      case 'sma':
      case 'cci':
      case 'williams':
      case 'parabolic':
      case 'obv':
      case 'pivot':
      case 'keltner':
      case 'supertrend':
      case 'mfi':
      case 'chaikin':
      case 'awesome':
      case 'alligator':
      case 'hma':
      case 'roc':
      case 'aroon':
      case 'trix':
      case 'elder':
      case 'dpo':
      case 'linear-reg':
      case 'force':
      case 'ultimate':
      case 'vortex':
      case 'ma-crossover':
      default:
        return `//@version=6
strategy("${safeTitle}", overlay=true)
fastLen = input.int(20, "Fast Length")
slowLen = input.int(50, "Slow Length")
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
longSignal = ta.crossover(fast, slow)
exitSignal = ta.crossunder(fast, slow)
if longSignal
    strategy.entry("Long", strategy.long)
if exitSignal
    strategy.close("Long")
plot(fast, "Fast", color=color.aqua)
plot(slow, "Slow", color=color.orange)`;
    }
  }

  private thinkCodeForProfile(profile: string, title: string): string {
    const safeTitle = title.replace(/"/g, '\\"');
    switch (profile) {
      case 'ma-crossover':
      case 'price-action':
        return `input fastLength = 20;
input slowLength = 50;
def fastMA = ExpAverage(close, fastLength);
def slowMA = ExpAverage(close, slowLength);
def buySignal = fastMA crosses above slowMA;
def sellSignal = fastMA crosses below slowMA;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "${safeTitle} Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "${safeTitle} Exit");
plot FastLine = fastMA;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slowMA;
SlowLine.SetDefaultColor(Color.ORANGE);`;
      case 'rsi':
        return `input length = 14;
def r = RSI(length = length);
def buySignal = r crosses above 30;
def sellSignal = r crosses below 70;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "RSI Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "RSI Exit");
plot RSI_Line = r;
RSI_Line.SetDefaultColor(Color.CYAN);`;
      case 'macd':
        return `def macd = MACD()."Value";
def signal = MACD()."Avg";
def buySignal = macd crosses above signal;
def sellSignal = macd crosses below signal;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "MACD Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "MACD Exit");
plot MacdLine = macd;
MacdLine.SetDefaultColor(Color.CYAN);
plot SignalLine = signal;
SignalLine.SetDefaultColor(Color.ORANGE);`;
      case 'stochastic':
      case 'stochrsi':
        return `def k = StochasticFull()."FullK";
def d = StochasticFull()."FullD";
def buySignal = k crosses above d and k < 25;
def sellSignal = k crosses below d and k > 75;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Stoch Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Stoch Exit");
plot KLine = k;
KLine.SetDefaultColor(Color.CYAN);
plot DLine = d;
DLine.SetDefaultColor(Color.MAGENTA);`;
      case 'bollinger':
      case 'mean-reversion':
        return `input length = 20;
input numDev = 2.0;
def mid = Average(close, length);
def up = mid + numDev * StDev(close, length);
def dn = mid - numDev * StDev(close, length);
def buySignal = close < dn;
def sellSignal = close > mid;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "MR Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "MR Exit");
plot Upper = up;
plot Lower = dn;`;
      case 'donchian':
      case 'breakout':
        return `input length = 20;
def upper = Highest(high, length);
def lower = Lowest(low, length);
def buySignal = close > upper[1];
def sellSignal = close < lower[1];
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Breakout Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Breakout Exit");
plot UpperBand = upper;
plot LowerBand = lower;`;
      case 'adx':
      case 'trend-following':
        return `input adxLength = 14;
input emaLength = 100;
def adxVal = ADX(adxLength);
def emaVal = ExpAverage(close, emaLength);
def buySignal = close > emaVal and adxVal > 25;
def sellSignal = close < emaVal;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Trend Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Trend Exit");
plot EMA = emaVal;
EMA.SetDefaultColor(Color.ORANGE);`;
      case 'fvg':
      case 'smc':
      case 'order-block':
      case 'liquidity-sweep':
      case 'breaker-block':
      case 'structure':
        return `def fast = ExpAverage(close, 20);
def slow = ExpAverage(close, 50);
def liquidityGrab = low < Lowest(low, 10)[1] and close > open;
def buySignal = close > fast and fast > slow and liquidityGrab;
def sellSignal = close < fast;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "SMC Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "SMC Exit");
plot FastLine = fast;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slow;
SlowLine.SetDefaultColor(Color.ORANGE);`;
      case 'ichimoku':
        return `def conv = (Highest(high, 9) + Lowest(low, 9)) / 2;
def base = (Highest(high, 26) + Lowest(low, 26)) / 2;
def spanA = (conv + base) / 2;
def spanB = (Highest(high, 52) + Lowest(low, 52)) / 2;
def buySignal = close > Max(spanA, spanB) and conv > base;
def sellSignal = close < base;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Ichimoku Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Ichimoku Exit");
plot Conversion = conv;
Conversion.SetDefaultColor(Color.CYAN);
plot BaseLine = base;
BaseLine.SetDefaultColor(Color.ORANGE);`;
      case 'vwap':
        return `def vwapVal = VWAP();
def trend = ExpAverage(close, 20);
def buySignal = close crosses above vwapVal and close > trend;
def sellSignal = close crosses below vwapVal;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "VWAP Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "VWAP Exit");
plot VWAPLine = vwapVal;
VWAPLine.SetDefaultColor(Color.MAGENTA);
plot Trend = trend;
Trend.SetDefaultColor(Color.CYAN);`;
      case 'atr':
      case 'volatility':
        return `input atrLength = 14;
input emaLength = 50;
def atrVal = ATR(atrLength);
def emaVal = ExpAverage(close, emaLength);
def buySignal = close crosses above emaVal;
def sellSignal = close < emaVal - (2 * atrVal);
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "ATR Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "ATR Exit");
plot EMA = emaVal;
EMA.SetDefaultColor(Color.ORANGE);`;
      case 'ema':
        return `input fastLength = 12;
input slowLength = 26;
def fastEMA = ExpAverage(close, fastLength);
def slowEMA = ExpAverage(close, slowLength);
def buySignal = fastEMA crosses above slowEMA;
def sellSignal = fastEMA crosses below slowEMA;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "EMA Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "EMA Exit");
plot FastLine = fastEMA;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slowEMA;
SlowLine.SetDefaultColor(Color.ORANGE);`;
      case 'sma':
        return `input fastLength = 20;
input slowLength = 50;
def fastSMA = Average(close, fastLength);
def slowSMA = Average(close, slowLength);
def buySignal = fastSMA crosses above slowSMA;
def sellSignal = fastSMA crosses below slowSMA;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "SMA Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "SMA Exit");
plot FastLine = fastSMA;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slowSMA;
SlowLine.SetDefaultColor(Color.ORANGE);`;
      case 'cci':
        return `input length = 20;
def cci = CCI(length = length);
def buySignal = cci crosses above -100;
def sellSignal = cci crosses below 100;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "CCI Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "CCI Exit");
plot CCI_Line = cci;
CCI_Line.SetDefaultColor(Color.CYAN);`;
      case 'williams':
        return `input length = 14;
def wpr = WilliamsPercentR(length = length);
def buySignal = wpr crosses above -80;
def sellSignal = wpr crosses below -20;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "WPR Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "WPR Exit");
plot WPR = wpr;
WPR.SetDefaultColor(Color.CYAN);`;
      case 'parabolic':
        return `def sar = ParabolicSAR();
def buySignal = close crosses above sar;
def sellSignal = close crosses below sar;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "SAR Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "SAR Exit");
plot SARLine = sar;
SARLine.SetDefaultColor(Color.ORANGE);`;
      case 'obv':
      case 'volume':
        return `def obv = OnBalanceVolume();
def obvAvg = ExpAverage(obv, 21);
def trend = ExpAverage(close, 50);
def buySignal = obv crosses above obvAvg and close > trend;
def sellSignal = obv crosses below obvAvg or close < trend;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Volume Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Volume Exit");
plot OBVLine = obv;
OBVLine.SetDefaultColor(Color.CYAN);
plot OBVAvg = obvAvg;
OBVAvg.SetDefaultColor(Color.ORANGE);`;
      case 'pivot':
        return `def pivot = (high[1] + low[1] + close[1]) / 3;
def buySignal = close crosses above pivot;
def sellSignal = close crosses below pivot;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Pivot Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Pivot Exit");
plot PivotLine = pivot;
PivotLine.SetDefaultColor(Color.YELLOW);`;
      case 'keltner':
        return `input length = 20;
input atrMult = 1.5;
def mid = ExpAverage(close, length);
def atrVal = ATR(length);
def upper = mid + atrMult * atrVal;
def lower = mid - atrMult * atrVal;
def buySignal = close crosses above upper;
def sellSignal = close crosses below mid;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Keltner Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Keltner Exit");
plot Mid = mid;
Mid.SetDefaultColor(Color.CYAN);
plot Upper = upper;
Upper.SetDefaultColor(Color.GREEN);
plot Lower = lower;
Lower.SetDefaultColor(Color.RED);`;
      case 'supertrend':
        return `input atrLength = 10;
input multiplier = 3.0;
def atrVal = ATR(atrLength);
def basis = (high + low) / 2;
def upper = basis + multiplier * atrVal;
def lower = basis - multiplier * atrVal;
def buySignal = close crosses above upper;
def sellSignal = close crosses below lower;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Supertrend Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Supertrend Exit");
plot UpperBand = upper;
UpperBand.SetDefaultColor(Color.GREEN);
plot LowerBand = lower;
LowerBand.SetDefaultColor(Color.RED);`;
      case 'mfi':
        return `input length = 14;
def mfi = MoneyFlowIndex(length = length);
def buySignal = mfi crosses above 20;
def sellSignal = mfi crosses below 80;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "MFI Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "MFI Exit");
plot MFI_Line = mfi;
MFI_Line.SetDefaultColor(Color.CYAN);`;
      case 'momentum':
        return `input length = 10;
def mom = Momentum(length = length);
def trend = ExpAverage(close, 50);
def buySignal = mom > 0 and close > trend;
def sellSignal = mom < 0 or close < trend;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Momentum Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Momentum Exit");
plot Mom = mom;
Mom.SetDefaultColor(Color.CYAN);`;
      case 'triple-screen':
      case 'multi-factor':
      case 'grid':
      case 'dca':
        return `def fast = ExpAverage(close, 13);
def slow = ExpAverage(close, 34);
def rsi = RSI(length = 14);
def buySignal = fast > slow and rsi < 65;
def sellSignal = fast < slow or rsi > 75;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "System Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "System Exit");
plot FastLine = fast;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slow;
SlowLine.SetDefaultColor(Color.ORANGE);`;
      case 'chaikin':
        return `def cmf = ChaikinMoneyFlow(length = 20);
def buySignal = cmf crosses above 0;
def sellSignal = cmf crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "CMF Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "CMF Exit");
plot CMFLine = cmf;
CMFLine.SetDefaultColor(Color.CYAN);`;
      case 'awesome':
        return `def ao = AwesomeOscillator();
def buySignal = ao crosses above 0;
def sellSignal = ao crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "AO Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "AO Exit");
plot AO = ao;
AO.SetDefaultColor(Color.CYAN);`;
      case 'alligator':
        return `def jaw = SmoothedAverage(close, 13);
def teeth = SmoothedAverage(close, 8);
def lips = SmoothedAverage(close, 5);
def buySignal = lips > teeth and teeth > jaw;
def sellSignal = lips < teeth;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Alligator Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Alligator Exit");
plot Jaw = jaw;
Jaw.SetDefaultColor(Color.BLUE);
plot Teeth = teeth;
Teeth.SetDefaultColor(Color.RED);
plot Lips = lips;
Lips.SetDefaultColor(Color.GREEN);`;
      case 'hma':
        return `input length = 21;
def hma = HullMovingAvg(close, length);
def buySignal = close crosses above hma;
def sellSignal = close crosses below hma;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "HMA Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "HMA Exit");
plot HMA_Line = hma;
HMA_Line.SetDefaultColor(Color.CYAN);`;
      case 'roc':
        return `input length = 12;
def roc = RateOfChange(length = length);
def buySignal = roc crosses above 0;
def sellSignal = roc crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "ROC Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "ROC Exit");
plot ROCLine = roc;
ROCLine.SetDefaultColor(Color.CYAN);`;
      case 'aroon':
        return `input length = 14;
def up = AroonUp(length = length);
def down = AroonDown(length = length);
def buySignal = up crosses above down;
def sellSignal = down crosses above up;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Aroon Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Aroon Exit");
plot AroonUpLine = up;
AroonUpLine.SetDefaultColor(Color.GREEN);
plot AroonDownLine = down;
AroonDownLine.SetDefaultColor(Color.RED);`;
      case 'trix':
        return `input length = 15;
def trix = TRIX(length = length);
def buySignal = trix crosses above 0;
def sellSignal = trix crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "TRIX Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "TRIX Exit");
plot TRIXLine = trix;
TRIXLine.SetDefaultColor(Color.CYAN);`;
      case 'elder':
        return `input length = 13;
def emaVal = ExpAverage(close, length);
def bullPower = high - emaVal;
def bearPower = low - emaVal;
def buySignal = bullPower > 0 and bearPower > bearPower[1];
def sellSignal = bearPower < 0 and bullPower < bullPower[1];
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Elder Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Elder Exit");
plot Bull = bullPower;
Bull.SetDefaultColor(Color.GREEN);
plot Bear = bearPower;
Bear.SetDefaultColor(Color.RED);`;
      case 'dpo':
        return `input length = 20;
def dpo = DetrendedPriceOsc(length = length);
def buySignal = dpo crosses above 0;
def sellSignal = dpo crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "DPO Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "DPO Exit");
plot DPO_Line = dpo;
DPO_Line.SetDefaultColor(Color.CYAN);`;
      case 'linear-reg':
        return `input length = 50;
def lr = Inertia(close, length);
def buySignal = close crosses above lr;
def sellSignal = close crosses below lr;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "LR Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "LR Exit");
plot LRLine = lr;
LRLine.SetDefaultColor(Color.ORANGE);`;
      case 'force':
        return `input length = 13;
def fi = ForceIndex(length = length);
def buySignal = fi crosses above 0;
def sellSignal = fi crosses below 0;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "FI Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "FI Exit");
plot ForceLine = fi;
ForceLine.SetDefaultColor(Color.CYAN);`;
      case 'ultimate':
        return `def ult = UltimateOscillator();
def buySignal = ult crosses above 30;
def sellSignal = ult crosses below 70;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Ultimate Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Ultimate Exit");
plot UltimateLine = ult;
UltimateLine.SetDefaultColor(Color.CYAN);`;
      case 'vortex':
        return `input length = 14;
def viPlus = Vortex(length = length)."VI+";
def viMinus = Vortex(length = length)."VI-";
def buySignal = viPlus crosses above viMinus;
def sellSignal = viMinus crosses above viPlus;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Vortex Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Vortex Exit");
plot VIPlus = viPlus;
VIPlus.SetDefaultColor(Color.GREEN);
plot VIMinus = viMinus;
VIMinus.SetDefaultColor(Color.RED);`;
      case 'fibonacci':
        return `input lookback = 100;
def hi = Highest(high, lookback);
def lo = Lowest(low, lookback);
def range = hi - lo;
def fib50 = hi - range * 0.5;
def fib618 = hi - range * 0.618;
def trend = ExpAverage(close, 55);
def buySignal = close > trend and close < fib50 and close > fib618;
def sellSignal = close > hi or close < fib618;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "Fibonacci Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "Fibonacci Exit");
plot Fib50 = fib50;
Fib50.SetDefaultColor(Color.ORANGE);
plot Fib618 = fib618;
Fib618.SetDefaultColor(Color.CYAN);`;
      default:
        return `input fastLength = 20;
input slowLength = 50;
def fastMA = ExpAverage(close, fastLength);
def slowMA = ExpAverage(close, slowLength);
def buySignal = fastMA crosses above slowMA;
def sellSignal = fastMA crosses below slowMA;
AddOrder(OrderType.BUY_AUTO, buySignal, close, 1, Color.GREEN, Color.GREEN, "${title} Buy");
AddOrder(OrderType.SELL_AUTO, sellSignal, close, 1, Color.RED, Color.RED, "${title} Exit");
plot FastLine = fastMA;
FastLine.SetDefaultColor(Color.CYAN);
plot SlowLine = slowMA;
SlowLine.SetDefaultColor(Color.ORANGE);`;
    }
  }

  private copyWithTextarea(text: string): boolean {
    const textarea = this.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    this.document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = this.document.execCommand('copy');
    this.document.body.removeChild(textarea);
    return copied;
  }

  isCodeUnlocked(): boolean {
    return this.codeAccessStep === 'unlocked';
  }

  previewCode(example: LearnCodeExample): string {
    if (this.isCodeUnlocked()) {
      return example.code;
    }
    return example.code.split('\n').slice(0, this.codePreviewLines).join('\n');
  }

  hiddenCode(example: LearnCodeExample): string {
    return example.code.split('\n').slice(this.codePreviewLines).join('\n');
  }

  shouldShowBlurGate(example: LearnCodeExample): boolean {
    return !this.isCodeUnlocked() && Boolean(this.hiddenCode(example));
  }

  async requestCodeAccess(): Promise<void> {
    if (this.codeAccessBusy) {
      return;
    }

    this.codeAccessError = '';
    this.codeAccessNotice = '';

    const name = this.codeAccessName.trim();
    const email = this.codeAccessEmail.trim().toLowerCase();

    this.codeAccessNameTouched = true;
    this.codeAccessEmailTouched = true;
    this.runCodeAccessFieldValidation();

    if (this.codeAccessNameFieldError || this.codeAccessEmailFieldError) {
      return;
    }

    this.codeAccessBusy = true;
    try {
      const response = await fetch('/api/requestLearnCodeAccess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: this.currentSlug,
          name,
          email,
        }),
      });

      const payload = await this.readApiResponse(response);
      if (!response.ok) {
        this.codeAccessError = payload['error'] || this.t('learnDetail.codeAccessSendFailed', 'Could not send the code right now. Please try again.');
        return;
      }

      this.codeAccessEmail = email;
      this.codeAccessStep = 'verify';
      this.codeAccessNotice = this.t('learnDetail.codeAccessCodeSent', 'Code sent. Please check your inbox and enter it below.');
    } catch {
      this.codeAccessError = this.t('learnDetail.codeAccessSendFailed', 'Could not send the code right now. Please try again.');
    } finally {
      this.codeAccessBusy = false;
    }
  }

  async verifyCodeAccess(): Promise<void> {
    if (this.codeAccessBusy) {
      return;
    }

    this.codeAccessError = '';
    this.codeAccessNotice = '';

    const code = this.codeAccessVerificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      this.codeAccessError = this.t('learnDetail.codeAccessCodeInvalid', 'Please enter the 6-digit verification code.');
      return;
    }

    this.codeAccessBusy = true;
    try {
      const response = await fetch('/api/verifyLearnCodeAccess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: this.currentSlug,
          email: this.codeAccessEmail,
          code,
        }),
      });

      const payload = await this.readApiResponse(response);
      if (!response.ok) {
        this.codeAccessError = payload['error'] || this.t('learnDetail.codeAccessVerifyFailed', 'Could not verify your code. Please try again.');
        return;
      }

      this.codeAccessStep = 'unlocked';
      this.codeAccessNotice = this.t('learnDetail.codeAccessThankYou', 'Thank you. You now have full code access.');
      this.codeAccessVerificationCode = '';
    } catch {
      this.codeAccessError = this.t('learnDetail.codeAccessVerifyFailed', 'Could not verify your code. Please try again.');
    } finally {
      this.codeAccessBusy = false;
    }
  }

  backToCodeAccessForm(): void {
    if (this.codeAccessBusy) {
      return;
    }
    this.codeAccessStep = 'collect';
    this.codeAccessError = '';
    this.codeAccessNotice = '';
  }

  onCodeAccessEmailInput(value: string): void {
    this.codeAccessEmail = value;
    if (this.codeAccessEmailTouched) {
      this.runCodeAccessFieldValidation();
    }
  }

  onCodeAccessNameInput(value: string): void {
    this.codeAccessName = value;
    if (this.codeAccessNameTouched) {
      this.runCodeAccessFieldValidation();
    }
  }

  onCodeAccessEmailBlur(): void {
    this.codeAccessEmailTouched = true;
    this.runCodeAccessFieldValidation();
  }

  onCodeAccessNameBlur(): void {
    this.codeAccessNameTouched = true;
    this.runCodeAccessFieldValidation();
  }

  private resetCodeAccessState(): void {
    this.codeAccessStep = 'collect';
    this.codeAccessName = '';
    this.codeAccessEmail = '';
    this.codeAccessVerificationCode = '';
    this.codeAccessNameTouched = false;
    this.codeAccessEmailTouched = false;
    this.codeAccessNameFieldError = '';
    this.codeAccessEmailFieldError = '';
    this.codeAccessBusy = false;
    this.codeAccessError = '';
    this.codeAccessNotice = '';
  }

  private runCodeAccessFieldValidation(): void {
    const name = this.codeAccessName.trim();
    const email = this.codeAccessEmail.trim().toLowerCase();

    this.codeAccessNameFieldError = '';
    this.codeAccessEmailFieldError = '';

    if (this.codeAccessNameTouched) {
      if (!name) {
        this.codeAccessNameFieldError = this.t('learnDetail.codeAccessNameRequired', 'Please enter your name.');
      } else if (!this.isValidName(name)) {
        this.codeAccessNameFieldError = this.t('learnDetail.codeAccessNameInvalid', 'Please enter a valid name (2-100 characters).');
      }
    }

    if (this.codeAccessEmailTouched && !this.isValidEmail(email)) {
      this.codeAccessEmailFieldError = this.t('learnDetail.codeAccessEmailInvalid', 'Please enter a valid email address.');
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) {
      return false;
    }
    return /^[\p{L}\p{N} .,'-]+$/u.test(name);
  }

  private async readApiResponse(response: Response): Promise<{ [key: string]: any }> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
}
