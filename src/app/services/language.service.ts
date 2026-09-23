import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

export interface Language {
  code: string;
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  /** Pages and routing for this language still exist, but it's hidden from the language selector UI. */
  hidden?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr', hidden: true },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr', hidden: true },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr', hidden: true },
  { code: 'pt', label: 'Português', flag: '🇵🇹', dir: 'ltr', hidden: true },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
];

const STORAGE_KEY = 'at_language';
const REGION_LOOKUP_TIMEOUT_MS = 4000;

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  // German-speaking regions
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
  LU: 'de',

  // Spanish-speaking regions
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  VE: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  EC: 'es',
  GT: 'es',
  CU: 'es',
  DO: 'es',
  HN: 'es',
  SV: 'es',
  NI: 'es',
  CR: 'es',
  PA: 'es',

  // French-speaking regions
  FR: 'fr',
  BE: 'fr',
  MC: 'fr',
  CA: 'fr',

  // Portuguese-speaking regions
  PT: 'pt',
  BR: 'pt',
  AO: 'pt',
  MZ: 'pt',
  CV: 'pt',
  GW: 'pt',
  ST: 'pt',
  TL: 'pt',

  // Arabic-speaking regions
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  MA: 'ar',
  DZ: 'ar',
  TN: 'ar',
  JO: 'ar',
  LB: 'ar',
  SY: 'ar',
  IQ: 'ar',
  KW: 'ar',
  QA: 'ar',
  BH: 'ar',
  OM: 'ar',
  YE: 'ar',
  SD: 'ar',
  LY: 'ar',
  PS: 'ar',
  MR: 'ar',
  SO: 'ar',
  DJ: 'ar',
  KM: 'ar',
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  readonly languages = LANGUAGES;
  /** Languages shown in the language-selector UI. Hidden languages keep their pages and routing. */
  readonly selectableLanguages = LANGUAGES.filter((l) => !l.hidden);
  readonly currentLang = signal<string>(this.getInitialLang());

  constructor() {
    this.translate.addLangs(LANGUAGES.map((l) => l.code));
    this.translate.setDefaultLang('en');

    effect(() => {
      const code = this.currentLang();
      this.translate.use(code);
      this.applyDir(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // storage not available
      }
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncLanguageFromUrl(event.urlAfterRedirects);
      });

    this.syncLanguageFromUrl(this.router.url);

    // At bootstrap, router.url is still '/' while the browser is on the real deep-link URL.
    // Use the browser pathname as the authoritative initial URL so we don't treat a
    // language-prefixed deep-link (e.g. /ar/learn/some-page) as "no language set" and
    // mistakenly navigate back to the language homepage.
    if (isPlatformBrowser(this.platformId)) {
      const initialUrl =
        this.router.url !== '/'
          ? this.router.url
          : (globalThis.location?.pathname ?? '/');

      if (!this.hasStoredLanguagePreference() && !this.getLanguageFromUrl(initialUrl)) {
        void this.applyStartupLanguageByLocation();
      }
    }
  }

  setLanguage(code: string): void {
    if (LANGUAGES.some((l) => l.code === code)) {
      this.currentLang.set(code);
      const nextUrl = this.buildUrlWithLanguage(this.router.url, code);
      if (nextUrl !== this.router.url) {
        void this.router.navigateByUrl(nextUrl, { replaceUrl: true });
      }
    }
  }

  getCurrentLanguage(): Language {
    return LANGUAGES.find((l) => l.code === this.currentLang()) ?? LANGUAGES[0];
  }

  isSupportedLanguage(code: string): boolean {
    return LANGUAGES.some((language) => language.code === code);
  }

  private getInitialLang(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        return stored;
      }
    } catch {
      // storage not available
    }

    return 'en';
  }

  private hasStoredLanguagePreference(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return !!stored && LANGUAGES.some((l) => l.code === stored);
    } catch {
      return false;
    }
  }

  private getLanguageFromUrl(url: string): string | null {
    const parsed = this.router.parseUrl(url);
    const primary = parsed.root.children['primary'];
    const first = primary?.segments[0]?.path;
    if (first && LANGUAGES.some((lang) => lang.code === first)) {
      return first;
    }
    return null;
  }

  private async applyStartupLanguageByLocation(): Promise<void> {
    const startingLanguage = this.currentLang();
    const locationLanguage = await this.detectLanguageFromLocation();

    // Do not override a language selected while startup detection was in progress.
    if (
      this.currentLang() !== startingLanguage ||
      this.hasStoredLanguagePreference() ||
      this.getLanguageFromUrl(this.router.url) ||
      this.getLanguageFromUrl(globalThis.location?.pathname ?? '')
    ) {
      return;
    }

    this.setLanguage(locationLanguage ?? 'en');
  }

  private async detectLanguageFromLocation(): Promise<string | null> {
    const countryCode = await this.getCountryCodeFromCurrentLocation();
    if (!countryCode) {
      return null;
    }

    const mapped = COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()];
    return mapped && this.selectableLanguages.some((lang) => lang.code === mapped) ? mapped : null;
  }

  private async getCountryCodeFromCurrentLocation(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return null;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: REGION_LOOKUP_TIMEOUT_MS,
          maximumAge: 600000,
        });
      });

      const abortController = new AbortController();
      const timeoutId = globalThis.setTimeout(() => abortController.abort(), REGION_LOOKUP_TIMEOUT_MS);

      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          return null;
        }

        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || !("countryCode" in payload)) {
          return null;
        }

        const countryCode = (payload as { countryCode?: unknown }).countryCode;
        return typeof countryCode === 'string' && countryCode.length > 0 ? countryCode : null;
      } finally {
        globalThis.clearTimeout(timeoutId);
      }
    } catch {
      return null;
    }
  }

  // Runs on the server too, so prerendered pages ship the correct <html lang dir>
  // (e.g. /ar/* as lang="ar" dir="rtl") instead of index.html's lang="en".
  private applyDir(code: string): void {
    const lang = LANGUAGES.find((l) => l.code === code);
    const dir = lang?.dir ?? 'ltr';
    this.document.documentElement.setAttribute('dir', dir);
    this.document.documentElement.setAttribute('lang', code);
  }

  private syncLanguageFromUrl(url: string): void {
    const parsed = this.router.parseUrl(url);
    const primary = parsed.root.children['primary'];
    const segments = primary?.segments.map((segment) => segment.path) ?? [];
    const first = segments[0];

    if (first && LANGUAGES.some((lang) => lang.code === first)) {
      if (this.currentLang() !== first) {
        this.currentLang.set(first);
      }
    }
  }

  private buildUrlWithLanguage(url: string, code: string): string {
    const parsed = this.router.parseUrl(url);
    const primary = parsed.root.children['primary'];
    const segments = primary?.segments.map((segment) => segment.path) ?? [];
    const hasLangPrefix = segments.length > 0 && LANGUAGES.some((lang) => lang.code === segments[0]);
    const nextSegments = hasLangPrefix ? [code, ...segments.slice(1)] : [code, ...segments];
    const commands: Array<string> = ['/', ...nextSegments];

    const nextTree = this.router.createUrlTree(commands, {
      queryParams: parsed.queryParams,
      fragment: parsed.fragment ?? undefined,
    });

    return this.router.serializeUrl(nextTree);
  }
}
