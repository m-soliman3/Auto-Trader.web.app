import { Injectable, inject, signal, effect } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

export interface Language {
  code: string;
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'pt', label: 'Português', flag: '🇵🇹', dir: 'ltr' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
];

const STORAGE_KEY = 'at_language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly languages = LANGUAGES;
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

  private getInitialLang(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        return stored;
      }
    } catch {
      // storage not available
    }

    const browserLang = navigator.language?.split('-')[0] ?? 'en';
    return LANGUAGES.some((l) => l.code === browserLang) ? browserLang : 'en';
  }

  private applyDir(code: string): void {
    const lang = LANGUAGES.find((l) => l.code === code);
    const dir = lang?.dir ?? 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', code);
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
      return;
    }

    const nextUrl = this.buildUrlWithLanguage(url, this.currentLang());
    if (nextUrl !== url) {
      void this.router.navigateByUrl(nextUrl, { replaceUrl: true });
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
