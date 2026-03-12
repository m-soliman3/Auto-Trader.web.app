export interface AppConfig {
  port: number;
  allowedOrigin: string;
  firebaseProjectId: string;
  firebaseAppName: string;
  firebaseServiceAccountJson?: string;
  openAiApiKey?: string;
  openAiModel: string;
  geminiApiKey?: string;
  geminiModel: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 8090),
  allowedOrigin: String(process.env.CHATBOT_ALLOWED_ORIGIN || '*'),
  firebaseProjectId: String(process.env.CHATBOT_FIREBASE_PROJECT_ID || 'autotrader-b8851'),
  firebaseAppName: String(process.env.CHATBOT_FIREBASE_APP_NAME || 'chatbot-backend'),
  firebaseServiceAccountJson: process.env.CHATBOT_FIREBASE_SERVICE_ACCOUNT_JSON,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: String(process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: String(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
};
