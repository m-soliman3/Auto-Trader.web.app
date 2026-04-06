import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { ChatSuggestion, ChatTurn, ChatbotAssistantService } from '../services/chatbot-assistant.service';
import { AuthService } from '../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-ai-chat-ribbon',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './ai-chat-ribbon.html',
  styleUrl: './ai-chat-ribbon.scss',
})
export class AiChatRibbon {
  private static readonly RESPONSE_DELAY_MS = 3000;
  private static readonly TYPING_INTERVAL_MS = 18;

  private readonly chatbot = inject(ChatbotAssistantService);
  private readonly router = inject(Router);
  private readonly accountMode = inject(AccountModeService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  isOpen = signal(false);
  isSending = signal(false);
  isTypingReply = signal(false);
  isOnline = signal(false);
  input = '';
  error = signal('');

  turns = signal<ChatTurn[]>([]);

  suggestions = signal<ChatSuggestion[]>([
    { label: 'chat.suggestionConnectExchange', action: 'connect', route: '/dashboard/real?action=connect' },
    { label: 'chat.suggestionCreateBot', action: 'bot', route: '/dashboard/real?action=bot' },
    { label: 'chat.suggestionBrowseStrategies', action: 'strategies', route: '/dashboard/real?action=strategies' },
  ]);

  hasMessages = computed(() => this.turns().length > 0);
  isLoggedIn = this.auth.isLoggedIn;
  panelTitle = computed(() => this.isLoggedIn()
    ? this.translate.instant('chat.panelTitleLoggedIn')
    : this.translate.instant('chat.panelTitleLoggedOut'));
  panelSubtitle = computed(() => this.isLoggedIn()
    ? this.translate.instant('chat.panelSubtitleLoggedIn')
    : this.translate.instant('chat.panelSubtitleLoggedOut'));
  inputPlaceholder = computed(() => this.isLoggedIn()
    ? this.translate.instant('chat.inputPlaceholderLoggedIn')
    : this.translate.instant('chat.inputPlaceholderLoggedOut'));

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
        { label: 'chat.suggestionConnectExchange', action: 'connect', route: '/dashboard/real?action=connect' },
        { label: 'chat.suggestionCreateBot', action: 'bot', route: '/dashboard/real?action=bot' },
        { label: 'chat.suggestionBrowseStrategies', action: 'strategies', route: '/dashboard/real?action=strategies' },
      ]);
    } else {
      this.suggestions.set([
        { label: 'chat.suggestionExploreFeatures', action: 'home', route: '/#features' },
        { label: 'chat.suggestionCreateAccount', action: 'signup', route: '/signup' },
        { label: 'chat.suggestionLogIn', action: 'login', route: '/login' },
      ]);
    }

    if (this.turns().length > 0) {
      return;
    }

    if (isLoggedIn) {
      this.turns.set([
        {
          role: 'assistant',
          content: this.translate.instant('chat.welcomeMessageLoggedIn'),
        },
      ]);
      return;
    }

    this.turns.set([
      {
        role: 'assistant',
        content: this.translate.instant('chat.welcomeMessageLoggedOut'),
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
    this.isTypingReply.set(false);

    try {
      const response = this.auth.isLoggedIn()
        ? await this.chatbot.ask(message, nextHistory.slice(-10))
        : await this.chatbot.askPublic(message, nextHistory.slice(-10));

      await this.wait(AiChatRibbon.RESPONSE_DELAY_MS);
      await this.typeAssistantReply(response.reply);
      this.suggestions.set(response.suggestions ?? []);
    } catch (err: any) {
      this.error.set(err?.message || this.translate.instant('chat.unableToReachAssistant'));
      this.turns.update((existing) => [
        ...existing,
        {
          role: 'assistant',
          content: this.translate.instant('chat.couldNotReachAssistantService'),
        },
      ]);
    } finally {
      this.isTypingReply.set(false);
      this.isSending.set(false);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async typeAssistantReply(reply: string) {
    const fullReply = reply || this.translate.instant('chat.noAnswerYet');

    this.turns.update((existing) => [...existing, { role: 'assistant', content: '' }]);
    this.isTypingReply.set(true);

    for (let i = 1; i <= fullReply.length; i += 1) {
      const nextContent = fullReply.slice(0, i);
      this.turns.update((existing) => {
        if (existing.length === 0) {
          return existing;
        }

        const next = [...existing];
        const lastIndex = next.length - 1;
        next[lastIndex] = {
          ...next[lastIndex],
          content: nextContent,
        };
        return next;
      });

      await this.wait(AiChatRibbon.TYPING_INTERVAL_MS);
    }

    this.isTypingReply.set(false);
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
