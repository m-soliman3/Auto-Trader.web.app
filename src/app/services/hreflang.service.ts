import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';
import { LANGUAGES } from './language.service';

const BASE_URL = 'https://invest-begin.com';
const PAYWALL_SCHEMA_SCRIPT_SELECTOR = 'script[data-schema="paywall"]';
const PROTECTED_PATH_PATTERNS = [
  /^\/exchanges(?:\/|$)/,
  /^\/bots(?:\/|$)/,
  /^\/strategies(?:\/|$)/,
  /^\/portfolio-management(?:\/|$)/,
  /^\/backend-runner(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/trade(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/billing\/checkout(?:\/|$)/,
  /^\/billing\/manage(?:\/|$)/,
];

@Injectable({ providedIn: 'root' })
export class HreflangService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateTags(event.urlAfterRedirects);
      });

    this.updateTags(this.router.url);
  }

  private updateTags(url: string): void {
    const canonicalPath = this.getCanonicalPath(url);
    this.setHreflangTags(canonicalPath);
    this.setCanonicalTag(url, canonicalPath);
    this.setPaywallStructuredData(canonicalPath);
  }

  /**
   * Strips the language prefix and query string from the URL to get the bare path.
   * e.g. "/en/features/ai-signals?foo=bar" -> "/features/ai-signals"
   *      "/en" -> ""
   */
  private getCanonicalPath(url: string): string {
    const withoutQuery = url.split('?')[0].split('#')[0];
    const segments = withoutQuery.split('/').filter(Boolean);

    if (segments.length > 0 && LANGUAGES.some((l) => l.code === segments[0])) {
      segments.shift();
    }

    return segments.length > 0 ? '/' + segments.join('/') : '';
  }

  private setHreflangTags(canonicalPath: string): void {
    this.removeExistingHreflangTags();

    const head = this.document.head;
    const fragment = this.document.createDocumentFragment();

    for (const lang of LANGUAGES) {
      const href = `${BASE_URL}/${lang.code}${canonicalPath}`;
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang.code);
      link.setAttribute('href', href);
      fragment.appendChild(link);
    }

    // x-default points to the English version
    const xDefault = this.document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', `${BASE_URL}/en${canonicalPath}`);
    fragment.appendChild(xDefault);

    head.appendChild(fragment);
  }

  private setCanonicalTag(url: string, canonicalPath: string): void {
    let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }

    // Derive the active language from the URL
    const withoutQuery = url.split('?')[0].split('#')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    const langCode = segments.length > 0 && LANGUAGES.some((l) => l.code === segments[0]) ? segments[0] : 'en';

    canonical.setAttribute('href', `${BASE_URL}/${langCode}${canonicalPath}`);
  }

  private removeExistingHreflangTags(): void {
    const existing = this.document.querySelectorAll('link[rel="alternate"][hreflang]');
    existing.forEach((el) => el.parentNode?.removeChild(el));
  }

  private setPaywallStructuredData(canonicalPath: string): void {
    const existing = this.document.querySelector<HTMLScriptElement>(PAYWALL_SCHEMA_SCRIPT_SELECTOR);

    if (!this.isProtectedPath(canonicalPath)) {
      existing?.parentNode?.removeChild(existing);
      return;
    }

    const script = existing ?? this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-schema', 'paywall');
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      isAccessibleForFree: false,
    });

    if (!existing) {
      this.document.head.appendChild(script);
    }
  }

  private isProtectedPath(path: string): boolean {
    return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(path));
  }
}
