import { Injectable, inject, signal, effect } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

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
  }

  setLanguage(code: string): void {
    if (LANGUAGES.some((l) => l.code === code)) {
      this.currentLang.set(code);
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
}
