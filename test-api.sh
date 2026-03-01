#!/bin/bash

echo "🧪 Testing Cloud Function endpoint..."
echo ""

RESPONSE=$(curl -s -X POST https://us-central1-autotrader-b8851.cloudfunctions.net/getPortfolio \
  -H "Content-Type: application/json" \
  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \
  -d '{"exchangeId":"alpaca-paper","apiKey":"PKOPFTLUYVRJOPB237GEAIXJAI"}')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q "portfolioValue"; then
  echo ""
  echo "✅ SUCCESS! Cloud Function is working!"
  echo ""
  echo "🎉 Your API endpoint is now live and ready to use!"
else
  echo ""
  if echo "$RESPONSE" | grep -q "403"; then
    echo "❌ Still getting 403 Forbidden"
    echo "   Try waiting 30 more seconds for permissions to propagate..."
  elif echo "$RESPONSE" | grep -q "401"; then
    echo "❌ Got 401 Unauthorized - API key issue"
  else
    echo "⚠️  Unexpected response - check above"
  fi
fi
