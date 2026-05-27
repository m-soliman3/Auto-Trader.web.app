#!/usr/bin/env node
/**
 * Generates branded chart images and creates Shopify products for all
 * learn-page strategies/signals not yet listed on Shopify.
 *
 * Usage:
 *   node scripts/create-all-shopify-products.mjs --images-only
 *       Only generate PNG images; skip Shopify API calls.
 *
 *   node scripts/create-all-shopify-products.mjs
 *       Generate images AND create Shopify products (run after production deploy).
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const IMAGES_ONLY = process.argv.includes("--images-only");
const IMG_DIR = resolve(ROOT, "public/images/strategies");

// ── Env ───────────────────────────────────────────────────────────────────────
try {
  const content = readFileSync(resolve(ROOT, "functions/.env"), "utf-8");
  for (const line of content.split("\n")) {
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim(), v = line.slice(eq + 1).trim();
    if (k && v && !process.env[k]) process.env[k] = v;
  }
} catch { /* optional */ }

const SHOP = process.env.SHOPIFY_SHOP;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!IMAGES_ONLY && (!SHOP || !ACCESS_TOKEN)) {
  console.error("❌  SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN must be in functions/.env");
  process.exit(1);
}

const GQL = `https://${SHOP}/admin/api/2024-04/graphql.json`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function shopify(query, variables = {}) {
  const resp = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": ACCESS_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ── Learn page parser ─────────────────────────────────────────────────────────
function parseLearnPages() {
  const src = readFileSync(resolve(ROOT, "src/app/pages/learn/learn-detail.ts"), "utf-8");
  const entries = [];
  const keyRe = /^\s+'([a-z][a-z0-9-]+)':\s*\{/gm;
  let km;
  while ((km = keyRe.exec(src)) !== null) {
    const start = km.index + km[0].length;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const block = src.slice(start, i - 1);
    const slugM    = block.match(/slug:\s*'([^']+)'/);
    const catM     = block.match(/category:\s*'(strategy|signal)'/);
    const titleM   = block.match(/title:\s*'([^']+)'/);
    const taglineM = block.match(/tagline:\s*'([^']+)'/);
    const ovM      = block.match(/overview:\s*`([\s\S]+?)`/);
    if (!slugM || !catM || !titleM) continue;
    const ov = ovM ? ovM[1].trim().split("\n\n")[0].replace(/\n/g, " ").trim() : "";
    entries.push({
      slug: slugM[1],
      category: catM[1],
      title: titleM[1],
      tagline: taglineM ? taglineM[1] : "",
      overview: ov.slice(0, 600),
    });
  }
  return entries;
}

// ── Existing Shopify slugs ────────────────────────────────────────────────────
const EXISTING = new Set(["ichimoku-strategy", "bollinger-bands"]);

// ── Template + colour assignment ─────────────────────────────────────────────
const TPL = {
  // MA / trend indicators
  "ema-indicator": "ma", "sma-indicator": "ma", "hull-moving-average": "ma",
  "supertrend-indicator": "ma", "parabolic-sar": "ma", "linear-regression": "ma",
  "triple-screen-strategy": "ma", "moving-average-crossover": "ma",
  // Trend strategies
  "trend-following": "trend", "momentum-trading": "trend", "position-trading": "trend",
  "carry-trade": "trend", "machine-learning-strategy": "trend", "rebalancing-strategy": "trend",
  "price-action-strategy": "trend", "dollar-cost-averaging": "trend",
  // Oscillators
  "rsi-indicator": "osc", "macd-indicator": "osc", "stochastic-oscillator": "osc",
  "stochastic-rsi": "osc", "mfi-indicator": "osc", "cci-indicator": "osc",
  "williams-percent-r": "osc", "rate-of-change": "osc", "aroon-indicator": "osc",
  "trix-indicator": "osc", "elder-ray": "osc", "detrended-price-oscillator": "osc",
  "force-index": "osc", "ultimate-oscillator": "osc", "vortex-indicator": "osc",
  "dmi-indicator": "osc", "awesome-oscillator": "osc", "alligator-indicator": "osc",
  "adx-indicator": "osc",
  // Bands / channels
  "keltner-channels": "bands", "donchian-channel": "bands",
  "atr-indicator": "bands", "volatility-trading": "bands",
  // Volume
  "vwap-indicator": "vol", "volume-analysis": "vol", "obv-indicator": "vol",
  "chaikin-money-flow": "vol",
  // SMC / institutional
  "smart-money-concepts": "smc", "order-blocks": "smc", "fair-value-gap": "smc",
  "liquidity-sweeps": "smc", "breaker-blocks": "smc", "supply-demand-zones": "smc",
  "wyckoff-method": "smc",
  // Patterns
  "fibonacci-retracement": "ptn", "fibonacci-indicator": "ptn",
  "harmonic-patterns": "ptn", "chart-patterns": "ptn", "elliott-wave": "ptn",
  // Range / mean-reversion
  "mean-reversion": "range", "range-trading": "range", "pairs-trading": "range",
  "counter-trend-strategy": "range", "pivot-points": "range",
  "grid-trading": "range", "arbitrage-strategy": "range", "market-making-strategy": "range",
  // Breakout
  "breakout-strategy": "brk", "gap-trading": "brk", "news-trading": "brk",
  "scalping-strategy": "brk", "swing-trading": "brk",
};
function getTemplate(slug) { return TPL[slug] ?? "trend"; }

const COLORS = [
  "#00d17a","#4db8ff","#ff9d3d","#a855f7","#ff4d6a",
  "#10b981","#f59e0b","#3b82f6","#ec4899","#14b8a6",
  "#f97316","#8b5cf6","#06b6d4","#84cc16","#22d3ee",
  "#6366f1","#0ea5e9","#d946ef","#fb923c","#a3e635","#fbbf24",
];
function hash(s) {
  let h = 5381;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
function getColor(slug) { return COLORS[hash(slug) % COLORS.length]; }
function getPrice(slug) {
  const base = 14 + (hash(slug + "_p") % 21);
  return `${base}.99`;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitTitle(t) {
  if (t.length <= 25) return [t];
  const mid = Math.floor(t.length / 2);
  for (let d = 0; d <= 10; d++) {
    if (t[mid - d] === " ") return [t.slice(0, mid - d), t.slice(mid - d + 1)];
    if (t[mid + d] === " ") return [t.slice(0, mid + d), t.slice(mid + d + 1)];
  }
  return [t];
}

function header(title, color) {
  const p = splitTitle(title);
  const y0 = p.length > 1 ? 28 : 35;
  return p.map((l, i) =>
    `<text x="480" y="${y0 + i * 22}" font-family="'Inter','Segoe UI',sans-serif" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">${escXml(l)}</text>`
  ).join("") +
  `<text x="480" y="${y0 + p.length * 22}" font-family="'Inter','Segoe UI',sans-serif" font-size="11" fill="${color}" text-anchor="middle" letter-spacing="0.8">invest-begin.com</text>`;
}

const BG = `<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:#0f1923"/><stop offset="100%" style="stop-color:#0a1018"/>
  </linearGradient>
  <filter id="gw"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="900" height="500" fill="url(#bg)" rx="12"/>
<g stroke="#1a2840" stroke-width="1">
  <line x1="100" y1="90" x2="860" y2="90"/><line x1="100" y1="170" x2="860" y2="170"/>
  <line x1="100" y1="250" x2="860" y2="250"/><line x1="100" y1="330" x2="860" y2="330"/>
  <line x1="100" y1="410" x2="860" y2="410"/>
  <line x1="220" y1="65" x2="220" y2="445"/><line x1="340" y1="65" x2="340" y2="445"/>
  <line x1="460" y1="65" x2="460" y2="445"/><line x1="580" y1="65" x2="580" y2="445"/>
  <line x1="700" y1="65" x2="700" y2="445"/><line x1="820" y1="65" x2="820" y2="445"/>
</g>`;

// ── Template functions ────────────────────────────────────────────────────────

function tplTrend(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<defs><linearGradient id="fill" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:${color};stop-opacity:0.14"/><stop offset="100%" style="stop-color:${color};stop-opacity:0.01"/></linearGradient></defs>
<polygon points="100,370 180,345 260,318 340,290 420,262 500,234 580,208 660,183 740,160 820,140 860,130 860,445 100,445" fill="url(#fill)"/>
<polyline points="100,395 180,372 260,347 340,319 420,292 500,265 580,238 660,213 740,190 820,169 860,158" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-opacity="0.7"/>
<polyline points="100,378 160,360 220,340 280,318 340,296 400,274 460,252 520,230 580,210 640,190 700,172 760,155 820,140 860,132" fill="none" stroke="#fb923c" stroke-width="1.8" stroke-opacity="0.8"/>
<polyline points="100,370 160,350 220,328 280,305 340,282 400,258 460,236 520,214 580,193 640,174 700,156 760,140 820,126 860,118" fill="none" stroke="${color}" stroke-width="2.5" filter="url(#gw)"/>
<g fill="${color}" stroke="${color}" stroke-width="1"><rect x="116" y="362" width="7" height="14"/><rect x="136" y="346" width="7" height="13"/><rect x="156" y="332" width="7" height="14"/></g>
<g fill="#ff4d6a" stroke="#ff4d6a" stroke-width="1"><rect x="176" y="340" width="7" height="10"/><rect x="196" y="345" width="7" height="8"/></g>
<g fill="${color}" stroke="${color}" stroke-width="1"><rect x="216" y="326" width="7" height="13"/><rect x="236" y="312" width="7" height="12"/><rect x="256" y="298" width="7" height="14"/><rect x="276" y="282" width="7" height="13"/><rect x="296" y="267" width="7" height="14"/><rect x="316" y="252" width="7" height="13"/><rect x="336" y="237" width="7" height="14"/><rect x="356" y="222" width="7" height="13"/></g>
<path d="M825,126 L858,110 L852,123 L865,118 Z" fill="${color}" opacity="0.85"/>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="${color}" stroke-width="2"/><text x="132" y="466">Price</text>
  <line x1="185" y1="462" x2="203" y2="462" stroke="#fb923c" stroke-width="1.8"/><text x="207" y="466">Fast MA</text>
  <line x1="272" y1="462" x2="290" y2="462" stroke="#f59e0b" stroke-width="1.8"/><text x="294" y="466">Slow MA</text>
</g>
${header(title, color)}
</svg>`;
}

function tplMa(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<polyline points="100,380 180,365 260,348 340,328 420,305 500,278 580,248 660,216 740,185 820,156 860,142" fill="none" stroke="#4a6280" stroke-width="3" stroke-opacity="0.5"/>
<polyline points="100,360 160,348 220,334 280,318 340,300 400,280 460,258 520,234 580,210 640,186 700,163 760,142 820,124 860,115" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.8"/>
<polyline points="100,370 140,360 180,348 220,336 260,322 300,307 340,291 380,274 420,257 460,239 500,221 540,203 580,186 620,170 660,155 700,141 740,129 780,118 820,109 860,102" fill="none" stroke="#fff" stroke-width="2.5" stroke-opacity="0.9" filter="url(#gw)"/>
<!-- Golden cross marker -->
<circle cx="560" cy="208" r="12" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.8"/>
<text x="580" y="200" font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="${color}">Golden Cross</text>
<line x1="560" y1="196" x2="560" y2="182" stroke="${color}" stroke-width="1" stroke-dasharray="3,2" stroke-opacity="0.6"/>
<g fill="${color}" stroke="${color}" stroke-width="1"><rect x="116" y="363" width="7" height="12"/><rect x="136" y="350" width="7" height="12"/><rect x="156" y="336" width="7" height="14"/><rect x="176" y="320" width="7" height="14"/><rect x="196" y="308" width="7" height="12"/></g>
<g fill="#ff4d6a" stroke="#ff4d6a" stroke-width="1"><rect x="216" y="328" width="7" height="10"/><rect x="236" y="335" width="7" height="8"/></g>
<g fill="${color}" stroke="${color}" stroke-width="1"><rect x="256" y="316" width="7" height="13"/><rect x="276" y="302" width="7" height="12"/><rect x="296" y="287" width="7" height="14"/></g>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="#fff" stroke-width="2"/><text x="132" y="466">Price</text>
  <line x1="185" y1="462" x2="203" y2="462" stroke="${color}" stroke-width="2"/><text x="207" y="466">Fast MA</text>
  <line x1="272" y1="462" x2="290" y2="462" stroke="#4a6280" stroke-width="3"/><text x="294" y="466">Slow MA</text>
</g>
${header(title, color)}
</svg>`;
}

function tplOsc(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<!-- Price panel (top 58%) -->
<polyline points="100,290 160,268 220,248 280,232 340,220 400,212 460,207 520,210 580,220 640,212 700,198 760,182 820,165 860,155" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.85"/>
<polyline points="100,305 180,285 260,266 340,248 420,234 500,225 580,224 660,218 740,205 820,188 860,178" fill="none" stroke="${color}" stroke-width="2" filter="url(#gw)"/>
<!-- Divider -->
<line x1="100" y1="330" x2="860" y2="330" stroke="#2a3f55" stroke-width="1.5"/>
<!-- Oscillator panel label -->
<text x="110" y="348" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="#4a6280">INDICATOR</text>
<!-- Overbought/oversold levels -->
<line x1="100" y1="350" x2="860" y2="350" stroke="#ff4d6a" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.5"/>
<text x="865" y="354" font-family="'Inter','Segoe UI',sans-serif" font-size="8" fill="#ff4d6a">70</text>
<line x1="100" y1="415" x2="860" y2="415" stroke="${color}" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.5"/>
<text x="865" y="419" font-family="'Inter','Segoe UI',sans-serif" font-size="8" fill="${color}">30</text>
<!-- Midline -->
<line x1="100" y1="383" x2="860" y2="383" stroke="#2a3f55" stroke-width="1" stroke-dasharray="2,4"/>
<!-- Oscillator curve -->
<polyline points="100,370 140,358 180,345 220,355 260,368 300,375 340,382 380,390 420,400 460,408 500,412 540,405 580,395 620,382 660,370 700,360 740,352 780,358 820,365 860,370" fill="none" stroke="${color}" stroke-width="2" filter="url(#gw)"/>
<!-- Overbought zone fill -->
<polygon points="100,350 860,350 860,330 100,330" fill="#ff4d6a" fill-opacity="0.04"/>
<!-- Oversold zone fill -->
<polygon points="100,415 860,415 860,445 100,445" fill="${color}" fill-opacity="0.05"/>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="#fff" stroke-width="2"/><text x="132" y="466">Price</text>
  <line x1="185" y1="462" x2="203" y2="462" stroke="${color}" stroke-width="2"/><text x="207" y="466">Indicator</text>
  <line x1="292" y1="462" x2="310" y2="462" stroke="#ff4d6a" stroke-width="1" stroke-dasharray="4,3"/><text x="314" y="466">Overbought</text>
</g>
${header(title, color)}
</svg>`;
}

function tplBands(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<defs>
  <linearGradient id="bandfill" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:${color};stop-opacity:0.1"/>
    <stop offset="100%" style="stop-color:${color};stop-opacity:0.02"/>
  </linearGradient>
</defs>
<!-- Band fill -->
<polygon points="100,155 200,148 300,140 400,132 500,128 600,133 700,148 800,170 860,185 860,305 800,290 700,275 600,262 500,252 400,248 300,252 200,260 100,265" fill="url(#bandfill)"/>
<!-- Upper band -->
<polyline points="100,155 200,148 300,140 400,132 500,128 600,133 700,148 800,170 860,185" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="7,4"/>
<!-- Lower band -->
<polyline points="100,265 200,260 300,252 400,248 500,252 600,262 700,275 800,290 860,305" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="7,4"/>
<!-- Middle band (SMA) -->
<polyline points="100,210 200,204 300,196 400,190 500,190 600,198 700,212 800,230 860,245" fill="none" stroke="#4db8ff" stroke-width="2.5"/>
<!-- Price -->
<polyline points="100,250 160,238 220,222 280,208 340,194 400,180 460,170 520,162 580,158 640,152 700,148 760,168 820,192 860,218" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.8"/>
<!-- Squeeze annotation -->
<text x="490" y="148" font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="${color}" text-anchor="middle" opacity="0.9">← Squeeze →</text>
<line x1="460" y1="145" x2="400" y2="150" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
<line x1="520" y1="145" x2="580" y2="152" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="#fff" stroke-width="2"/><text x="132" y="466">Price</text>
  <line x1="185" y1="462" x2="203" y2="462" stroke="#4db8ff" stroke-width="2.5"/><text x="207" y="466">Middle (SMA)</text>
  <line x1="308" y1="462" x2="326" y2="462" stroke="${color}" stroke-width="2" stroke-dasharray="5,3"/><text x="330" y="466">Bands (±2σ)</text>
</g>
${header(title, color)}
</svg>`;
}

function tplVol(title, color) {
  const volBars = [100,114,128,142,156,170,184,198,212,226,240,254,268,282,296,310,324,338,352,366,380,394,408,422,436,450,464,478,492,506,520,534,548,562,576,590,604,618,632,646,660,674,688,702,716,730,744,758,772,786,800,814,828,842];
  const barXml = volBars.map((x, i) => {
    const h = 15 + (hash(String(i)) % 40);
    const isGreen = (i + hash(title)) % 3 !== 0;
    const isHighlight = i === 18 || i === 42;
    const fill = isHighlight ? color : (isGreen ? "#00d17a" : "#ff4d6a");
    return `<rect x="${x}" y="${440 - h}" width="10" height="${h}" fill="${fill}" opacity="${isHighlight ? 0.9 : 0.45}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<!-- Price (top 58%) -->
<polyline points="100,295 150,278 200,262 250,248 300,236 350,225 400,216 450,208 500,200 550,193 600,187 650,182 700,178 750,175 800,172 860,168" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.85"/>
<polyline points="100,310 170,292 240,276 310,261 380,248 450,237 520,228 590,220 660,213 730,207 800,202 860,198" fill="none" stroke="${color}" stroke-width="2" filter="url(#gw)"/>
<!-- Volume label -->
<text x="110" y="408" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="#4a6280">VOLUME</text>
<line x1="100" y1="412" x2="860" y2="412" stroke="#2a3f55" stroke-width="1"/>
<!-- Volume bars -->
${barXml}
<!-- Climax volume label -->
<text x="270" y="398" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="${color}" text-anchor="middle">Climax Vol.</text>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="479" x2="128" y2="479" stroke="#fff" stroke-width="2"/><text x="132" y="483">Price</text>
  <line x1="185" y1="479" x2="203" y2="479" stroke="${color}" stroke-width="2"/><text x="207" y="483">MA</text>
  <rect x="272" y="472" width="16" height="8" fill="#00d17a" opacity="0.6"/><text x="292" y="483">Bull Vol</text>
  <rect x="358" y="472" width="16" height="8" fill="#ff4d6a" opacity="0.6"/><text x="378" y="483">Bear Vol</text>
</g>
${header(title, color)}
</svg>`;
}

function tplSmc(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<!-- Demand zone (bullish order block) -->
<rect x="115" y="320" width="120" height="40" fill="#00d17a" fill-opacity="0.12" stroke="#00d17a" stroke-width="1" stroke-opacity="0.4"/>
<text x="175" y="346" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="#00d17a" text-anchor="middle">Demand Zone</text>
<!-- Supply zone (bearish order block) -->
<rect x="530" y="140" width="120" height="40" fill="#ff4d6a" fill-opacity="0.12" stroke="#ff4d6a" stroke-width="1" stroke-opacity="0.4"/>
<text x="590" y="166" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="#ff4d6a" text-anchor="middle">Supply Zone</text>
<!-- FVG arrow -->
<rect x="340" y="235" width="60" height="22" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
<text x="370" y="250" font-family="'Inter','Segoe UI',sans-serif" font-size="8" fill="${color}" text-anchor="middle">FVG</text>
<!-- Price path: drops to demand, impulsive move up, supply rejection -->
<polyline points="100,210 160,230 220,255 280,288 340,320 400,332 420,338 440,325 460,300 500,258 540,215 570,180 600,158 640,152 680,162 720,180 760,198 820,220 860,238" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.7"/>
<!-- Impulse (displacement) candles -->
<g fill="${color}" stroke="${color}" stroke-width="1">
  <rect x="436" y="296" width="8" height="22"/><rect x="452" y="274" width="8" height="24"/><rect x="468" y="250" width="8" height="25"/>
  <rect x="484" y="225" width="8" height="27"/><rect x="500" y="200" width="8" height="28"/>
  <line x1="440" y1="292" x2="440" y2="285"/><line x1="456" y1="270" x2="456" y2="262"/>
  <line x1="472" y1="246" x2="472" y2="238"/>
</g>
<!-- Rejection candles at supply -->
<g fill="#ff4d6a" stroke="#ff4d6a" stroke-width="1">
  <rect x="548" y="160" width="8" height="18"/><rect x="564" y="165" width="8" height="16"/>
</g>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <rect x="110" y="457" width="16" height="8" fill="#00d17a" fill-opacity="0.3" stroke="#00d17a" stroke-width="1"/><text x="130" y="466">Demand</text>
  <rect x="200" y="457" width="16" height="8" fill="#ff4d6a" fill-opacity="0.3" stroke="#ff4d6a" stroke-width="1"/><text x="220" y="466">Supply</text>
  <rect x="290" y="457" width="16" height="8" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1"/><text x="310" y="466">FVG</text>
</g>
${header(title, color)}
</svg>`;
}

function tplPtn(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<!-- Pattern lines (W / double bottom) -->
<polyline points="100,180 180,220 260,310 320,340 380,280 440,175 500,165 560,200 620,320 680,350 740,288 800,175 860,155" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.75"/>
<!-- Pattern highlight (the W shape) -->
<polyline points="260,310 320,340 380,280 440,175" fill="none" stroke="${color}" stroke-width="2.5" filter="url(#gw)" stroke-dasharray="0"/>
<polyline points="560,200 620,320 680,350 740,288 800,175" fill="none" stroke="${color}" stroke-width="2.5" filter="url(#gw)"/>
<!-- Neckline -->
<line x1="380" y1="270" x2="740" y2="270" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.7"/>
<text x="480" y="265" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="${color}" text-anchor="middle">Neckline / Key Level</text>
<!-- Fibonacci levels -->
<line x1="100" y1="196" x2="860" y2="196" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,4" stroke-opacity="0.5"/>
<text x="108" y="192" font-family="'Inter','Segoe UI',sans-serif" font-size="8" fill="#f59e0b">0.618</text>
<line x1="100" y1="232" x2="860" y2="232" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,4" stroke-opacity="0.4"/>
<text x="108" y="228" font-family="'Inter','Segoe UI',sans-serif" font-size="8" fill="#f59e0b">0.500</text>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="${color}" stroke-width="2.5"/><text x="132" y="466">Pattern</text>
  <line x1="200" y1="462" x2="218" y2="462" stroke="${color}" stroke-width="1.5" stroke-dasharray="5,3"/><text x="222" y="466">Key Level</text>
  <line x1="302" y1="462" x2="320" y2="462" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3"/><text x="324" y="466">Fibonacci</text>
</g>
${header(title, color)}
</svg>`;
}

function tplRange(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<defs>
  <linearGradient id="rfill" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:${color};stop-opacity:0.06"/>
    <stop offset="100%" style="stop-color:${color};stop-opacity:0.02"/>
  </linearGradient>
</defs>
<!-- Range fill -->
<rect x="100" y="185" width="760" height="155" fill="url(#rfill)"/>
<!-- Resistance -->
<line x1="100" y1="185" x2="860" y2="185" stroke="#ff4d6a" stroke-width="2" stroke-dasharray="8,4"/>
<text x="872" y="189" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="#ff4d6a">R</text>
<!-- Support -->
<line x1="100" y1="340" x2="860" y2="340" stroke="${color}" stroke-width="2" stroke-dasharray="8,4"/>
<text x="872" y="344" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="${color}">S</text>
<!-- Mean line -->
<line x1="100" y1="262" x2="860" y2="262" stroke="#4db8ff" stroke-width="1.2" stroke-dasharray="4,6" stroke-opacity="0.6"/>
<!-- Oscillating price -->
<polyline points="100,338 160,290 220,215 280,200 340,228 400,300 440,338 500,308 560,228 620,193 680,210 740,275 800,335 860,310" fill="none" stroke="#fff" stroke-width="2.2" stroke-opacity="0.85"/>
<!-- Entry arrows -->
<path d="M108,332 L118,320 L114,325 L124,322 Z" fill="${color}" opacity="0.8"/>
<path d="M448,332 L458,320 L454,325 L464,322 Z" fill="${color}" opacity="0.8"/>
<path d="M220,192 L230,204 L226,199 L236,202 Z" fill="#ff4d6a" opacity="0.8"/>
<path d="M618,190 L628,202 L624,197 L634,200 Z" fill="#ff4d6a" opacity="0.8"/>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <line x1="110" y1="462" x2="128" y2="462" stroke="#fff" stroke-width="2"/><text x="132" y="466">Price</text>
  <line x1="185" y1="462" x2="203" y2="462" stroke="#4db8ff" stroke-width="1.2" stroke-dasharray="4,4"/><text x="207" y="466">Mean</text>
  <line x1="262" y1="462" x2="280" y2="462" stroke="#ff4d6a" stroke-width="2" stroke-dasharray="6,3"/><text x="284" y="466">Resistance</text>
  <line x1="370" y1="462" x2="388" y2="462" stroke="${color}" stroke-width="2" stroke-dasharray="6,3"/><text x="392" y="466">Support</text>
</g>
${header(title, color)}
</svg>`;
}

function tplBrk(title, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="900" height="500">
${BG}
<defs>
  <linearGradient id="brkfill" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:${color};stop-opacity:0.18"/>
    <stop offset="100%" style="stop-color:${color};stop-opacity:0.01"/>
  </linearGradient>
</defs>
<!-- Consolidation box -->
<rect x="100" y="235" width="380" height="80" fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-width="1" stroke-opacity="0.35" stroke-dasharray="6,3"/>
<!-- Consolidation price -->
<polyline points="100,280 140,268 180,275 220,272 260,280 300,274 340,278 380,270 420,275 460,272 480,268" fill="none" stroke="#fff" stroke-width="1.8" stroke-opacity="0.7"/>
<!-- Breakout level -->
<line x1="100" y1="238" x2="860" y2="238" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.6"/>
<text x="108" y="232" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="${color}">Breakout Level</text>
<!-- Post-breakout explosion -->
<polygon points="480,268 500,238 520,205 560,168 620,132 680,105 740,88 800,75 860,68 860,115 800,118 740,130 680,148 620,168 560,202 520,235 500,245 480,260" fill="url(#brkfill)"/>
<polyline points="480,268 520,225 570,178 630,140 700,108 770,84 860,68" fill="none" stroke="${color}" stroke-width="3" filter="url(#gw)"/>
<!-- Volume spike bar -->
<rect x="488" y="390" width="14" height="50" fill="${color}" opacity="0.7"/>
<text x="495" y="385" font-family="'Inter','Segoe UI',sans-serif" font-size="9" fill="${color}" text-anchor="middle">Vol spike</text>
<!-- Candles during breakout -->
<g fill="${color}" stroke="${color}" stroke-width="1">
  <rect x="504" y="218" width="8" height="20"/><rect x="520" y="195" width="8" height="22"/>
  <rect x="536" y="172" width="8" height="24"/><rect x="552" y="150" width="8" height="24"/>
</g>
<g font-family="'Inter','Segoe UI',sans-serif" font-size="10" fill="#8aa0b2">
  <rect x="110" y="457" width="50" height="6" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1" stroke-dasharray="4,2"/><text x="165" y="466">Consolidation</text>
  <line x1="275" y1="462" x2="293" y2="462" stroke="${color}" stroke-width="3"/><text x="297" y="466">Breakout</text>
</g>
${header(title, color)}
</svg>`;
}

const TPL_FNS = { trend: tplTrend, ma: tplMa, osc: tplOsc, bands: tplBands, vol: tplVol, smc: tplSmc, ptn: tplPtn, range: tplRange, brk: tplBrk };

function generateSvg(slug, title, color) {
  const tpl = getTemplate(slug);
  return TPL_FNS[tpl](title, color);
}

function generatePng(svg) {
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

// ── Shopify mutations ─────────────────────────────────────────────────────────
const CREATE_PRODUCT = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id variants(first: 1) { edges { node { id } } } }
      userErrors { field message }
    }
  }
`;
const UPDATE_PRICE = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;
const CREATE_MEDIA = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { ... on MediaImage { id image { url } } }
      mediaUserErrors { field message code }
    }
  }
`;

function makeDescription(entry) {
  const escaped = entry.overview
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped}</p><p><strong>What's included:</strong></p><ul><li>Pine Script (TradingView)</li><li>ThinkScript (thinkorswim)</li><li>Setup documentation</li></ul>`;
}

async function createShopifyProduct(entry, price) {
  const title = `${entry.title} — Pine Script & ThinkScript`;
  const data = await shopify(CREATE_PRODUCT, {
    input: {
      title,
      descriptionHtml: makeDescription(entry),
      status: "ACTIVE",
      productType: "Trading Script",
      vendor: "Auto Trader X",
      tags: [entry.category, entry.slug, "pine-script", "thinkscript"],
    },
  });
  const { product, userErrors } = data.productCreate;
  if (userErrors?.length) throw new Error(userErrors.map(e => `${e.field}: ${e.message}`).join("; "));
  const productId = product.id;
  const variantId = product.variants.edges[0]?.node?.id;

  if (variantId) {
    await delay(400);
    await shopify(UPDATE_PRICE, {
      productId,
      variants: [{ id: variantId, price }],
    });
  }
  return productId;
}

async function attachImage(productId, imageUrl) {
  const data = await shopify(CREATE_MEDIA, {
    productId,
    media: [{ originalSource: imageUrl, mediaContentType: "IMAGE" }],
  });
  const { mediaUserErrors } = data.productCreateMedia;
  if (mediaUserErrors?.length) {
    throw new Error(mediaUserErrors.map(e => `${e.code}: ${e.message}`).join("; "));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n📋  Parsing learn pages...");
  const all = parseLearnPages();
  const entries = all.filter(e => !EXISTING.has(e.slug) && e.category === 'strategy');
  console.log(`  Found ${all.length} total pages, ${entries.length} strategies not yet on Shopify.\n`);

  mkdirSync(IMG_DIR, { recursive: true });

  // Phase 1: generate images
  console.log("🎨  Generating chart images...");
  const imgResults = [];
  for (const entry of entries) {
    const color = getColor(entry.slug);
    const svg = generateSvg(entry.slug, entry.title, color);
    const png = generatePng(svg);
    const pngPath = resolve(IMG_DIR, `${entry.slug}.png`);
    writeFileSync(pngPath, png);
    imgResults.push({ slug: entry.slug, ok: true });
    process.stdout.write(`  ✅  ${entry.slug}.png (${png.length} bytes)\n`);
  }
  console.log(`\n✅  ${imgResults.length} images saved to public/images/strategies/\n`);

  if (IMAGES_ONLY) {
    console.log("ℹ️   --images-only flag set. Skipping Shopify API calls.");
    console.log("    Deploy to production, then re-run without the flag.\n");
    return;
  }

  // Phase 2: create Shopify products
  console.log("🛒  Creating Shopify products on " + SHOP + "...");
  console.log("=".repeat(65));

  const results = [];
  for (const entry of entries) {
    const price = getPrice(entry.slug);
    const imageUrl = `https://autotrader-b8851-staging.web.app/images/strategies/${entry.slug}.png`;
    try {
      process.stdout.write(`  ⏳  "${entry.title}" (€${price})... `);
      const productId = await createShopifyProduct(entry, price);
      await delay(400);
      await attachImage(productId, imageUrl);
      console.log(`✅  ${productId.split("/").pop()}`);
      results.push({ ok: true, title: entry.title, price, productId });
    } catch (err) {
      console.log(`❌`);
      console.error(`      ${err.message}`);
      results.push({ ok: false, title: entry.title, price, error: err.message });
    }
    await delay(600); // respect Shopify rate limits
  }

  // Summary
  console.log("\n" + "=".repeat(65));
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n🎉  Done! ${ok} products created, ${fail} failed.`);
  if (fail > 0) {
    console.log("\nFailed products:");
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌  ${r.title}: ${r.error}`));
  }
  console.log(`\n    Shopify Admin: https://${SHOP}/admin/products\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
