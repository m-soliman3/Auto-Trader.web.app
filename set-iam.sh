#!/bin/bash

# Set Cloud Function IAM permissions using Firebase + REST API

PROJECT_ID="autotrader-b8851"
FUNCTION_NAME="getPortfolio"
REGION="us-central1"
RESOURCE="projects/${PROJECT_ID}/locations/${REGION}/functions/${FUNCTION_NAME}"

echo "🔐 Setting IAM permissions for Cloud Function..."
echo "   Project: $PROJECT_ID"
echo "   Function: $FUNCTION_NAME"
echo "   Region: $REGION"
echo ""

# Try to get OAuth token from Firebase CLI
echo "📋 Getting authentication token..."
TOKEN=$(firebase use autotrader-b8851 2>/dev/null && gcloud auth print-access-token 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "no-token" ]; then
  echo ""
  echo "⚠️  Could not obtain authentication token automatically."
  echo ""
  echo "✅ EASY SOLUTION: Use the Google Cloud Console (30 seconds)"
  echo ""
  echo "Steps:"
  echo "1. Open: https://console.cloud.google.com/cloudfunctions/details/us-central1/getPortfolio?project=autotrader-b8851"
  echo "2. Click the 'Permissions' tab at the top"
  echo "3. Click 'Grant Access' button"
  echo "4. In 'New principals' box, type: allUsers"
  echo "5. In 'Select a role' dropdown, search for and select: Cloud Functions Invoker"
  echo "6. Click 'Save'"
  echo ""
  echo "That's it! Your function will be publicly accessible."
  echo ""
  exit 0
fi

echo "✅ Got authentication token"
echo ""

# Prepare the IAM policy JSON
POLICY=$(cat <<EOF
{
  "policy": {
    "bindings": [
      {
        "role": "roles/cloudfunctions.invoker",
        "members": ["allUsers"]
      }
    ]
  },
  "updateMask": "bindings"
}
EOF
)

echo "🚀 Sending IAM policy update to Google Cloud..."
RESPONSE=$(curl -s -X POST \
  "https://cloudfunctions.googleapis.com/v1/${RESOURCE}:setIamPolicy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$POLICY")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"bindings"'; then
  echo ""
  echo "✅ SUCCESS! Cloud Function is now publicly accessible"
  echo ""
  echo "🧪 Test the endpoint:"
  echo "curl -X POST https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME} \\"
  echo '  -H "Content-Type: application/json" \'
  echo '  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \'
  echo '  -d '"'"'{"exchangeId":"alpaca-paper","apiKey":"YOUR_ALPACA_KEY"}'"'"
  exit 0
else
  echo ""
  echo "❌ Request failed. Error details above."
  exit 1
fi
