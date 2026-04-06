import { Component, inject, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ExchangeService,
  SUPPORTED_EXCHANGES,
  Exchange,
  ConnectedExchange,
} from '../services/exchange.service';
import { AuthService } from '../services/auth.service';
import { AccountModeService } from '../services/account-mode.service';
import { SubscriptionService } from '../services/subscription.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-connect-exchange-modal',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './connect-exchange-modal.html',
  styleUrl: './connect-exchange-modal.scss',
})
export class ConnectExchangeModal {
  private exchangeService = inject(ExchangeService);
  private authService = inject(AuthService);
  private accountMode = inject(AccountModeService);
  private subscription = inject(SubscriptionService);
  private translate = inject(TranslateService);

  closed = output<void>();
  connected = output<ConnectedExchange>();

  exchanges = SUPPORTED_EXCHANGES;

  cryptoExchanges = computed(() => {
    const paper = this.accountMode.mode() === 'paper';
    return SUPPORTED_EXCHANGES.filter(exchange => exchange.category === 'crypto' && (exchange.isPaper ?? false) === paper);
  });
  stockExchanges = computed(() => {
    const paper = this.accountMode.mode() === 'paper';
    return SUPPORTED_EXCHANGES.filter(exchange => exchange.category === 'stocks' && (exchange.isPaper ?? false) === paper);
  });
  step = signal<1 | 2>(1);
  selected = signal<Exchange | null>(null);
  error = signal('');
  saving = signal(false);

  // Form fields
  label = '';
  apiKey = '';
  secret = '';
  passphrase = '';

  select(ex: Exchange) {
    this.selected.set(ex);
    this.label = ex.name;
    this.apiKey = '';
    this.secret = '';
    this.passphrase = '';
    this.error.set('');
    this.step.set(2);
  }

  back() {
    this.step.set(1);
    this.selected.set(null);
    this.error.set('');
  }

  save() {
    const ex = this.selected();
    if (!ex) return;

    // Check if user is logged in
    if (!this.authService.currentUser()) {
      this.error.set(this.translate.instant('connectExchange.validation.mustBeLoggedIn'));
      return;
    }

    if (!this.subscription.canCreate('exchange', this.exchangeService.connections().length)) {
      this.error.set(this.translate.instant('connectExchange.validation.freePlanLimitReached'));
      return;
    }

    if (!this.label.trim()) { this.error.set(this.translate.instant('connectExchange.validation.enterLabel')); return; }
    if (!this.apiKey.trim()) { this.error.set(this.translate.instant('connectExchange.validation.apiKeyRequired')); return; }
    if (!this.secret.trim()) { this.error.set(this.translate.instant('connectExchange.validation.apiSecretRequired')); return; }
    
    // Validate API Key format
    if (this.apiKey.trim().length < 10) {
      this.error.set(this.translate.instant('connectExchange.validation.apiKeyMinLength'));
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(this.apiKey.trim())) {
      this.error.set(this.translate.instant('connectExchange.validation.apiKeyInvalidChars'));
      return;
    }

    // Validate Secret format
    if (this.secret.trim().length < 20) {
      this.error.set(this.translate.instant('connectExchange.validation.apiSecretMinLength'));
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.\/\+\=]+$/.test(this.secret.trim())) {
      this.error.set(this.translate.instant('connectExchange.validation.apiSecretInvalidChars'));
      return;
    }
    
    if (ex.hasPassphrase && !this.passphrase.trim()) {
      this.error.set(this.translate.instant('connectExchange.validation.passphraseRequired'));
      return;
    }

    this.error.set('');
    this.saving.set(true);

    // Save credentials to Firestore
    (async () => {
      try {
        const ex = this.selected();
        if (!ex) return;

        await this.exchangeService.validateCredentials(
          ex.id,
          this.apiKey.trim(),
          this.secret.trim(),
          this.passphrase.trim() || undefined,
        );

        const conn: ConnectedExchange = {
          exchangeId: ex.id,
          label: this.label.trim(),
          apiKey: this.apiKey.trim(),
          secret: this.secret.trim(),
          ...(this.passphrase.trim() && { passphrase: this.passphrase.trim() }),
          connectedAt: new Date().toISOString(),
        };
        
        await this.exchangeService.add(conn);
        this.saving.set(false);
        this.error.set('');
        this.connected.emit(conn);
        this.close();
      } catch (err: any) {
        console.error('failed to save exchange', err);
        const errorMsg = err?.message || this.translate.instant('connectExchange.validation.failedToSave');
        this.error.set(errorMsg);
        this.saving.set(false);
      }
    })();
  }

  close() {
    this.closed.emit();
  }
}
