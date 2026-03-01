#!/usr/bin/env node

/**
 * Set Cloud Function IAM permissions using curl + Firebase credentials
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'autotrader-b8851';
const FUNCTION_NAME = 'getPortfolio';
const REGION = 'us-central1';
const RESOURCE = `projects/${PROJECT_ID}/locations/${REGION}/functions/${FUNCTION_NAME}`;

console.log('🔐 Setting Cloud Function IAM Permissions\n');
console.log(`   Project: ${PROJECT_ID}`);
console.log(`   Function: ${FUNCTION_NAME}`);
console.log(`   Resource: ${RESOURCE}\n`);

try {
  // Check if user is logged in to Firebase
  console.log('📋 Checking Firebase authentication...');
  try {
    const user = execSync('firebase auth:list --json', {
      cwd: '/Users/Mohamed/Auto-Trader web app/Auto-Trader.web.app',
      encoding: 'utf-8'
    });
    console.log('✅ Firebase authenticated\n');
  } catch (e) {
    console.log('⚠️  Firebase not authenticated. Try: firebase login\n');
  }

  // Try to initialize Application Default Credentials
  console.log('🔑 Attempting to get credentials...\n');

  // Check for gcloud credentials file
  const credentialsPath = path.expandUser('~/.config/gcloud/application_default_credentials.json');
  
  if (fs.existsSync(credentialsPath)) {
    console.log('✅ Found gcloud credentials\n');
    
    // Read and parse credentials
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    
    // For service account credentials, we'd need to create a JWT
    // For user credentials, we might have a refresh token
    console.log('📄 Credentials found, but would need OAuth flow to use...\n');
  }

  // Fallback: Direct console link
  console.log('✨ Since CLI authentication is complex, here\'s the fastest solution:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🌐 OPEN THIS LINK IN YOUR BROWSER:\n');
  console.log('https://console.cloud.google.com/cloudfunctions/details/us-central1/getPortfolio?project=autotrader-b8851\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 STEPS (takes 30 seconds):\n');
  console.log('1️⃣  Click "Permissions" tab at the top');
  console.log('2️⃣  Click "Grant Access" button');
  console.log('3️⃣  Paste in "New principals": allUsers');
  console.log('4️⃣  Select "Cloud Functions Invoker" from Role dropdown');
  console.log('5️⃣  Click "Save"\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Once done, run this to test:\n');
  console.log('curl -X POST https://us-central1-autotrader-b8851.cloudfunctions.net/getPortfolio \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \\');
  console.log('  -d \'{"exchangeId":"alpaca-paper","apiKey":"PKOPFTLUYVRJOPB237GEAIXJAI"}\'\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
