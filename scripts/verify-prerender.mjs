/**
 * Guards the two ways a prerendered page has silently turned into a crawl-quality
 * problem before:
 *
 *  1. A blank page. A locale-less internal link (`/signup`) misses
 *     `languagePrefixMatcher`, has no prerendered file and no Hosting redirect,
 *     so the `**` rewrite answers 200 with `index.csr.html` — an empty
 *     `<app-root>` carrying the site-wide default title and no canonical.
 *  2. A dev host leaking into the output. Prerendering runs against
 *     `http://ng-localhost`, so anything built from `location.origin` at render
 *     time ships that host to production.
 *
 * Run after `ng build`; exits non-zero with the offending files listed.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const browserDir = join(root, 'dist', 'auto-trading', 'browser');

// Kept in sync with LANGUAGES in src/app/services/language.service.ts.
const LOCALES = ['en', 'de', 'es', 'fr', 'pt', 'ar'];

// Hosting 301s these locale-less paths to their `/en` equivalent, so a link to
// one costs a redirect hop but never lands on the CSR shell.
const REDIRECTED_ROOTS = new Set([
  'privacy', 'terms', 'disclaimer', 'collecting-data', 'contact', 'knowledge-base',
  'login', 'signup', 'signup-guide', 'system-health', 'sitemap',
  'features', 'learn', 'blog',
]);

const DEV_HOSTS = [/ng-localhost/gi, /\/\/localhost[:/]/gi, /\/\/127\.0\.0\.1[:/]/gi, /\/\/0\.0\.0\.0[:/]/gi];

// Below this, `<main>` holds nothing a crawler would call content. The thinnest
// real page today (ar/contact) sits at ~200 characters.
const MIN_MAIN_TEXT = 100;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name === 'index.html') yield full;
  }
}

const blank = [];
const devHost = [];
const unprefixed = new Map();
let checked = 0;

for await (const file of walk(browserDir)) {
  const rel = relative(browserDir, file);
  const html = readFileSync(file, 'utf8');
  checked++;

  for (const pattern of DEV_HOSTS) {
    const hits = html.match(pattern);
    if (hits) devHost.push(`${rel}: ${[...new Set(hits)].join(', ')}`);
  }

  const main = html.match(/<main[^>]*class="app-main"[^>]*>([\s\S]*?)<\/main>/);
  const text = main ? main[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (text.length < MIN_MAIN_TEXT) blank.push(`${rel}: ${text.length} characters of <main> text`);

  for (const [, href] of html.matchAll(/<a\b[^>]*?\bhref="(\/[^"#?]*)/g)) {
    const first = href.split('/')[1] ?? '';
    if (first === '' || LOCALES.includes(first)) continue;
    if (REDIRECTED_ROOTS.has(first)) continue;
    if (!unprefixed.has(href)) unprefixed.set(href, new Set());
    unprefixed.get(href).add(rel.split(sep)[0]);
  }
}

const report = (title, rows) => {
  if (!rows.length) return false;
  console.error(`\n✗ ${title}`);
  for (const row of rows.slice(0, 20)) console.error(`    ${row}`);
  if (rows.length > 20) console.error(`    …and ${rows.length - 20} more`);
  return true;
};

let failed = false;
failed = report('Prerendered pages with no rendered content', blank) || failed;
failed = report('Dev host leaked into prerendered output', devHost) || failed;
failed = report(
  'Locale-less internal links (these fall through to the blank CSR shell)',
  [...unprefixed].map(([href, where]) => `${href} — in ${[...where].slice(0, 4).join(', ')}`),
) || failed;

if (failed) {
  console.error(`\nChecked ${checked} prerendered pages.\n`);
  process.exit(1);
}

console.log(`✓ ${checked} prerendered pages: content present, no dev hosts, no locale-less links.`);
