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
