import { Injectable, computed, signal } from '@angular/core';

export type AccountMode = 'real' | 'paper';

@Injectable({ providedIn: 'root' })
export class AccountModeService {
  private readonly storageKey = 'auto-trader-account-mode';
  private readonly modeSignal = signal<AccountMode>(this.readInitialMode());

  mode = computed(() => this.modeSignal());
  isPaperMode = computed(() => this.modeSignal() === 'paper');

  constructor() {
    this.applyModeAttribute(this.modeSignal());
  }

  setMode(mode: AccountMode) {
    this.modeSignal.set(mode);
    localStorage.setItem(this.storageKey, mode);
    this.applyModeAttribute(mode);
  }

  toggle() {
    this.setMode(this.modeSignal() === 'real' ? 'paper' : 'real');
  }

  private readInitialMode(): AccountMode {
    const saved = localStorage.getItem(this.storageKey);
    return saved === 'paper' ? 'paper' : 'real';
  }

  private applyModeAttribute(mode: AccountMode) {
    document.documentElement.setAttribute('data-account-mode', mode);
  }
}