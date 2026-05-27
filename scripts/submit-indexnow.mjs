#!/usr/bin/env node
/**
 * Submits all URLs from public/sitemap.xml to IndexNow (Bing).
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs
 *
 * Prerequisites:
 *   1. The key file must be deployed and accessible at:
 *      https://invest-begin.com/69f79fd8505c47deae19d9a9b602657b.txt
 *   2. Run after deploying the public/ key file to Firebase Hosting.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const HOST         = "invest-begin.com";
const API_KEY      = "69f79fd8505c47deae19d9a9b602657b";
const KEY_LOCATION = `https://${HOST}/${API_KEY}.txt`;
const SITEMAP_PATH = resolve(ROOT, "public/sitemap.xml");
const BATCH_SIZE   = 10_000; // IndexNow max per request

// ── Parse URLs from sitemap ───────────────────────────────────────────────────
function parseUrls(xmlContent) {
  const urls = [];
  const regex = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

// ── Submit a batch of URLs ────────────────────────────────────────────────────
async function submitBatch(urlList, batchNum, totalBatches) {
  const payload = {
    host: HOST,
    key: API_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  const resp = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const status = resp.status;
  const label = totalBatches > 1 ? ` (batch ${batchNum}/${totalBatches})` : "";

  if (status === 200) {
    console.log(`✅  ${urlList.length} URLs submitted successfully${label}`);
  } else if (status === 202) {
    console.log(`✅  Accepted (202) — ${urlList.length} URLs queued for processing${label}`);
  } else {
    const body = await resp.text().catch(() => "");
    throw new Error(`HTTP ${status}${label}: ${body}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🔍  Reading sitemap: ${SITEMAP_PATH}\n`);

const xml  = readFileSync(SITEMAP_PATH, "utf-8");
const urls = parseUrls(xml);

if (!urls.length) {
  console.error("❌  No URLs found in sitemap.xml");
  process.exit(1);
}

console.log(`📄  Found ${urls.length} URL(s) in sitemap`);
console.log(`🔑  Key location: ${KEY_LOCATION}`);
console.log(`📡  Submitting to api.indexnow.org...\n`);

// Split into batches if > 10,000 URLs (not needed here, but future-proof)
const batches = [];
for (let i = 0; i < urls.length; i += BATCH_SIZE) {
  batches.push(urls.slice(i, i + BATCH_SIZE));
}

for (let i = 0; i < batches.length; i++) {
  await submitBatch(batches[i], i + 1, batches.length);
}

console.log(`\n🎉  Done! All ${urls.length} URLs submitted to IndexNow.`);
console.log(`\n📊  Verify at: https://www.bing.com/webmasters\n`);
