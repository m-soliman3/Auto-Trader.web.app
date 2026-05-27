#!/usr/bin/env node
/**
 * One-off seed script — creates 4 Shopify product listings:
 *   1. Ichimoku Cloud Strategy — Pine Script (TradingView)
 *   2. Ichimoku Cloud Strategy — ThinkScript (thinkorswim)
 *   3. Bollinger Bands Strategy — Pine Script (TradingView)
 *   4. Bollinger Bands Strategy — ThinkScript (thinkorswim)
 *
 * Requires in functions/.env:
 *   SHOPIFY_SHOP           = autotradingx.myshopify.com
 *   SHOPIFY_CLIENT_ID      = <your client id>
 *   SHOPIFY_CLIENT_SECRET  = <your client secret>
 *
 * If SHOPIFY_ACCESS_TOKEN is already present in functions/.env, the OAuth
 * step is skipped. Otherwise the script opens a browser, completes the OAuth
 * flow via a local callback server, and saves the token to functions/.env
 * automatically before creating the listings.
 *
 * One-time setup (do once in Shopify Partner Dashboard):
 *   Apps → <your app> → App setup → Allowed redirection URL(s)
 *   Add:  http://localhost:3000/shopify/callback
 *
 * Usage:
 *   node scripts/create-shopify-listings.mjs
 */

import { readFileSync, appendFileSync } from "fs";
import { createServer } from "http";
import { execSync } from "child_process";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load functions/.env ───────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../functions/.env");

function loadEnv() {
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && val && !process.env[key]) process.env[key] = val;
    }
  } catch { /* env file is optional */ }
}

loadEnv();

const SHOP          = process.env.SHOPIFY_SHOP;
const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌  SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET must be set in functions/.env");
  process.exit(1);
}

// ── OAuth: obtain access token if not already stored ─────────────────────────

const CALLBACK_PORT = 3000;
const CALLBACK_PATH = "/shopify/callback";
const REDIRECT_URI  = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES        = "read_products,write_products";

/**
 * Verifies the Shopify HMAC on the callback query parameters.
 * Removes `hmac` from the params, sorts the rest, signs with client secret.
 */
function verifyHmac(params, secret) {
  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k !== "hmac") pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const message = pairs.join("&");
  const digest  = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(params.get("hmac") ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Runs the full OAuth authorization-code flow locally.
 * Returns the offline access token string.
 */
async function runOAuthFlow() {
  const state = randomBytes(16).toString("hex");

  const authUrl =
    `https://${SHOP}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  console.log("\n🔐  Shopify OAuth required.");
  console.log("    Opening your browser to authorise the app...");
  console.log(`    Auth URL:\n    ${authUrl}\n`);

  // Open browser (macOS: open, Linux: xdg-open, Windows: start)
  try {
    const cmd = process.platform === "win32" ? "start" :
                process.platform === "darwin" ? "open" : "xdg-open";
    execSync(`${cmd} "${authUrl}"`);
  } catch {
    console.log("    (Could not open browser automatically — please visit the URL above.)");
  }

  // Wait for Shopify to redirect to http://localhost:3000/shopify/callback
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith(CALLBACK_PATH)) {
        res.writeHead(404).end(); return;
      }

      const params = new URL(req.url, `http://localhost:${CALLBACK_PORT}`).searchParams;

      // Validate state
      if (params.get("state") !== state) {
        res.writeHead(400).end("State mismatch");
        server.close();
        reject(new Error("OAuth state mismatch — possible CSRF"));
        return;
      }

      // Validate HMAC
      if (!verifyHmac(params, CLIENT_SECRET)) {
        res.writeHead(400).end("HMAC invalid");
        server.close();
        reject(new Error("HMAC verification failed"));
        return;
      }

      const code = params.get("code");
      if (!code) {
        res.writeHead(400).end("Missing code");
        server.close();
        reject(new Error("No code in callback"));
        return;
      }

      // Exchange code for access token
      try {
        const tokenResp = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
        });
        if (!tokenResp.ok) throw new Error(`Token exchange HTTP ${tokenResp.status}`);
        const { access_token, scope } = await tokenResp.json();
        if (!access_token) throw new Error("No access_token in response");

        console.log(`    ✅  OAuth complete — scopes: ${scope}`);

        // Persist token to functions/.env
        appendFileSync(envPath, `\nSHOPIFY_ACCESS_TOKEN=${access_token}\n`);
        console.log(`    💾  Token saved to functions/.env\n`);

        res.writeHead(200, { "Content-Type": "text/html" }).end(
          "<html><body><h2>✅ Authorised!</h2><p>You can close this tab.</p></body></html>"
        );
        server.close();
        resolve(access_token);
      } catch (err) {
        res.writeHead(500).end("Token exchange failed");
        server.close();
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(`    Listening for OAuth callback on http://localhost:${CALLBACK_PORT}${CALLBACK_PATH} ...`);
    });

    server.on("error", reject);
  });
}

// Obtain (or reuse) the access token
let ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  ACCESS_TOKEN = await runOAuthFlow();
  // Reload env so the rest of the script has the token in process.env
  process.env.SHOPIFY_ACCESS_TOKEN = ACCESS_TOKEN;
} else {
  console.log("ℹ️   Using existing SHOPIFY_ACCESS_TOKEN from functions/.env");
}

const GQL = `https://${SHOP}/admin/api/2024-04/graphql.json`;

async function gql(query, variables) {
  const resp = await fetch(GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const CREATE_PRODUCT = `
  mutation productCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product { id title handle status }
      userErrors { field message }
    }
  }
`;

const GET_VARIANT = `
  query getVariant($id: ID!) {
    product(id: $id) {
      variants(first: 1) { edges { node { id } } }
    }
  }
`;

const UPDATE_VARIANT_PRICE = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

// ── Listing definitions ──────────────────────────────────────────────────────

const PRICE = "14.99";

const listings = [
  // ── 1. Ichimoku Cloud Strategy (Pine Script + ThinkScript) ───────────────
  {
    title: "Ichimoku Cloud Strategy — Pine Script & ThinkScript",
    descriptionHtml: `
<h2>Ichimoku Cloud Strategy — 2 Script Files Included</h2>

<p>
  <strong>From the AutoTrader Learn series · Includes: Pine Script v5 (TradingView) + ThinkScript (thinkorswim)</strong>
</p>

<p>
  The Ichimoku Cloud (Ichimoku Kinko Hyo) is a complete, all-in-one trading system
  developed by Japanese journalist Goichi Hosoda. Unlike single-line indicators, it
  delivers trend direction, momentum, dynamic support/resistance, and forward price
  projections — all in a single view.
</p>

<p>Your purchase includes <strong>2 ready-to-use script files</strong>:</p>

<hr />

<h3>File 1 — Pine Script v5 for TradingView</h3>
<ul>
  <li>All five Ichimoku components: Tenkan-sen, Kijun-sen, Senkou Span A &amp; B, and Chikou Span</li>
  <li>Long entry fires only when all four bullish confluences align simultaneously:
    price above the cloud · Tenkan above Kijun · cloud ahead is green · Chikou above historical price
  </li>
  <li>Configurable stop-loss at Span B and take-profit at next resistance</li>
  <li>Runs in the TradingView Strategy Tester — backtest on any symbol and timeframe instantly</li>
  <li>Adjustable periods: Tenkan (9), Kijun (26), Senkou B (52)</li>
</ul>
<p><strong>How to use:</strong> Open TradingView → Pine Editor → Paste → Add to chart → Strategy Tester</p>

<hr />

<h3>File 2 — ThinkScript for thinkorswim</h3>
<ul>
  <li>Plots all five Ichimoku components with correct cloud shading: bullish green / bearish red</li>
  <li>Long and short strategy signals when all four Ichimoku conditions align</li>
  <li>Configurable periods: Tenkan-sen (9), Kijun-sen (26), Senkou Span B (52)</li>
  <li>Compatible with thinkorswim's Strategy tab for back-testing</li>
  <li>Compatible with the Scan tab to find live setups across any watchlist</li>
</ul>
<p><strong>How to use:</strong> Open thinkorswim → Studies → Edit Studies → Create → Paste → Apply to chart</p>

<hr />

<p><em>Suitable for crypto, forex, equities, and commodities on any timeframe from 1H upward.</em></p>
    `.trim(),
    vendor: "AutoTrader",
    productType: "Trading Script",
    tags: ["pinescript", "thinkscript", "tradingview", "thinkorswim", "ichimoku", "strategy", "technical-analysis"],
  },

  // ── 2. Bollinger Bands Strategy (Pine Script + ThinkScript) ─────────────
  {
    title: "Bollinger Bands Strategy — Pine Script & ThinkScript",
    descriptionHtml: `
<h2>Bollinger Bands Strategy — 2 Script Files Included</h2>

<p>
  <strong>From the AutoTrader Learn series · Includes: Pine Script v5 (TradingView) + ThinkScript (thinkorswim)</strong>
</p>

<p>
  Created by John Bollinger in the 1980s, Bollinger Bands consist of a 20-period SMA flanked
  by upper and lower bands at ±2 standard deviations. They dynamically expand in high-volatility
  conditions and contract in low-volatility ones — making the <strong>Bollinger Squeeze</strong>
  one of the most reliable breakout-detection setups in technical analysis.
</p>

<p>Your purchase includes <strong>2 ready-to-use script files</strong>:</p>

<hr />

<h3>File 1 — Pine Script v5 for TradingView</h3>
<ul>
  <li>Three signal modes selectable from the inputs panel:
    <ul>
      <li><strong>Mean Reversion</strong> — band-touch reversals back toward the midline SMA</li>
      <li><strong>Squeeze Breakout</strong> — enters when bands expand after a historically narrow squeeze</li>
      <li><strong>%B Threshold</strong> — signals based on the %B oscillator crossing configurable levels</li>
    </ul>
  </li>
  <li>Configurable SMA length (default 20) and standard deviation multiplier (default 2.0)</li>
  <li>Built-in Squeeze detector using a band-width historical percentile filter</li>
  <li>Stop-loss and take-profit calculated automatically from band width</li>
</ul>
<p><strong>How to use:</strong> Open TradingView → Pine Editor → Paste → Add to chart → select signal mode → Strategy Tester</p>

<hr />

<h3>File 2 — ThinkScript for thinkorswim</h3>
<ul>
  <li>Same three signal modes: Mean Reversion, Squeeze Breakout, and %B Threshold</li>
  <li>Bollinger Squeeze <strong>Scanner script</strong> included — screen any watchlist for active squeeze setups</li>
  <li>%B indicator plotted as a separate sub-panel</li>
  <li>Configurable band length (default 20) and deviation multiplier (default 2.0)</li>
  <li>Upper/lower band alert conditions ready to activate in the thinkorswim Alert Wizard</li>
</ul>
<p><strong>How to use:</strong> Open thinkorswim → Studies → Edit Studies → Create → Paste → Apply to chart. Use the Scan script to screen your watchlist.</p>

<hr />

<p><em>Works on all asset classes. Best results on instruments with well-defined ranges or breakout tendencies.</em></p>
    `.trim(),
    vendor: "AutoTrader",
    productType: "Trading Script",
    tags: ["pinescript", "thinkscript", "tradingview", "thinkorswim", "bollinger-bands", "strategy", "technical-analysis"],
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────

async function createListing(listing, index) {
  console.log(`\n[${index + 1}/2] Creating: "${listing.title}"...`);

  const data = await gql(CREATE_PRODUCT, {
    product: {
      title: listing.title,
      descriptionHtml: listing.descriptionHtml,
      vendor: listing.vendor,
      productType: listing.productType,
      tags: listing.tags,
      status: "ACTIVE",
    },
  });

  const { product, userErrors } = data.productCreate;
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => `${e.field}: ${e.message}`).join("; "));
  }

  // Set price on the default variant
  const variantData = await gql(GET_VARIANT, { id: product.id });
  const variantId = variantData.product.variants.edges[0]?.node?.id;

  if (variantId) {
    const priceData = await gql(UPDATE_VARIANT_PRICE, {
      productId: product.id,
      variants: [{ id: variantId, price: PRICE }],
    });
    const priceErrors = priceData.productVariantsBulkUpdate?.userErrors ?? [];
    if (priceErrors.length) {
      console.warn(`  ⚠️  Price update errors: ${priceErrors.map((e) => e.message).join("; ")}`);
    }
  }

  console.log(`  ✅ Created → handle: "${product.handle}" | status: ${product.status}`);
  console.log(`     Admin URL: https://${SHOP}/admin/products/${product.id.split("/").pop()}`);
  return product;
}

console.log(`\n🛒  Creating 2 Shopify listings on ${SHOP} at €${PRICE} each (Pine Script + ThinkScript per listing)...\n`);
console.log("=".repeat(60));

const results = [];
for (let i = 0; i < listings.length; i++) {
  try {
    const product = await createListing(listings[i], i);
    results.push({ ok: true, title: product.title });
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    results.push({ ok: false, title: listings[i].title, error: err.message });
  }
}

console.log("\n" + "=".repeat(60));
console.log("\n📋  Summary:");
for (const r of results) {
  console.log(`  ${r.ok ? "✅" : "❌"}  ${r.title}`);
}
const failed = results.filter((r) => !r.ok).length;
if (failed === 0) {
  console.log(`\n🎉  All 2 listings created on ${SHOP}!`);
} else {
  console.log(`\n⚠️   ${failed} listing(s) failed. Review errors above.`);
}
