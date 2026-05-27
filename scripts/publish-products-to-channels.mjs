#!/usr/bin/env node
/**
 * Publishes all Shopify products to the first 3 available sales channels.
 *
 * Usage:
 *   node scripts/publish-products-to-channels.mjs
 *       Lists channels, then publishes all products to the first 3.
 *
 *   node scripts/publish-products-to-channels.mjs --list-only
 *       Only list available channels; do not publish anything.
 *
 * Requires in functions/.env:
 *   SHOPIFY_SHOP           = autotradingx.myshopify.com
 *   SHOPIFY_ACCESS_TOKEN   = <admin access token with read_publications + write_publications>
 *
 * If SHOPIFY_ACCESS_TOKEN is missing or lacks the required scopes, set
 * SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in functions/.env and the
 * script will run an OAuth flow to obtain a new token automatically.
 *
 * One-time setup (if using OAuth):
 *   Shopify Partner Dashboard → Apps → <your app> → App setup →
 *   Allowed redirection URL(s) → add:  http://localhost:3000/shopify/callback
 */

import { readFileSync, appendFileSync } from "fs";
import { createServer } from "http";
import { execSync } from "child_process";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const LIST_ONLY = process.argv.includes("--list-only");
const MAX_CHANNELS  = 5;
const CALLBACK_PORT = 3000;
const CALLBACK_PATH = "/shopify/callback";
const REDIRECT_URI  = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES        = "read_products,write_products,read_publications,write_publications";

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = resolve(ROOT, "functions/.env");

function loadEnv() {
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const k = line.slice(0, eq).trim(), v = line.slice(eq + 1).trim();
      if (k && v && !process.env[k]) process.env[k] = v;
    }
  } catch { /* optional */ }
}

loadEnv();

const SHOP          = process.env.SHOPIFY_SHOP;
const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

if (!SHOP) {
  console.error("❌  SHOPIFY_SHOP must be in functions/.env");
  process.exit(1);
}

// ── OAuth helpers (only used when token is absent) ────────────────────────────
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

async function runOAuthFlow() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      "❌  No SHOPIFY_ACCESS_TOKEN found and SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are not set.\n" +
      "    Add them to functions/.env to run the OAuth flow, or set SHOPIFY_ACCESS_TOKEN directly\n" +
      "    (the token must have: read_publications, write_publications scopes)."
    );
    process.exit(1);
  }

  const state   = randomBytes(16).toString("hex");
  const authUrl =
    `https://${SHOP}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  console.log("\n🔐  Shopify OAuth required (need read_publications + write_publications scopes).");
  console.log("    Opening your browser to authorise the app...");
  console.log(`    Auth URL:\n    ${authUrl}\n`);

  try {
    const cmd = process.platform === "win32" ? "start" :
                process.platform === "darwin" ? "open" : "xdg-open";
    execSync(`${cmd} "${authUrl}"`);
  } catch {
    console.log("    (Could not open browser automatically — please visit the URL above.)");
  }

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith(CALLBACK_PATH)) { res.writeHead(404).end(); return; }

      const params = new URL(req.url, `http://localhost:${CALLBACK_PORT}`).searchParams;

      if (params.get("state") !== state) {
        res.writeHead(400).end("State mismatch");
        server.close();
        reject(new Error("OAuth state mismatch — possible CSRF"));
        return;
      }
      if (!verifyHmac(params, CLIENT_SECRET)) {
        res.writeHead(400).end("HMAC invalid");
        server.close();
        reject(new Error("HMAC verification failed"));
        return;
      }

      const code = params.get("code");
      if (!code) { res.writeHead(400).end("Missing code"); server.close(); reject(new Error("No code")); return; }

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
  process.env.SHOPIFY_ACCESS_TOKEN = ACCESS_TOKEN;
} else {
  console.log("ℹ️   Using existing SHOPIFY_ACCESS_TOKEN from functions/.env");
}

// Helper: wipe stored token and re-auth when the existing token lacks scopes
async function reAuthIfScopeError(err) {
  const msg = err.message ?? "";
  if (!msg.includes("ACCESS_DENIED") && !msg.includes("read_publications")) return false;
  console.warn("\n⚠️   Existing token lacks required scopes (read_publications / write_publications).");
  console.warn("    Removing stale token and re-authenticating via OAuth...\n");
  // Remove only the SHOPIFY_ACCESS_TOKEN line from the env file
  try {
    const raw = readFileSync(envPath, "utf-8");
    const cleaned = raw.split("\n").filter((l) => !l.startsWith("SHOPIFY_ACCESS_TOKEN=")).join("\n");
    const { writeFileSync } = await import("fs");
    writeFileSync(envPath, cleaned, "utf-8");
  } catch { /* ignore */ }
  delete process.env.SHOPIFY_ACCESS_TOKEN;
  ACCESS_TOKEN = await runOAuthFlow();
  process.env.SHOPIFY_ACCESS_TOKEN = ACCESS_TOKEN;
  return true;
}

const GQL   = `https://${SHOP}/admin/api/2024-04/graphql.json`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function shopify(query, variables = {}) {
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

// ── Fetch all publications (sales channels) ───────────────────────────────────
async function getPublications() {
  const data = await shopify(`{
    publications(first: 20) {
      edges {
        node {
          id
          name
          app { title }
        }
      }
    }
  }`);
  return data.publications.edges.map((e) => e.node);
}

// ── Fetch all products (paginated) ────────────────────────────────────────────
async function getAllProducts() {
  const products = [];
  let cursor = null;
  let page = 1;
  do {
    const data = await shopify(`
      query getProducts($after: String) {
        products(first: 50, after: $after) {
          edges {
            cursor
            node { id title handle }
          }
          pageInfo { hasNextPage }
        }
      }
    `, { after: cursor });

    const edges = data.products.edges;
    for (const { node } of edges) products.push(node);
    cursor = edges.length ? edges[edges.length - 1].cursor : null;
    console.log(`  📦  Page ${page}: fetched ${edges.length} products (total so far: ${products.length})`);
    page++;
    if (!data.products.pageInfo.hasNextPage) break;
    await delay(500);
  } while (true);
  return products;
}

// ── Publish one product to a list of publication IDs ─────────────────────────
const PUBLISH_MUTATION = `
  mutation productPublish($input: ProductPublishInput!) {
    productPublish(input: $input) {
      product { id title }
      userErrors { field message }
    }
  }
`;

async function publishProduct(productId, publicationIds) {
  const data = await shopify(PUBLISH_MUTATION, {
    input: {
      id: productId,
      productPublications: publicationIds.map((publicationId) => ({ publicationId })),
    },
  });
  const { userErrors } = data.productPublish;
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => `${e.field}: ${e.message}`).join("; "));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🛒  Connecting to ${SHOP}...\n`);

let publications;
try {
  publications = await getPublications();
} catch (err) {
  const retried = await reAuthIfScopeError(err);
  if (!retried) throw err;
  publications = await getPublications();
}
if (!publications.length) {
  console.error("❌  No sales channels found on this store.");
  process.exit(1);
}

console.log(`📡  Available sales channels (${publications.length} total):`);
publications.forEach((p, i) => {
  const appLabel = p.app?.title ? ` (${p.app.title})` : "";
  console.log(`  [${i + 1}] ${p.name}${appLabel}  →  ${p.id}`);
});

if (LIST_ONLY) {
  console.log("\n(--list-only: no products were published)\n");
  process.exit(0);
}

const targetChannels = publications.slice(0, MAX_CHANNELS);
const targetIds      = targetChannels.map((p) => p.id);

console.log(`\n✅  Publishing all products to these ${targetChannels.length} channel(s):`);
targetChannels.forEach((p) => console.log(`   • ${p.name}`));

console.log("\n📦  Fetching all products...\n");
const products = await getAllProducts();
console.log(`\n🎯  ${products.length} product(s) found. Publishing now...\n`);
console.log("=".repeat(60));

let success = 0;
let failed  = 0;

for (let i = 0; i < products.length; i++) {
  const product = products[i];
  try {
    await publishProduct(product.id, targetIds);
    console.log(`  [${i + 1}/${products.length}] ✅  "${product.title}" (${product.handle})`);
    success++;
  } catch (err) {
    console.error(`  [${i + 1}/${products.length}] ❌  "${product.title}": ${err.message}`);
    failed++;
  }
  // Stay within Shopify's rate limit (~2 req/s for non-Plus stores)
  if ((i + 1) % 10 === 0) await delay(1000);
  else await delay(200);
}

console.log("=".repeat(60));
console.log(`\n📋  Summary: ${success} published, ${failed} failed`);
if (failed === 0) {
  console.log(`\n🎉  All ${success} product(s) are now live on ${targetChannels.length} channel(s)!\n`);
} else {
  console.log(`\n⚠️   ${failed} product(s) failed — review errors above.\n`);
}
