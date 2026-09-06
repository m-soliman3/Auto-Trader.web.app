# Auto Trader Backend (Cloud Run)

This is a standalone backend service for strategy evaluation and trade execution.

## Features

- Independent API service on Cloud Run
- Scheduled strategy evaluation endpoint
- Trading-hours aware execution guard
- yfinance is the default market data provider for chart/evaluation candles
- Buy/sell order execution for Binance and Alpaca

## Market Data Provider

The backend now defaults to `yfinance` for candle data used by strategy evaluation and live charts.

- `MARKET_DATA_PROVIDER=yfinance` (default): use yfinance first, then fallback to native exchange APIs if yfinance is unavailable.
- `MARKET_DATA_PROVIDER=native`: use Binance/Alpaca APIs directly.

Optional:

- `YFINANCE_PYTHON_BIN` to override the Python executable used to run yfinance (default: `python3`).

## Endpoints

- `GET /health`
- `POST /v1/run-active-strategies` (requires `x-runner-key`)
- `POST /v1/execute-strategy` (requires Firebase bearer token)
- `POST /v1/instrument-chart` (requires Firebase bearer token)

## Local Run

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
cd backend
npm run build
npm start
```

## Deploy to Cloud Run

```bash
cd backend
gcloud run deploy auto-trader-backend \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars RUNNER_API_KEY=change-me
```

## Scheduler Trigger Example

```bash
gcloud scheduler jobs create http auto-trader-runner \
  --location europe-west1 \
  --schedule "* * * * *" \
  --uri "https://YOUR_CLOUD_RUN_URL/v1/run-active-strategies" \
  --http-method POST \
  --headers "x-runner-key=change-me"
```

## Market analysis runner (read-only)

An always-on technical-analysis pass that powers the MCP connector. It reuses
`buildMarketContext` from `engine/indicators.ts` and the same condition
expressions as `engine/signals.ts`, so an answer surfaced to a user never
contradicts what their bot would do. **It never places an order.**

Snapshots are written to the top-level `marketAnalysis` collection — outside
`users/{uid}/`, so a reader never needs access to `users/{uid}/exchanges`,
which holds broker API keys. No Firestore rule matches `marketAnalysis`, so
client SDKs are denied by default and only Admin SDK callers can read it.

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/run-analysis` | `x-runner-key` | Scheduler trigger; analyses the watchlist |
| `GET` | `/v1/analysis` | `x-analysis-key` | All current snapshots |
| `GET` | `/v1/analysis/:symbol?timeframe=1h` | `x-analysis-key` | One snapshot |

`ANALYSIS_READ_KEY` is deliberately a **different secret** from
`RUNNER_API_KEY`: the runner key can trigger `/v1/run-active-strategies`, which
places real orders. A read-only consumer must never hold a credential that can
trade.

### Environment

```
ANALYSIS_READ_KEY=<generate a long random string>
ANALYSIS_SYMBOLS=AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL,META,SPY,QQQ,BTC/USD,ETH/USD
ANALYSIS_TIMEFRAMES=1h,1d
ANALYSIS_INCLUDE_STRATEGY_SYMBOLS=true   # also cover every active strategy's symbol
```

### Deploy

```bash
gcloud run deploy auto-trader-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --update-env-vars ANALYSIS_READ_KEY=...,ANALYSIS_SYMBOLS='AAPL,NVDA,BTC/USD',ANALYSIS_TIMEFRAMES='1h,1d'
```

### Schedule

Run every 5 minutes on weekdays and let the service decide whether the market
is open. `marketSessionForExchange` already handles US equity hours and DST,
and crypto is 24/7 — encoding hours in the cron instead would break twice a
year and would also stop crypto analysis overnight.

```bash
gcloud scheduler jobs create http auto-trader-analysis \
  --schedule "*/5 * * * *" \
  --time-zone "America/New_York" \
  --uri "https://YOUR_CLOUD_RUN_URL/v1/run-analysis" \
  --http-method POST \
  --headers "x-runner-key=YOUR_RUNNER_KEY,Content-Type=application/json" \
  --message-body '{}' \
  --location us-central1
```

Closed markets are skipped rather than analysed on stale bars; the previous
snapshot stays in place with its own `marketOpen: false` and timestamp, so a
reader always sees the last known state and how old it is.

### Verify without deploying

```bash
npx tsx src/tools/analysisSmoke.ts
```

Pulls real bars from Alpaca's no-auth crypto endpoint and prints a full
snapshot — no credentials, no Firestore.
