import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ExchangeService,
  SUPPORTED_EXCHANGES,
  Exchange,
  ConnectedExchange,
} from '../services/exchange.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-connect-exchange-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './connect-exchange-modal.html',
  styleUrl: './connect-exchange-modal.scss',
})
export class ConnectExchangeModal {
  private exchangeService = inject(ExchangeService);
  private authService = inject(AuthService);

  closed = output<void>();
  connected = output<ConnectedExchange>();

  exchanges = SUPPORTED_EXCHANGES;

  cryptoExchanges = SUPPORTED_EXCHANGES.filter(e => e.category === 'crypto');
  stockExchanges  = SUPPORTED_EXCHANGES.filter(e => e.category === 'stocks');
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
      this.error.set('You must be logged in to connect an exchange.');
      return;
    }

    if (!this.label.trim()) { this.error.set('Please enter a label.'); return; }
    if (!this.apiKey.trim()) { this.error.set('API Key is required.'); return; }
    if (!this.secret.trim()) { this.error.set('API Secret is required.'); return; }
    if (ex.hasPassphrase && !this.passphrase.trim()) {
      this.error.set('Passphrase is required for this exchange.');
      return;
    }

    this.error.set('');
    this.saving.set(true);

    // Simulate a brief validation delay
    setTimeout(async () => {
      const conn: ConnectedExchange = {
        exchangeId: ex.id,
        label: this.label.trim(),
        apiKey: this.apiKey.trim(),
        secret: this.secret.trim(),
        ...(this.passphrase.trim() && { passphrase: this.passphrase.trim() }),
        connectedAt: new Date().toISOString(),
      };
      try {
        await this.exchangeService.add(conn);
        this.saving.set(false);
        this.connected.emit(conn);
        this.close();
      } catch (err: any) {
        console.error('failed to save exchange', err);
        const errorMsg = err?.message || 'Failed to save exchange connection. Please try again.';
        this.error.set(errorMsg);
        this.saving.set(false);
      }
    }, 800);
  }

  close() {
    this.closed.emit();
  }
}
