import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { ChatSuggestion, ChatTurn, ChatbotAssistantService } from '../services/chatbot-assistant.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-ai-chat-ribbon',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat-ribbon.html',
  styleUrl: './ai-chat-ribbon.scss',
})
export class AiChatRibbon {
  private readonly chatbot = inject(ChatbotAssistantService);
  private readonly router = inject(Router);
  private readonly accountMode = inject(AccountModeService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  isOpen = signal(false);
  isSending = signal(false);
  isOnline = signal(false);
  input = '';
  error = signal('');

  turns = signal<ChatTurn[]>([]);

  suggestions = signal<ChatSuggestion[]>([
    { label: 'Connect Exchange', action: 'connect', route: '/dashboard/real?action=connect' },
    { label: 'Create Bot', action: 'bot', route: '/dashboard/real?action=bot' },
    { label: 'Browse Strategies', action: 'strategies', route: '/dashboard/real?action=strategies' },
  ]);

  hasMessages = computed(() => this.turns().length > 0);
  isLoggedIn = this.auth.isLoggedIn;
  panelTitle = computed(() => this.isLoggedIn() ? 'Auto-Trader AI Copilot' : 'Auto-Trader Assistant');
  panelSubtitle = computed(() => this.isLoggedIn()
    ? 'Ask about bots, strategies, and exchange setup.'
    : 'Ask about features, safety, and getting started.');
  inputPlaceholder = computed(() => this.isLoggedIn()
    ? 'Ask: Create a low-risk paper bot for BTCUSDT...'
    : 'Ask: What can Auto-Trader do for me?');

  constructor() {
    effect(() => {
      this.seedWelcomeMessage(this.auth.isLoggedIn());
    });

    void this.refreshHealth();
    const timer = setInterval(() => {
      void this.refreshHealth();
    }, 30000);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private seedWelcomeMessage(isLoggedIn: boolean) {
    if (isLoggedIn) {
      this.suggestions.set([
        { label: 'Connect Exchange', action: 'connect', route: '/dashboard/real?action=connect' },
        { label: 'Create Bot', action: 'bot', route: '/dashboard/real?action=bot' },
        { label: 'Browse Strategies', action: 'strategies', route: '/dashboard/real?action=strategies' },
      ]);
    } else {
      this.suggestions.set([
        { label: 'Explore Features', action: 'home', route: '/#features' },
        { label: 'Create Account', action: 'signup', route: '/signup' },
        { label: 'Log In', action: 'login', route: '/login' },
      ]);
    }

    if (this.turns().length > 0) {
      return;
    }

    if (isLoggedIn) {
      this.turns.set([
        {
          role: 'assistant',
          content: 'How can I help you today? I can guide you to connect an exchange, create a bot, or configure a strategy.',
        },
      ]);
      return;
    }

    this.turns.set([
      {
        role: 'assistant',
        content: 'Welcome to Auto-Trader. I can answer questions about features, safety, and how to get started before you sign in.',
      },
    ]);
  }

  private async refreshHealth() {
    const ok = await this.chatbot.healthCheck();
    this.isOnline.set(ok);
  }

  toggleOpen() {
    this.isOpen.update((open) => !open);
  }

  openPanel() {
    this.isOpen.set(true);
  }

  minimizePanel() {
    this.isOpen.set(false);
  }

  async send() {
    const message = this.input.trim();
    if (!message || this.isSending()) {
      return;
    }

    this.error.set('');
    this.input = '';

    const nextHistory: ChatTurn[] = [...this.turns(), { role: 'user', content: message }];
    this.turns.set(nextHistory);
    this.isOpen.set(true);
    this.isSending.set(true);

    try {
      const response = this.auth.isLoggedIn()
        ? await this.chatbot.ask(message, nextHistory.slice(-10))
        : await this.chatbot.askPublic(message, nextHistory.slice(-10));
      this.turns.update((existing) => [...existing, { role: 'assistant', content: response.reply }]);
      this.suggestions.set(response.suggestions ?? []);
    } catch (err: any) {
      this.error.set(err?.message || 'Unable to reach the AI assistant right now.');
      this.turns.update((existing) => [
        ...existing,
        {
          role: 'assistant',
          content: 'I could not reach the assistant service. Please try again in a moment.',
        },
      ]);
    } finally {
      this.isSending.set(false);
    }
  }

  async useSuggestion(suggestion: ChatSuggestion) {
    if (!this.auth.isLoggedIn()) {
      if (suggestion.action === 'home' && suggestion.route.includes('#')) {
        const [, fragment] = suggestion.route.split('#');
        await this.router.navigate(['/'], { fragment: fragment || undefined });
        return;
      }

      await this.router.navigateByUrl(suggestion.route);
      return;
    }

    const mode = this.accountMode.mode();
    const queryAction = suggestion.action;

    if (queryAction === 'signup' || queryAction === 'login' || queryAction === 'home') {
      await this.router.navigateByUrl(suggestion.route);
      return;
    }

    await this.router.navigate(['/dashboard', mode], {
      queryParams: {
        action: queryAction,
      },
    });
  }
}
