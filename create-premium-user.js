const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://autotrader-b8851.firebaseio.com'
});

const auth = admin.auth();
const db = admin.firestore();

async function createPremiumUser() {
  try {
    // Test credentials
    const email = 'premiumuser@test.com';
    const password = 'Test@123456!';
    
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: 'Premium Test User'
    });
    
    console.log('✓ Firebase Auth user created:', userRecord.uid);
    
    // Create Firestore document with premium status
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: 'Premium Test User',
      isPremium: true,
      premiumCreatedAt: new Date(),
      createdAt: new Date(),
      topUpBalance: 10000, // Give them $10,000 balance for testing
      alpacaStatus: 'provisioned'
    });
    
    console.log('✓ Firestore user document created with premium status');
    
    console.log('\n═══════════════════════════════════════');
    console.log('STAGING PREMIUM USER CREDENTIALS');
    console.log('═══════════════════════════════════════');
    console.log('Email:    ' + email);
    console.log('Password: ' + password);
    console.log('User ID:  ' + userRecord.uid);
    console.log('Status:   Premium (Active)');
    console.log('Balance:  $10,000 (Test)');
    console.log('═══════════════════════════════════════');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }
}

createPremiumUser();
