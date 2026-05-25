import { Injectable, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';

export type AccountMode = 'real' | 'paper';

@Injectable({ providedIn: 'root' })
export class AccountModeService {
  private readonly storageKey = 'auto-trader-account-mode';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
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
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.storageKey);
      return saved === 'paper' ? 'paper' : 'real';
    }
    return 'real';
  }

  private applyModeAttribute(mode: AccountMode) {
    this.document.documentElement.setAttribute('data-account-mode', mode);
  }
}
