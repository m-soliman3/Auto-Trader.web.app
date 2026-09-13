import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';
import { SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { STRATEGY_TEMPLATES, StrategyTemplate } from '../services/strategy.service';
import { AdBannerSkyscraper } from '../components/ad-banner-skyscraper';
import { AdWidgetEtoro } from '../components/ad-widget-etoro';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule, AdBannerSkyscraper, AdWidgetEtoro],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements AfterViewInit, OnDestroy {
  private auth   = inject(AuthService);
  private translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  languageService = inject(LanguageService);

  @ViewChild('howItWorksSection') howItWorksSection?: ElementRef<HTMLElement>;
  @ViewChild('howItWorksVideo') howItWorksVideo?: ElementRef<HTMLVideoElement>;

  readonly activeStepIndex = signal(0);

  private sectionObserver: IntersectionObserver | null = null;
  private isHowItWorksInView = false;

  t(key: string, fallback: string): string {
    const value = this.translate.instant(key);
    return !value || value === key ? fallback : value;
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  ctaRouterLink(): string[] {
    return ['/', this.auth.isLoggedIn() ? 'dashboard' : 'signup'];
  }

  ctaHref(): string {
    return this.auth.isLoggedIn() ? '/dashboard' : '/signup';
  }

  pricingCtaRouterLink(): string[] {
    return this.ctaRouterLink();
  }

  pricingCtaQueryParams(planId: string): Record<string, string> {
    return { plan: planId };
  }

  pricingCtaHref(planId: string): string {
    return this.auth.isLoggedIn() ? '/dashboard' : `/signup?plan=${planId}`;
  }

  stats = [
    { value: '50+', labelKey: 'home.stats.activeTraders' },
    { value: '$2,969,028', labelKey: 'home.stats.volumeTraded' },
    { value: '99.9%', labelKey: 'home.stats.uptime' },
    { value: '10%', labelKey: 'home.stats.avgReturn' },
  ];

  features = [
    { icon: '⚡', titleKey: 'home.features.aiSignals.title', descKey: 'home.features.aiSignals.desc', slug: 'ai-signals' },
    { icon: '🔗', titleKey: 'home.features.multiExchange.title', descKey: 'home.features.multiExchange.desc', slug: 'multi-exchange' },
    { icon: '🛡️', titleKey: 'home.features.riskManagement.title', descKey: 'home.features.riskManagement.desc', slug: 'risk-management' },
    { icon: '📊', titleKey: 'home.features.backtesting.title', descKey: 'home.features.backtesting.desc', slug: 'backtesting' },
    { icon: '🔔', titleKey: 'home.features.smartAlerts.title', descKey: 'home.features.smartAlerts.desc', slug: 'smart-alerts' },
    { icon: '🌐', titleKey: 'home.features.noCode.title', descKey: 'home.features.noCode.desc', slug: 'no-code-builder' },
  ];

  steps = [
    {
      num: '01',
      titleKey: 'home.steps.step1.title',
      descKey: 'home.steps.step1.desc',
      videoSrc: '/videos/Connect Exchange - 08.06.2026.mov',
    },
    {
      num: '02',
      titleKey: 'home.steps.step2.title',
      descKey: 'home.steps.step2.desc',
      videoSrc: '/videos/Bot Created 08.06.2026.mov',
    },
    {
      num: '03',
      titleKey: 'home.steps.step3.title',
      descKey: 'home.steps.step3.desc',
      videoSrc: '/videos/Strategy created 08.06.2026.mov',
    },
  ];

  pricingPlans = [
    {
      id: 'free',
      highlighted: false,
      nameKey: 'home.pricing.plans.free.name',
      priceKey: 'home.pricing.plans.free.price',
      periodKey: null as string | null,
      badgeKey: null as string | null,
      ctaKey: 'home.pricing.plans.free.cta',
      features: [
        { textKey: 'home.pricing.plans.free.features.strategies', included: true },
        { textKey: 'home.pricing.plans.free.features.exchanges', included: true },
        { textKey: 'home.pricing.plans.free.features.emailNotifications', included: false },
        { textKey: 'home.pricing.plans.free.features.extraStrategies', included: false },
        { textKey: 'home.pricing.plans.free.features.customerSupport', included: false },
      ],
    },
    {
      id: 'beginner-trader',
      highlighted: true,
      nameKey: 'home.pricing.plans.beginner.name',
      priceKey: 'home.pricing.plans.beginner.price',
      periodKey: 'home.pricing.plans.beginner.period' as string | null,
      badgeKey: 'home.pricing.plans.beginner.badge' as string | null,
      ctaKey: 'home.pricing.plans.beginner.cta',
      features: [
        { textKey: 'home.pricing.plans.beginner.features.strategies', included: true },
        { textKey: 'home.pricing.plans.beginner.features.exchanges', included: true },
        { textKey: 'home.pricing.plans.beginner.features.emailNotifications', included: true },
        { textKey: 'home.pricing.plans.beginner.features.customerSupport', included: true },
      ],
    },
    {
      id: 'trading-expert',
      highlighted: false,
      nameKey: 'home.pricing.plans.expert.name',
      priceKey: 'home.pricing.plans.expert.price',
      periodKey: 'home.pricing.plans.expert.period' as string | null,
      badgeKey: null as string | null,
      ctaKey: 'home.pricing.plans.expert.cta',
      features: [
        { textKey: 'home.pricing.plans.expert.features.strategies', included: true },
        { textKey: 'home.pricing.plans.expert.features.exchanges', included: true },
        { textKey: 'home.pricing.plans.expert.features.emailNotifications', included: true },
        { textKey: 'home.pricing.plans.expert.features.customerSupport', included: true },
      ],
    },
  ];

  /** Curated, representative strategy ids offered in the "build your automation" picker. */
  private static readonly HERO_STRATEGY_IDS = [
    'ema-crossover',
    'macd-trend',
    'rsi-reversal',
    'bollinger-bounce',
    'vwap-reversion',
    'breakout',
  ];

  heroStrategies: StrategyTemplate[] = Home.HERO_STRATEGY_IDS
    .map(id => STRATEGY_TEMPLATES.find(t => t.id === id))
    .filter((t): t is StrategyTemplate => !!t);

  /** Unique (non-paper/testnet/sandbox/demo) exchanges & brokers for the "build your automation" picker, stocks first. */
  brokerShowcase = SUPPORTED_EXCHANGES
    .filter(e => !e.isPaper)
    .map(e => ({ id: e.id, name: e.name, logo: e.logo, color: e.color, category: e.category }))
    .sort((a, b) => (a.category === b.category ? 0 : a.category === 'stocks' ? -1 : 1));

  /** Single-select state for the "build your automation" section (strategy + broker picked together). */
  readonly selectedStrategyId = signal<string>('ema-crossover');
  readonly selectedBrokerId = signal<string>('alpaca');

  readonly selectedStrategy = computed(() =>
    this.heroStrategies.find(s => s.id === this.selectedStrategyId()) ?? this.heroStrategies[0]
  );

  readonly selectedBroker = computed(() =>
    this.brokerShowcase.find(b => b.id === this.selectedBrokerId()) ?? this.brokerShowcase[0]
  );

  selectStrategy(id: string): void {
    this.selectedStrategyId.set(id);
  }

  selectBroker(id: string): void {
    this.selectedBrokerId.set(id);
  }

  combinedQueryParams(): Record<string, string> {
    return { strategy: this.selectedStrategyId(), broker: this.selectedBrokerId() };
  }

  combinedHref(): string {
    return this.auth.isLoggedIn()
      ? '/dashboard'
      : `/signup?strategy=${this.selectedStrategyId()}&broker=${this.selectedBrokerId()}`;
  }

  activeStepVideoSrc(): string {
    return this.steps[this.activeStepIndex()]?.videoSrc ?? '';
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.howItWorksSection?.nativeElement) {
      return;
    }

    if (!('IntersectionObserver' in globalThis)) {
      this.startHowItWorksSequence();
      return;
    }

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          this.isHowItWorksInView = true;
          this.startHowItWorksSequence();
        } else {
          this.isHowItWorksInView = false;
          this.pauseHowItWorksVideo();
        }
      },
      {
        threshold: 0.45,
      },
    );

    this.sectionObserver.observe(this.howItWorksSection.nativeElement);
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
    this.sectionObserver = null;
  }

  setActiveHowItWorksStep(index: number): void {
    this.activeStepIndex.set(index);
    this.playCurrentStepVideo(true);
  }

  onStepVideoEnded(): void {
    if (!this.isHowItWorksInView) {
      return;
    }

    const nextIndex = (this.activeStepIndex() + 1) % this.steps.length;
    this.activeStepIndex.set(nextIndex);
    this.playCurrentStepVideo(true);
  }

  onStepVideoError(): void {
    if (!this.isHowItWorksInView) {
      return;
    }

    const nextIndex = (this.activeStepIndex() + 1) % this.steps.length;
    this.activeStepIndex.set(nextIndex);
    this.playCurrentStepVideo(true);
  }

  private startHowItWorksSequence(): void {
    this.activeStepIndex.set(0);
    this.playCurrentStepVideo(true);
  }

  private pauseHowItWorksVideo(): void {
    const video = this.howItWorksVideo?.nativeElement;
    if (!video) {
      return;
    }

    video.pause();
  }

  private playCurrentStepVideo(resetToStart = false): void {
    if (!this.isBrowser) {
      return;
    }

    globalThis.setTimeout(() => {
      const video = this.howItWorksVideo?.nativeElement;
      if (!video) {
        return;
      }

      // The `muted` IDL property is only initialised from the content attribute
      // when the element is created. Angular builds the element and *then* calls
      // setAttribute, so the attribute alone leaves video.muted false, and a
      // non-muted video is refused autoplay until the user interacts with the
      // page. Set the property outright so the state is correct at play() time.
      video.muted = true;

      if (resetToStart) {
        video.currentTime = 0;
      }

      // Do NOT call video.load() here: for step 1 the src is unchanged and load()
      // drops readyState to 0, causing play() to be aborted before any data arrives.
      // When the [src] binding changes (steps 2/3), the browser reloads automatically.
      void video.play().catch((err: DOMException) => {
        // AbortError is normal: it fires when a pending play() is superseded by
        // the next step's src change. Anything else means playback was actually
        // refused, which is otherwise invisible — surface it rather than swallow it.
        if (err?.name !== 'AbortError') {
          console.warn('[home] step video playback was blocked:', err?.name);
        }
      });
    }, 0);
  }
}
