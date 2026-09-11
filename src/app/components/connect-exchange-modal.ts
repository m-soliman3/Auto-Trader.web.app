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
import { TranslateModule } from '@ngx-translate/core';

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
  oauthConnecting = signal(false);
  manualEntryExpanded = signal(false);

  isAlpacaSelected = computed(() => {
    const ex = this.selected();
    return ex?.id === 'alpaca' || ex?.id === 'alpaca-paper';
  });

  // Form fields
  label = '';
  apiKey = '';
  secret = '';
  passphrase = '';

  select(ex: Exchange) {
    // Demo/paper exchanges require a Premium subscription ($10/month).
    if (ex.isPaper && !this.subscription.isPremium()) {
      this.error.set('Demo / paper exchange connections require a Premium subscription ($10/month). Upgrade in Settings → Billing.');
      return;
    }

    this.selected.set(ex);
    this.label = ex.name;
    this.apiKey = '';
    this.secret = '';
    this.passphrase = '';
    this.error.set('');
    this.manualEntryExpanded.set(false);
    this.step.set(2);
  }

  back() {
    this.step.set(1);
    this.selected.set(null);
    this.error.set('');
    this.manualEntryExpanded.set(false);
  }

  toggleManualEntry() {
    this.manualEntryExpanded.update(v => !v);
  }

  save() {
    const ex = this.selected();
    if (!ex) return;

    // Check if user is logged in
    if (!this.authService.currentUser()) {
      this.error.set('You must be logged in to connect an exchange.');
      return;
    }

    try {
      this.subscription.assertCanCreate('exchange', this.exchangeService.connections().length);
    } catch (err: any) {
      this.error.set(err?.message || 'You reached your plan limit for exchange connections.');
      return;
    }

    if (!this.label.trim()) { this.error.set('Please enter a label.'); return; }
    if (!this.apiKey.trim()) { this.error.set('API Key is required.'); return; }
    if (!this.secret.trim()) { this.error.set('API Secret is required.'); return; }
    
    // Validate API Key format
    if (this.apiKey.trim().length < 10) {
      this.error.set('API Key must be at least 10 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(this.apiKey.trim())) {
      this.error.set('API Key contains invalid characters. Only alphanumeric, underscores, hyphens, and dots are allowed.');
      return;
    }

    // Validate Secret format
    if (this.secret.trim().length < 20) {
      this.error.set('API Secret must be at least 20 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.\/\+\=]+$/.test(this.secret.trim())) {
      this.error.set('API Secret contains invalid characters. Only alphanumeric, underscores, hyphens, forward slashes, plus signs, equals and dots are allowed.');
      return;
    }
    
    if (ex.hasPassphrase && !this.passphrase.trim()) {
      this.error.set('Passphrase is required for this exchange.');
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
        const errorMsg = err?.message || 'Failed to save exchange connection. Please try again.';
        this.error.set(errorMsg);
        this.saving.set(false);
      }
    })();
  }

  /**
   * "Connect with Alpaca" via OAuth (Alpaca Connect Apps) — an alternative to
   * pasting API keys below. Navigates the browser to Alpaca's authorize page;
   * on approval the user lands back on /exchanges already connected.
   */
  async connectAlpacaOAuth(): Promise<void> {
    const ex = this.selected();
    if (!ex) return;

    if (!this.authService.currentUser()) {
      this.error.set('You must be logged in to connect an exchange.');
      return;
    }

    try {
      this.subscription.assertCanCreate('exchange', this.exchangeService.connections().length);
    } catch (err: any) {
      this.error.set(err?.message || 'You reached your plan limit for exchange connections.');
      return;
    }

    this.error.set('');
    this.oauthConnecting.set(true);
    try {
      const env: 'live' | 'paper' = ex.id === 'alpaca-paper' ? 'paper' : 'live';
      await this.exchangeService.startAlpacaConnect(env);
      // On success the browser navigates to Alpaca; nothing else to do here.
    } catch (err: any) {
      this.oauthConnecting.set(false);
      this.error.set(err?.message || 'Failed to start the Alpaca connection. Please try again.');
    }
  }

  close() {
    this.closed.emit();
  }
}
