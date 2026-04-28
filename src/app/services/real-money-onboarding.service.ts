import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AccountModeService } from './account-mode.service';
import { ExchangeService, SUPPORTED_EXCHANGES } from './exchange.service';

@Injectable({ providedIn: 'root' })
export class RealMoneyOnboardingService {
  private readonly auth = inject(AuthService);
  private readonly accountMode = inject(AccountModeService);
  private readonly exchange = inject(ExchangeService);

  /**
   * True when the user is in real-money mode and has not yet completed
   * onboarding (i.e. they have neither connected a real exchange nor
   * topped up their account balance).
   */
  needsOnboarding = computed(() => {
    if (!this.auth.isLoggedIn()) return false;
    if (this.accountMode.mode() !== 'real') return false;

    const user = this.auth.currentUser();
    if (user?.realMoneyOnboarded === true) return false;
    if ((user?.realMoneyBalance ?? 0) > 0) return false;

    // If at least one non-paper exchange is already connected, consider onboarded.
    const hasRealExchange = this.exchange.connections().some((c) => {
      const def = SUPPORTED_EXCHANGES.find((e) => e.id === c.exchangeId);
      return def !== undefined && !def.isPaper;
    });
    return !hasRealExchange;
  });
}
