# Auto-Trader Agent

## Scope
- Use this agent for implementation work in the Auto-Trader web app, including frontend changes, Cloud Functions, localization, and deployment updates.

## Localization
- When visible frontend text changes, update `public/i18n/en.json`, `public/i18n/de.json`, `public/i18n/es.json`, `public/i18n/fr.json`, `public/i18n/pt.json`, and `public/i18n/ar.json` in the same task.
- Replace hardcoded UI copy with translation lookups and keep translation keys stable and descriptive.

## Crypto Payments
- Use NOWPayments as the default crypto gateway unless a task explicitly says otherwise.
- Keep order creation, status polling, and callback handling inside Cloud Functions.
- Store gateway credentials in Google Cloud or Firebase Secret Manager, not in source control.

## Deployment
- Deploy the current Firebase Hosting, Functions, and Firestore rules directly from CI.
- Do not add deploy-time cleanup steps for retired CoinGate functions; remove obsolete functions only as an explicit maintenance action when required.

## Shopify Scripts
All Shopify scripts live in `scripts/` and require `SHOPIFY_SHOP` and `SHOPIFY_ACCESS_TOKEN` in `functions/.env`. If the token is absent, set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` to trigger an automatic OAuth flow.

- `scripts/create-shopify-listings.mjs` — creates Shopify product listings from a local data source.
- `scripts/create-all-shopify-products.mjs` — bulk-creates all products on the Shopify store.
- `scripts/add-shopify-images.mjs` — attaches images to existing Shopify products; images are stored on Shopify and locally, never committed to the repo.
- `scripts/check-and-create-product-images.mjs` — verifies that each product has images and creates missing ones.
- `scripts/generate-hq-charts.mjs` — generates high-quality chart images for products.
- `scripts/generate-pro-charts.mjs` — generates pro-tier chart images for products.
- `scripts/publish-products-to-channels.mjs` — publishes all products to the first N sales channels (default 5). Run with `--list-only` to preview channels without publishing.

Run any script with: `node scripts/<script-name>.mjs`

## IndexNow (SEO Indexing)
IndexNow allows instant URL submission to Bing and other search engines.

- Key file: `public/69f79fd8505c47deae19d9a9b602657b.txt` — must be present in `dist/auto-trading/browser/` before deploying so it is served at `https://invest-begin.com/69f79fd8505c47deae19d9a9b602657b.txt`.
- Submission script: `scripts/submit-indexnow.mjs` — reads all URLs from `public/sitemap.xml` and POSTs them in bulk to `api.indexnow.org`.
- Run after every deployment that adds or changes public URLs: `node scripts/submit-indexnow.mjs`
- If the script returns HTTP 403 `SiteVerificationNotCompleted`, wait a few minutes for Bing to crawl the key file and retry. Ensure the site is registered in [Bing Webmaster Tools](https://www.bing.com/webmasters) to speed up verification.
- The key file must also be copied to `dist/auto-trading/browser/` after each fresh build (Angular build copies `public/` assets, but if deploying without a rebuild, copy manually).
