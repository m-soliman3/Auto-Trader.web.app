"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.average = average;
exports.stdDev = stdDev;
exports.calculateEmaSeries = calculateEmaSeries;
exports.calculateRsiSeries = calculateRsiSeries;
exports.calculateAtrSeries = calculateAtrSeries;
exports.calculateVwap = calculateVwap;
exports.buildMarketContext = buildMarketContext;
function average(values) {
    if (!values.length)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function stdDev(values) {
    if (!values.length)
        return 0;
    const mean = average(values);
    return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}
function calculateEmaSeries(values, period) {
    if (!values.length)
        return [];
    const multiplier = 2 / (period + 1);
    const series = [values[0]];
    let previous = values[0];
    for (let i = 1; i < values.length; i++) {
        previous = (values[i] - previous) * multiplier + previous;
        series.push(previous);
    }
    return series;
}
function calculateRsiSeries(values, period = 14) {
    if (values.length < period + 1)
        return [];
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const delta = values[i] - values[i - 1];
        if (delta >= 0)
            gains += delta;
        else
            losses += Math.abs(delta);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const result = [100 - 100 / (1 + (avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss))];
    for (let i = period + 1; i < values.length; i++) {
        const delta = values[i] - values[i - 1];
        const gain = delta > 0 ? delta : 0;
        const loss = delta < 0 ? Math.abs(delta) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
    }
    return result;
}
function calculateAtrSeries(candles, period = 14) {
    if (candles.length < period + 1)
        return [];
    const trueRanges = [];
    for (let i = 0; i < candles.length; i++) {
        const current = candles[i];
        const previousClose = i > 0 ? candles[i - 1].close : current.close;
        const tr = Math.max(current.high - current.low, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose));
        trueRanges.push(tr);
    }
    const atr = [];
    let prevAtr = average(trueRanges.slice(0, period));
    atr.push(prevAtr);
    for (let i = period; i < trueRanges.length; i++) {
        prevAtr = (prevAtr * (period - 1) + trueRanges[i]) / period;
        atr.push(prevAtr);
    }
    return atr;
}
function calculateVwap(candles, period = 30) {
    if (!candles.length)
        return 0;
    const window = candles.slice(-period);
    let weighted = 0;
    let volumeSum = 0;
    for (const candle of window) {
        const typical = (candle.high + candle.low + candle.close) / 3;
        const volume = Number.isFinite(candle.volume) ? candle.volume : 0;
        weighted += typical * volume;
        volumeSum += volume;
    }
    if (volumeSum <= 0)
        return average(window.map((c) => c.close));
    return weighted / volumeSum;
}
function buildMarketContext(candles) {
    if (candles.length < 30)
        return null;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);
    const ema9 = calculateEmaSeries(closes, 9);
    const ema21 = calculateEmaSeries(closes, 21);
    const ema12 = calculateEmaSeries(closes, 12);
    const ema26 = calculateEmaSeries(closes, 26);
    if (ema9.length < 2 || ema21.length < 2 || ema12.length < 2 || ema26.length < 2)
        return null;
    const macdLine = ema12.map((value, index) => value - ema26[index]);
    const macdSignal = calculateEmaSeries(macdLine, 9);
    const rsiSeries = calculateRsiSeries(closes, 14);
    const atrSeries = calculateAtrSeries(candles, 14);
    const bbWindow = closes.slice(-20);
    const bbBasis = average(bbWindow);
    const bbSigma = stdDev(bbWindow);
    const current = closes[closes.length - 1];
    return {
        current,
        previous: closes[closes.length - 2],
        ema9Current: ema9[ema9.length - 1],
        ema9Previous: ema9[ema9.length - 2],
        ema21Current: ema21[ema21.length - 1],
        ema21Previous: ema21[ema21.length - 2],
        macdCurrent: macdLine[macdLine.length - 1],
        macdPrevious: macdLine[macdLine.length - 2],
        macdSignalCurrent: macdSignal[macdSignal.length - 1],
        macdSignalPrevious: macdSignal[macdSignal.length - 2],
        rsiCurrent: rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : 50,
        rsiPrevious: rsiSeries.length > 1 ? rsiSeries[rsiSeries.length - 2] : 50,
        bbUpper: bbBasis + bbSigma * 2,
        bbLower: bbBasis - bbSigma * 2,
        bbBasis,
        roc14: closes.length > 14 ? ((current - closes[closes.length - 15]) / closes[closes.length - 15]) * 100 : 0,
        vwap30: calculateVwap(candles, 30),
        atr14: atrSeries.length ? atrSeries[atrSeries.length - 1] : 0,
        priorHigh20: Math.max(...highs.slice(-21, -1)),
        priorLow20: Math.min(...lows.slice(-21, -1)),
        currentVolume: volumes[volumes.length - 1] || 0,
        volumeAverage: average(volumes.slice(-20)),
    };
}
