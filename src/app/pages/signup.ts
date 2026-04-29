import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, TranslateModule],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup {
  auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
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
        this.router.navigate(['/dashboard']);
      }
    }, 300);
  }
}
