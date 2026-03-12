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
  '- Support both crypto exchanges and stock brokers/exchanges with API integrations.',
  '- Help users create bots with realistic risk controls.',
  '- Help users choose and set up strategies.',
  '- Ask setup questions when needed (especially: Which trading platform/exchange do you use?).',
  '- Help users verify whether their platform supports API trading.',
  '- Guide users to create API key and secret with safe permissions.',
  '- Guide users through strategy selection and bot setup in order.',
  'Rules:',
  '- Be concise and practical.',
  '- Keep responses friendly and clear for non-technical users.',
  '- Prefer short numbered steps when giving instructions.',
  '- Never claim to execute actions. Only suggest next UI steps.',
  '- Include cautions about API key permissions and risk when relevant.',
  '- For guest users, occasionally suggest opening a free account to continue setup guidance.',
  '- Auto-Trader currently does not have a referral or affiliate program. If asked, clearly state that it is not available.',
].join('\n');

const NO_REFERRAL_PROGRAM_REPLY = [
  'Auto-Trader does not have a referral or affiliate program right now.',
  'If that changes, it will be announced in the app and official channels.',
].join('\n');

const FREE_ACCOUNT_SUGGESTION: ChatActionSuggestion = {
  label: 'Create Free Account',
  action: 'signup',
  route: '/signup',
};

type PlatformApiSupport = {
  name: string;
  marketType: 'crypto' | 'stocks';
  apiTradingSupported: boolean;
  aliases: string[];
  setupHint: string;
};

// Curated list used for quick platform detection and setup guidance.
const KNOWN_PLATFORMS: PlatformApiSupport[] = [
  {
    name: 'Binance',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['binance'],
    setupHint: 'Profile -> API Management -> Create API key (enable spot/futures trading as needed).',
  },
  {
    name: 'Coinbase Advanced',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['coinbase', 'coinbase advanced', 'coinbase pro'],
    setupHint: 'Settings -> API -> Create API key with trade permissions only.',
  },
  {
    name: 'Kraken',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['kraken'],
    setupHint: 'Security -> API -> Generate new key with query/trade permissions only.',
  },
  {
    name: 'Bybit',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['bybit'],
    setupHint: 'Account & Security -> API Management -> Create key for trading.',
  },
  {
    name: 'KuCoin',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['kucoin'],
    setupHint: 'API Management -> Create API key and keep passphrase safe.',
  },
  {
    name: 'Bitget',
    marketType: 'crypto',
    apiTradingSupported: true,
    aliases: ['bitget'],
    setupHint: 'API Management -> Create key with trade permission and no withdrawals.',
  },
  {
    name: 'Alpaca',
    marketType: 'stocks',
    apiTradingSupported: true,
    aliases: ['alpaca'],
    setupHint: 'Dashboard -> API Keys -> Generate key pair for paper/live trading.',
  },
  {
    name: 'Interactive Brokers',
    marketType: 'stocks',
    apiTradingSupported: true,
    aliases: ['interactive brokers', 'ibkr', 'ib'],
    setupHint: 'Enable API in TWS/Gateway settings, then create API credentials per account setup.',
  },
  {
    name: 'Tradier',
    marketType: 'stocks',
    apiTradingSupported: true,
    aliases: ['tradier'],
    setupHint: 'Developer/API section -> Create access token for paper/live environment.',
  },
];

function hasKeyword(input: string, keywords: string[]): boolean {
  const lower = input.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function findPlatformInMessage(message: string): PlatformApiSupport | null {
  const lower = message.toLowerCase();
  for (const platform of KNOWN_PLATFORMS) {
    if (platform.aliases.some((alias) => lower.includes(alias))) {
      return platform;
    }
  }

  return null;
}

function buildPlatformAndApiSetupReply(message: string): string | null {
  const lower = message.toLowerCase();
  const asksSupportedMarkets = hasKeyword(lower, [
    'what do you support',
    'supported exchange',
    'supported exchanges',
    'supported broker',
    'supported brokers',
    'stocks',
    'stock trading',
    'crypto',
    'markets',
  ]);

  if (asksSupportedMarkets) {
    return [
      'We support both crypto and stocks integrations.',
      'Crypto examples: Binance, Coinbase Advanced, Kraken, Bybit, KuCoin, Bitget.',
      'Stock examples: Alpaca, Interactive Brokers, and Tradier.',
      'Tell me which platform you use and I will guide the exact API setup steps.',
    ].join('\n');
  }

  const asksPlatformOrApi = hasKeyword(lower, [
    'platform',
    'exchange',
    'broker',
    'api',
    'api trading',
    'key',
    'secret',
    'setup',
    'set up',
    'connect',
    'start',
  ]);

  if (!asksPlatformOrApi) {
    return null;
  }

  const platform = findPlatformInMessage(message);
  if (!platform) {
    return [
      'Great, I can guide your setup step-by-step.',
      'First question: which trading platform/exchange do you use (for example Binance, Coinbase, Kraken, Bybit, KuCoin, or Bitget)?',
      'Once you tell me, I will confirm API trading support and show the exact API key/secret steps.',
    ].join('\n');
  }

  if (!platform.apiTradingSupported) {
    return [
      `${platform.name} is not currently supported for API trading in our setup flow.`,
      'If you want, tell me your preferred alternative exchange and I can guide you immediately.',
    ].join('\n');
  }

  return [
    `${platform.name} supports API trading for ${platform.marketType}. Here is the safe setup path:`,
    `1) In ${platform.name}, open: ${platform.setupHint}`,
    '2) Create API credentials with trading permission only and keep withdrawals disabled.',
    '3) Copy API key and secret when shown. Store them securely (secret is usually shown once).',
    '4) In Auto-Trader, open Connect Exchange and paste key/secret.',
    '5) Start in paper mode first to verify balance sync and order behavior.',
  ].join('\n');
}

function buildStrategyAndBotSetupReply(): string {
  return [
    'After exchange connection, use this setup order:',
    '1) Choose market and timeframe (for example BTCUSDT on 15m or 1h).',
    '2) Pick a strategy that matches market type (trend strategy for trending markets, mean-reversion for ranging markets).',
    '3) Create a bot and attach the strategy to that bot/symbol/timeframe.',
    '4) Set risk controls first: position size, stop-loss, take-profit, and max daily loss.',
    '5) Run in paper mode, review recent executions, then move to real mode only after stable behavior.',
  ].join('\n');
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

  const platformSetupReply = buildPlatformAndApiSetupReply(message);
  if (platformSetupReply) {
    return platformSetupReply;
  }

  if (hasKeyword(lower, ['connect', 'exchange', 'api key'])) {
    return [
      'To connect an exchange safely:',
      '1) Use API keys with trading permission only (no withdrawal rights).',
      '2) In Dashboard, open Connect Exchange and add key/secret.',
      '3) Start in Paper mode first and validate balance sync.',
    ].join('\n');
  }

  if (hasKeyword(lower, ['create bot', 'bot'])) {
    return buildStrategyAndBotSetupReply();
  }

  if (hasKeyword(lower, ['strategy', 'signal'])) {
    return buildStrategyAndBotSetupReply();
  }

  if (hasKeyword(lower, ['setup', 'set up', 'onboard', 'getting started', 'start'])) {
    return [
      'I can guide your complete setup step-by-step.',
      '1) Tell me which exchange you use, and I will confirm API trading support.',
      '2) I will guide API key/secret creation and safe permissions.',
      '3) Then I will help you choose strategy, create bot, and set risk controls.',
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

  const platformSetupReply = buildPlatformAndApiSetupReply(message);
  if (platformSetupReply) {
    return platformSetupReply;
  }

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
      '1) Tell me which exchange you use and I will verify API trading support.',
      '2) I will guide API key/secret creation with safe permissions.',
      '3) Create your account and connect exchange in paper mode.',
      '4) Create a bot, assign strategy, and test before real mode.',
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

function isReferralProgramQuestion(message: string): boolean {
  return hasKeyword(message, [
    'referral',
    'refer',
    'invite',
    'invitation',
    'affiliate',
    'ref code',
    'promo code',
    'bonus code',
    'commission',
  ]);
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

  if (isReferralProgramQuestion(message)) {
    return {
      reply: NO_REFERRAL_PROGRAM_REPLY,
      suggestions,
      source: 'rule-based' as const,
    };
  }

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
