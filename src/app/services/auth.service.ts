import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  verifyBeforeUpdateEmail,
  User as FirebaseUser,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
} from '@angular/fire/firestore';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthAccountDetails {
  email: string;
  emailVerified: boolean;
  creationTime: string;
  lastSignInTime: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private fireAuth = inject(Auth);
  private firestore = inject(Firestore);
  private router   = inject(Router);

  currentUser = signal<User | null>(null);
  accountDetails = signal<AuthAccountDetails | null>(null);
  isLoggedIn  = computed(() => this.currentUser() !== null);

  constructor() {
    onAuthStateChanged(this.fireAuth, async (fbUser) => {
      if (fbUser) {
        this.accountDetails.set({
          email: fbUser.email ?? '',
          emailVerified: fbUser.emailVerified,
          creationTime: fbUser.metadata.creationTime ?? '',
          lastSignInTime: fbUser.metadata.lastSignInTime ?? '',
        });

        const ref = doc(this.firestore, 'users', fbUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          this.currentUser.set(snap.data() as User);
        } else {
          // Create and save fallback profile to Firestore
          const fallbackProfile: User = {
            id: fbUser.uid,
            name: fbUser.displayName ?? 'User',
            email: fbUser.email ?? '',
            createdAt: new Date().toISOString(),
          };
          try {
            await setDoc(ref, fallbackProfile);
            this.currentUser.set(fallbackProfile);
          } catch (err) {
            console.error('failed to create user profile', err);
            this.currentUser.set(fallbackProfile);
          }
        }
      } else {
        this.currentUser.set(null);
        this.accountDetails.set(null);
      }
    });
  }

  /** Register a new user using Firebase. */
  async register(name: string, email: string, password: string): Promise<string | null> {
    try {
      const cred = await createUserWithEmailAndPassword(this.fireAuth, email, password);
      await updateProfile(cred.user, { displayName: name });
      const profile: User = {
        id: cred.user.uid,
        name,
        email,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
      this.currentUser.set(profile);
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  /** Log in via Firebase */
  async login(email: string, password: string): Promise<string | null> {
    try {
      await signInWithEmailAndPassword(this.fireAuth, email, password);
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  async logout() {
    await signOut(this.fireAuth);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  /**
   * Send a Firebase password-reset email.
   */
  async sendPasswordResetEmail(email: string): Promise<string | null> {
    try {
      await sendPasswordResetEmail(this.fireAuth, email);
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  async sendPasswordResetForCurrentUser(): Promise<string | null> {
    const email = this.accountDetails()?.email ?? this.currentUser()?.email ?? '';
    if (!email) return 'No email is available for this account.';
    return this.sendPasswordResetEmail(email);
  }

  async changeEmailAddress(nextEmail: string): Promise<string | null> {
    const user = this.fireAuth.currentUser;
    if (!user) return 'Please log in again to update your email address.';

    const normalized = nextEmail.trim();
    if (!normalized) return 'Please enter a new email address.';

    try {
      await verifyBeforeUpdateEmail(user, normalized);
      this.accountDetails.update(details => {
        if (!details) return details;
        return {
          ...details,
          email: normalized,
          emailVerified: false,
        };
      });
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  /** Real Google OAuth via Firebase – opens a popup */
  async loginWithGoogle(): Promise<string | null> {
    try {
      const result = await signInWithPopup(this.fireAuth, new GoogleAuthProvider());
      // ensure profile stored
      const profile: User = {
        id: result.user.uid,
        name: result.user.displayName ?? 'User',
        email: result.user.email ?? '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(this.firestore,'users',profile.id),profile, { merge: true });
      this.currentUser.set(profile);
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'Google sign-in failed.';
    }
  }

  // utility to translate errors
  private mapError(e: any): string {
    switch (e.code) {
      case 'auth/email-already-in-use':  return 'An account with this email already exists.';
      case 'auth/invalid-email':         return 'Please enter a valid email address.';
      case 'auth/weak-password':         return 'Password must be at least 6 characters.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':    return 'Incorrect email or password.';
      case 'auth/user-disabled':         return 'This account has been disabled.';
      case 'auth/too-many-requests':     return 'Too many attempts. Please try again later.';
      case 'auth/requires-recent-login': return 'Please log out and log back in, then try again.';
      default:                           return e.message ?? 'An error occurred.';
    }
  }
}
