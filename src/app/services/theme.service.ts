import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  isDark = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('theme');
      if (saved) {
        this.isDark.set(saved === 'dark');
      }
    }
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      document.documentElement.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
      localStorage.setItem('theme', this.isDark() ? 'dark' : 'light');
    });
  }

  toggle() {
    this.isDark.update(v => !v);
  }

  setTheme(theme: 'dark' | 'light') {
    this.isDark.set(theme === 'dark');
  }

  themeName(): 'dark' | 'light' {
    return this.isDark() ? 'dark' : 'light';
  }
}
