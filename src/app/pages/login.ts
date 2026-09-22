import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login extends LocalizedLinks {
  auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    super();
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }


  // ── Login fields ─────────────────────────────────────────
  // stored email/password for the login form (not persisted anywhere)
  email         = '';
  password      = '';
  loading       = signal(false);
  error         = signal('');
  emailTouched  = signal(false);
  socialLoading = signal<'google' | 'microsoft' | 'twitter' | 'facebook' | ''>('');

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ── Forgot password state ─────────────────────────────────
  forgotOpen    = signal(false);
  forgotEmail   = '';
  forgotLoading = signal(false);
  forgotError   = signal('');
  resetSent     = signal(false);


  // ── Login submit ─────────────────────────────────────────
  async onSubmit() {
    this.emailTouched.set(true);
    if (!this.email || !this.password) {
      this.error.set('Please fill in all fields.');
      return;
    }
    if (!this.isValidEmail(this.email)) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    const err = await this.auth.login(this.email.trim(), this.password);
    this.loading.set(false);
    if (err) {
      this.error.set(err);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // ── Social login ─────────────────────────────────────────
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
    this.router.navigate(['/dashboard']);
  }

  async loginWithTwitter() {
    this.socialLoading.set('twitter');
    const err = await this.auth.loginWithTwitter();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    this.router.navigate(['/dashboard']);
  }

  async loginWithFacebook() {
    this.socialLoading.set('facebook');
    const err = await this.auth.loginWithFacebook();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    this.router.navigate(['/dashboard']);
  }

  // ── Forgot password actions ───────────────────────────────
  openForgot() {
    this.forgotEmail  = this.email;
    this.forgotError.set('');
    this.resetSent.set(false);
    this.forgotLoading.set(false);
    this.forgotOpen.set(true);
  }

  closeForgot() {
    this.forgotOpen.set(false);
  }

  async onForgotSubmitEmail() {
    const email = this.forgotEmail.trim();
    if (!email) { this.forgotError.set('Please enter your email address.'); return; }
    this.forgotError.set('');
    this.forgotLoading.set(true);
    const err = await this.auth.sendPasswordResetEmail(email);
    this.forgotLoading.set(false);
    if (err) {
      this.forgotError.set(err);
    } else {
      this.resetSent.set(true);
    }
  }






  /** Close modal after success */
  finishReset() {
    this.forgotOpen.set(false);
  }
}
