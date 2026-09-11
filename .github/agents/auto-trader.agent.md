---
name: auto-trader
description: Use for Auto-Trader web app changes, especially feature work, localization updates, and payment-flow integrations.
argument-hint: A concrete task such as "update a feature", "add translations", "swap the crypto gateway", or "fix a workflow".
# tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

## Agent Scope

Use this agent for implementation work in the Auto-Trader web app, with a focus on frontend changes, backend Cloud Functions, localization, and deployment-related updates.

## Agent Maintenance Rule

Keep this agent definition current as the project evolves.

Follow this rule after meaningful code changes:
1. If behavior, workflow, architecture, deployment steps, payment flow, or localization process changed, update this file in the same task.
2. Add or refine only durable instructions (avoid temporary one-off notes).
3. Keep instructions concise, actionable, and organized by section.
4. If no lasting behavior changed, explicitly leave this file unchanged.

## Translation Procedure

When making any change that affects visible text, punctuation, labels, buttons, images, or orientation in the frontend, add the new key and its English value to `public/i18n/en.json` (the source file), then add the translated equivalent to each of the five target locale files: de.json, es.json, fr.json, pt.json, and ar.json.

Follow this procedure:
1. Add a unique, descriptive translation key in `public/i18n/en.json`.
2. Add the matching translated key and value to `public/i18n/de.json`, `public/i18n/es.json`, `public/i18n/fr.json`, `public/i18n/pt.json`, and `public/i18n/ar.json`.
3. Replace hardcoded UI strings with `translate` bindings or equivalent i18n lookups.
4. Keep translation keys stable and descriptive, especially for repeated UI areas such as payment panels, call-to-action buttons, and error messages.
5. Verify that no visible copy remains untranslated before finishing.
6. If a high-quality translation cannot be confirmed for a given locale, insert the English value as a temporary placeholder and add a TODO comment in that locale file (e.g., `// TODO: professional review needed`) rather than leaving the key absent or empty.

## Crypto Payment Gateway Procedure

For crypto payment work, use NOWPayments as the preferred gateway unless the task explicitly says otherwise.

Follow this integration pattern in the order below:

**A) Security & Secrets**
1. Store gateway credentials in Google Cloud / Firebase Secret Manager, not in source code.
2. Use the secret names `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_PUBLIC_KEY`.
3. Keep Firestore order records locked down so only Cloud Functions can create and update them.

**B) Backend Implementation**
4. Keep the order creation, status polling, and callback handling inside Cloud Functions.
5. Validate requested `pay_currency` server-side against NOWPayments merchant-enabled currencies before creating an order. If `pay_currency` fails validation, the Cloud Function must return HTTP 400 with a JSON body `{ "error": "unsupported_currency", "message": "<pay_currency> is not enabled for this merchant" }` and must not call the NOWPayments order-creation API.
6. Expose a Cloud Function endpoint for authenticated clients to fetch merchant-enabled currencies, and update Hosting rewrites when endpoint names change.

**C) Frontend & Validation**
7. For top-up checkout, support user-selected `pay_currency` values (not BTC-only), with quick choices for BTC/ETH/USDT/DOGE and an "other" list sourced from merchant-enabled NOWPayments currencies.
8. Update any user-facing crypto labels or status text through the translation procedure above.
9. Validate the backend build and the frontend build after the change.

## Architecture

- Bots and Strategies are merged: the strategy creation wizard (4-step `create-strategy-modal`) handles both bot settings and strategy settings in one flow. There is no standalone "Create Bot" flow for users.
- The "Getting Started" checklist on the dashboard tracks: account creation → exchange connection → first strategy created → first active strategy. It does not reference bots directly.
- `tradeSide` on a strategy supports three values: `'buy'` (buy-only), `'sell'` (sell-only, including shorts), and `'buySell'` (both directions). Backend `engine/signals.ts` passes `preferredSide = null` for `buySell`, allowing both signal directions through.
- Broker-provisioned `alpaca-paper` strategies (CK credentials or `brokerProvisioned=true`) must execute orders via Alpaca Broker sandbox trading endpoints with OAuth and `alpacaBrokerAccountId`; do not route these orders to `paper-api.alpaca.markets`.
- Every entry in `LEARN_PAGES` (`src/app/pages/learn/learn-detail.ts`), including `blog` category pages, must have a matching slug entry in the `bySlug` map inside `codeProfileForPage()`. A missing mapping throws a runtime error ("Missing strategy code profile mapping for learn page slug: ..."), so add the mapping in the same change whenever a new learn/blog page is added.
- Blog post content lives only in the base `LEARN_PAGES` TypeScript object for English; `public/i18n/en.json` does not contain `learnPages.<slug>` keys for blog posts. Only the 5 non-English locale files (de/es/fr/pt/ar.json) carry explicit `learnPages.<slug>` translation objects (title, tagline, metaTitle, metaDescription, overview, howItWorks, externalLinks as `{label, description}` — no `url`, since URLs are sourced only from the English TS object).
- New blog posts require entries in `prerender-routes.txt` (one line per locale per slug, e.g. `/en/blog/<slug>`) so the page is statically prerendered by `@angular/ssr`, and corresponding `<url>` entries in `public/sitemap.xml` for each locale/slug combination.

## Static Prerendering

The app uses `@angular/ssr` static prerendering (not runtime SSR). The build command (`npm run build:prod`) prerenders 420 learn page routes at build time.

Architecture:
- `src/main.server.ts` — server entry point; exports a default function that `@angular/ssr` calls during prerender
- `src/app/app.config.server.ts` — server config with `provideServerRendering()` and a filesystem-based `TranslateLoader`
- `prerender-routes.txt` — lists all 420 learn-page routes (70 slugs × 6 languages)
- Angular outputs prerendered HTML files into `dist/auto-trading/browser/<lang>/learn/<slug>/index.html`
- `dist/auto-trading/browser/index.csr.html` — the client-side SPA shell; Firebase Hosting's `**` fallback points here (not `index.html`)

SSR compatibility rules (enforce for all future components/services):
- Never access `localStorage`, `sessionStorage`, `window`, `document`, `navigator`, `location`, or `history` outside an `isPlatformBrowser(this.platformId)` guard
- Inject `PLATFORM_ID` via `inject(PLATFORM_ID)` and check with `isPlatformBrowser` from `@angular/common`
- Component `ngOnInit` IS called during prerender — guard browser-only code there too
- For `window.setTimeout/clearTimeout`, use `globalThis.setTimeout/clearTimeout` instead

## Dark Mode / Theme Toggle

- The navbar dark/light mode toggle (`showThemeToggle`) is visible **only to non-logged-in users** (homepage, learn pages, marketing pages, etc.).
- Logged-in users control their theme exclusively through the Settings page; the toggle must not appear in the navbar for authenticated sessions.
- `showThemeToggle` is a computed signal in `src/app/navbar/navbar.ts`: keep it set to `this.auth.currentUser() === null`.

## Consent Banner

The consent banner (`src/app/components/consent-banner.ts`) uses a two-state floating UI:

- **Collapsed (default):** A single 48px bar fixed to the bottom of the viewport. Shows the banner title, compact "Decline All" / "Accept All" buttons, and a chevron-up expand button.
- **Expanded:** Clicking the expand button grows the panel to `max-height: 50vh` (~half the viewport), revealing the full description, collapsible detail sections, and full-size action buttons. A chevron-down button at the top collapses it back to the bar.

Rules:
- `isExpanded: boolean` tracks the toggle state; `toggleExpand()` flips it.
- The collapsed bar must remain a single line — never let it wrap to multiple lines.
- The expanded panel must be capped at `50vh` with `overflow-y: auto`.
- On mobile (≤640px), hide `.consent-bar-text` to keep the bar compact; keep action buttons and the expand toggle visible.
- Do not change the accept/decline cookie logic — only the presentation layer is collapsible.

## Homepage Ad Banners

The homepage carries two affiliate ad slots, rendered in `src/app/pages/home.html` immediately
**after** the closing `</section>` of the hero:

- **Left — AvaTrade skyscraper** (`src/app/components/ad-banner-skyscraper.ts`), 120x600. Injects an
  AvaPartner tracking iframe client-side, so it needs `ngSkipHydration` and an `afterNextRender` +
  `isPlatformBrowser` guard. Accepts a `side` input (`'left' | 'right'`, default `'left'`).
- **Right — eToro banner** (`src/app/components/ad-widget-etoro.ts`), 300x600 native. A **static**
  anchor + `<img>` creative served from `med.etoro.com` (creative `B20158_A122755`, a ~513KB
  animated GIF). Because it is plain markup it needs no browser guard and no `ngSkipHydration` — it
  prerenders and hydrates normally.

Do **not** reintroduce eToro's `iframe-creator.js` popular-investor widget. Its host
`pages.etoro.com` returns HTTP 530 (Cloudflare Error 1016, origin DNS failure) on every path, so the
widget cannot render at all; `widgets.etoro.com` now redirects to the eToro homepage, indicating the
widget product was retired. Replacement creatives come from the Partners portal at `por.etoro.com`.

Rules:
- Keep both elements **outside** the hero `<section>`, which uses `overflow: hidden`.
- Both slots use `position: absolute` (**not** `fixed`), anchored at `top: 96px` — the upper part of
  the page just below the navbar logo, top- and bottom-aligned with each other. They scroll away
  with the content. Do not switch them back to `fixed`: that makes them track the viewport and
  overlap the stats bar and the sections below the hero as the user scrolls.
- Horizontal offsets centre each banner in the gutter **outside** the 1200px `.container` column:
  `calc((100% - 1200px) / 2 / 2 - <half the banner width>)`. Use `100%` rather than `100vw` — these
  are absolutely positioned, so percentages resolve against the initial containing block, which
  excludes the scrollbar. Never add the gutter (`+ 1.5rem`) instead of subtracting the banner width:
  that places the creative *inside* the content column, on top of the hero.
- Both banners appear at `@media (min-width: 1480px)` so they show and hide together. A
  fixed-width banner needs `1200 + 2 x (width + ~16px)` of viewport, which is why eToro is **not**
  fixed-width: at its native 300px that would be 1840px, hiding it on every laptop (a 14" MacBook is
  1512px, a 16" is 1728px) so in practice almost nobody saw it. Instead its host spans the whole
  gutter (`right: 0; width: calc((100% - 1200px) / 2)`) and the creative is centred inside with
  `width: 100%; max-width: 300px; height: auto` — filling the gutter, never exceeding native size,
  and holding the 1:2 ratio. It renders ~108px wide at 1480px and reaches full 300x600 from 1920px.
  Keep the `width`/`height` attributes on the `<img>` so that ratio is known before the image loads.
  Prefer this pattern over raising the breakpoint when a creative is too wide for the gutter.
- The absolute offsets resolve against the initial containing block, so never introduce a
  `transform`, `filter`, `contain`, or non-static `position` on an ancestor of `<app-home>` without
  re-checking the banner positions.
- The positioning CSS must live in each component's `:host` styles, **not** in `home.scss`. Angular's
  view encapsulation scopes `home.scss` to the parent, so it cannot style a child component's host
  element and the positioning silently breaks.
- The host elements are `aria-hidden="true"` and carry no first-party copy, so the translation
  procedure does not apply to them. The eToro link is `tabindex="-1"` to keep a focusable element out
  of an `aria-hidden` subtree.

Verification caveat: `tracking.avapartner.com` sits behind Cloudflare bot protection and returns
HTTP 403 with `X-Frame-Options: SAMEORIGIN` to headless browsers, so the AvaTrade slot renders blank
under automation while working fine in a real browser. **An empty AvaTrade slot in an automated
browser is not evidence of a regression** — confirm in a real browser session before debugging it.
The eToro creative is a plain image and does render under automation.

## Exchange Connection UI (Alpaca OAuth + Manual Entry)

The "Connect with Alpaca" OAuth button and the "or enter API keys manually" manual-entry toggle are duplicated across **three** components, because each has its own independent exchange-selection state (`selectedExchange`/`selected`, `exchangeStep`/`step`, `isAlpacaSelected`, `manualEntryExpanded`, `connectAlpacaOAuth()`) rather than sharing one:

1. `src/app/components/connect-exchange-modal.ts` / `.html` / `.scss` — the modal opened from the **Exchanges page** (`src/app/pages/exchanges.ts` embeds `<app-connect-exchange-modal>` directly, so this page does not need separate edits).
2. `src/app/components/paper-money-onboarding-modal.ts` / `.html` / `.scss` — shown to new users on first paper-trading top-up.
3. `src/app/components/real-money-onboarding-modal.ts` / `.html` / `.scss` — shown to new users on first real-money top-up.

Any change to the Alpaca OAuth flow, the manual API-key form, or the toggle between them must be applied identically to **all three** components above — they are not derived from a shared base, so updating only one leaves the others stale. Pattern to preserve: OAuth "Connect with Alpaca" button is the primary, always-visible option for Alpaca/Alpaca Paper; "or enter API keys manually" is a `manual-entry-toggle` button (not a static divider) that expands the label/API key/secret/passphrase fields and the submit button via `manualEntryExpanded()`; non-Alpaca exchanges always show the manual fields directly since they have no OAuth alternative. Reset `manualEntryExpanded` to `false` whenever an exchange is (re)selected or the user navigates back to the exchange list.

## Security Expectations

- New user Firestore profiles always include `onboardingCompleted: false` (set explicitly at registration and in `onAuthStateChanged` fallback). The dashboard redirects to the signup guide only when `user.onboardingCompleted === false` (strict equality), never for `undefined`. This prevents existing users whose profiles predate the field from being sent to the questionnaire.

## Shopify Scripts
All Shopify scripts live in `scripts/` and require `SHOPIFY_SHOP` and `SHOPIFY_ACCESS_TOKEN` in `functions/.env`. If the token is absent, set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` to trigger an automatic OAuth flow.

- `scripts/create-shopify-listings.mjs` — creates Shopify product listings from a local data source.
- `scripts/create-all-shopify-products.mjs` — bulk-creates all products on the Shopify store.
- `scripts/add-shopify-images.mjs` — attaches images to existing Shopify products; images are stored on Shopify and locally, never committed to the repo.
- `scripts/check-and-create-product-images.mjs` — verifies that each product has images and creates missing ones.
- `scripts/generate-hq-charts.mjs` — generates high-quality chart images for products.
- `scripts/generate-pro-charts.mjs` — generates pro-tier chart images for products.
- `scripts/publish-products-to-channels.mjs` — publishes all products to the first N sales channels (default 5). Run with `--list-only` to preview channels without publishing.

## IndexNow (SEO Indexing)
IndexNow allows instant URL submission to Bing and other search engines.

- Key file: `public/69f79fd8505c47deae19d9a9b602657b.txt` — must be present in `dist/auto-trading/browser/` before deploying so it is served at `https://invest-begin.com/69f79fd8505c47deae19d9a9b602657b.txt`.
- Submission script: `scripts/submit-indexnow.mjs` — reads all URLs from `public/sitemap.xml` and POSTs them in bulk to `api.indexnow.org`.
- Run after every deployment that adds or changes public URLs: `node scripts/submit-indexnow.mjs`
- If the script returns HTTP 403 `SiteVerificationNotCompleted`, wait a few minutes for Bing to crawl the key file and retry. Ensure the site is registered in [Bing Webmaster Tools](https://www.bing.com/webmasters) to speed up verification.
- The key file must also be copied to `dist/auto-trading/browser/` after each fresh build (Angular build copies `public/` assets, but if deploying without a rebuild, copy manually).

## Deployment Rule

After new development work, if the deployment target has not been specified, ask whether the change should be deployed to staging or production before proceeding. If staging is requested, deploy to staging and test it. If production is requested, deploy to production and confirm the change is live and working. If a deployment command fails, stop immediately, report the full error output to the user, and do not retry or proceed to the next step without explicit user instruction.

Additional deployment constraints:
- Deploy the current Firebase Hosting, Functions, and Firestore rules directly from CI.
- Do not add deploy-time cleanup steps for retired CoinGate functions; remove obsolete functions only as an explicit maintenance action when required.
