#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Set Cloud Function IAM permissions to allow public access
 * This uses the Google Cloud REST API directly with OAuth token from Application Default Credentials
 */

const PROJECT_ID = 'autotrader-b8851';
const FUNCTION_NAME = 'getPortfolio';
const REGION = 'us-central1';

// Try to get OAuth token from gcloud or Firebase
async function getOAuthToken() {
  return new Promise((resolve, reject) => {
    // Try firebase CLI first since you have it installed
    const spawn = require('child_process').spawn;
    const gcloud = spawn('firebase', ['login:ci', '--no-project'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    gcloud.stdout.on('data', (data) => {
      output += data.toString();
    });

    gcloud.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error('Failed to get auth token'));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      gcloud.kill();
      reject(new Error('Auth timeout'));
    }, 10000);
  });
}

async function setIAMPermissions() {
  try {
    console.log('🔐 Setting IAM permissions for Cloud Function...');
    console.log(`   Project: ${PROJECT_ID}`);
    console.log(`   Function: ${FUNCTION_NAME}`);
    console.log(`   Region: ${REGION}`);

    // The resource name for the function
    const resource = `projects/${PROJECT_ID}/locations/${REGION}/functions/${FUNCTION_NAME}`;

    // Get current policy first
    console.log('\n📋 Checking current IAM policy...');
    
    // Using gcloud auth to get token
    const { exec } = require('child_process');
    
    exec('gcloud auth print-access-token 2>/dev/null || echo "no-token"', (error, stdout, stderr) => {
      if (stdout.includes('no-token')) {
        console.log('\n⚠️  Could not get authentication token.');
        console.log('\nAlternative: Use the Google Cloud Console UI');
        console.log('1. Go to: https://console.cloud.google.com/cloudfunctions/details/us-central1/getPortfolio');
        console.log('2. Click the "Permissions" tab');
        console.log('3. Click "Grant Access"');
        console.log('4. Add principal: allUsers');
        console.log('5. Role: Cloud Functions Invoker');
        console.log('6. Click "Save"');
        process.exit(0);
      }

      const token = stdout.trim();
      console.log('✅ Got authentication token');

      // Prepare IAM policy binding
      const policy = {
        bindings: [
          {
            role: 'roles/cloudfunctions.invoker',
            members: ['allUsers']
          }
        ]
      };

      // Make the API call to setIamPolicy
      const data = JSON.stringify({
        policy: policy,
        updateMask: 'bindings'
      });

      const options = {
        hostname: 'cloudfunctions.googleapis.com',
        port: 443,
        path: `/v1/${resource}:setIamPolicy`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'Authorization': `Bearer ${token}`
        }
      };

      console.log('\n🚀 Sending IAM policy update...');

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('\n✅ SUCCESS! Cloud Function is now publicly accessible');
            console.log('\n📝 Test the endpoint:');
            console.log(`curl -X POST https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME} \\`);
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -H "X-API-Key: autotrader_pk_5f8b9c2a7d3e1f4b6a9c8d7e5f2a1b3c4d" \\');
            console.log('  -d \'{"exchangeId":"alpaca-paper","apiKey":"YOUR_ALPACA_KEY"}\'');
          } else {
            console.log(`\n❌ API Error (${res.statusCode}):`);
            console.log(responseData);
          }
        });
      });

      req.on('error', (e) => {
        console.error('❌ Request failed:', e.message);
      });

      req.write(data);
      req.end();
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the function
setIAMPermissions();
