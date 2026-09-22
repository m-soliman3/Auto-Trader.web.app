import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { STRATEGY_TEMPLATES, StrategyTemplate } from '../services/strategy.service';
import { STRATEGY_EXPLAINERS, StrategyExplainer } from '../services/strategy-explainer';
import { SUPPORTED_EXCHANGES, Exchange } from '../services/exchange.service';
import { StrategyChart } from '../components/strategy-chart';
import { LocalizedLinks } from '../shared/localized-links';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, TranslateModule, StrategyChart],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup extends LocalizedLinks {
  auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Strategy template referenced by a `?strategy=<id>` query param, if any and known. */
  contextStrategy: StrategyTemplate | null = null;
  /** Broker/exchange referenced by a `?broker=<id>` query param, if any and known. */
  contextBroker: Exchange | null = null;
  /**
   * Jargon-free explanation of the linked strategy plus its entry/exit chart.
   * Null for a strategy with no explainer written yet — the panel just omits the
   * block rather than showing a gap.
   */
  contextExplainer: StrategyExplainer | null = null;

  constructor() {
    super();
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);

    const params = this.route.snapshot.queryParamMap;
    const strategyId = params.get('strategy');
    const brokerId = params.get('broker');
    if (strategyId) {
      this.contextStrategy = STRATEGY_TEMPLATES.find(t => t.id === strategyId) ?? null;
      this.contextExplainer = STRATEGY_EXPLAINERS[strategyId] ?? null;
    }
    if (brokerId) {
      this.contextBroker = SUPPORTED_EXCHANGES.find(e => e.id === brokerId) ?? null;
    }
  }

  get hasContext(): boolean {
    return !!this.contextStrategy || !!this.contextBroker;
  }

  /** True when both `?strategy=` and `?broker=` resolved — shows the single combined panel. */
  get isCombinedContext(): boolean {
    return !!this.contextStrategy && !!this.contextBroker;
  }

  get isAlpacaBroker(): boolean {
    return this.contextBroker?.id === 'alpaca' || this.contextBroker?.id === 'alpaca-paper';
  }

  name          = '';
  email         = '';
  password      = '';
  confirm       = '';
  agree         = false;
  loading       = signal(false);
  error         = signal('');
  emailTouched  = signal(false);
  socialLoading = signal<'google' | 'microsoft' | 'twitter' | 'facebook' | ''>('');

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async loginWithGoogle() {
    await this.runSocialLogin('google', () => this.auth.loginWithGoogle());
  }

  async loginWithMicrosoft() {
    await this.runSocialLogin('microsoft', () => this.auth.loginWithMicrosoft());
  }

  private async runSocialLogin(
    provider: 'google' | 'microsoft',
    authenticate: () => Promise<string | null>,
  ) {
    this.socialLoading.set(provider);
    const err = await authenticate();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    const dest = this.auth.lastSigninWasNewUser() ? '/signup-guide' : '/dashboard';
    this.router.navigate([dest]);
  }

  async loginWithTwitter() {
    this.socialLoading.set('twitter');
    const err = await this.auth.loginWithTwitter();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    const dest = this.auth.lastSigninWasNewUser() ? '/signup-guide' : '/dashboard';
    this.router.navigate([dest]);
  }

  async loginWithFacebook() {
    this.socialLoading.set('facebook');
    const err = await this.auth.loginWithFacebook();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    const dest = this.auth.lastSigninWasNewUser() ? '/signup-guide' : '/dashboard';
    this.router.navigate([dest]);
  }

  onSubmit() {
    this.emailTouched.set(true);
    if (!this.name || !this.email || !this.password || !this.confirm) {
      this.error.set('Please fill in all fields.');
      return;
    }
    if (!this.isValidEmail(this.email)) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (!this.agree) {
      this.error.set('You must agree to the Terms of Service.');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    // small delay to allow spinner to show briefly
    setTimeout(async () => {
      const err = await this.auth.register(this.name.trim(), this.email.trim(), this.password);
      this.loading.set(false);
      if (err) {
        this.error.set(err);
      } else {
        this.router.navigate(['/signup-guide']);
      }
    }, 300);
  }
}
