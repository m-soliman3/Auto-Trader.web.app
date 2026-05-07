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

  ngOnInit(): void {
    this.loadPage(this.route.snapshot.paramMap.get('slug') ?? '');
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.loadPage(p.get('slug') ?? ''));
  }

  private loadPage(slug: string): void {
    const data = LEARN_PAGES[slug];
    if (!data) {
      this.router.navigate(['/']);
      return;
    }
    this.page = data;
    this.document.title = data.metaTitle;

    // Set canonical and noindex: drive traffic to homepage instead of this page
    this.meta.updateTag({ name: 'description', content: data.metaDescription });
    // Canonical points to homepage so Google understands the authoritative page
    const canonicalHref = (this.document.location?.origin ?? '') + '/';
    let canonicalEl = this.document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = this.document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalHref);

    this.relatedPages = data.relatedSlugs
      .map(s => LEARN_PAGES[s])
      .filter(Boolean);

    this.allStrategies = Object.values(LEARN_PAGES)
      .filter(p => p.category === 'strategy' && p.slug !== slug);
    this.allSignals = Object.values(LEARN_PAGES)
      .filter(p => p.category === 'signal' && p.slug !== slug);

    this.overviewParagraphs = data.overview
      .split('\n\n')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => this.sanitizer.sanitize(SecurityContext.HTML, this.escapeHtml(p)) ?? '');

    const howHtml = this.sanitizer.sanitize(SecurityContext.HTML, this.escapeHtml(data.howItWorks)) ?? '';
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
}
