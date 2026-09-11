import {
  AfterViewInit,
  Component,
  computed,
  HostListener,
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
const CURATED_CRYPTO_CHOICES = [
  'BTC',
  'ETH',
  'USDT',
  'DOGE',
  'USDC',
  'SOL',
  'XRP',
  'ADA',
  'BNB',
  'LTC',
  'BCH',
  'XLM',
  'XMR',
  'DASH',
  'ETC',
  'TRX',
  'LINK',
  'DOT',
  'MATIC',
  'TON',
] as const;
const CRYPTO_CURRENCY_SYMBOLS: Record<string, string> = {
  ADA: '₳',
  BCH: 'Ƀ',
  BNB: '◇',
  BTC: '₿',
  DASH: 'Đ',
  DOGE: 'Ð',
  DOT: '●',
  ETC: '⟠',
  ETH: 'Ξ',
  LINK: '⬡',
  LTC: 'Ł',
  MATIC: '⬟',
  SOL: '◎',
  TON: '✦',
  TRX: '▲',
  USDC: '$',
  USDT: '₮',
  XLM: '✧',
  XMR: 'ɱ',
  XRP: '✕',
};
const CRYPTO_CURRENCY_ACCENTS: Record<string, string> = {
  ADA: '#246bff',
  BCH: '#8dc351',
  BNB: '#f0b90b',
  BTC: '#f7931a',
  DASH: '#1c75bc',
  DOGE: '#c2a633',
  DOT: '#e6007a',
  ETC: '#3ab83a',
  ETH: '#627eea',
  LINK: '#2a5ada',
  LTC: '#345d9d',
  MATIC: '#8247e5',
  SOL: '#14f195',
  TON: '#0098ea',
  TRX: '#ff060a',
  USDC: '#2775ca',
  USDT: '#26a17b',
  XLM: '#111111',
  XMR: '#ff6600',
  XRP: '#23292f',
};

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
  oauthConnecting = signal(false);
  manualEntryExpanded = signal(false);

  /** True when the "Connect with Alpaca" OAuth option should show (Alpaca Connect Apps). */
  isAlpacaSelected = computed(() => {
    const ex = this.selectedExchange();
    return ex?.id === 'alpaca' || ex?.id === 'alpaca-paper';
  });

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
  cryptoSearchQuery = signal('');
  cryptoDropdownOpen = signal(false);
  fixedCryptoChoices = computed(() => {
    const selected = this.selectedOtherCryptoCurrency().trim().toUpperCase();
    if (!selected || this.quickCryptoChoices.includes(selected as (typeof QUICK_CRYPTO_CHOICES)[number])) {
      return [...this.quickCryptoChoices];
    }

    return [...this.quickCryptoChoices, selected];
  });
  filteredOtherCryptoCurrencies = computed(() => {
    const query = this.cryptoSearchQuery().trim().toLowerCase();
    const all = this.otherCryptoCurrencies();
    if (!query) {
      return all;
    }

    return all.filter((code) => {
      const normalized = code.toLowerCase();
      const symbol = this.cryptoCurrencySymbol(code).toLowerCase();
      return normalized.includes(query) || symbol.includes(query);
    });
  });
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
    this.manualEntryExpanded.set(false);
    this.exchangeStep.set(2);
  }

  backToExchangeList(): void {
    this.exchangeStep.set(1);
    this.selectedExchange.set(null);
    this.exchangeError.set('');
    this.manualEntryExpanded.set(false);
  }

  toggleManualEntry(): void {
    this.manualEntryExpanded.update((v) => !v);
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

  /**
   * "Connect with Alpaca" via OAuth (Alpaca Connect Apps) — an alternative to
   * pasting API keys below. Navigates the browser to Alpaca's authorize page;
   * on approval the user lands back on /exchanges already connected.
   */
  async connectAlpacaOAuth(): Promise<void> {
    const ex = this.selectedExchange();
    if (!ex) return;

    this.exchangeError.set('');
    this.oauthConnecting.set(true);
    try {
      const env: 'live' | 'paper' = ex.id === 'alpaca-paper' ? 'paper' : 'live';
      await this.exchangeService.startAlpacaConnect(env);
      // On success the browser navigates to Alpaca; nothing else to do here.
    } catch (err: any) {
      this.oauthConnecting.set(false);
      this.exchangeError.set(err?.message || 'Failed to start the Alpaca connection. Please try again.');
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

  private curatedAvailableCryptoCurrencies(codes: string[]): string[] {
    const available = new Set(codes);
    return CURATED_CRYPTO_CHOICES.filter((code) => available.has(code));
  }

  cryptoCurrencySymbol(currency: string): string {
    const normalized = String(currency || '').trim().toUpperCase();
    return CRYPTO_CURRENCY_SYMBOLS[normalized] || '';
  }

  formatCryptoCurrencyLabel(currency: string): string {
    const normalized = String(currency || '').trim().toUpperCase();
    const symbol = this.cryptoCurrencySymbol(normalized);
    return symbol ? `${symbol} ${normalized}` : normalized;
  }

  cryptoCurrencyAccent(currency: string): string {
    const normalized = String(currency || '').trim().toUpperCase();
    return CRYPTO_CURRENCY_ACCENTS[normalized] || '#5b8cff';
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
    this.cryptoSearchQuery.set('');
    this.cryptoDropdownOpen.set(false);
  }

  selectFixedCryptoCurrency(currency: string): void {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized) {
      return;
    }

    if (this.quickCryptoChoices.includes(normalized as (typeof QUICK_CRYPTO_CHOICES)[number])) {
      this.selectQuickCryptoCurrency(normalized as (typeof QUICK_CRYPTO_CHOICES)[number]);
      return;
    }

    this.selectedOtherCryptoCurrency.set(normalized);
    this.selectedCryptoCurrency.set(normalized);
    this.cryptoSearchQuery.set('');
    this.cryptoDropdownOpen.set(false);
  }

  selectOtherCryptoCurrency(currency: string): void {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized) {
      return;
    }
    this.selectedOtherCryptoCurrency.set(normalized);
    this.selectedCryptoCurrency.set(normalized);
    this.cryptoSearchQuery.set('');
    this.cryptoDropdownOpen.set(false);
  }

  setCryptoSearchQuery(query: string): void {
    this.cryptoSearchQuery.set(String(query || ''));
  }

  toggleCryptoDropdown(): void {
    this.cryptoDropdownOpen.update((open) => !open);
  }

  closeCryptoDropdown(): void {
    this.cryptoDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    if (!this.cryptoDropdownOpen()) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('.crypto-other-select-group')) {
      return;
    }

    this.closeCryptoDropdown();
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
      const curated = this.curatedAvailableCryptoCurrencies(normalized);

      this.availableCryptoCurrencies.set(curated.length > 0 ? curated : [...this.quickCryptoChoices]);

      if (!curated.includes(this.selectedPayCurrency())) {
        const fallback = curated.find((c) => c === 'BTC') || curated[0] || 'BTC';
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
