// Regenerates the `chart` blocks in `src/app/services/strategy-explainer.ts`.
//
// The price series are fabricated, but the entry/exit markers are not: each one
// is produced by running that strategy's real rule (EMA crossover, MACD signal
// cross, Bollinger band touch, RSI threshold, ATR flip, ...) over the generated
// series, so the markers on the chart sit on the bar where the rule actually
// fires. Re-run with `node scripts/generate-strategy-charts.mjs` and paste the
// output into the data file.

function makeRnd(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
/** Piecewise-linear base plus an AR(1) wiggle, so bands and oscillators really trigger. */
function shape(points, n, wiggle, rnd) {
  const out = []; let w = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (points.length - 1);
    const a = Math.floor(t), b = Math.min(a + 1, points.length - 1);
    const base = points[a] + (points[b] - points[a]) * (t - a);
    w = w * 0.55 + (rnd() - 0.5) * wiggle;
    out.push(base * (1 + w));
  }
  return out;
}
const ema = (v, p) => { const k = 2 / (p + 1); let e = v[0]; return v.map((x, i) => (e = i ? x * k + e * (1 - k) : x)); };
const sma = (v, p) => v.map((_, i) => { const s = v.slice(Math.max(0, i - p + 1), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
const sd = (v, p) => v.map((_, i) => { const s = v.slice(Math.max(0, i - p + 1), i + 1); const m = s.reduce((a, b) => a + b, 0) / s.length; return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / s.length); });
const vwap = v => { let s = 0; return v.map((x, i) => (s += x) / (i + 1)); };
function rsi(v, p = 14) {
  let g = 0, l = 0; const out = [50];
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p;
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return out;
}
const roc = (v, p) => v.map((x, i) => (i < p ? 0 : ((x - v[i - p]) / v[i - p]) * 100));
function cross(a, b, warm) {
  const out = [];
  for (let i = warm + 1; i < a.length; i++) {
    if (a[i - 1] <= b[i - 1] && a[i] > b[i]) out.push({ index: i, dir: 'up' });
    if (a[i - 1] >= b[i - 1] && a[i] < b[i]) out.push({ index: i, dir: 'down' });
  }
  return out;
}
const round = (v, d) => v.map(x => Math.round(x * 10 ** d) / 10 ** d);

const N = 56;
const out = {};
const push = (id, prices, markers, levels) => { out[id] = { prices, markers, levels: levels || null }; };

// 1. ema-crossover — EMA9 x EMA21
{ const p = round(shape([112, 101, 95, 94, 104, 124, 140, 146, 136, 122, 112], N, 0.022, makeRnd(11)), 1);
  const x = cross(ema(p, 9), ema(p, 21), 10).slice(0, 2);
  push('ema-crossover', p, x.map(c => ({ index: c.index, kind: c.dir === 'up' ? 'entry' : 'exit' }))); }

// 2. macd-trend — MACD line x signal line
{ const p = round(shape([57, 54, 53, 58, 69, 80, 88, 92, 86, 79, 75], N, 0.018, makeRnd(23)), 1);
  const m = ema(p, 12).map((v, i) => v - ema(p, 26)[i]);
  const x = cross(m, ema(m, 9), 8).slice(0, 2);
  push('macd-trend', p, x.map(c => ({ index: c.index, kind: c.dir === 'up' ? 'entry' : 'exit' }))); }

// 3. supertrend — ATR band flips
{ const p = round(shape([27, 24.5, 23.4, 26, 30, 32.5, 30, 27.8, 31, 34, 31.5], N, 0.026, makeRnd(37)), 1);
  const atr = p.map((_, i) => { const s = p.slice(Math.max(1, i - 9), i + 1); let t = 0; for (let j = 1; j < s.length; j++) t += Math.abs(s[j] - s[j - 1]); return t / Math.max(1, s.length - 1); });
  let dir = 1, st = p[0] - 3 * atr[0]; const marks = [];
  for (let i = 1; i < p.length; i++) { const up = p[i] - 3 * atr[i], dn = p[i] + 3 * atr[i];
    if (dir === 1) { st = Math.max(up, st); if (p[i] < st) { dir = -1; st = dn; if (i > 10) marks.push({ index: i, kind: 'exit' }); } }
    else { st = Math.min(dn, st); if (p[i] > st) { dir = 1; st = up; if (i > 10) marks.push({ index: i, kind: 'entry' }); } } }
  const e = marks.findIndex(m => m.kind === 'entry');
  push('supertrend', p, marks.slice(e, e + 2)); }

// 4. rsi-reversal — RSI(14) under 30 in, over 70 out
{ const p = round(shape([88, 86, 82, 85, 79, 74, 71, 76, 83, 89, 85], N, 0.03, makeRnd(1)), 1);
  const r = rsi(p); const marks = []; let open = false;
  for (let i = 18; i < p.length; i++) { if (!open && r[i] < 32) { marks.push({ index: i, kind: 'entry' }); open = true; }
    else if (open && r[i] > 68) { marks.push({ index: i, kind: 'exit' }); open = false; } }
  push('rsi-reversal', p, marks.slice(0, 2)); }

// 5. bollinger-bounce — lower band in, middle band out
{ const p = round(shape([45, 47, 44, 46, 41, 44, 47, 45, 42, 46, 45], N, 0.045, makeRnd(1)), 1);
  const mid = sma(p, 20), s = sd(p, 20), lo = mid.map((m, i) => m - 2 * s[i]);
  const marks = []; let open = false;
  for (let i = 22; i < p.length; i++) { if (!open && p[i] <= lo[i]) { marks.push({ index: i, kind: 'entry' }); open = true; }
    else if (open && p[i] >= mid[i]) { marks.push({ index: i, kind: 'exit' }); open = false; } }
  push('bollinger-bounce', p, marks.slice(0, 2)); }

// 6. vwap-reversion — pullback below session VWAP in, back at VWAP out
{ const p = round(shape([196, 193, 190, 194, 188, 191, 195, 192, 197, 194, 198], N, 0.028, makeRnd(6)), 1);
  const v = vwap(p); const marks = []; let open = false;
  for (let i = 10; i < p.length; i++) { if (!open && p[i] < v[i] * 0.985) { marks.push({ index: i, kind: 'entry' }); open = true; }
    else if (open && p[i] >= v[i]) { marks.push({ index: i, kind: 'exit' }); open = false; } }
  push('vwap-reversion', p, marks.slice(0, 2)); }

// 7. breakout — range high/low levels, entry on the close above the high
{ const p = round(shape([64, 66, 63.5, 66, 64, 66.5, 63.5, 66, 72, 78, 75], N, 0.02, makeRnd(5)), 1);
  const hi = Math.max(...p.slice(0, 34)), lo = Math.min(...p.slice(0, 34));
  let entry = -1; for (let i = 34; i < p.length; i++) if (p[i] > hi) { entry = i; break; }
  // 2:1 reward/risk: the stop sits under the range low, the target is twice that distance.
  const stop = lo, target = hi + 2 * (hi - stop);
  let exit = -1; for (let i = entry + 1; i < p.length; i++) if (p[i] >= target) { exit = i; break; }
  if (exit < 0) exit = p.length - 3;
  push('breakout', p, [{ index: entry, kind: 'entry' }, { index: exit, kind: 'exit' }],
    [{ value: Math.round(hi * 10) / 10, label: 'Range high (resistance)' }, { value: Math.round(lo * 10) / 10, label: 'Range low (support)' }]); }

// 8. dca — four scheduled buys, level is the resulting average entry
{ const p = round(shape([102, 94, 88, 83, 86, 92, 99, 106, 112, 118, 124], N, 0.022, makeRnd(9)), 1);
  const buys = [4, 17, 30, 43];
  // A fixed *amount of money* buys more units when price is low, so the real
  // average cost is the harmonic mean of the prices paid, not the plain mean.
  const cost = Math.round((buys.length / buys.reduce((a, i) => a + 1 / p[i], 0)) * 100) / 100;
  push('dca', p, [...buys.map(i => ({ index: i, kind: 'entry' })), { index: N - 2, kind: 'exit' }],
    [{ value: cost, label: 'Average cost per unit' }]); }

// 9. momentum-roc — ROC(9) crosses its threshold in, back through zero out
{ const p = round(shape([48, 47, 46.5, 49, 55, 62, 68, 72, 70, 66, 64], N, 0.022, makeRnd(17)), 1);
  const r = roc(p, 9); const marks = []; let open = false;
  for (let i = 12; i < p.length; i++) { if (!open && r[i] > 8) { marks.push({ index: i, kind: 'entry' }); open = true; }
    else if (open && r[i] < 0) { marks.push({ index: i, kind: 'exit' }); open = false; } }
  push('momentum-roc', p, marks.slice(0, 2)); }

// 10. grid — laddered rungs, buy on each rung down, sell on the rung above
{ const p = round(shape([50, 47, 51, 46.5, 50.5, 47, 51.5, 47.5, 50.5, 47, 50], N, 0.02, makeRnd(29)), 1);
  const rungs = [47, 48.5, 50, 51.5];
  const marks = []; let held = false;
  for (let i = 3; i < p.length; i++) {
    // Buys the 48.50 rung on the way down, sells the 50.00 rung above it.
    if (!held && p[i] <= 48.5 && p[i - 1] > 48.5) { marks.push({ index: i, kind: 'entry' }); held = true; }
    else if (held && p[i] >= 50 && p[i - 1] < 50) { marks.push({ index: i, kind: 'exit' }); held = false; }
  }
  push('grid', p, marks.slice(0, 6), rungs.map(v => ({ value: v, label: 'Grid ' + v.toFixed(2) }))); }

// 11. scalping — many tiny in/out pairs on micro moves
{ const p = round(shape([100, 100.4, 100.1, 100.5, 100.2, 100.6, 100.3, 100.7, 100.4, 100.8, 100.6], N, 0.0022, makeRnd(41)), 2);
  const marks = []; let held = false, entryPx = 0, heldFor = 0;
  for (let i = 2; i < p.length - 1; i++) {
    if (!held && p[i] < p[i - 1] && p[i] < p[i - 2]) { marks.push({ index: i, kind: 'entry' }); held = true; entryPx = p[i]; heldFor = 0; }
    else if (held && (++heldFor >= 4 || p[i] >= entryPx * 1.0009)) { marks.push({ index: i, kind: 'exit' }); held = false; }
  }
  // Always finish on an exit so the chart never shows a position left open.
  if (marks.length % 2) marks.pop();
  push('scalping', p, marks.slice(0, 8)); }

// 12. triangular-arb — round-trip value vs the 1.0000 break-even line
{ const p = round(shape([0.9994, 0.9998, 0.9996, 1.0002, 0.9997, 1.0009, 0.9998, 0.9995, 1.0001, 0.9996, 0.9999], N, 0.0006, makeRnd(59)), 4);
  let entry = -1; for (let i = 4; i < p.length; i++) if (p[i] > 1.0006) { entry = i; break; }
  const exit = Math.min(entry + 2, p.length - 1);
  push('triangular-arb', p, [{ index: entry, kind: 'entry' }, { index: exit, kind: 'exit' }],
    [{ value: 1, label: 'Break-even (1.0000)' }]); }

// 13. covered-call — hold the stock, sell a call at the strike, let it expire
{ const p = round(shape([180, 183, 181, 185, 183, 187, 185, 188, 186, 189, 187], N, 0.014, makeRnd(67)), 1);
  const strike = 195;
  push('covered-call', p, [{ index: 6, kind: 'entry' }, { index: 20, kind: 'exit' }, { index: 24, kind: 'entry' }, { index: 38, kind: 'exit' }],
    [{ value: strike, label: 'Call strike ($195)' }]); }

let ts = '';
for (const [id, v] of Object.entries(out)) {
  ts += `  // ${id}\n  ${JSON.stringify(id)}: {\n    prices: [${v.prices.join(', ')}],\n`;
  ts += `    markers: [${v.markers.map(m => `{ index: ${m.index}, kind: '${m.kind}' }`).join(', ')}],\n`;
  if (v.levels) ts += `    levels: [${v.levels.map(l => `{ value: ${l.value}, label: ${JSON.stringify(l.label)} }`).join(', ')}],\n`;
  ts += '  },\n';
}
console.log(ts);
console.error('--- marker summary ---');
for (const [id, v] of Object.entries(out)) console.error(id.padEnd(18), JSON.stringify(v.markers.map(m => m.index + m.kind[0])), v.levels ? 'levels:' + v.levels.length : '');
