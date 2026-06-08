import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
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

  stats = [
    { value: '125K+', labelKey: 'home.stats.activeTraders' },
    { value: '$4.2B', labelKey: 'home.stats.volumeTraded' },
    { value: '99.9%', labelKey: 'home.stats.uptime' },
    { value: '38%', labelKey: 'home.stats.avgReturn' },
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

      if (resetToStart) {
        video.currentTime = 0;
      }

      video.load();
      void video.play().catch(() => {
        // Autoplay can be blocked by browser policy until user interaction.
      });
    }, 0);
  }
}
