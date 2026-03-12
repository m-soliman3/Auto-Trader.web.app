# Auto Trader Chatbot Backend

Standalone chatbot backend app for Auto-Trader.

## What It Does

- Exposes a secure chat API at `POST /v1/chat`
- Verifies Firebase bearer tokens before serving chat responses
- Uses Gemini when `GEMINI_API_KEY` is configured
- Can optionally use OpenAI as fallback when configured
- Falls back to a built-in rule-based assistant if AI provider is unavailable
- Returns action suggestions for:
  - connect exchange
  - create bot
  - browse strategies

## Endpoints

- `GET /health`
- `POST /v1/public-chat` (no auth, for pre-login onboarding Q&A)
- `POST /v1/chat` (requires `Authorization: Bearer <firebase_id_token>`)

Request body:

```json
{
  "message": "Help me connect Binance",
  "history": [
    { "role": "user", "content": "I am new" },
    { "role": "assistant", "content": "I can help" }
  ]
}
```

Response body:

```json
{
  "reply": "...",
  "suggestions": [
    {
      "label": "Open Connect Exchange",
      "action": "connect",
      "route": "/dashboard/real?action=connect"
    }
  ],
  "source": "openai"
}
```

## Environment

Copy `.env.example` to `.env` and fill values:

- `PORT` default `8090`
- `CHATBOT_ALLOWED_ORIGIN` default `*`
- `CHATBOT_FIREBASE_PROJECT_ID` Firebase project for ID token verification
- `CHATBOT_FIREBASE_APP_NAME` named admin app (default `chatbot-backend`)
- `CHATBOT_FIREBASE_SERVICE_ACCOUNT_JSON` optional service account JSON string
- `GEMINI_API_KEY` optional; if empty, provider fallback is used
- `GEMINI_MODEL` default `gemini-2.5-flash`
- `OPENAI_API_KEY` optional OpenAI fallback
- `OPENAI_MODEL` default `gpt-4o-mini`

## Local Run

```bash
cd chatbot-backend
npm install
npm run dev
```

## Build

```bash
cd chatbot-backend
npm run build
npm start
```

## Deploy (Cloud Run)

```bash
cd chatbot-backend
gcloud run deploy auto-trader-chatbot-backend \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CHATBOT_FIREBASE_PROJECT_ID=autotrader-b8851
```

For production, lock `CHATBOT_ALLOWED_ORIGIN` to your web app domain and store secrets in Secret Manager.
