import { Component, inject, signal, ViewChildren, ElementRef, QueryList } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import emailjs from '@emailjs/browser';
import { AuthService } from '../services/auth.service';

const EMAILJS_PUBLIC_KEY  = 'HYIL6fQcJSo0pHAhw';
const EMAILJS_SERVICE_ID  = 'Auto-Trader';
const EMAILJS_TEMPLATE_ID = 'template_4oscrw3';

type ForgotStep = 'email' | 'code' | 'newpass' | 'done';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // ── Login fields ─────────────────────────────────────────
  // stored email/password for the login form (not persisted anywhere)
  email         = '';
  password      = '';
  loading       = signal(false);
  error         = signal('');
  emailTouched  = signal(false);
  socialLoading = signal<'google' | ''>('');

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // ── Forgot password state ─────────────────────────────────
  forgotOpen    = signal(false);
  forgotStep    = signal<ForgotStep>('email');
  forgotEmail   = '';
  newPassword   = '';
  confirmPass   = '';
  forgotLoading = signal(false);
  forgotError   = signal('');
  showNewPass   = signal(false);
  showConfirm   = signal(false);

  // ── Code-verification state ───────────────────────────────
  generatedCode = '';           // stored in-memory only
  codeDigits    = ['', '', '', '', '', ''];
  codeExpiry    = signal(0);    // seconds remaining
  private codeTimer: ReturnType<typeof setInterval> | null = null;

  get enteredCode(): string { return this.codeDigits.join(''); }

  formatTimer(s: number): string {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // ── Login submit ─────────────────────────────────────────
  onSubmit() {
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
    setTimeout(() => {
      const err = this.auth.login(this.email, this.password);
      if (err) {
        this.error.set(err);
        this.loading.set(false);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }, 600);
  }

  // ── Social login ─────────────────────────────────────────
  async loginWithGoogle() {
    this.socialLoading.set('google');
    const err = await this.auth.loginWithGoogle();
    this.socialLoading.set('');
    if (err) { this.error.set(err); return; }
    this.router.navigate(['/dashboard']);
  }

  // ── Forgot password actions ───────────────────────────────
  openForgot() {
    this.forgotEmail  = this.email;
    this.forgotStep.set('email');
    this.forgotError.set('');
    this.newPassword  = '';
    this.confirmPass  = '';
    this.codeDigits   = ['', '', '', '', '', ''];
    this.stopTimer();
    this.forgotOpen.set(true);
  }

  closeForgot() {
    this.stopTimer();
    this.forgotOpen.set(false);
  }

  /** Step 1 — verify the email exists, then send code */
  onForgotSubmitEmail() {
    const email = this.forgotEmail.trim();
    if (!email) { this.forgotError.set('Please enter your email address.'); return; }
    this.forgotError.set('');
    this.forgotLoading.set(true);
    setTimeout(() => {
      this.forgotLoading.set(false);
      if (this.auth.emailExists(email)) {
        this.dispatchCode();
        this.forgotStep.set('code');
      } else {
        this.forgotError.set('No account found with that email address.');
      }
    }, 700);
  }

  /** Generate a new 6-digit code, start the expiry timer, and email the code */
  dispatchCode() {
    this.generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.codeDigits    = ['', '', '', '', '', ''];
    this.forgotError.set('');
    this.startTimer(120);   // 2-minute window

    // Send the code to the user's email via EmailJS REST API
    const userEmail = this.forgotEmail.trim();
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: userEmail,
          to_name:  userEmail,
          otp_code: this.generatedCode,
          subject:  'Your Password Reset Code',
          message:  `Your 6-digit password reset code is: ${this.generatedCode}\n\nThis code expires in 2 minutes. If you did not request a password reset, please ignore this email.`,
        },
      }),
    }).catch(err => console.error('Failed to send reset code email:', err));
  }

  private startTimer(seconds: number) {
    this.stopTimer();
    this.codeExpiry.set(seconds);
    this.codeTimer = setInterval(() => {
      const t = this.codeExpiry() - 1;
      if (t <= 0) { this.stopTimer(); this.codeExpiry.set(0); }
      else        { this.codeExpiry.set(t); }
    }, 1000);
  }

  private stopTimer() {
    if (this.codeTimer) { clearInterval(this.codeTimer); this.codeTimer = null; }
  }

  // ── OTP input handlers ────────────────────────────────────
  onDigitInput(index: number, event: Event) {
    const el  = event.target as HTMLInputElement;
    const val = el.value.replace(/\D/g, '');
    this.codeDigits[index] = val.slice(-1);
    el.value = this.codeDigits[index];
    if (val && index < 5) {
      this.digitInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onDigitKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.codeDigits[index] && index > 0) {
      this.digitInputs.toArray()[index - 1]?.nativeElement.focus();
    }
  }

  onDigitPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text   = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    const inputs = this.digitInputs.toArray();
    text.split('').forEach((ch, i) => {
      this.codeDigits[i] = ch;
      if (inputs[i]) inputs[i].nativeElement.value = ch;
    });
    inputs[Math.min(text.length, 5)]?.nativeElement.focus();
  }

  /** Step 2 — verify the entered OTP */
  onVerifyCode() {
    if (this.enteredCode.length < 6) {
      this.forgotError.set('Please enter the full 6-digit code.');
      return;
    }
    if (this.codeExpiry() === 0) {
      this.forgotError.set('This code has expired. Please request a new one.');
      return;
    }
    this.forgotError.set('');
    this.forgotLoading.set(true);
    setTimeout(() => {
      this.forgotLoading.set(false);
      if (this.enteredCode === this.generatedCode) {
        this.stopTimer();
        this.forgotStep.set('newpass');
      } else {
        this.forgotError.set('Incorrect code. Please check and try again.');
      }
    }, 600);
  }

  /** Step 3 — set the new password */
  onForgotSetPassword() {
    const np = this.newPassword;
    if (np.length < 6) { this.forgotError.set('Password must be at least 6 characters.'); return; }
    if (np !== this.confirmPass) { this.forgotError.set('Passwords do not match.'); return; }
    this.forgotError.set('');
    this.forgotLoading.set(true);
    setTimeout(() => {
      const err = this.auth.resetPassword(this.forgotEmail.trim(), np);
      this.forgotLoading.set(false);
      if (err) { this.forgotError.set(err); }
      else {
        this.email    = this.forgotEmail.trim();
        this.password = '';
        this.forgotStep.set('done');
      }
    }, 700);
  }

  /** Close modal after success */
  finishReset() {
    this.stopTimer();
    this.forgotOpen.set(false);
  }
}
