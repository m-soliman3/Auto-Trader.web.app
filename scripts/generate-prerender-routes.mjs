#!/usr/bin/env node
/**
 * Regenerates prerender-routes.txt from the slugs defined in learn-detail.ts.
 *
 * Usage:
 *   node scripts/generate-prerender-routes.mjs
 *
 * The output file (prerender-routes.txt) is read by Angular's build-time
 * prerenderer to produce static HTML for every learn page × language combination.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const LANGUAGES = ['en', 'de', 'es', 'fr', 'pt', 'ar'];

// Extract slugs — every top-level key in the LEARN_PAGES Record object.
// Pattern: `'<slug>': {`  (opening of each page entry).
const source = readFileSync(join(ROOT, 'src/app/pages/learn/learn-detail.ts'), 'utf-8');
const slugRegex = /^  '([\w-]+)':\s*\{/gm;
const slugs = [];
let match;
while ((match = slugRegex.exec(source)) !== null) {
  slugs.push(match[1]);
}

const routes = [];
for (const lang of LANGUAGES) {
  for (const slug of slugs) {
    routes.push(`/${lang}/learn/${slug}`);
  }
}

const outputPath = join(ROOT, 'prerender-routes.txt');
writeFileSync(outputPath, routes.join('\n') + '\n', 'utf-8');
console.log(`Written ${routes.length} routes to ${outputPath}`);
