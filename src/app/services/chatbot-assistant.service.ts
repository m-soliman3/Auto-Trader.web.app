import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatSuggestion {
  label: string;
  action: 'connect' | 'bot' | 'strategies' | 'learn' | 'signup' | 'login' | 'home';
  route: string;
}

export interface ChatResponse {
  reply: string;
  suggestions: ChatSuggestion[];
  source: 'gemini' | 'openai' | 'rule-based';
}

@Injectable({ providedIn: 'root' })
export class ChatbotAssistantService {
  private readonly http = inject(HttpClient);
  private readonly firebaseAuth = inject(Auth);
  private readonly baseUrl = String(environment.chatbotBackendBaseUrl || '').replace(/\/$/, '');

  private chatEndpoint(): string {
    if (!this.baseUrl) {
      return '/v1/chat';
    }

    return `${this.baseUrl}/v1/chat`;
  }

  private publicChatEndpoint(): string {
    if (!this.baseUrl) {
      return '/v1/public-chat';
    }

    return `${this.baseUrl}/v1/public-chat`;
  }

  private healthEndpoint(): string {
    if (!this.baseUrl) {
      return '/health';
    }

    return `${this.baseUrl}/health`;
  }

  async ask(message: string, history: ChatTurn[]): Promise<ChatResponse> {
    const user = this.firebaseAuth.currentUser;
    if (!user) {
      throw new Error('Please sign in to use the AI assistant.');
    }

    const idToken = await user.getIdToken();

    return firstValueFrom(this.http.post<ChatResponse>(
      this.chatEndpoint(),
      {
        message,
        history,
      },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
    ));
  }

  async askPublic(message: string, history: ChatTurn[]): Promise<ChatResponse> {
    return firstValueFrom(this.http.post<ChatResponse>(
      this.publicChatEndpoint(),
      {
        message,
        history,
      },
    ));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const payload = await firstValueFrom(this.http.get<{ ok?: boolean }>(this.healthEndpoint()));
      return Boolean(payload?.ok);
    } catch {
      return false;
    }
  }
}
