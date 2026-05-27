#!/usr/bin/env node
/**
 * Replaces product images for the 2 strategy listings with self-hosted
 * chart images from invest-begin.com.
 *
 * IMPORTANT: Run this script AFTER deploying to Firebase Hosting so that
 *            Shopify can fetch the image URLs from invest-begin.com.
 *
 * Usage:
 *   node scripts/add-shopify-images.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load functions/.env ───────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../functions/.env");

try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
} catch { /* env file optional */ }

const SHOP         = process.env.SHOPIFY_SHOP;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOP || !ACCESS_TOKEN) {
  console.error("❌  SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN must be set in functions/.env");
  process.exit(1);
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

// ── Products & images ─────────────────────────────────────────────────────────

const BASE_URL = "https://invest-begin.com";

const products = [
  {
    name: "Ichimoku Cloud Strategy",
    id: "gid://shopify/Product/15679457427786",
    // Media to delete before adding new image
    existingMediaIds: ["gid://shopify/MediaImage/69936299344202"],
    imageUrls: [
      `${BASE_URL}/images/strategies/ichimoku-cloud.png`,
    ],
  },
  {
    name: "Bollinger Bands Strategy",
    id: "gid://shopify/Product/15679457493322",
    // Media to delete before adding new image
    existingMediaIds: ["gid://shopify/MediaImage/69936299409738"],
    imageUrls: [
      `${BASE_URL}/images/strategies/bollinger-bands.png`,
    ],
  },
];

// ── Mutations ─────────────────────────────────────────────────────────────────

const DELETE_MEDIA = `
  mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      mediaUserErrors { field message code }
    }
  }
`;

const CREATE_MEDIA = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
          image { url }
        }
      }
      mediaUserErrors { field message code }
    }
  }
`;

// ── Runner ────────────────────────────────────────────────────────────────────

async function replaceImages(product) {
  console.log(`\n⏳  Updating image(s) for "${product.name}"...`);

  // Step 1: delete existing media
  if (product.existingMediaIds?.length) {
    console.log(`  🗑️   Deleting ${product.existingMediaIds.length} existing image(s)...`);
    const delData = await gql(DELETE_MEDIA, {
      productId: product.id,
      mediaIds: product.existingMediaIds,
    });
    const { deletedMediaIds, mediaUserErrors } = delData.productDeleteMedia;
    if (mediaUserErrors?.length) {
      console.warn(`  ⚠️   Delete warnings: ${mediaUserErrors.map(e => `${e.code}: ${e.message}`).join("; ")}`);
    } else {
      console.log(`  ✅  Deleted: ${deletedMediaIds.join(", ")}`);
    }
  }

  // Step 2: add new media
  const media = product.imageUrls.map((url) => ({
    originalSource: url,
    mediaContentType: "IMAGE",
  }));

  const data = await gql(CREATE_MEDIA, { productId: product.id, media });
  const { media: created, mediaUserErrors } = data.productCreateMedia;

  if (mediaUserErrors?.length) {
    throw new Error(mediaUserErrors.map((e) => `${e.code}: ${e.message}`).join("; "));
  }

  for (const m of created) {
    console.log(`  ✅  New image queued — Shopify is processing it asynchronously.`);
    console.log(`      Media ID: ${m.id}`);
  }
}

console.log(`\n🖼️   Replacing images on 2 products on ${SHOP}...\n`);
console.log("=".repeat(60));

const results = [];
for (const product of products) {
  try {
    await replaceImages(product);
    results.push({ ok: true, name: product.name });
  } catch (err) {
    console.error(`  ❌  Failed for "${product.name}": ${err.message}`);
    results.push({ ok: false, name: product.name });
  }
}

console.log("\n" + "=".repeat(60));
console.log("\n📋  Summary:");
for (const r of results) {
  console.log(`  ${r.ok ? "✅" : "❌"}  ${r.name}`);
}

const failed = results.filter((r) => !r.ok).length;
if (failed === 0) {
  console.log(`\n🎉  Images replaced. Shopify processes them in the background — check your admin in ~30s.`);
  console.log(`    Ichimoku: https://${SHOP}/admin/products/15679457427786`);
  console.log(`    Bollinger: https://${SHOP}/admin/products/15679457493322`);
}
