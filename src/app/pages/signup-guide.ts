import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { ExchangeService, SUPPORTED_EXCHANGES, ConnectedExchange } from '../services/exchange.service';
import { SubscriptionService } from '../services/subscription.service';

type StepId = 'welcome' | 'activeTrader' | 'noTraderChoice' | 'portfolioType' | 'info' | 'broker' | 'credentials';

@Component({
  selector: 'app-signup-guide',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink],
  templateUrl: './signup-guide.html',
  styleUrl: './signup-guide.scss',
})
export class SignupGuide {
  private router          = inject(Router);
  private firestore       = inject(Firestore);
  private platformId      = inject(PLATFORM_ID);
  private translate       = inject(TranslateService);
  private exchangeService = inject(ExchangeService);
  private subscription    = inject(SubscriptionService);
  auth                    = inject(AuthService);

  /** True once the translation file has been loaded — prevents showing raw keys on the welcome screen. */
  translationsReady = signal(false);

  currentStep      = signal<StepId>('activeTrader');
  isActiveTrader   = signal<'yes' | 'no' | null>(null);
  noTraderPath     = signal<'broker' | 'deposit' | null>(null);
  portfolioType    = signal<'stocks' | 'crypto' | null>(null);
  brokerSearch     = signal('');
  selectedBroker   = signal<string | null>(null);
  otherBrokerText  = signal('');
  showDropdown     = signal(false);
  saving           = signal(false);

  // Credentials step
  apiKey           = signal('');
  apiSecret        = signal('');
  apiPassphrase    = signal('');
  credentialError  = signal('');
  connecting       = signal(false);

  /** True if the selected exchange requires a passphrase. */
  selectedExchangeMeta = computed(() =>
    SUPPORTED_EXCHANGES.find(e => e.id === this.selectedBroker()) ?? null,
  );
  requiresPassphrase = computed(() => this.selectedExchangeMeta()?.hasPassphrase ?? false);

  /** Map each step to a 1-5 progress index for the dots. */
  stepIndex = computed(() => {
    const map: Record<StepId, number> = {
      welcome: 1,
      activeTrader: 1,
      noTraderChoice: 2,
      portfolioType: 2,
      info: 3,
      broker: 4,
      credentials: 5,
    };
    return map[this.currentStep()];
  });

  availableExchanges = computed(() => {
    const step = this.currentStep();
    // No-path broker step: show all real (non-paper) exchanges
    if (step === 'broker' && this.isActiveTrader() === 'no') {
      return SUPPORTED_EXCHANGES.filter(e => !e.isPaper);
    }
    const type = this.portfolioType();
    if (!type) return [];
    return SUPPORTED_EXCHANGES.filter(e => e.category === type && !e.isPaper);
  });

  filteredExchanges = computed(() => {
    const search = this.brokerSearch().toLowerCase().trim();
    const exchanges = this.availableExchanges();
    if (!search) return exchanges;
    return exchanges.filter(e => e.name.toLowerCase().includes(search));
  });

  canFinish = computed(() => {
    if (!this.selectedBroker()) return false;
    if (this.selectedBroker() === 'other' && !this.otherBrokerText().trim()) return false;
    return true;
  });

  constructor() {
    // Wait for the translation file to load before rendering text.
    const probeKey = 'signupGuide.welcome.title';
    if (this.translate.instant(probeKey) !== probeKey) {
      this.translationsReady.set(true);
    } else {
      this.translate.get(probeKey).subscribe(() => {
        this.translationsReady.set(true);
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      const user = this.auth.currentUser();
      if (!user) {
        this.router.navigate(['/signup']);
        return;
      }
      if (user.onboardingCompleted) {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  // ── Navigation ────────────────────────────────────────────────────

  goNext() {
    this.currentStep.set('activeTrader');
  }

  selectActiveTrader(value: 'yes' | 'no') {
    this.isActiveTrader.set(value);
    if (value === 'yes') {
      this.currentStep.set('portfolioType');
    } else {
      this.currentStep.set('noTraderChoice');
    }
  }

  selectNoTraderPath(choice: 'broker' | 'deposit') {
    this.noTraderPath.set(choice);
    if (choice === 'broker') {
      this.selectedBroker.set(null);
      this.brokerSearch.set('');
      this.otherBrokerText.set('');
      this.currentStep.set('broker');
    } else {
      void this.finishDeposit();
    }
  }

  selectPortfolioType(type: 'stocks' | 'crypto') {
    this.portfolioType.set(type);
    this.selectedBroker.set(null);
    this.brokerSearch.set('');
    this.otherBrokerText.set('');
    this.currentStep.set('info');
  }

  goBack() {
    const s = this.currentStep();
    if (s === 'activeTrader')    { this.currentStep.set('welcome'); }
    else if (s === 'portfolioType')   { this.currentStep.set('activeTrader'); }
    else if (s === 'noTraderChoice')  { this.currentStep.set('activeTrader'); }
    else if (s === 'info')       { this.currentStep.set('portfolioType'); }
    else if (s === 'broker')     {
      this.currentStep.set(this.isActiveTrader() === 'no' ? 'noTraderChoice' : 'info');
    }
    else if (s === 'credentials') { this.currentStep.set('broker'); }
  }

  // ── Autocomplete ──────────────────────────────────────────────────

  selectBroker(id: string) {
    this.selectedBroker.set(id);
    const exchange = this.availableExchanges().find(e => e.id === id);
    this.brokerSearch.set(exchange?.name ?? id);
    this.showDropdown.set(false);
  }

  selectOther() {
    this.selectedBroker.set('other');
    this.brokerSearch.set('Other');
    this.showDropdown.set(false);
  }

  onBrokerInput(value: string) {
    this.brokerSearch.set(value);
    this.selectedBroker.set(null);
    this.showDropdown.set(value.trim().length > 0);
  }

  onBrokerFocus() { this.showDropdown.set(true); }
  onBrokerBlur()  { globalThis.setTimeout(() => this.showDropdown.set(false), 200); }

  // ── Save helpers ──────────────────────────────────────────────────

  private async persistOnboarding(extraData: object = {}): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    const data = {
      onboardingCompleted: true,
      signupGuide: {
        isActiveTrader: this.isActiveTrader() === 'yes',
        noTraderPath: this.noTraderPath() ?? null,
        portfolioType: this.portfolioType() ?? null,
        broker: this.selectedBroker() ?? null,
        ...(this.selectedBroker() === 'other' ? { otherBroker: this.otherBrokerText().trim() } : {}),
      },
      ...extraData,
    };
    await setDoc(doc(this.firestore, 'users', user.id), data, { merge: true });
    this.auth.currentUser.update(u => u ? { ...u, onboardingCompleted: true } : u);
  }

  async finish() {
    if (!this.canFinish()) return;
    // If user selected a known (non-other) exchange, go to credentials step.
    if (this.selectedBroker() !== 'other') {
      this.apiKey.set('');
      this.apiSecret.set('');
      this.apiPassphrase.set('');
      this.credentialError.set('');
      this.currentStep.set('credentials');
      return;
    }
    // "Other" broker — just save guide data and go to dashboard.
    await this.saveAndGo();
  }

  async connectExchange() {
    const exchangeId = this.selectedBroker();
    if (!exchangeId || exchangeId === 'other') return;

    if (!this.apiKey().trim()) { this.credentialError.set('API Key is required.'); return; }
    if (!this.apiSecret().trim()) { this.credentialError.set('API Secret is required.'); return; }
    if (this.requiresPassphrase() && !this.apiPassphrase().trim()) {
      this.credentialError.set('Passphrase is required for this exchange.');
      return;
    }

    this.credentialError.set('');
    this.connecting.set(true);

    const user = this.auth.currentUser();
    if (!user) { this.router.navigate(['/signup']); return; }

    try {
      // Check plan limits
      this.subscription.assertCanCreate('exchange', this.exchangeService.connections().length);

      // Validate with backend
      await this.exchangeService.validateCredentials(
        exchangeId,
        this.apiKey().trim(),
        this.apiSecret().trim(),
        this.apiPassphrase().trim() || undefined,
      );

      const exMeta = this.selectedExchangeMeta()!;
      const conn: ConnectedExchange = {
        exchangeId,
        label: exMeta.name,
        apiKey: this.apiKey().trim(),
        secret: this.apiSecret().trim(),
        ...(this.apiPassphrase().trim() && { passphrase: this.apiPassphrase().trim() }),
        connectedAt: new Date().toISOString(),
      };
      await this.exchangeService.add(conn);
    } catch (e: any) {
      this.credentialError.set(e?.message ?? 'Failed to connect. Please check your credentials.');
      this.connecting.set(false);
      return;
    }

    await this.saveAndGo();
  }

  private async saveAndGo(): Promise<void> {
    this.saving.set(true);
    this.connecting.set(true);
    const user = this.auth.currentUser();
    if (!user) { this.router.navigate(['/signup']); return; }
    try { await this.persistOnboarding(); } catch (e) { console.error(e); }
    this.saving.set(false);
    this.connecting.set(false);
    this.router.navigate(['/dashboard']);
  }

  async finishDeposit() {
    this.saving.set(true);
    const user = this.auth.currentUser();
    if (!user) { this.router.navigate(['/signup']); return; }
    try { await this.persistOnboarding(); } catch (e) { console.error(e); }
    this.saving.set(false);
    // Real-money onboarding modal will auto-appear on the dashboard
    this.router.navigate(['/dashboard/real']);
  }

  async skipGuide() {
    this.saving.set(true);
    const user = this.auth.currentUser();
    if (!user) { this.router.navigate(['/signup']); return; }
    try { await this.persistOnboarding(); } catch (e) { console.error(e); }
    this.saving.set(false);
    this.router.navigate(['/dashboard', 'paper']);
  }

  async finishWithDemo() {
    this.saving.set(true);
    const user = this.auth.currentUser();
    if (!user) { this.router.navigate(['/signup']); return; }
    try { await this.persistOnboarding(); } catch (e) { console.error(e); }
    this.saving.set(false);
    this.router.navigate(['/dashboard', 'paper']);
  }
}
