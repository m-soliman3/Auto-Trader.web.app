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
  localTime: string;
  language: string;
  region: string;
  timeZone: string;
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

@Injectable({ providedIn: 'root' })
export class UsageAnalyticsService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly analyticsCollection = 'userAnalytics';

  private readonly flushIntervalMs = 30000;
  private readonly sessionLoginRecorded = new Set<string>();

  private activeUserId: string | null = null;
  private visitorId: string | null = null;
  private currentPageKey: string | null = null;
  private pageStartedAtMs = 0;
  private flushTimerId: number | null = null;

  private readonly sessionStartedAtMs = Date.now();
  private readonly sessionStartedAt = new Date().toISOString();

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
      // Capture elapsed time before switching identity so it isn't lost.
      this.captureCurrentPageDuration();

      if (!user) {
        this.flushPendingAnalytics();
        this.activeUserId = null;
        return;
      }

      this.activeUserId = user.uid;
      void this.ensureSummaryDocument(user.uid, user.email ?? undefined);

      if (!this.sessionLoginRecorded.has(user.uid)) {
        this.sessionLoginRecorded.add(user.uid);
        void this.recordLogin(this.summaryRef(user.uid), this.buildAuthEventContext(), user.email ?? undefined);
      }

      this.flushPendingAnalytics();
    });
  }

  async recordAuthEvent(userId: string, type: AuthEventType, languageCode?: string): Promise<void> {
    if (!userId) return;

    const summaryRef = this.summaryRef(userId);
    const context = this.buildAuthEventContext(languageCode);
    const email = this.auth.currentUser?.email ?? undefined;

    if (type === 'signup') {
      try {
        const payload: Record<string, unknown> = {
          lastSignupContext: context,
          updatedAt: serverTimestamp(),
        };
        if (email) payload['email'] = email;
        await setDoc(summaryRef, payload, { merge: true });
      } catch (error) {
        console.error('failed to record signup analytics', error);
      }
      return;
    }

    this.sessionLoginRecorded.add(userId);
    await this.recordLogin(summaryRef, context, email);
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
    const effectiveId = this.getEffectiveUserId();
    if (!effectiveId) return;
    if (this.pendingPageViewCounts.size === 0 && this.pendingPageDurationSeconds.size === 0) return;

    const summaryRef = this.summaryRef(effectiveId);
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      currentSessionStartedAt: this.sessionStartedAt,
      userType: this.activeUserId ? 'user' : 'visitor',
    };

    let flushingDurationSeconds = 0;

    for (const [pageKey, count] of this.pendingPageViewCounts.entries()) {
      updatePayload[`pageViewCounts.${pageKey}`] = increment(count);
    }

    for (const [pageKey, seconds] of this.pendingPageDurationSeconds.entries()) {
      updatePayload[`pageDurationSeconds.${pageKey}`] = increment(seconds);
      flushingDurationSeconds += seconds;
    }

    if (flushingDurationSeconds > 0) {
      updatePayload['totalDurationSeconds'] = increment(flushingDurationSeconds);
    }

    this.pendingPageViewCounts.clear();
    this.pendingPageDurationSeconds.clear();

    void setDoc(summaryRef, updatePayload, { merge: true }).catch((error) => {
      console.error('failed to flush usage analytics', error);
    });
  }

  private getEffectiveUserId(): string | null {
    return this.activeUserId ?? this.getOrCreateVisitorId();
  }

  private getOrCreateVisitorId(): string {
    if (this.visitorId) return this.visitorId;

    try {
      const stored = sessionStorage.getItem('at_visitor_id');
      if (stored) {
        this.visitorId = stored;
        return stored;
      }
      const newId = `visitor_${crypto.randomUUID()}`;
      sessionStorage.setItem('at_visitor_id', newId);
      this.visitorId = newId;
      return newId;
    } catch {
      // sessionStorage may be restricted (e.g. private-browsing edge cases)
      if (!this.visitorId) {
        this.visitorId = `visitor_${crypto.randomUUID()}`;
      }
      return this.visitorId;
    }
  }

  private async recordLogin(
    summaryRef: ReturnType<typeof doc>,
    loginContext: AuthEventContext,
    email?: string,
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

        const payload: Record<string, unknown> = {
          lastLogins: nextHistory,
          lastLoginContext: loginContext,
          updatedAt: serverTimestamp(),
        };
        if (email) payload['email'] = email;

        transaction.set(summaryRef, payload, { merge: true });
      });
    } catch (error) {
      console.error('failed to record login analytics', error);
    }
  }

  private toPageKey(url: string): string {
    const baseUrl = url.split('?')[0]?.split('#')[0] ?? '/';
    const normalized = baseUrl.trim() || '/';
    if (normalized === '/') return 'home';
    // Strip leading slash, replace remaining slashes with underscores
    return normalized.replace(/^\//, '').replace(/\//g, '_');
  }

  private normalizeLoginEntry(entry: unknown): AuthEventContext | null {
    if (typeof entry === 'string') {
      return {
        at: entry,
        localTime: entry,
        language: this.detectLanguage(),
        region: this.detectRegion(),
        timeZone: this.detectTimeZone(),
        browser: this.detectBrowser(),
        deviceType: this.detectDeviceType(),
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
      localTime: typeof candidate.localTime === 'string' ? candidate.localTime : candidate.at,
      language: typeof candidate.language === 'string' ? candidate.language : this.detectLanguage(),
      region: typeof candidate.region === 'string' ? candidate.region : this.detectRegion(),
      timeZone: typeof candidate.timeZone === 'string' ? candidate.timeZone : this.detectTimeZone(),
      browser: typeof candidate.browser === 'string' ? candidate.browser : this.detectBrowser(),
      deviceType: this.isDeviceType(candidate.deviceType) ? candidate.deviceType : this.detectDeviceType(),
    };
  }

  private buildAuthEventContext(languageCode?: string): AuthEventContext {
    return {
      at: new Date().toISOString(),
      localTime: this.detectLocalTime(),
      language: languageCode?.trim() || this.detectLanguage(),
      region: this.detectRegion(),
      timeZone: this.detectTimeZone(),
      browser: this.detectBrowser(),
      deviceType: this.detectDeviceType(),
    };
  }

  private isDeviceType(value: unknown): value is 'desktop' | 'mobile' | 'tablet' {
    return value === 'desktop' || value === 'mobile' || value === 'tablet';
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

  private detectLocalTime(): string {
    const now = new Date();
    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
    const minutes = String(absoluteMinutes % 60).padStart(2, '0');

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}${sign}${hours}:${minutes}`;
  }

  private detectBrowser(): string {
    if (typeof navigator === 'undefined') return 'Unknown';
    const ua = navigator.userAgent;

    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('OPR/')) return 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';

    return 'Unknown';
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent.toLowerCase();

    if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
      return 'tablet';
    }

    if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
      return 'mobile';
    }

    return 'desktop';
  }

  private summaryRef(docId: string) {
    return doc(this.firestore, this.analyticsCollection, docId);
  }

  private async ensureSummaryDocument(userId: string, email?: string): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      };
      if (email) payload['email'] = email;
      await setDoc(this.summaryRef(userId), payload, { merge: true });
    } catch (error) {
      console.error('failed to ensure analytics summary document', error);
    }
  }
}