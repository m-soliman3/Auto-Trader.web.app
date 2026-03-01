#!/usr/bin/env node

/**
 * Set Cloud Function IAM permissions using Firebase Admin SDK
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase with the default credentials from your local environment
// This uses the Application Default Credentials (ADC)
try {
  admin.initializeApp({
    projectId: 'autotrader-b8851'
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.log('⚠️  Firebase initialization:', error.message);
}

const iam = require('@google-cloud/iam-credentials');

async function setFunctionAsPublic() {
  try {
    console.log('\n🔐 Setting Cloud Function as publicly accessible...\n');

    const iamClient = new iam.v1.IAMCredentialsClient();

    const resource = 'projects/autotrader-b8851/locations/us-central1/functions/getPortfolio';

    // Get current IAM policy
    console.log('📋 Getting current IAM policy...');
    const [policy] = await iamClient.getIamPolicy({
      resource: resource
    });

    console.log('Policy retrieved:', JSON.stringify(policy, null, 2));

    // Add allUsers as Cloud Functions Invoker
    const binding = {
      role: 'roles/cloudfunctions.invoker',
      members: ['allUsers']
    };

    // Check if binding already exists
    let foundBinding = false;
    if (policy.bindings) {
      for (const b of policy.bindings) {
        if (b.role === binding.role) {
          b.members = [...new Set([...b.members, ...binding.members])];
          foundBinding = true;
          break;
        }
      }
    }

    if (!foundBinding) {
      if (!policy.bindings) {
        policy.bindings = [];
      }
      policy.bindings.push(binding);
    }

    console.log('\n🚀 Updating IAM policy...');
    const [updatedPolicy] = await iamClient.setIamPolicy({
      resource: resource,
      policy: policy
    });

    console.log('\n✅ SUCCESS! Cloud Function is now publicly accessible');
    console.log('\n📝 Updated policy:', JSON.stringify(updatedPolicy, null, 2));

    console.log('\n🧪 Test the endpoint with:');
    console.log(`curl -X POST https://us-central1-autotrader-b8851.cloudfunctions.net/getPortfolio \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \\');
    console.log('  -d \'{"exchangeId":"alpaca-paper","apiKey":"YOUR_ALPACA_KEY"}\'');

  } catch (error) {
    console.error('\n❌ Error setting IAM policy:', error.message);
    console.error('\n⚠️  Alternative: Use the Google Cloud Console UI');
    console.error('1. Go to: https://console.cloud.google.com/cloudfunctions/details/us-central1/getPortfolio');
    console.error('2. Click the "Permissions" tab');
    console.error('3. Click "Grant Access"');
    console.error('4. Add principal: allUsers');
    console.error('5. Role: Cloud Functions Invoker');
    console.error('6. Click "Save"');
    process.exit(1);
  }
}

setFunctionAsPublic();
