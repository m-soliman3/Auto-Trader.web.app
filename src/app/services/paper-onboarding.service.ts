import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AccountModeService } from './account-mode.service';
import { ExchangeService, SUPPORTED_EXCHANGES } from './exchange.service';

@Injectable({ providedIn: 'root' })
export class PaperOnboardingService {
  private readonly auth = inject(AuthService);
  private readonly accountMode = inject(AccountModeService);
  private readonly exchange = inject(ExchangeService);

  /**
   * True when the user is in paper/demo mode and has not yet completed
   * onboarding — i.e. they have neither connected a paper exchange nor
   * topped up a demo account balance.
   */
  needsOnboarding = computed(() => {
    if (!this.auth.isLoggedIn()) return false;
    if (this.accountMode.mode() !== 'paper') return false;

    const user = this.auth.currentUser();
    if (user?.paperOnboarded === true) return false;

    // If at least one paper exchange is already connected, consider onboarded.
    const hasPaperExchange = this.exchange.connections().some((c) => {
      const def = SUPPORTED_EXCHANGES.find((e) => e.id === c.exchangeId);
      return def !== undefined && def.isPaper === true;
    });
    return !hasPaperExchange;
  });
}
