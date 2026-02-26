import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ExchangeService,
  SUPPORTED_EXCHANGES,
  Exchange,
  ConnectedExchange,
} from '../services/exchange.service';

@Component({
  selector: 'app-connect-exchange-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './connect-exchange-modal.html',
  styleUrl: './connect-exchange-modal.scss',
})
export class ConnectExchangeModal {
  private exchangeService = inject(ExchangeService);

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
    setTimeout(() => {
      const conn: ConnectedExchange = {
        exchangeId: ex.id,
        label: this.label.trim(),
        apiKey: this.apiKey.trim(),
        secret: this.secret.trim(),
        passphrase: this.passphrase.trim() || undefined,
        connectedAt: new Date().toISOString(),
      };
      this.exchangeService.add(conn);
      this.saving.set(false);
      this.connected.emit(conn);
      this.close();
    }, 800);
  }

  close() {
    this.closed.emit();
  }
}
