import {
  AfterViewInit,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  loadStripe,
  Stripe,
  StripeCardElement,
  StripeElements,
} from '@stripe/stripe-js';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import {
  ExchangeService,
  SUPPORTED_EXCHANGES,
  Exchange,
  ConnectedExchange,
} from '../services/exchange.service';
import { TourService } from '../services/tour.service';

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000] as const;
const QUICK_CRYPTO_CHOICES = ["BTC", "ETH", "USDT", "DOGE"] as const;

@Component({
  selector: 'app-real-money-onboarding-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './real-money-onboarding-modal.html',
  styleUrl: './real-money-onboarding-modal.scss',
})
export class RealMoneyOnboardingModal implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly firebaseAuth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly exchangeService = inject(ExchangeService);
  private readonly tourService = inject(TourService);
  private readonly translate = inject(TranslateService);

  // ── Expose helpers to template ──────────────────────────────────────────
  readonly presetAmounts = PRESET_AMOUNTS;
  readonly quickCryptoChoices = QUICK_CRYPTO_CHOICES;

  /** All real (non-paper) exchanges for selection. */
  readonly realCryptoExchanges = computed(() =>
    SUPPORTED_EXCHANGES.filter((e) => e.category === 'crypto' && !e.isPaper),
  );
  readonly realStockExchanges = computed(() =>
    SUPPORTED_EXCHANGES.filter((e) => e.category === 'stocks' && !e.isPaper),
  );

  // ── Tab state ────────────────────────────────────────────────────────────
  activeTab = signal<'topup' | 'exchange'>('topup');

  // ── Payment method within the top-up tab ────────────────────────────────
  paymentMethod = signal<'card' | 'crypto'>('card');

  // ── Exchange connection state ────────────────────────────────────────────
  exchangeStep = signal<1 | 2>(1);
  selectedExchange = signal<Exchange | null>(null);
  exchangeLabel = '';
  exchangeApiKey = '';
  exchangeSecret = '';
  exchangePassphrase = '';
  exchangeError = signal('');
  exchangeSaving = signal(false);
  exchangeConnected = signal(false);

  // ── Top-up state ─────────────────────────────────────────────────────────
  selectedAmount = signal<number | 'custom'>(100);
  customAmount = signal('');
  cardholderName = signal('');
  topupError = signal('');
  topupStatus = signal('');
  topupProcessing = signal(false);
  topupInitializing = signal(false);
  topupCompleted = signal(false);

  // ── Crypto payment state ────────────────────────────────────────────────
  cryptoProcessing = signal(false);
  cryptoStatus = signal('');
  cryptoError = signal('');
  cryptoOrderId = signal('');
  cryptoPaymentUrl = signal('');
  cryptoPolling = signal(false);
  cryptoCurrenciesLoading = signal(false);
  availableCryptoCurrencies = signal<string[]>([]);
  selectedCryptoCurrency = signal<string>('BTC');
  selectedOtherCryptoCurrency = signal<string>('');
  private _cryptoPollInterval: ReturnType<typeof setInterval> | null = null;

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.initStripe();
  }

  ngOnDestroy(): void {
    this.cardElement?.destroy();
    this._stopCryptoPoll();
  }

  // ── Exchange helpers ─────────────────────────────────────────────────────

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
      await this.markOnboarded();
      this.exchangeConnected.set(true);
      // Start tour after the modal closes.
      this.tourService.scheduleTourStart();
    } catch (err: any) {
      this.exchangeError.set(err?.message || 'Failed to connect exchange. Please try again.');
    } finally {
      this.exchangeSaving.set(false);
    }
  }

  // ── Amount selection ─────────────────────────────────────────────────────

  selectAmount(amount: number | 'custom'): void {
    this.selectedAmount.set(amount);
    if (amount !== 'custom') {
      this.customAmount.set('');
    }
  }

  otherCryptoCurrencies(): string[] {
    const quick = new Set(this.quickCryptoChoices);
    return this.availableCryptoCurrencies().filter((code) => !quick.has(code as (typeof QUICK_CRYPTO_CHOICES)[number]));
  }

  selectedPayCurrency(): string {
    const quick = new Set(this.quickCryptoChoices);
    const selected = this.selectedCryptoCurrency().trim().toUpperCase();
    if (quick.has(selected as (typeof QUICK_CRYPTO_CHOICES)[number])) {
      return selected;
    }
    const other = this.selectedOtherCryptoCurrency().trim().toUpperCase();
    return other || 'BTC';
  }

  selectQuickCryptoCurrency(currency: (typeof QUICK_CRYPTO_CHOICES)[number]): void {
    this.selectedCryptoCurrency.set(currency);
    this.selectedOtherCryptoCurrency.set('');
  }

  selectOtherCryptoCurrency(currency: string): void {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized) {
      return;
    }
    this.selectedOtherCryptoCurrency.set(normalized);
    this.selectedCryptoCurrency.set(normalized);
  }

  resolvedTopUpAmount(): number | null {
    const sel = this.selectedAmount();
    if (sel === 'custom') {
      const v = Number(this.customAmount());
      return Number.isFinite(v) && v >= 1 ? Math.round(v * 100) / 100 : null;
    }
    return sel;
  }

  // ── Stripe top-up ─────────────────────────────────────────────────────────

  async payAndTopUp(): Promise<void> {
    this.topupError.set('');
    this.topupStatus.set('');

    const amount = this.resolvedTopUpAmount();
    if (!amount || amount < 1) {
      this.topupError.set('Please enter a valid top-up amount (minimum $1).');
      return;
    }

    if (!this.stripe || !this.cardElement) {
      this.topupError.set('Payment form is not ready. Please refresh and try again.');
      return;
    }

    const firebaseUser = this.firebaseAuth.currentUser;
    if (!firebaseUser) {
      this.topupError.set('Please log in again to continue.');
      return;
    }

    this.topupProcessing.set(true);

    try {
      const idToken = await firebaseUser.getIdToken();

      // Create PaymentIntent via backend
      const resp = await firstValueFrom(
        this.http.post<{ clientSecret: string; paymentIntentId: string }>(
          '/api/createTopUpIntent',
          { amountUsd: amount },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      this.topupStatus.set('Processing payment...');

      const result = await this.stripe.confirmCardPayment(resp.clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: {
            name: this.cardholderName().trim() || undefined,
            email: firebaseUser.email ?? undefined,
          },
        },
      });

      if (result.error) {
        this.topupError.set(result.error.message || 'Payment failed. Please check your card details.');
        this.topupProcessing.set(false);
        return;
      }

      // Confirm top-up and mark onboarded on backend.
      // The backend also auto-provisions an Alpaca paper account on first top-up.
      this.topupStatus.set('Confirming deposit...');
      const confirmResp = await firstValueFrom(
        this.http.post<{ ok: boolean; alpacaProvisioned?: boolean }>(
          '/api/confirmTopUp',
          {
            paymentIntentId: result.paymentIntent?.id || resp.paymentIntentId,
            amountUsd: amount,
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      // If an Alpaca paper account was provisioned, reload exchanges so the
      // auto-connected "alpaca-paper-autotrader" entry becomes available.
      if (confirmResp.alpacaProvisioned) {
        this.topupStatus.set('Setting up your Alpaca paper account...');
        await this.exchangeService.reloadFromFirestore();
      }

      await this.authService.reloadCurrentUserProfile();
      this.topupStatus.set('');
      this.topupCompleted.set(true);
      // Start tour after the modal closes.
      this.tourService.scheduleTourStart();
    } catch (err: any) {
      const apiMsg = err?.error?.error;
      this.topupError.set(apiMsg || err?.message || 'Payment failed. Please try again.');
    } finally {
      this.topupProcessing.set(false);
    }
  }

  // ── Crypto payment ──────────────────────────────────────────────────────

  async payCrypto(): Promise<void> {
    this.cryptoError.set('');
    this.cryptoStatus.set('');

    const amount = this.resolvedTopUpAmount();
    if (!amount || amount < 1) {
      this.cryptoError.set(this.translate.instant('payments.crypto.invalidAmount'));
      return;
    }

    const firebaseUser = this.firebaseAuth.currentUser;
    if (!firebaseUser) {
      this.cryptoError.set(this.translate.instant('payments.crypto.loginAgain'));
      return;
    }

    this.cryptoProcessing.set(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const payCurrency = this.selectedPayCurrency();

      const resp = await firstValueFrom(
        this.http.post<{ orderId: string; paymentId: string; paymentUrl: string }>(
          '/api/createNowPaymentsOrder',
          { amountUsd: amount, payCurrency },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      this.cryptoOrderId.set(resp.orderId);
      this.cryptoPaymentUrl.set(resp.paymentUrl);
      this.cryptoStatus.set(this.translate.instant('payments.crypto.waiting'));

      const paymentUrl = String(resp.paymentUrl || '').trim();
      if (!/^https?:\/\//i.test(paymentUrl)) {
        this.cryptoError.set(this.translate.instant('payments.crypto.createFailed'));
        this.cryptoStatus.set('');
        return;
      }

      // Open the hosted payment page in a new tab.
      window.open(paymentUrl, '_blank', 'noopener,noreferrer');

      // Start polling for payment confirmation.
      this._startCryptoPoll(resp.orderId, idToken);
    } catch (err: any) {
      const apiMsg = err?.error?.error;
      this.cryptoError.set(apiMsg || err?.message || this.translate.instant('payments.crypto.createFailed'));
    } finally {
      this.cryptoProcessing.set(false);
    }
  }

  async ensureNowPaymentsCurrenciesLoaded(): Promise<void> {
    if (this.availableCryptoCurrencies().length > 0 || this.cryptoCurrenciesLoading()) {
      return;
    }

    const firebaseUser = this.firebaseAuth.currentUser;
    if (!firebaseUser) {
      return;
    }

    this.cryptoCurrenciesLoading.set(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await firstValueFrom(
        this.http.get<{ currencies: string[] }>(
          '/api/listNowPaymentsCurrencies',
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            }),
          },
        ),
      );

      const normalized = (Array.isArray(resp?.currencies) ? resp.currencies : [])
        .map((c) => String(c || '').trim().toUpperCase())
        .filter((c) => c.length > 0);

      this.availableCryptoCurrencies.set(normalized);

      if (!normalized.includes(this.selectedPayCurrency())) {
        const fallback = normalized.find((c) => c === 'BTC') || normalized[0] || 'BTC';
        this.selectedCryptoCurrency.set(fallback);
        this.selectedOtherCryptoCurrency.set('');
      }
    } catch {
      // Keep the quick picks even if list loading fails.
      this.availableCryptoCurrencies.set([...this.quickCryptoChoices]);
    } finally {
      this.cryptoCurrenciesLoading.set(false);
    }
  }

  private _startCryptoPoll(orderId: string, idToken: string): void {
    this._stopCryptoPoll();
    this.cryptoPolling.set(true);
    this._cryptoPollInterval = setInterval(async () => {
      try {
        const freshToken = await this.firebaseAuth.currentUser?.getIdToken() ?? idToken;
        const result = await firstValueFrom(
          this.http.post<{ status: string; amountUsd: number }>(
            '/api/checkNowPaymentsOrder',
            { orderId },
            {
              headers: new HttpHeaders({
                Authorization: `Bearer ${freshToken}`,
                'Content-Type': 'application/json',
              }),
            },
          ),
        );
        if (result.status === 'paid') {
          this._stopCryptoPoll();
          await this.authService.reloadCurrentUserProfile();
          this.cryptoStatus.set('');
          this.topupCompleted.set(true);
          this.tourService.scheduleTourStart();
        }
      } catch {
        // Polling errors are non-fatal; keep retrying.
      }
    }, 5_000);
  }

  private _stopCryptoPoll(): void {
    if (this._cryptoPollInterval !== null) {
      clearInterval(this._cryptoPollInterval);
      this._cryptoPollInterval = null;
    }
    this.cryptoPolling.set(false);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async initStripe(): Promise<void> {
    const key = (environment.stripePublishableKey || '').trim();
    if (!key) {
      this.topupError.set('Payment is not configured. Please contact support.');
      return;
    }

    this.topupInitializing.set(true);

    try {
      this.stripe = await loadStripe(key);
      if (!this.stripe) {
        this.topupError.set('Failed to load payment provider. Please refresh and try again.');
        return;
      }

      this.elements = this.stripe.elements({
        appearance: { theme: 'stripe', labels: 'floating' },
      });

      if (this.cardElement) {
        this.cardElement.destroy();
        this.cardElement = null;
      }
      this.cardElement = this.elements.create('card', { hidePostalCode: false });

      // Yield to the event loop so Angular has committed the current render
      // before we try to mount the Stripe iframe into the DOM.
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      const container = document.getElementById('topup-card-element');
      if (!container) {
        this.topupError.set('Payment form could not initialize. Please refresh.');
        return;
      }

      this.cardElement.mount(container);
      this.cardElement.on('change', (e) => {
        if (e.error?.message) this.topupError.set(e.error.message);
        else if (!this.topupProcessing()) this.topupError.set('');
      });
    } catch (err: any) {
      console.error('Stripe initialization error:', err);
      this.topupError.set('Failed to initialize payment form. Please refresh and try again.');
    } finally {
      this.topupInitializing.set(false);
    }
  }

  private async markOnboarded(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;
    const ref = doc(this.firestore, 'users', user.id);
    await updateDoc(ref, { realMoneyOnboarded: true });
    await this.authService.reloadCurrentUserProfile();
  }
}
