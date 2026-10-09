import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  TwitterAuthProvider,
  getAdditionalUserInfo,
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
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from '@angular/fire/firestore';
import { LanguageService } from './language.service';
import { SignupMethod, UsageAnalyticsService } from './usage-analytics.service';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  preferredLanguage?: string;
  /** How the account was first created; set once at signup. */
  signupMethod?: SignupMethod;
  plan?: string;
  subscription?: {
    active?: boolean;
    status?: string;
    priceUsd?: number;
    renewedAt?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: string;
    canceledBy?: string;
  };
  /** Real-money wallet balance in USD (topped up via Stripe one-time payments). */
  realMoneyBalance?: number;
  /** True once the user has completed real-money onboarding (connected exchange OR topped up). */
  realMoneyOnboarded?: boolean;
  /** Alpaca Broker sandbox account ID auto-provisioned on first top-up. */
  alpacaBrokerAccountId?: string;
  /** True once the user has completed paper-money onboarding (topped up demo account OR connected paper exchange). */
  paperOnboarded?: boolean;
  /** Starting balance of the auto-provisioned Alpaca paper account (USD). */
  alpacaPaperBalance?: number;
  /** Alpaca paper account number (e.g. "PA12345678") assigned on demo top-up. */
  alpacaPaperAccountNumber?: string;
  /** True once the user has completed the post-signup onboarding guide. */
  onboardingCompleted?: boolean;
  /** True once the user has skipped or finished the dashboard quick guide tour. */
  tourCompleted?: boolean;
  /** Answers captured during the post-signup onboarding guide. */
  signupGuide?: {
    isActiveTrader: boolean;
    portfolioType: 'stocks' | 'crypto';
    broker: string;
    otherBroker?: string;
  };
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
  private language = inject(LanguageService);
  private usageAnalytics = inject(UsageAnalyticsService);

  currentUser = signal<User | null>(null);
  accountDetails = signal<AuthAccountDetails | null>(null);
  isLoggedIn  = computed(() => this.currentUser() !== null);
  /** Set to true when the last social sign-in created a new account. */
  lastSigninWasNewUser = signal<boolean>(false);
  private profileListenerUnsub: Unsubscribe | null = null;

  constructor() {
    onAuthStateChanged(this.fireAuth, async (fbUser) => {
      if (this.profileListenerUnsub) {
        this.profileListenerUnsub();
        this.profileListenerUnsub = null;
      }

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
          const storedProfile = snap.data() as User;
          this.currentUser.set(storedProfile);
          this.applyPreferredLanguage(storedProfile.preferredLanguage);
        } else {
          // Create and save fallback profile to Firestore
          const fallbackProfile: User = {
            id: fbUser.uid,
            name: fbUser.displayName ?? 'User',
            email: fbUser.email ?? '',
            createdAt: new Date().toISOString(),
            preferredLanguage: this.language.getCurrentLanguage().code,
            onboardingCompleted: false,
          };
          try {
            await setDoc(ref, fallbackProfile);
            this.currentUser.set(fallbackProfile);
            this.applyPreferredLanguage(fallbackProfile.preferredLanguage);
          } catch (err) {
            console.error('failed to create user profile', err);
            this.currentUser.set(fallbackProfile);
            this.applyPreferredLanguage(fallbackProfile.preferredLanguage);
          }
        }

        this.profileListenerUnsub = onSnapshot(
          ref,
          (snapshot) => {
            if (!snapshot.exists()) return;
            const latestProfile = snapshot.data() as User;
            this.currentUser.set(latestProfile);
            this.applyPreferredLanguage(latestProfile.preferredLanguage);
          },
          (error) => {
            console.error('failed to listen for user profile updates', error);
          },
        );
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
        preferredLanguage: this.language.getCurrentLanguage().code,
        onboardingCompleted: false,
        signupMethod: 'email',
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
      this.currentUser.set(profile);
      await this.usageAnalytics.recordAuthEvent(cred.user.uid, 'signup', profile.preferredLanguage, 'email');
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  /** Log in via Firebase */
  async login(email: string, password: string): Promise<string | null> {
    try {
      const cred = await signInWithEmailAndPassword(this.fireAuth, email, password);
      await this.usageAnalytics.recordAuthEvent(
        cred.user.uid,
        'login',
        this.language.getCurrentLanguage().code,
      );
      return null;
    } catch (e: any) {
      return this.mapError(e);
    }
  }

  async logout() {
    await signOut(this.fireAuth);
    this.currentUser.set(null);
    this.accountDetails.set(null);
    await this.router.navigate(['/', this.language.getCurrentLanguage().code]);
  }

  async logoutToLogin() {
    await signOut(this.fireAuth);
    this.currentUser.set(null);
    this.accountDetails.set(null);
    await this.router.navigate(['/', this.language.getCurrentLanguage().code, 'login']);
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

  async reloadCurrentUserProfile(): Promise<void> {
    const fbUser = this.fireAuth.currentUser;
    if (!fbUser) {
      this.currentUser.set(null);
      return;
    }

    const ref = doc(this.firestore, 'users', fbUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const profile = snap.data() as User;
      this.currentUser.set(profile);
      this.applyPreferredLanguage(profile.preferredLanguage);
    }
  }

  /** Marks the dashboard quick guide tour as skipped/finished, persisted on the user's profile. */
  async markTourCompleted(): Promise<void> {
    const fbUser = this.fireAuth.currentUser;
    if (!fbUser) return;

    this.currentUser.update((current) => (current ? { ...current, tourCompleted: true } : current));

    try {
      await setDoc(doc(this.firestore, 'users', fbUser.uid), { tourCompleted: true }, { merge: true });
    } catch (err) {
      console.error('failed to save tour completion', err);
    }
  }

  async updatePreferredLanguage(languageCode: string): Promise<string | null> {
    const fbUser = this.fireAuth.currentUser;
    if (!fbUser) {
      return 'Please log in again to update your language settings.';
    }

    if (!this.language.isSupportedLanguage(languageCode)) {
      return 'Selected language is not supported.';
    }

    try {
      await setDoc(
        doc(this.firestore, 'users', fbUser.uid),
        { preferredLanguage: languageCode },
        { merge: true },
      );

      this.currentUser.update((current) => {
        if (!current) return current;
        return {
          ...current,
          preferredLanguage: languageCode,
        };
      });

      return null;
    } catch {
      return 'Could not save your language preference. Please try again.';
    }
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
      const additionalUserInfo = getAdditionalUserInfo(result);
      this.lastSigninWasNewUser.set(additionalUserInfo?.isNewUser ?? false);
      await this.upsertSocialProfile(result.user, additionalUserInfo?.isNewUser ? 'google' : undefined);
      await this.usageAnalytics.recordAuthEvent(
        result.user.uid,
        additionalUserInfo?.isNewUser ? 'signup' : 'login',
        this.language.getCurrentLanguage().code,
        additionalUserInfo?.isNewUser ? 'google' : undefined,
      );
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'Google sign-in failed.';
    }
  }

  /** Microsoft OAuth via Firebase – opens a popup */
  async loginWithMicrosoft(): Promise<string | null> {
    try {
      const result = await signInWithPopup(this.fireAuth, new OAuthProvider('microsoft.com'));
      const additionalUserInfo = getAdditionalUserInfo(result);
      this.lastSigninWasNewUser.set(additionalUserInfo?.isNewUser ?? false);
      await this.upsertSocialProfile(result.user, additionalUserInfo?.isNewUser ? 'microsoft' : undefined);
      await this.usageAnalytics.recordAuthEvent(
        result.user.uid,
        additionalUserInfo?.isNewUser ? 'signup' : 'login',
        this.language.getCurrentLanguage().code,
        additionalUserInfo?.isNewUser ? 'microsoft' : undefined,
      );
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'Microsoft sign-in failed.';
    }
  }

  /** X (Twitter) OAuth via Firebase – opens a popup */
  async loginWithTwitter(): Promise<string | null> {
    try {
      const result = await signInWithPopup(this.fireAuth, new TwitterAuthProvider());
      const additionalUserInfo = getAdditionalUserInfo(result);
      this.lastSigninWasNewUser.set(additionalUserInfo?.isNewUser ?? false);
      await this.upsertSocialProfile(result.user, additionalUserInfo?.isNewUser ? 'twitter' : undefined);
      await this.usageAnalytics.recordAuthEvent(
        result.user.uid,
        additionalUserInfo?.isNewUser ? 'signup' : 'login',
        this.language.getCurrentLanguage().code,
        additionalUserInfo?.isNewUser ? 'twitter' : undefined,
      );
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'X sign-in failed.';
    }
  }

  /** Facebook OAuth via Firebase – opens a popup */
  async loginWithFacebook(): Promise<string | null> {
    try {
      const result = await signInWithPopup(this.fireAuth, new FacebookAuthProvider());
      const additionalUserInfo = getAdditionalUserInfo(result);
      this.lastSigninWasNewUser.set(additionalUserInfo?.isNewUser ?? false);
      await this.upsertSocialProfile(result.user, additionalUserInfo?.isNewUser ? 'facebook' : undefined);
      await this.usageAnalytics.recordAuthEvent(
        result.user.uid,
        additionalUserInfo?.isNewUser ? 'signup' : 'login',
        this.language.getCurrentLanguage().code,
        additionalUserInfo?.isNewUser ? 'facebook' : undefined,
      );
      return null;
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') return null;
      return e.message ?? 'Facebook sign-in failed.';
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

  private applyPreferredLanguage(preferredLanguage?: string): void {
    if (!preferredLanguage || !this.language.isSupportedLanguage(preferredLanguage)) {
      return;
    }

    if (this.language.currentLang() !== preferredLanguage) {
      this.language.setLanguage(preferredLanguage);
    }
  }

  private async upsertSocialProfile(fbUser: FirebaseUser, signupMethod?: SignupMethod): Promise<void> {
    const ref = doc(this.firestore, 'users', fbUser.uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as User) : null;

    const profile: User = {
      id: fbUser.uid,
      name: fbUser.displayName ?? existing?.name ?? 'User',
      email: fbUser.email ?? existing?.email ?? '',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      preferredLanguage: existing?.preferredLanguage ?? this.language.getCurrentLanguage().code,
      ...((existing?.signupMethod ?? signupMethod)
        ? { signupMethod: (existing?.signupMethod ?? signupMethod) as SignupMethod }
        : {}),
    };

    await setDoc(ref, profile, { merge: true });
    this.currentUser.set(profile);
    this.applyPreferredLanguage(profile.preferredLanguage);
  }
}
