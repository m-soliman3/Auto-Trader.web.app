import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-binance-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card" style="text-align:center;">
        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
          <p style="margin-top:1.25rem">
            <a routerLink="/login" style="color:var(--accent);font-weight:600;text-decoration:none;">{{ 'login.logIn' | translate }}</a>
          </p>
        } @else {
          <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;padding:1.5rem 0;">
            <span class="spinner" style="width:28px;height:28px;border-width:3px;"></span>
            <p style="color:var(--text-secondary);font-size:0.95rem;margin:0;">{{ 'login.connecting' | translate }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './login.scss',
})
export class BinanceCallbackPage implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  error = signal('');

  async ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const storedState = sessionStorage.getItem('binance_oauth_state');
    sessionStorage.removeItem('binance_oauth_state');

    if (!code) {
      this.error.set('No authorisation code received from Binance. Please try again.');
      return;
    }

    if (!state || state !== storedState) {
      this.error.set('Invalid state parameter — possible CSRF. Please try signing in again.');
      return;
    }

    try {
      const redirectUri = `${window.location.origin}/auth/binance/callback`;
      const result = await firstValueFrom(
        this.http.post<{ customToken: string }>('/api/binanceOAuthCallback', {
          code,
          redirectUri,
        }),
      );
      const err = await this.authService.completeOAuthSignIn(result.customToken);
      if (err) {
        this.error.set(err);
        return;
      }
      await this.router.navigate(['/dashboard']);
    } catch (err: any) {
      const msg =
        err?.error?.error ||
        err?.message ||
        'Binance sign-in failed. Please try again.';
      this.error.set(msg);
    }
  }
}
