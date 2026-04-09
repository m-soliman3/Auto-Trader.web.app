export const firebaseConfig = {
  apiKey: 'AIzaSyAXpbJmUhGfxb_oFV8h0vIf938hIFyG4eo',
  authDomain: 'invest-begin.com',
  projectId: 'autotrader-b8851',
  storageBucket: 'autotrader-b8851.firebasestorage.app',
  messagingSenderId: '1022221175478',
  appId: '1:1022221175478:web:56e6159d5cd39cf24af417',
};

export const environment = {
  // Leave empty to keep using Firebase Hosting rewrites (/api/*).
  // Set to your Cloud Run URL to route supported endpoints there.
  tradingBackendBaseUrl: 'https://auto-trader-backend-zcypdnoyqa-ew.a.run.app',
  // Set to your chatbot backend URL. Leave empty only if proxied at the same origin.
  chatbotBackendBaseUrl: '',
  // Stripe publishable key for the embedded payment form.
  stripePublishableKey: 'pk_live_51QDLjUCZhBElEvM6oiXno0kPFEwlv6jD1ohfH0n73Zhsineme4vEL5QzpeaiiJSVc9xABp7uTq64atUj6sFOFCw400FqkxEzkO',
};
