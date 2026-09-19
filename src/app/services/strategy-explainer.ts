/**
 * Plain-English explainers for each strategy template, plus the illustrative
 * price series the signup page charts.
 *
 * Why this lives outside `strategy.service.ts`: the templates there describe a
 * strategy to someone who already trades ("9/21 EMA crossover", "ADX > 25").
 * Everything here is aimed at a visitor who has just clicked a strategy link and
 * may not know what an EMA is, so each entry defines the jargon before using it.
 *
 * The price series are fabricated, but the marker positions are not hand-placed:
 * they were derived by running the strategy's real rule over the series (see
 * `scripts/generate-strategy-charts.mjs`), so a buy marker really does sit on the
 * bar where the crossover, band touch or threshold fires. Overlay lines are
 * recomputed from `prices` at render time for the same reason — the lines drawn
 * are always the true indicator for the prices shown.
 */

/** An indicator line the chart computes from `prices` and draws over them. */
export interface ChartOverlay {
  kind: 'ema' | 'sma' | 'vwap' | 'bollinger';
  /** Lookback in bars. Ignored by `vwap`, which is cumulative over the session. */
  period: number;
  label: string;
  /** Categorical colour slot — 1 and 2 are the only validated pair. */
  slot: 1 | 2;
}

/** A horizontal reference price (range high, grid rung, option strike, ...). */
export interface ChartLevel {
  value: number;
  label: string;
}

/** A point where the strategy's rule fires. */
export interface ChartMarker {
  index: number;
  kind: 'entry' | 'exit';
}

export interface StrategyChartSpec {
  prices: number[];
  markers: ChartMarker[];
  overlays?: ChartOverlay[];
  levels?: ChartLevel[];
  /** One sentence under the chart saying what to look at. */
  caption: string;
}

export interface StrategyExplainer {
  /** Heading for the jargon block, e.g. "What is an EMA?". */
  question: string;
  /** The answer, written for someone who has never traded. */
  plain: string;
  /** What makes the bot open a position. */
  entry: string;
  /** What makes it close one. */
  exit: string;
  chart: StrategyChartSpec;
}

export const STRATEGY_EXPLAINERS: Record<string, StrategyExplainer> = {
  'ema-crossover': {
    question: 'What is an EMA?',
    plain:
      'A moving average is the average price over the last N bars, redrawn on every new bar — it smooths out the jitter so the underlying direction is visible. An exponential moving average weights recent bars more heavily than older ones, so it turns sooner than a plain average. The 9-period EMA follows the last few hours closely; the 21-period EMA is slower and reflects the last day or so.',
    entry:
      'The 9 EMA crosses above the 21 EMA. Recent prices have pulled ahead of the longer average, which is what the start of an uptrend looks like — traders call it a golden cross.',
    exit:
      'The 9 EMA drops back below the 21 EMA (a death cross). The fast average has given up its lead, so the bot closes the position rather than sitting through the reversal.',
    chart: {
      prices: [112.4, 109.9, 108.7, 106, 103.7, 102.3, 101.3, 100.3, 97.8, 97.2, 96.8, 95, 95.5, 94.2, 94.7, 94.7, 93.3, 95.4, 96.9, 99.5, 101.5, 103, 104, 107.8, 111.7, 115.2, 118.8, 121.8, 124.4, 128.5, 131.2, 133.2, 135.1, 137.8, 141, 143.2, 143.1, 142.9, 143.1, 144.5, 143, 140.6, 138.5, 135.8, 134.7, 132.2, 129, 126.4, 125, 122.4, 121.7, 120.1, 118.8, 117.4, 114.8, 111.4],
      markers: [{ index: 23, kind: 'entry' }, { index: 49, kind: 'exit' }],
      overlays: [{ kind: 'ema', period: 9, label: '9 EMA (fast)', slot: 1 }, { kind: 'ema', period: 21, label: '21 EMA (slow)', slot: 2 }],
      caption:
        'Both EMAs drawn over the same price. The bot buys where the fast line crosses above the slow one and sells where it crosses back under.',
    },
  },
  'macd-trend': {
    question: 'What is MACD?',
    plain:
      'MACD measures the gap between a fast 12-period and a slow 26-period moving average. A widening gap means momentum is building; a narrowing one means it is fading. A 9-period average of the MACD itself — the signal line — is what the crossover is measured against.',
    entry:
      'MACD crosses above its signal line while ADX is above 25, which filters out choppy markets where the crossover means nothing.',
    exit:
      'MACD falls back through its signal line, or the histogram shrinks while price keeps climbing — a divergence that usually precedes a turn.',
    chart: {
      prices: [57.3, 56.8, 55.7, 54.8, 54.5, 54.5, 54.3, 53.8, 53.4, 53.5, 53.3, 52.8, 53.4, 54.1, 55, 56.7, 57.5, 58.6, 60.8, 63.2, 65, 66.9, 69.2, 71.4, 72.6, 75.3, 77.3, 79.7, 81.9, 82.3, 84.1, 85.8, 87.1, 88.5, 89.3, 90.4, 90.5, 90.8, 91.8, 92.2, 90.2, 89.5, 89.1, 88.2, 87.3, 85.6, 84.2, 82.1, 81.5, 80, 79.2, 77.6, 76.9, 76.6, 75.5, 75.3],
      markers: [{ index: 15, kind: 'entry' }, { index: 41, kind: 'exit' }],
      overlays: [{ kind: 'ema', period: 12, label: '12 EMA (fast)', slot: 1 }, { kind: 'ema', period: 26, label: '26 EMA (slow)', slot: 2 }],
      caption:
        'The two moving averages MACD is built from. The buy fires where MACD crosses above its signal line, the sell where it crosses back under.',
    },
  },
  'supertrend': {
    question: 'What is ATR, and what is a Supertrend?',
    plain:
      'ATR (Average True Range) measures how far an asset typically travels in one bar — its normal amount of movement. Supertrend uses that to draw a line trailing the price by a multiple of ATR, far enough away that ordinary noise does not reach it. When price does cross the line, the line flips to the other side and the trend is considered turned.',
    entry:
      'Supertrend flips to below price — the move has cleared the noise band, with volume confirming.',
    exit:
      'Supertrend flips back above price. Because the band is ATR-based, a quiet market needs only a small move to trigger this and a volatile one needs a large move.',
    chart: {
      prices: [26.7, 26.6, 26.4, 25.7, 25.3, 24.8, 24.6, 24.3, 24.1, 23.8, 23.3, 23.4, 24, 24.3, 24.9, 25.1, 25.7, 26.1, 27.3, 27.9, 28.7, 29.1, 30.1, 30.5, 31.2, 31.2, 31.7, 31.8, 31.9, 31.7, 31.5, 30.9, 30.4, 30.1, 29.5, 29.2, 28.5, 28.4, 28.2, 28.5, 28.8, 29.6, 30.3, 31, 31.1, 31.9, 32.3, 32.4, 32.7, 33.4, 33.2, 33.4, 32.5, 32.5, 32.1, 31.7],
      markers: [{ index: 14, kind: 'entry' }, { index: 32, kind: 'exit' }],
      caption:
        'Price with the two Supertrend flips marked. The band adapts to volatility, so the distance price must travel to flip it changes with the market.',
    },
  },
  'rsi-reversal': {
    question: 'What is RSI?',
    plain:
      'RSI (Relative Strength Index) scores momentum from 0 to 100 by comparing the size of recent gains against recent losses. Under 30 means sellers have dominated to the point where the move looks stretched (oversold); over 70 means the same in the other direction (overbought). It measures how one-sided the recent move has been — not where price will go next.',
    entry:
      'RSI drops under 30 and turns back up, with price near the lower Bollinger Band as confirmation.',
    exit:
      'RSI climbs back above 70, or price returns to the middle band. This is a range strategy — it fights the move, so it does badly in a strong trend.',
    chart: {
      prices: [88, 86.8, 85.9, 85.2, 85.1, 86.5, 84.5, 85.3, 83.5, 82.4, 81.6, 82.1, 82.4, 83.1, 84.7, 84.6, 84.2, 84, 84, 82.2, 80.5, 80, 78, 78.6, 77.6, 77.2, 76.1, 73.8, 73.9, 74.2, 73.5, 72.4, 72.1, 72.2, 73, 74.5, 74.7, 75.5, 75.6, 77.1, 78.7, 79.1, 79.2, 80.7, 83.2, 84.8, 85.5, 85.4, 85.6, 86.6, 87, 88, 87.7, 87.9, 87.1, 84.8],
      markers: [{ index: 20, kind: 'entry' }, { index: 44, kind: 'exit' }],
      caption:
        'Price with both RSI signals marked: the buy at the oversold reading, the sell once momentum has swung to overbought.',
    },
  },
  'bollinger-bounce': {
    question: 'What are Bollinger Bands?',
    plain:
      'Bollinger Bands are a 20-period average with a line drawn two standard deviations above and below it. Because standard deviation is a measure of how much price has been moving, the bands widen in volatile markets and tighten in calm ones. Price spends most of its time between them, so a touch of an outer band is an unusually stretched move.',
    entry:
      'Price touches the lower band — stretched far enough below its own average to be worth fading.',
    exit:
      'Price returns to the middle band (the 20-period average) it was stretched away from. The middle band is the target, not the opposite band.',
    chart: {
      prices: [45, 44.7, 44.7, 44.8, 45.3, 47.1, 45.8, 46.5, 45.1, 44.2, 43.6, 44.1, 44.2, 44.7, 45.9, 45.8, 45.4, 45.2, 45.1, 43.7, 42.3, 41.8, 40.2, 42, 42.5, 43.5, 43.8, 43.1, 44.4, 45.8, 46.1, 46.2, 47, 48.2, 47.7, 47.9, 46.8, 46.3, 45.3, 45.1, 44.9, 43.6, 42.1, 41.7, 42.2, 43.3, 43.7, 43.5, 43.5, 44.2, 44.6, 45.8, 45.9, 46.5, 46.3, 44.9],
      markers: [{ index: 22, kind: 'entry' }, { index: 28, kind: 'exit' }],
      overlays: [{ kind: 'bollinger', period: 20, label: 'Bollinger Band (20, 2σ)', slot: 2 }, { kind: 'sma', period: 20, label: '20 SMA (middle band)', slot: 1 }],
      caption:
        'The 20-period average with its ±2σ bands. The buy is the lower-band touch; the sell is the return to the middle.',
    },
  },
  'vwap-reversion': {
    question: 'What is VWAP?',
    plain:
      'VWAP (Volume-Weighted Average Price) is the average price paid so far in the session, weighted by how much volume traded at each price. Large institutions are measured against it when they fill orders, which makes it behave like a magnet: price that runs far from VWAP tends to get pulled back toward it.',
    entry:
      'Price dips more than about 1.5% below session VWAP while the session trend is still intact.',
    exit:
      'Price returns to VWAP. The trade is the gap closing, so the target is the line itself.',
    chart: {
      prices: [193.7, 195.7, 195, 196, 193.3, 193.4, 193.1, 192.6, 190, 188.3, 190, 190.8, 191.7, 192.1, 195.1, 192.7, 193.4, 191.2, 191.6, 191.7, 188.4, 190.2, 187.6, 189.8, 187.5, 186.8, 186.2, 189.3, 188, 187.9, 190.8, 195.1, 197.1, 198.2, 194, 192.5, 190.8, 192.5, 191.5, 190.1, 194, 192.7, 195.3, 197.8, 198.7, 199.9, 197.2, 197.9, 196.8, 195.7, 194.6, 193, 195.2, 195.9, 198.1, 199.8],
      markers: [{ index: 20, kind: 'entry' }, { index: 31, kind: 'exit' }],
      overlays: [{ kind: 'vwap', period: 0, label: 'Session VWAP', slot: 1 }],
      caption:
        'Session VWAP against price. The bot buys the stretch below the line and sells when price comes back to it.',
    },
  },
  'breakout': {
    question: 'What is a breakout?',
    plain:
      'A consolidation range is a stretch where price keeps bouncing between the same high and low. The high acts as resistance and the low as support. A breakout is a close outside that range — and volume is what separates a real one from a false one, because it takes genuine size to push price out rather than a thin drift that snaps straight back.',
    entry:
      'Price closes above the range high on a volume surge, not merely wicks through it.',
    exit:
      'A target set at twice the distance to the stop (2:1 reward-to-risk), with the stop one ATR below the breakout level.',
    chart: {
      prices: [64.1, 64.1, 65.1, 65.1, 65.8, 65.5, 65.6, 65.1, 64.7, 64, 63.3, 63.1, 63.9, 64.1, 64.4, 65.4, 65.3, 65, 64.6, 64.6, 64.3, 63.6, 63, 64.5, 64.9, 65.7, 65.4, 65.5, 66.3, 66.3, 64.9, 64.6, 64.5, 64.2, 64.4, 65, 65.5, 65.2, 65.5, 66.6, 68, 69.5, 70, 70.8, 72.3, 73.6, 74.5, 74.7, 75.5, 77.1, 77.2, 76.8, 76.6, 76.4, 76.1, 75.7],
      markers: [{ index: 39, kind: 'entry' }, { index: 45, kind: 'exit' }],
      levels: [{ value: 66.3, label: 'Range high (resistance)' }, { value: 63, label: 'Range low (support)' }],
      caption:
        'The range the bot watched, then the break. Entry is the close above resistance; the exit is the 2:1 target.',
    },
  },
  'dca': {
    question: 'What is Dollar Cost Averaging?',
    plain:
      'Dollar Cost Averaging means buying a fixed amount of money\'s worth on a fixed schedule, whatever the price is that day. Because the same sum buys more units when price is low and fewer when it is high, your average cost per unit ends up below the plain average of the prices you paid. No forecasting is involved — the schedule does the work.',
    entry:
      'Every scheduled interval, here once a day. Optional RSI weighting buys a larger slice when RSI is low.',
    exit:
      'There is no timed exit — you sell when you decide to. The sell marked at the right of the chart is only there to close the example.',
    chart: {
      prices: [102.3, 100.3, 98.3, 97.5, 96, 94.1, 93.4, 91.5, 91.5, 89.7, 89.5, 87.3, 86.3, 86.4, 84.8, 84.6, 83.6, 83.9, 84.2, 84.6, 85, 84.8, 84.8, 86.4, 88.6, 88.9, 89.3, 91.1, 92.9, 94, 94.5, 95.5, 96.9, 99.5, 99.9, 101, 102.7, 104.3, 106.6, 107.1, 109, 108.9, 110.1, 111.8, 111.7, 112.5, 114.4, 115.1, 116.4, 116.4, 117.3, 119.9, 120.1, 122.2, 123.5, 125.2],
      markers: [{ index: 4, kind: 'entry' }, { index: 17, kind: 'entry' }, { index: 30, kind: 'entry' }, { index: 43, kind: 'entry' }, { index: 54, kind: 'exit' }],
      levels: [{ value: 95.55, label: 'Average cost per unit' }],
      caption:
        'Four scheduled buys through a dip. The same amount of money bought far more units at 83.90 than at 111.80, so the average cost lands at 95.55 — below the plain average of the four prices, 96.55.',
    },
  },
  'momentum-roc': {
    question: 'What is Rate of Change?',
    plain:
      'Rate of Change (ROC) is the plainest momentum measure there is: how far price has moved, in percent, over a fixed lookback — nine bars here. Positive means higher than nine bars ago, and the larger the number, the faster the market is moving. It says nothing about whether the move is justified, only how quick it is.',
    entry:
      'ROC pushes above its threshold of +8%, meaning the market is running rather than drifting.',
    exit:
      'ROC decelerates back through zero — price is no longer higher than it was nine bars ago, so the burst is over.',
    chart: {
      prices: [48.2, 48, 47.4, 46.9, 47.3, 47, 47.1, 47.2, 46.5, 47, 46.5, 46.9, 47.1, 47.2, 48, 48.1, 48.7, 49.1, 50.6, 51.8, 52.4, 53.5, 55.4, 56.6, 57.1, 58.9, 60.4, 61.9, 63.2, 64.6, 65.5, 66.6, 67.3, 67.8, 69.4, 70, 70.8, 71.6, 71.7, 72.6, 71.2, 70.7, 70.4, 70.1, 70.2, 69.9, 68.7, 68.3, 66.7, 65.8, 65.6, 65.4, 64.5, 63.9, 63.2, 63.8],
      markers: [{ index: 19, kind: 'entry' }, { index: 45, kind: 'exit' }],
      caption:
        'Price with both ROC signals marked: in while the nine-bar change is strongly positive, out once it turns negative.',
    },
  },
  'grid': {
    question: 'What is a trading grid?',
    plain:
      'A grid is a ladder of orders placed in advance at fixed price steps — a buy on every rung below the current price, a sell on every rung above. Each dip into a rung buys and each recovery to the rung above sells, harvesting the oscillation. It takes no view on direction; it only needs the market to keep moving inside the range.',
    entry:
      'Price falls to the 48.50 rung and the resting buy order fills.',
    exit:
      'Price rises to the 50.00 rung above and that lot is sold. The profit is the step, taken again on every swing.',
    chart: {
      prices: [50.4, 49.9, 49.2, 48.8, 47.7, 47, 46.8, 48.2, 49.3, 49.9, 50.8, 50.8, 50.1, 49.7, 48.7, 47.9, 46.7, 46.8, 47.1, 47.9, 48.7, 49.5, 50.4, 49.9, 49.4, 48.6, 47.8, 46.9, 47.4, 48, 48.9, 50, 50.7, 51.9, 50.6, 50.4, 49.6, 48.9, 48.2, 48.2, 48.5, 49, 49.7, 50.4, 50.4, 49.8, 49.1, 48.5, 48.3, 47.8, 47.2, 47.9, 48.5, 48.6, 49.1, 49.5],
      markers: [{ index: 4, kind: 'entry' }, { index: 10, kind: 'exit' }, { index: 15, kind: 'entry' }, { index: 22, kind: 'exit' }, { index: 26, kind: 'entry' }, { index: 31, kind: 'exit' }],
      levels: [{ value: 47, label: 'Grid 47.00' }, { value: 48.5, label: 'Grid 48.50' }, { value: 50, label: 'Grid 50.00' }, { value: 51.5, label: 'Grid 51.50' }],
      caption:
        'Three complete round trips inside the same range. Every buy is a rung touched on the way down, every sell the rung above it.',
    },
  },
  'scalping': {
    question: 'What is the spread, and what is order flow?',
    plain:
      'The spread is the gap between the best price a buyer will pay (the bid) and the lowest a seller will accept (the ask). Order flow is the running imbalance between the two sides. Scalping captures a few ticks at a time from short bursts of that imbalance, dozens of times a session — each trade is tiny, so the edge comes from repetition and from fees and latency staying very low.',
    entry:
      'A short dip against a bid that holds — an order-flow imbalance in your favour.',
    exit:
      'A few ticks of profit, or a time stop after a handful of bars if the move does not come. Positions are never carried.',
    chart: {
      prices: [99.91, 100.13, 100.11, 100.29, 100.27, 100.32, 100.38, 100.28, 100.21, 100.2, 100.24, 100.23, 100.2, 100.19, 100.4, 100.49, 100.42, 100.35, 100.3, 100.19, 100.21, 100.26, 100.18, 100.3, 100.38, 100.52, 100.64, 100.66, 100.55, 100.41, 100.45, 100.37, 100.42, 100.34, 100.42, 100.38, 100.52, 100.56, 100.68, 100.58, 100.62, 100.48, 100.43, 100.46, 100.47, 100.46, 100.51, 100.69, 100.71, 100.71, 100.8, 100.72, 100.69, 100.64, 100.6, 100.51],
      markers: [{ index: 7, kind: 'entry' }, { index: 11, kind: 'exit' }, { index: 12, kind: 'entry' }, { index: 14, kind: 'exit' }, { index: 17, kind: 'entry' }, { index: 21, kind: 'exit' }, { index: 22, kind: 'entry' }, { index: 23, kind: 'exit' }],
      caption:
        'Four round trips inside a price range under 1% wide. Note the scale: each trade is going for a fraction of a percent, which is why costs decide whether it works.',
    },
  },
  'triangular-arb': {
    question: 'What is triangular arbitrage?',
    plain:
      'Triangular arbitrage converts one coin into a second, the second into a third and the third back into the first, all on one exchange within seconds. If the three quoted rates are momentarily out of line with each other, the loop finishes with more than it started with. The line below tracks what one unit is worth after a full round trip: above 1.0000 there is an edge, below it the loop loses money.',
    entry:
      'The round trip prices above 1.0000 by more than the fees on all three legs — here a spike to 1.0008.',
    exit:
      'The three legs settle, normally within seconds. The gap closes as soon as other bots take the same trade, which is why speed is the whole strategy.',
    chart: {
      prices: [0.9993, 0.9993, 0.9994, 0.9996, 0.9997, 0.9995, 0.9994, 0.9996, 0.9999, 0.9999, 1, 1.0001, 0.9999, 1.0001, 0.9999, 0.9998, 0.9999, 0.9997, 0.9998, 0.9998, 0.9996, 0.9999, 0.9997, 1.0002, 1.0002, 1.0003, 1.0004, 1.0008, 1.0007, 1.0007, 1.0006, 1.0003, 0.9999, 0.9997, 0.9997, 0.9994, 0.9993, 0.9991, 0.9991, 0.9994, 0.9996, 0.9999, 1.0002, 1, 1.0001, 1, 1.0002, 1.0002, 0.9997, 0.9996, 0.9998, 0.9995, 0.9999, 1.0001, 0.9997, 0.9997],
      markers: [{ index: 27, kind: 'entry' }, { index: 29, kind: 'exit' }],
      levels: [{ value: 1, label: 'Break-even (1.0000)' }],
      caption:
        'Round-trip value of a BTC → ETH → BNB → BTC loop against the 1.0000 break-even line. The bot fires only on the spike above it and is out two bars later.',
    },
  },
  'covered-call': {
    question: 'What is a covered call?',
    plain:
      'A call option is a contract that lets someone buy your stock at a set price — the strike — before a set date. Selling one against stock you already own pays you a premium up front. If the stock stays below the strike the option expires worthless and you keep both the premium and your shares; if it rises above, your shares are sold at the strike and you keep the premium but give up the gain beyond it.',
    entry:
      'Each week a call is sold at a strike above the current price, collecting the premium immediately.',
    exit:
      'At expiry the contract closes. Below the strike it expires worthless and the whole premium is kept — which is the outcome this strategy is built around.',
    chart: {
      prices: [179.8, 180.5, 180.2, 181.5, 181.8, 183, 182.6, 182.7, 182.4, 181.5, 180.8, 181.4, 181.9, 182.1, 183.5, 184.4, 185.6, 186.2, 184.7, 183.1, 182.7, 183.1, 183.5, 183, 184.3, 185.8, 186.9, 186.3, 185.7, 185, 184.5, 185.8, 186.1, 185.1, 185.3, 185.9, 186.9, 187.5, 188.6, 187, 187.8, 186.2, 186, 187.1, 187.6, 188.1, 187.5, 186.8, 187.8, 188.4, 189.7, 188.4, 189, 187.5, 187.3, 187.1],
      markers: [{ index: 6, kind: 'entry' }, { index: 20, kind: 'exit' }, { index: 24, kind: 'entry' }, { index: 38, kind: 'exit' }],
      levels: [{ value: 195, label: 'Call strike ($195)' }],
      caption:
        'Two weekly cycles against a $195 strike. Price stayed under it both times, so both calls expired worthless and both premiums were kept.',
    },
  },
};
