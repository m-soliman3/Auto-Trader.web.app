#!/usr/bin/env node

/**
 * Open Google Cloud Console to set IAM permissions automatically
 */

const { execSync } = require('child_process');

const PROJECT_ID = 'autotrader-b8851';
const REGION = 'us-central1';
const FUNCTION_NAME = 'getPortfolio';

console.log('🌐 Opening Google Cloud Console...\n');

// The direct link to the function details page
const url = `https://console.cloud.google.com/cloudfunctions/details/${REGION}/${FUNCTION_NAME}?project=${PROJECT_ID}`;

console.log('URL:', url);
console.log('\n📋 Once the page opens, follow these steps:\n');
console.log('1️⃣  Click "Permissions" tab (top of page)');
console.log('2️⃣  Click "Grant Access" button');
console.log('3️⃣  In "New principals" field, enter: allUsers');
console.log('4️⃣  In "Select a role" dropdown, find: Cloud Functions Invoker');
console.log('5️⃣  Click "Save"\n');
console.log('⏱️  Takes about 30 seconds\n');

try {
  // Try to open the URL
  execSync(`open "${url}"`, { stdio: 'ignore' });
  console.log('✅ Browser opened!\n');
} catch (e) {
  console.log('❌ Could not open browser automatically.\n');
  console.log('📌 Please open this link manually:\n');
  console.log(`   ${url}\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('When done, run this to test:\n');
console.log('curl -X POST https://us-central1-autotrader-b8851.cloudfunctions.net/getPortfolio \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \\');
console.log('  -d \'{"exchangeId":"alpaca-paper","apiKey":"PKOPFTLUYVRJOPB237GEAIXJAI"}\'\n');
