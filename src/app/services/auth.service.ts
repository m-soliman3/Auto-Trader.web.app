import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly USERS_KEY = 'at_users';
  private readonly SESSION_KEY = 'at_session';

  private fireAuth = inject(Auth);
  private router   = inject(Router);

  currentUser = signal<User | null>(this.loadSession());

  isLoggedIn = computed(() => this.currentUser() !== null);

  /** Register a new user. Returns an error string or null on success. */
  register(name: string, email: string, password: string): string | null {
    const users = this.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return 'An account with this email already exists.';
    }
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: this.hash(password),
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    this.startSession(newUser);
    return null;
  }

  /** Log in. Returns an error string or null on success. */
  login(email: string, password: string): string | null {
    const users = this.getUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === this.hash(password)
    );
    if (!user) {
      return 'Incorrect email or password.';
    }
    this.startSession(user);
    return null;
  }

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  // ── Helpers ─────────────────────────────────────────────

  private startSession(user: StoredUser) {
    const { passwordHash, ...safe } = user;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(safe));
    this.currentUser.set(safe);
  }

  private loadSession(): User | null {
    try {
      const raw = localStorage.getItem('at_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private getUsers(): StoredUser[] {
    try {
      return JSON.parse(localStorage.getItem(this.USERS_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  /**
   * Reset a user's password.
   * Returns an error string on failure, or null on success.
   */
  resetPassword(email: string, newPassword: string): string | null {
    if (newPassword.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (idx === -1) {
      return 'No account found with that email address.';
    }
    users[idx].passwordHash = this.hash(newPassword);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    return null;
  }

  /** Real Google OAuth via Firebase – opens a popup */
  async loginWithGoogle(): Promise<string | null> {
    try {
      const result = await signInWithPopup(this.fireAuth, new GoogleAuthProvider());
      this.saveOAuthSession(result.user);
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'Google sign-in failed.';
    }
  }

  private saveOAuthSession(fbUser: { uid: string; displayName: string | null; email: string | null }) {
    const user: User = {
      id: fbUser.uid,
      name: fbUser.displayName ?? 'User',
      email: fbUser.email ?? '',
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /** Check whether an email is registered (used by forgot-password flow). */
  emailExists(email: string): boolean {
    return this.getUsers().some(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  /** Very simple hash — good enough for a local demo */
  private hash(str: string): string {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h.toString(16);
  }
}
