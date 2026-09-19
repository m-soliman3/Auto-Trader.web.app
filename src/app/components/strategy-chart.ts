import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { StrategyChartSpec } from '../services/strategy-explainer';
import { bollinger, ema, sma, vwap } from '../services/indicators';

/** A polyline the template draws, already projected into viewBox units. */
interface PlottedLine {
  label: string;
  points: string;
  color: string;
  /** Raw values, kept for the tooltip readout. */
  values: number[];
  /** First index the line is defined for — a full window, not a partial one. */
  start: number;
}

interface PlottedLevel {
  label: string;
  value: number;
  y: number;
}

interface PlottedMarker {
  key: string;
  kind: 'entry' | 'exit';
  index: number;
  price: number;
  /** Centre of the anchor dot, on the price line. */
  x: number;
  y: number;
  /** Centre of the triangle glyph, offset clear of the line. */
  glyphY: number;
  glyph: string;
  /** Only the first entry and first exit are labelled — see the class comment. */
  label: string | null;
  labelY: number;
  labelAnchor: 'start' | 'middle' | 'end';
}

interface GridLine {
  y: number;
  value: number;
}

/**
 * The small price chart on the signup page that shows where a strategy buys and
 * sells.
 *
 * Design notes, so later edits keep the properties that were checked:
 *
 * - Colours come from the `--chart-*` tokens in `styles.scss`. Slots 1 and 2 were
 *   validated for colour-vision separation and 3:1 contrast against both theme
 *   surfaces; adding a third series means re-validating the set, not picking a
 *   nice hue. Entry/exit use the reserved status green/red and always ship a
 *   triangle plus a "Buy"/"Sell" word, so colour never carries the meaning alone.
 * - Overlay lines are recomputed here from `spec.prices` rather than stored, so
 *   the line drawn is always the real indicator for the prices shown.
 * - Only the first entry and first exit get a text label. Strategies like grid
 *   and scalping fire six to eight times and the labels would collide; the legend
 *   and the tooltip identify the rest.
 */
@Component({
  selector: 'app-strategy-chart',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './strategy-chart.html',
  styleUrl: './strategy-chart.scss',
})
export class StrategyChart {
  spec = input.required<StrategyChartSpec>();

  /** Index of the hovered bar, or null when the pointer is away. */
  hover = signal<number | null>(null);

  // viewBox geometry. The units are kept close to the real rendered width of the
  // context panel (~380px), so SVG text lands near its nominal pixel size instead
  // of being scaled down to something unreadable. Padding on the right leaves
  // room for the y-axis readout.
  readonly W = 380;
  readonly H = 240;
  private readonly padT = 16;
  private readonly padR = 34;
  private readonly padB = 16;
  private readonly padL = 8;

  /** Decimal places the series is quoted in, so the axis and tooltip match it. */
  protected decimals = computed(() => {
    const places = this.spec().prices.map(p => (String(p).split('.')[1] ?? '').length);
    return Math.min(4, Math.max(0, ...places));
  });

  /**
   * Everything the template draws, derived in one pass so the scale used by the
   * price line, the overlays, the levels and the markers can never drift apart.
   */
  protected model = computed(() => {
    const spec = this.spec();
    const prices = spec.prices;
    const n = prices.length;

    // ── Overlays ────────────────────────────────────────────────────────────
    const lines: PlottedLine[] = [];
    let band: { d: string; label: string; upper: number[]; lower: number[] } | null = null;

    // A window-based indicator does not exist until its window is full, so its
    // line starts at `period - 1` rather than being drawn from a partial window —
    // that is also what stops a Bollinger band from tapering to a point at bar 0.
    // EMAs are seeded from the first price and drawn from the start, the way
    // charting platforms draw them.
    let bandStart = 0;
    for (const o of spec.overlays ?? []) {
      const color = `var(--chart-series-${o.slot})`;
      if (o.kind === 'bollinger') {
        const b = bollinger(prices, o.period);
        bandStart = o.period - 1;
        band = { d: '', label: o.label, upper: b.upper, lower: b.lower };
        continue;
      }
      const values =
        o.kind === 'ema' ? ema(prices, o.period)
        : o.kind === 'sma' ? sma(prices, o.period)
        : vwap(prices);
      lines.push({
        label: o.label,
        points: '',
        color,
        values,
        start: o.kind === 'sma' ? o.period - 1 : 0,
      });
    }

    // ── Scale ───────────────────────────────────────────────────────────────
    const pool = [
      ...prices,
      ...lines.flatMap(l => l.values.slice(l.start)),
      ...(band ? [...band.upper.slice(bandStart), ...band.lower.slice(bandStart)] : []),
      ...(spec.levels ?? []).map(l => l.value),
    ];
    const lo = Math.min(...pool);
    const hi = Math.max(...pool);
    const headroom = (hi - lo) * 0.08 || 1;
    const min = lo - headroom;
    const max = hi + headroom;

    const x = (i: number) => this.padL + (i / (n - 1)) * (this.W - this.padL - this.padR);
    const y = (v: number) =>
      this.padT + (1 - (v - min) / (max - min)) * (this.H - this.padT - this.padB);
    const path = (vals: number[], from = 0) =>
      vals.slice(from).map((v, i) => `${x(i + from).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

    for (const l of lines) l.points = path(l.values, l.start);
    if (band) {
      const up = band.upper.slice(bandStart).map((v, i) => `${x(i + bandStart).toFixed(1)},${y(v).toFixed(1)}`);
      const down = band.lower.slice(bandStart).map((v, i) => `${x(i + bandStart).toFixed(1)},${y(v).toFixed(1)}`).reverse();
      band.d = `M${up.join('L')}L${down.join('L')}Z`;
    }

    // ── Levels ──────────────────────────────────────────────────────────────
    // Reference prices are drawn in slot 1 (blue) rather than slot 2 (orange):
    // grid and breakout put several of them right under the red exit markers, and
    // orange beside status-red is the one pairing in this palette that hue alone
    // does not separate.
    const levels: PlottedLevel[] = (spec.levels ?? []).map(l => ({
      label: l.label,
      value: l.value,
      y: y(l.value),
    }));

    // ── Markers ─────────────────────────────────────────────────────────────
    let labelledEntry = false;
    let labelledExit = false;
    const markers: PlottedMarker[] = spec.markers.map((m, idx) => {
      const px = x(m.index);
      const py = y(prices[m.index]);
      const entry = m.kind === 'entry';

      // Buys sit under the price line and sells above it — the usual convention,
      // and it keeps the glyph off the line it refers to. Near the top or bottom
      // of the plot that would push the glyph or its label out of the viewBox, so
      // the pair flips to the other side. The triangle still points up for a buy
      // and down for a sell; only the placement moves.
      const needs = 26;
      let below = entry;
      if (below && py + needs > this.H - this.padB) below = false;
      else if (!below && py - needs < this.padT) below = true;

      const glyphY = below ? py + 12 : py - 12;
      const glyph = entry
        ? `M${px},${glyphY - 5} L${px + 5},${glyphY + 4} L${px - 5},${glyphY + 4} Z`
        : `M${px},${glyphY + 5} L${px + 5},${glyphY - 4} L${px - 5},${glyphY - 4} Z`;

      const wantsLabel = entry ? !labelledEntry : !labelledExit;
      if (entry) labelledEntry ||= wantsLabel;
      else labelledExit ||= wantsLabel;

      return {
        key: `${m.kind}-${m.index}-${idx}`,
        kind: m.kind,
        index: m.index,
        price: prices[m.index],
        x: px,
        y: py,
        glyphY,
        glyph,
        label: wantsLabel ? m.kind : null,
        labelY: below ? glyphY + 14 : glyphY - 10,
        labelAnchor: px < 22 ? 'start' : px > this.W - this.padR - 22 ? 'end' : 'middle',
      };
    });

    // Fast strategies fire their entry and exit a couple of bars apart (triangular
    // arbitrage is two, scalping four), which lands both labels on top of each
    // other. Move the second one to the far side of its own glyph, and drop it if
    // even that collides — the legend still names the triangle.
    const kept: PlottedMarker[] = [];
    for (const m of markers.filter(m => m.label)) {
      const clashes = (labelY: number) =>
        kept.some(k => Math.abs(k.x - m.x) < 34 && Math.abs(k.labelY - labelY) < 14);
      if (!clashes(m.labelY)) {
        kept.push(m);
        continue;
      }
      const flipped = m.labelY > m.glyphY ? m.glyphY - 10 : m.glyphY + 14;
      if (!clashes(flipped)) {
        m.labelY = flipped;
        kept.push(m);
      } else {
        m.label = null;
      }
    }

    // ── Chrome ──────────────────────────────────────────────────────────────
    const grid: GridLine[] = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const value = max - f * (max - min);
      return { y: y(value), value };
    });

    return {
      n,
      prices,
      pricePoints: path(prices),
      lines,
      band,
      levels,
      markers,
      grid,
      xFor: x,
      yFor: y,
    };
  });

  protected hoverX = computed(() => {
    const i = this.hover();
    return i === null ? 0 : this.model().xFor(i);
  });

  protected hoverY = computed(() => {
    const i = this.hover();
    return i === null ? 0 : this.model().yFor(this.model().prices[i]);
  });

  /** Tooltip rows: price plus whatever overlay lines this chart draws. */
  protected hoverRows = computed(() => {
    const i = this.hover();
    if (i === null) return [];
    const m = this.model();
    // A null label means "the price line" — the template supplies the translated
    // word, since overlay labels are technical notation and stay as authored.
    return [
      { label: null as string | null, value: m.prices[i], color: 'var(--chart-price)' },
      ...m.lines
        .filter(l => i >= l.start)
        .map(l => ({ label: l.label as string | null, value: l.values[i], color: l.color })),
    ];
  });

  /** The marker on the hovered bar, if any — the tooltip calls it out. */
  protected hoverMarker = computed(() => {
    const i = this.hover();
    return i === null ? null : (this.model().markers.find(m => m.index === i) ?? null);
  });

  /**
   * Tooltip offset as a percentage of the plot width, so it tracks the bar.
   * Clamped so the box stays inside the panel at either end of the series.
   */
  protected tipLeft = computed(() => Math.max(18, Math.min(82, (this.hoverX() / this.W) * 100)));

  protected onMove(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!box.width) return;
    const m = this.model();
    // Undo the viewBox padding so bar 0 sits at the left edge of the plot.
    const px = ((event.clientX - box.left) / box.width) * this.W;
    const frac = (px - this.padL) / (this.W - this.padL - this.padR);
    const i = Math.round(frac * (m.n - 1));
    this.hover.set(Math.max(0, Math.min(m.n - 1, i)));
  }

  protected format(value: number): string {
    return value.toFixed(this.decimals());
  }
}
