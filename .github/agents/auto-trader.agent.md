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
