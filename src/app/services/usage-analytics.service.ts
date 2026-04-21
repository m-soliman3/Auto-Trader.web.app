import { Injectable, inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

type AuthEventType = 'signup' | 'login';

interface AuthEventContext {
  at: string;
  language: string;
  region: string;
  timeZone: string;
}

@Injectable({ providedIn: 'root' })
export class UsageAnalyticsService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  private readonly flushIntervalMs = 30000;
  private readonly sessionLoginRecorded = new Set<string>();

  private activeUserId: string | null = null;
  private currentPageKey: string | null = null;
  private pageStartedAtMs = 0;
  private flushTimerId: number | null = null;

  private pendingPageViewCounts = new Map<string, number>();
  private pendingPageDurationSeconds = new Map<string, number>();

  constructor() {
    this.handleAuthState();
    this.handleNavigation();
    this.handleDocumentVisibility();
    this.handlePageUnload();

    this.startNewPage(this.router.url);
    this.startFlushTimer();
  }

  private handleAuthState(): void {
    onAuthStateChanged(this.auth, (user) => {
      if (!user) {
        this.flushPendingAnalytics();
        this.activeUserId = null;
        return;
      }

      this.activeUserId = user.uid;
    });
  }

  async recordAuthEvent(userId: string, type: AuthEventType, languageCode?: string): Promise<void> {
    if (!userId) return;

    const summaryRef = doc(this.firestore, 'users', userId, 'analytics', 'summary');
    const context = this.buildAuthEventContext(languageCode);

    if (type === 'signup') {
      try {
        await setDoc(
          summaryRef,
          {
            lastSignupContext: context,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error('failed to record signup analytics', error);
      }
      return;
    }

    this.sessionLoginRecorded.add(userId);
    await this.recordLogin(summaryRef, context);
  }

  private handleNavigation(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const navEnd = event as NavigationEnd;
        this.captureCurrentPageDuration();
        this.startNewPage(navEnd.urlAfterRedirects);
        this.flushPendingAnalytics();
      });
  }

  private handleDocumentVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.captureCurrentPageDuration();
        this.flushPendingAnalytics();
        return;
      }

      this.pageStartedAtMs = Date.now();
    });
  }

  private handlePageUnload(): void {
    window.addEventListener('beforeunload', () => {
      this.captureCurrentPageDuration();
      this.flushPendingAnalytics();
    });
  }

  private startNewPage(url: string): void {
    this.currentPageKey = this.toPageKey(url);
    this.pageStartedAtMs = Date.now();
    this.addPendingPageView(this.currentPageKey, 1);
  }

  private captureCurrentPageDuration(): void {
    if (!this.currentPageKey || !this.pageStartedAtMs) return;

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - this.pageStartedAtMs) / 1000));
    this.addPendingPageDuration(this.currentPageKey, elapsedSeconds);
    this.pageStartedAtMs = Date.now();
  }

  private addPendingPageView(pageKey: string, count: number): void {
    const current = this.pendingPageViewCounts.get(pageKey) ?? 0;
    this.pendingPageViewCounts.set(pageKey, current + count);
  }

  private addPendingPageDuration(pageKey: string, seconds: number): void {
    const current = this.pendingPageDurationSeconds.get(pageKey) ?? 0;
    this.pendingPageDurationSeconds.set(pageKey, current + seconds);
  }

  private startFlushTimer(): void {
    this.flushTimerId = window.setInterval(() => {
      this.flushPendingAnalytics();
    }, this.flushIntervalMs);
  }

  private flushPendingAnalytics(): void {
    if (!this.activeUserId) return;
    if (this.pendingPageViewCounts.size === 0 && this.pendingPageDurationSeconds.size === 0) return;

    const summaryRef = doc(this.firestore, 'users', this.activeUserId, 'analytics', 'summary');
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    for (const [pageKey, count] of this.pendingPageViewCounts.entries()) {
      updatePayload[`pageViewCounts.${pageKey}`] = increment(count);
    }

    for (const [pageKey, seconds] of this.pendingPageDurationSeconds.entries()) {
      updatePayload[`pageDurationSeconds.${pageKey}`] = increment(seconds);
    }

    this.pendingPageViewCounts.clear();
    this.pendingPageDurationSeconds.clear();

    void setDoc(summaryRef, updatePayload, { merge: true }).catch((error) => {
      console.error('failed to flush usage analytics', error);
    });
  }

  private async recordLogin(
    summaryRef: ReturnType<typeof doc>,
    loginContext: AuthEventContext,
  ): Promise<void> {
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const snapshot = await transaction.get(summaryRef);
        const existing = snapshot.exists() ? snapshot.data()['lastLogins'] : [];
        const history = Array.isArray(existing)
          ? existing
              .map((entry) => this.normalizeLoginEntry(entry))
              .filter((entry): entry is AuthEventContext => !!entry)
          : [];

        const nextHistory = [loginContext, ...history].slice(0, 10);

        transaction.set(
          summaryRef,
          {
            lastLogins: nextHistory,
            lastLoginContext: loginContext,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (error) {
      console.error('failed to record login analytics', error);
    }
  }

  private toPageKey(url: string): string {
    const baseUrl = url.split('?')[0]?.split('#')[0] ?? '/';
    const normalized = baseUrl.trim() || '/';
    return encodeURIComponent(normalized);
  }

  private normalizeLoginEntry(entry: unknown): AuthEventContext | null {
    if (typeof entry === 'string') {
      return {
        at: entry,
        language: this.detectLanguage(),
        region: this.detectRegion(),
        timeZone: this.detectTimeZone(),
      };
    }

    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const candidate = entry as Partial<AuthEventContext>;
    if (typeof candidate.at !== 'string') {
      return null;
    }

    return {
      at: candidate.at,
      language: typeof candidate.language === 'string' ? candidate.language : this.detectLanguage(),
      region: typeof candidate.region === 'string' ? candidate.region : this.detectRegion(),
      timeZone: typeof candidate.timeZone === 'string' ? candidate.timeZone : this.detectTimeZone(),
    };
  }

  private buildAuthEventContext(languageCode?: string): AuthEventContext {
    return {
      at: new Date().toISOString(),
      language: languageCode?.trim() || this.detectLanguage(),
      region: this.detectRegion(),
      timeZone: this.detectTimeZone(),
    };
  }

  private detectLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';
    const preferred = navigator.language || navigator.languages?.[0] || 'en';
    return preferred.split('-')[0]?.toLowerCase() || 'en';
  }

  private detectRegion(): string {
    if (typeof navigator !== 'undefined') {
      const source = navigator.language || navigator.languages?.[0] || '';
      const byLocaleSuffix = source.split('-')[1];
      if (byLocaleSuffix) return byLocaleSuffix.toUpperCase();

      try {
        if (typeof Intl !== 'undefined' && 'Locale' in Intl) {
          const locale = new Intl.Locale(source || 'en');
          if (locale.region) return locale.region.toUpperCase();
        }
      } catch {
        // ignore locale parsing errors
      }
    }

    const timeZone = this.detectTimeZone();
    const byTimeZone = timeZone.split('/').at(-1);
    return byTimeZone ? byTimeZone.toUpperCase().slice(0, 16) : 'UNKNOWN';
  }

  private detectTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }
}