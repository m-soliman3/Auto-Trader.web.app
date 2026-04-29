import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { ExchangeService, SUPPORTED_EXCHANGES, Exchange, ConnectedExchange } from '../services/exchange.service';

const DEMO_PRESET_AMOUNTS = [1_000, 10_000, 100_000] as const;

interface PaperTopUpResponse {
  accountId: string;
  accountNumber: string;
  balance: number;
  alpacaApiKey: string;
  alpacaApiSecret: string;
}

@Component({
  selector: 'app-paper-money-onboarding-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './paper-money-onboarding-modal.html',
  styleUrl: './paper-money-onboarding-modal.scss',
})
export class PaperMoneyOnboardingModal {
  private readonly http = inject(HttpClient);
  private readonly firebaseAuth = inject(Auth);
  private readonly firestore = inject(Firestore);
  readonly authService = inject(AuthService);
  private readonly exchangeService = inject(ExchangeService);

  readonly presetAmounts = DEMO_PRESET_AMOUNTS;

  /** All paper exchanges available for manual connection. */
  readonly paperCryptoExchanges = computed(() =>
    SUPPORTED_EXCHANGES.filter((e) => e.category === 'crypto' && e.isPaper === true),
  );
  readonly paperStockExchanges = computed(() =>
    SUPPORTED_EXCHANGES.filter((e) => e.category === 'stocks' && e.isPaper === true),
  );

  // ── Tab state ─────────────────────────────────────────────────────────────
  activeTab = signal<'topup' | 'exchange'>('topup');

  // ── Top-up state ──────────────────────────────────────────────────────────
  selectedAmount = signal<number>(10_000);
  topupProcessing = signal(false);
  topupError = signal('');
  topupCompleted = signal(false);

  // ── Exchange connection state ─────────────────────────────────────────────
  exchangeStep = signal<1 | 2>(1);
  selectedExchange = signal<Exchange | null>(null);
  exchangeLabel = '';
  exchangeApiKey = '';
  exchangeSecret = '';
  exchangePassphrase = '';
  exchangeError = signal('');
  exchangeSaving = signal(false);
  exchangeConnected = signal(false);

  private get backendBase(): string {
    return String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');
  }

  // ── Top-up ────────────────────────────────────────────────────────────────

  async topUpDemoAccount(): Promise<void> {
    this.topupError.set('');
    const amount = this.selectedAmount();

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      this.topupError.set('You must be logged in.');
      return;
    }

    this.topupProcessing.set(true);
    try {
      const idToken = await currentUser.getIdToken();
      const endpoint = this.backendBase
        ? `${this.backendBase}/v1/paper-topup`
        : '/api/paper-topup';

      const result = await firstValueFrom(
        this.http.post<PaperTopUpResponse>(endpoint, { balanceUsd: amount }, {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      );

      // Auto-connect the provisioned Alpaca paper account as an exchange.
      const conn: ConnectedExchange = {
        exchangeId: 'alpaca-paper',
        label: `Demo Account ($${amount.toLocaleString()})`,
        apiKey: result.alpacaApiKey,
        secret: result.alpacaApiSecret,
        connectedAt: new Date().toISOString(),
      };
      await this.exchangeService.add(conn);

      // Mark paper onboarding complete in Firestore.
      const uid = currentUser.uid;
      await updateDoc(doc(this.firestore, 'users', uid), {
        paperOnboarded: true,
        alpacaPaperBalance: result.balance,
        alpacaPaperAccountNumber: result.accountNumber,
        alpacaBrokerAccountId: result.accountId,
      });

      // Update local user signal.
      const user = this.authService.currentUser();
      if (user) {
        this.authService.currentUser.set({
          ...user,
          paperOnboarded: true,
          alpacaPaperBalance: result.balance,
          alpacaPaperAccountNumber: result.accountNumber,
          alpacaBrokerAccountId: result.accountId,
        });
      }

      this.topupCompleted.set(true);
    } catch (err: any) {
      this.topupError.set(err?.error?.error || err?.message || 'Failed to top up demo account. Please try again.');
    } finally {
      this.topupProcessing.set(false);
    }
  }

  // ── Exchange connection ───────────────────────────────────────────────────

  selectExchange(ex: Exchange): void {
    this.selectedExchange.set(ex);
    this.exchangeLabel = ex.name;
    this.exchangeApiKey = '';
    this.exchangeSecret = '';
    this.exchangePassphrase = '';
    this.exchangeError.set('');
    this.exchangeStep.set(2);
  }

  backToExchangeList(): void {
    this.exchangeStep.set(1);
    this.selectedExchange.set(null);
    this.exchangeError.set('');
  }

  async saveExchange(): Promise<void> {
    const ex = this.selectedExchange();
    if (!ex) return;

    if (!this.exchangeLabel.trim()) {
      this.exchangeError.set('Please enter a label.');
      return;
    }
    if (!this.exchangeApiKey.trim() || this.exchangeApiKey.trim().length < 10) {
      this.exchangeError.set('API Key must be at least 10 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(this.exchangeApiKey.trim())) {
      this.exchangeError.set('API Key contains invalid characters.');
      return;
    }
    if (!this.exchangeSecret.trim() || this.exchangeSecret.trim().length < 20) {
      this.exchangeError.set('API Secret must be at least 20 characters.');
      return;
    }
    if (ex.hasPassphrase && !this.exchangePassphrase.trim()) {
      this.exchangeError.set('Passphrase is required for this exchange.');
      return;
    }

    this.exchangeError.set('');
    this.exchangeSaving.set(true);

    try {
      await this.exchangeService.validateCredentials(
        ex.id,
        this.exchangeApiKey.trim(),
        this.exchangeSecret.trim(),
        this.exchangePassphrase.trim() || undefined,
      );

      const conn: ConnectedExchange = {
        exchangeId: ex.id,
        label: this.exchangeLabel.trim(),
        apiKey: this.exchangeApiKey.trim(),
        secret: this.exchangeSecret.trim(),
        ...(this.exchangePassphrase.trim() && { passphrase: this.exchangePassphrase.trim() }),
        connectedAt: new Date().toISOString(),
      };

      await this.exchangeService.add(conn);
      await this.markPaperOnboarded();
      this.exchangeConnected.set(true);
    } catch (err: any) {
      this.exchangeError.set(err?.message || 'Failed to connect exchange. Please try again.');
    } finally {
      this.exchangeSaving.set(false);
    }
  }

  private async markPaperOnboarded(): Promise<void> {
    const uid = this.firebaseAuth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(this.firestore, 'users', uid), { paperOnboarded: true });
    const user = this.authService.currentUser();
    if (user) {
      this.authService.currentUser.set({ ...user, paperOnboarded: true });
    }
  }
}
