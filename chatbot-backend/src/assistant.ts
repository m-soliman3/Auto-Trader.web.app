import { config } from './config';
import { ChatActionSuggestion, ChatTurn } from './types';

const SYSTEM_PROMPT = [
  'You are Auto-Trader Copilot, an assistant for a retail trading automation app.',
  'Your style: guide users through a simple journey, one step at a time.',
  'Journey stages:',
  '1) Understand user goal and experience level.',
  '2) Suggest a safe setup path (paper mode first).',
  '3) Give concrete next action in the UI.',
  '4) Confirm what success looks like before moving to real mode.',
  'Your scope:',
  '- Help users connect exchanges safely.',
  '- Help users create bots with realistic risk controls.',
  '- Help users choose and set up strategies.',
  'Rules:',
  '- Be concise and practical.',
  '- Keep responses friendly and clear for non-technical users.',
  '- Prefer short numbered steps when giving instructions.',
  '- Never claim to execute actions. Only suggest next UI steps.',
  '- Include cautions about API key permissions and risk when relevant.',
  '- For guest users, occasionally suggest opening a free account to continue setup guidance.',
].join('\n');

const FREE_ACCOUNT_SUGGESTION: ChatActionSuggestion = {
  label: 'Create Free Account',
  action: 'signup',
  route: '/signup',
};

function hasKeyword(input: string, keywords: string[]): boolean {
  const lower = input.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function buildSuggestions(input: string, isAuthenticated: boolean, includeFreeAccountNudge: boolean): ChatActionSuggestion[] {
  if (!isAuthenticated) {
    return buildPublicSuggestions(input, includeFreeAccountNudge);
  }

  const suggestions: ChatActionSuggestion[] = [];

  if (hasKeyword(input, ['exchange', 'binance', 'coinbase', 'alpaca', 'api key'])) {
    suggestions.push({
      label: 'Open Connect Exchange',
      action: 'connect',
      route: '/dashboard/real?action=connect',
    });
  }

  if (hasKeyword(input, ['bot', 'create bot', 'new bot', 'automation'])) {
    suggestions.push({
      label: 'Open Create Bot',
      action: 'bot',
      route: '/dashboard/real?action=bot',
    });
  }

  if (hasKeyword(input, ['strategy', 'signal', 'rsi', 'macd', 'momentum', 'mean reversion'])) {
    suggestions.push({
      label: 'Open Strategy Browser',
      action: 'strategies',
      route: '/dashboard/real?action=strategies',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push(
      {
        label: 'Connect an Exchange',
        action: 'connect',
        route: '/dashboard/real?action=connect',
      },
      {
        label: 'Create a Bot',
        action: 'bot',
        route: '/dashboard/real?action=bot',
      },
      {
        label: 'Browse Strategies',
        action: 'strategies',
        route: '/dashboard/real?action=strategies',
      },
    );
  }

  return suggestions.slice(0, 3);
}

function buildPublicSuggestions(input: string, includeFreeAccountNudge: boolean): ChatActionSuggestion[] {
  const suggestions: ChatActionSuggestion[] = [];

  if (hasKeyword(input, ['signup', 'start', 'join', 'create account'])) {
    suggestions.push({
      label: 'Create Your Free Account',
      action: 'signup',
      route: '/signup',
    });
  }

  if (hasKeyword(input, ['login', 'log in', 'signin', 'sign in'])) {
    suggestions.push({
      label: 'Log In',
      action: 'login',
      route: '/login',
    });
  }

  if (hasKeyword(input, ['features', 'how', 'what is', 'about', 'auto trader', 'pricing'])) {
    suggestions.push({
      label: 'Explore Features',
      action: 'home',
      route: '/#features',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push(
      {
        label: 'See Platform Features',
        action: 'home',
        route: '/#features',
      },
      {
        label: 'Create Free Account',
        action: 'signup',
        route: '/signup',
      },
      {
        label: 'Log In',
        action: 'login',
        route: '/login',
      },
    );
  }

  if (includeFreeAccountNudge && !suggestions.some((item) => item.action === 'signup')) {
    suggestions.unshift(FREE_ACCOUNT_SUGGESTION);
  }

  return suggestions.slice(0, 3);
}

function buildRuleBasedReply(message: string, isAuthenticated: boolean): string {
  if (!isAuthenticated) {
    return buildPublicRuleBasedReply(message);
  }

  const lower = message.toLowerCase();

  if (hasKeyword(lower, ['connect', 'exchange', 'api key'])) {
    return [
      'To connect an exchange safely:',
      '1) Use API keys with trading permission only (no withdrawal rights).',
      '2) In Dashboard, open Connect Exchange and add key/secret.',
      '3) Start in Paper mode first and validate balance sync.',
    ].join('\n');
  }

  if (hasKeyword(lower, ['create bot', 'bot'])) {
    return [
      'For a first bot setup:',
      '1) Pick one symbol and one timeframe.',
      '2) Set small investment size and strict stop-loss.',
      '3) Keep it paused until strategy and exchange data look correct.',
    ].join('\n');
  }

  if (hasKeyword(lower, ['strategy', 'signal'])) {
    return [
      'Strategy setup checklist:',
      '1) Choose strategy type based on market condition (trend vs range).',
      '2) Assign it to an existing bot with matching symbol/timeframe.',
      '3) Monitor recent executions and adjust risk before scaling.',
    ].join('\n');
  }

  return [
    'I can help with three things right now:',
    '- Connect an exchange securely',
    '- Create a bot with risk controls',
    '- Pick and configure a strategy',
    'Tell me your goal and whether you are in paper or real mode.',
  ].join('\n');
}

function buildPublicRuleBasedReply(message: string): string {
  const lower = message.toLowerCase();

  if (hasKeyword(lower, ['what is', 'auto trader', 'about', 'platform'])) {
    return [
      'Auto-Trader is a platform that helps you automate trading workflows with connected exchanges and configurable strategies.',
      'You can monitor bots, manage risk controls, and review execution activity from one dashboard.',
      'Start in paper mode first, then move to real mode once your setup is validated.',
    ].join('\n');
  }

  if (hasKeyword(lower, ['safe', 'risk', 'secure'])) {
    return [
      'Safety checklist for new users:',
      '1) Start with paper mode and small position sizing.',
      '2) Use exchange API keys with trading-only permissions (no withdrawals).',
      '3) Always set stop-loss and take-profit rules before activating a bot.',
    ].join('\n');
  }

  if (hasKeyword(lower, ['how to start', 'getting started', 'begin'])) {
    return [
      'Fast start path:',
      '1) Create an account.',
      '2) Connect an exchange in paper mode.',
      '3) Create a bot and assign a strategy.',
      '4) Review behavior before running in real mode.',
    ].join('\n');
  }

  return [
    'Welcome to Auto-Trader. I can answer product questions before you log in.',
    'Ask me about features, safety, getting started steps, or how bot automation works.',
    'When you are ready, create an account and I can guide setup step-by-step.',
  ].join('\n');
}

function shouldIncludeFreeAccountNudge(message: string, isAuthenticated: boolean): boolean {
  if (isAuthenticated) {
    return false;
  }

  return hasKeyword(message, [
    'signup',
    'sign up',
    'join',
    'create account',
    'open account',
    'getting started',
    'how to start',
    'start',
    'trial',
    'pricing',
    'price',
    'cost',
    'free',
    'register',
  ]);
}

function appendFreeAccountNudge(reply: string, includeNudge: boolean): string {
  if (!includeNudge) {
    return reply;
  }

  const lower = reply.toLowerCase();
  if (lower.includes('free account') || lower.includes('create an account') || lower.includes('create account')) {
    return reply;
  }

  return `${reply}\n\nIf you want, open a free account and I can guide you step-by-step.`;
}

async function generateWithOpenAi(message: string, history: ChatTurn[]): Promise<string | null> {
  if (!config.openAiApiKey) {
    return null;
  }

  const trimmedHistory = history.slice(-8).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...trimmedHistory,
        { role: 'user', content: message },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || null;
}

async function generateWithGemini(message: string, history: ChatTurn[]): Promise<string | null> {
  if (!config.geminiApiKey) {
    return null;
  }

  const promptHistory = history.slice(-8)
    .map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.content}`)
    .join('\n');

  const fullPrompt = [
    SYSTEM_PROMPT,
    '',
    'Conversation so far:',
    promptHistory || 'No previous turns.',
    '',
    `User: ${message}`,
    'Assistant:',
  ].join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 700,
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  return text || null;
}

export async function generateAssistantReply(message: string, history: ChatTurn[], isAuthenticated: boolean) {
  const includeFreeAccountNudge = shouldIncludeFreeAccountNudge(message, isAuthenticated);
  const suggestions = buildSuggestions(message, isAuthenticated, includeFreeAccountNudge);

  try {
    const geminiReply = await generateWithGemini(message, history);
    if (geminiReply) {
      return {
        reply: appendFreeAccountNudge(geminiReply, includeFreeAccountNudge),
        suggestions,
        source: 'gemini' as const,
      };
    }
  } catch (error) {
    console.error('gemini generation failed, trying fallback provider', error);
  }

  try {
    const openAiReply = await generateWithOpenAi(message, history);
    if (openAiReply) {
      return {
        reply: appendFreeAccountNudge(openAiReply, includeFreeAccountNudge),
        suggestions,
        source: 'openai' as const,
      };
    }
  } catch (error) {
    console.error('openai generation failed, using rule-based fallback', error);
  }

  return {
    reply: appendFreeAccountNudge(buildRuleBasedReply(message, isAuthenticated), includeFreeAccountNudge),
    suggestions,
    source: 'rule-based' as const,
  };
}
