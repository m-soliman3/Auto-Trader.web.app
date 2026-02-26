import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
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
  socialLoading = signal<'google' | ''>('');

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async loginWithGoogle() {
    this.socialLoading.set('google');
    const err = await this.auth.loginWithGoogle();
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

    // Small delay to show loading state, then register
    setTimeout(() => {
      const err = this.auth.register(this.name, this.email, this.password);
      if (err) {
        this.error.set(err);
        this.loading.set(false);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }, 600);
  }
}
