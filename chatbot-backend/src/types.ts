export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatTurn[];
}

export interface ChatActionSuggestion {
  label: string;
  action: 'connect' | 'bot' | 'strategies' | 'learn' | 'signup' | 'login' | 'home';
  route: string;
}

export interface ChatResponseBody {
  reply: string;
  suggestions: ChatActionSuggestion[];
  source: 'gemini' | 'openai' | 'rule-based';
}
