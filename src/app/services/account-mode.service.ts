import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AccountMode = 'real' | 'paper';

@Injectable({ providedIn: 'root' })
export class AccountModeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'auto-trader-account-mode';
  private readonly modeSignal = signal<AccountMode>(this.readInitialMode());

  mode = computed(() => this.modeSignal());
  isPaperMode = computed(() => this.modeSignal() === 'paper');

  constructor() {
    this.applyModeAttribute(this.modeSignal());
  }

  setMode(mode: AccountMode) {
    this.modeSignal.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, mode);
    }
    this.applyModeAttribute(mode);
  }

  toggle() {
    this.setMode(this.modeSignal() === 'real' ? 'paper' : 'real');
  }

  private readInitialMode(): AccountMode {
    if (!isPlatformBrowser(this.platformId)) return 'real';
    const saved = localStorage.getItem(this.storageKey);
    return saved === 'paper' ? 'paper' : 'real';
  }

  private applyModeAttribute(mode: AccountMode) {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.setAttribute('data-account-mode', mode);
  }
}