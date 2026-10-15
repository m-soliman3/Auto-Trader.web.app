import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  JsonLdNode,
  SITE_URL,
  StructuredDataService,
} from '../../services/structured-data.service';

export interface VideoHighlight {
  icon: string;
  title: string;
  description: string;
}

export interface VideoRelatedLink {
  label: string;
  routeSegment: 'videos' | 'features';
  slug: string;
}

export interface VideoData {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  heroDescription: string;
  overview: string;
  howItWorks: string;
  highlights: VideoHighlight[];
  relatedLinks: VideoRelatedLink[];
  videoFile: string;
  thumbnailFile: string;
  uploadDate: string;
  metaTitle: string;
  metaDescription: string;
}

interface VideoNavLink {
  slug: string;
  label: string;
  tagline: string;
  icon: string;
}

export const VIDEOS: Record<string, VideoData> = {
  'connect-exchange': {
    slug: 'connect-exchange',
    icon: '🔗',
    title: 'Connect Your Exchange',
    tagline: 'Link your exchange account safely — in under two minutes.',
    metaTitle: 'How to Connect Your Exchange — Video Guide | Invest-Begin',
    metaDescription:
      'Watch a step-by-step video showing exactly how to connect your exchange account to auto-Trading with encrypted API keys — no withdrawal access required.',
    heroDescription:
      'This short walkthrough shows the exact steps to link your exchange account to auto-Trading using read-and-trade API keys, so your bots can start trading in minutes.',
    overview: `Connecting an exchange is the first step to automating any strategy, and it is also the step traders are most cautious about — rightly so, since it involves handing over API access to your trading account. This video shows the entire process on screen, from start to finish, so you know exactly what to expect before you do it yourself.

auto-Trading supports more than 30 spot and derivatives exchanges, including Binance, Coinbase Advanced Trade, Kraken, Bybit, OKX, and KuCoin, all through a single unified connection flow. In the video you will see the three steps required: generating a read-and-trade API key in your exchange account settings, pasting it into auto-Trading's secure vault, and running a one-click connection test that confirms the link is live before any bot touches it.`,
    howItWorks: `Your API keys are encrypted at rest with AES-256 inside an isolated key-management vault and are never requested with withdrawal permissions — the video highlights exactly where that permission toggle lives on the exchange side so you can double-check it yourself. Once connected, auto-Trading opens a persistent, authenticated session with the exchange's WebSocket feed, which is how your dashboard shows live prices and order status the moment you finish the steps shown here.`,
    highlights: [
      {
        icon: '🔐',
        title: 'Bank-grade key encryption',
        description: 'API keys are encrypted with AES-256 and stored in an isolated vault — never shared, never logged in plain text.',
      },
      {
        icon: '🚫',
        title: 'No withdrawal access, ever',
        description: 'Only read-and-trade permissions are requested. Your funds stay under your control on the exchange at all times.',
      },
      {
        icon: '⚡',
        title: 'Live in three steps',
        description: 'Generate a key, paste it into the vault, run the connection test — the whole flow takes under two minutes.',
      },
      {
        icon: '🏦',
        title: '30+ exchanges supported',
        description: 'Binance, Coinbase, Kraken, Bybit, OKX, KuCoin, and many more — all through one connection flow.',
      },
    ],
    relatedLinks: [
      { label: 'Create Your First Strategy', routeSegment: 'videos', slug: 'create-strategy' },
      { label: 'Let It Work For You', routeSegment: 'videos', slug: 'let-it-work-for-you' },
      { label: 'Multi-Exchange Support', routeSegment: 'features', slug: 'multi-exchange' },
    ],
    videoFile: 'Connect Exchange - 30.09.2026.mp4',
    thumbnailFile: 'connect-exchange.jpg',
    uploadDate: '2026-09-30',
  },

  'create-strategy': {
    slug: 'create-strategy',
    icon: '🧩',
    title: 'Create Your First Strategy',
    tagline: 'Build an automated trading strategy without writing a line of code.',
    metaTitle: 'How to Create a Trading Strategy — Video Guide | Invest-Begin',
    metaDescription:
      'Watch how to build a fully automated trading strategy in the no-code builder — combine indicators, entry conditions, and risk rules visually, then deploy in one click.',
    heroDescription:
      'See exactly how to drag, connect, and configure blocks in the no-code strategy builder to launch a working bot — no programming experience required.',
    overview: `Once your exchange is connected, the next step is giving auto-Trading something to execute: a strategy. This video walks through building one from scratch in the visual, drag-and-drop strategy builder, the same tool used by beginners and experienced traders alike.

You will see blocks being dragged from the side panel onto the canvas and wired together to define a flow of logic: a market-data input, a technical indicator such as RSI or a moving average, a condition block that checks when that indicator crosses a threshold, and an action block that opens or closes a position. The indicator library used in the video is pulled from more than 80 built-in options, covering trend, momentum, volatility, and volume indicators, so the same canvas works for almost any style of strategy.`,
    howItWorks: `Behind the canvas shown in the video, every block becomes a node in a directed acyclic graph, and every connection defines a data dependency. When the strategy runs, the engine evaluates that graph in order for each new market bar, so upstream indicator calculations always finish before the downstream conditions and actions that depend on them are evaluated. That is what makes it possible to paper-trade the exact strategy built in this video first, then flip it to live trading with the single click shown at the end.`,
    highlights: [
      {
        icon: '🖱️',
        title: 'True drag-and-drop',
        description: 'Build the entire strategy shown in the video with clicks and drags — no coding required at any step.',
      },
      {
        icon: '📚',
        title: '80+ built-in indicators',
        description: 'RSI, MACD, Bollinger Bands, VWAP, Ichimoku, and dozens more, ready to drop onto the canvas.',
      },
      {
        icon: '🧪',
        title: 'Paper-trade before going live',
        description: 'Validate the strategy from this video against real market data with virtual funds first.',
      },
      {
        icon: '🚀',
        title: 'One-click deployment',
        description: 'Go from the finished canvas to live trading in a single click — no code changes needed.',
      },
    ],
    relatedLinks: [
      { label: 'Connect Your Exchange', routeSegment: 'videos', slug: 'connect-exchange' },
      { label: 'Let It Work For You', routeSegment: 'videos', slug: 'let-it-work-for-you' },
      { label: 'No-Code Strategy Builder', routeSegment: 'features', slug: 'no-code-builder' },
    ],
    videoFile: 'Create Strategy - 30.09.2026.mp4',
    thumbnailFile: 'create-strategy.jpg',
    uploadDate: '2026-09-30',
  },

  'let-it-work-for-you': {
    slug: 'let-it-work-for-you',
    icon: '🛡️',
    title: 'Let It Work For You',
    tagline: 'Automated trading, monitored and protected around the clock.',
    metaTitle: 'Let It Work For You — Automated Trading Video Guide | Invest-Begin',
    metaDescription:
      'Watch how auto-Trading monitors markets, executes trades, and enforces risk controls automatically once your bot is live — so you can let it work for you.',
    heroDescription:
      'Once your strategy is live, this is what happens next: round-the-clock monitoring, automatic execution, and built-in risk controls running quietly in the background.',
    overview: `With an exchange connected and a strategy built, this final video shows what day-to-day automated trading actually looks like once you step back. The dashboard keeps watching every connected exchange for the conditions your strategy defines, places and manages orders the moment those conditions are met, and reconciles every fill against the exchange's own records so the numbers you see are always accurate.

You will also see the risk controls that run underneath every trade: stop-loss and take-profit levels, position-sizing limits, and portfolio-level drawdown circuit-breakers that can automatically pause a bot if losses exceed a threshold you set. None of this requires you to be watching a screen — alerts arrive by push notification, email, or Telegram the moment something worth knowing happens.`,
    howItWorks: `Every order you see submitted in the video first passes through the risk engine, which checks it against your active position-size limits, portfolio exposure, and drawdown thresholds before it ever reaches the exchange. Stop-loss and take-profit orders are submitted alongside the entry automatically, and the performance dashboard shown at the end aggregates P&L across every connected exchange in real time, so a bot genuinely can run unattended while still being fully auditable.`,
    highlights: [
      {
        icon: '🛡️',
        title: 'Built-in risk controls',
        description: 'Stop-loss, take-profit, and portfolio drawdown limits are enforced automatically on every trade.',
      },
      {
        icon: '🔔',
        title: 'Real-time alerts',
        description: 'Push, email, or Telegram notifications the moment a trade fills or a risk limit is hit.',
      },
      {
        icon: '📊',
        title: 'Live performance dashboard',
        description: 'Track P&L, win rate, and open positions across every connected exchange in one place.',
      },
      {
        icon: '🌙',
        title: 'Runs while you sleep',
        description: 'Bots trade 24/7 once deployed — no manual intervention needed to keep them working.',
      },
    ],
    relatedLinks: [
      { label: 'Connect Your Exchange', routeSegment: 'videos', slug: 'connect-exchange' },
      { label: 'Create Your First Strategy', routeSegment: 'videos', slug: 'create-strategy' },
      { label: 'Risk Management', routeSegment: 'features', slug: 'risk-management' },
    ],
    videoFile: 'Let It Work For You - 30.09.2026.mp4',
    thumbnailFile: 'let-it-work-for-you.jpg',
    uploadDate: '2026-09-30',
  },
};

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './video-detail.html',
  styleUrl: './video-detail.scss',
})
export class VideoDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  languageService = inject(LanguageService);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private meta = inject(Meta);
  private structuredData = inject(StructuredDataService);

  private baseVideo: VideoData | null = null;
  video: VideoData | null = null;
  overviewParagraphs: string[] = [];
  howItWorksParagraphs: string[] = [];
  otherVideos: VideoNavLink[] = [];

  ngOnInit(): void {
    this.loadVideo(this.route.snapshot.paramMap.get('slug') ?? '');

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.loadVideo(params.get('slug') ?? '');
      });

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTranslatedVideo());
  }

  private loadVideo(slug: string): void {
    const data = VIDEOS[slug];
    if (!data) {
      void this.router.navigate(['/', this.languageService.currentLang()]);
      return;
    }

    this.baseVideo = data;
    this.applyTranslatedVideo();
  }

  private t(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return translated === key ? fallback : translated;
  }

  private applyTranslatedVideo(): void {
    const base = this.baseVideo;
    if (!base) {
      return;
    }

    const keyRoot = `videoPages.${base.slug}`;
    const translatedOverview = this.t(`${keyRoot}.overview`, base.overview);
    const translatedHowItWorks = this.t(`${keyRoot}.howItWorks`, base.howItWorks);
    const translatedRelatedLinks = base.relatedLinks.map((link) => ({
      ...link,
      label:
        link.routeSegment === 'videos'
          ? this.t(`videoPages.${link.slug}.title`, link.label)
          : this.t(`featurePages.${link.slug}.title`, link.label),
    }));

    this.video = {
      ...base,
      title: this.t(`${keyRoot}.title`, base.title),
      tagline: this.t(`${keyRoot}.tagline`, base.tagline),
      metaTitle: this.t(`${keyRoot}.metaTitle`, base.metaTitle),
      metaDescription: this.t(`${keyRoot}.metaDescription`, base.metaDescription),
      heroDescription: this.t(`${keyRoot}.heroDescription`, base.heroDescription),
      overview: translatedOverview,
      howItWorks: translatedHowItWorks,
      highlights: base.highlights.map((highlight, index) => ({
        ...highlight,
        title: this.t(`${keyRoot}.highlights.${index}.title`, highlight.title),
        description: this.t(`${keyRoot}.highlights.${index}.description`, highlight.description),
      })),
      relatedLinks: translatedRelatedLinks,
    };

    const canonicalHref = this.canonicalHref(base.slug);
    const videoAbsUrl = `${SITE_URL}/videos/${encodeURIComponent(base.videoFile)}`;
    const thumbnailAbsUrl = `${SITE_URL}/images/video-thumbnails/${base.thumbnailFile}`;

    this.document.title = this.video.metaTitle;
    this.meta.updateTag({ name: 'description', content: this.video.metaDescription });
    this.meta.updateTag({ property: 'og:title', content: this.video.metaTitle });
    this.meta.updateTag({ property: 'og:description', content: this.video.metaDescription });
    this.meta.updateTag({ property: 'og:url', content: canonicalHref });
    this.meta.updateTag({ property: 'og:type', content: 'video.other' });
    this.meta.updateTag({ property: 'og:video', content: videoAbsUrl });
    this.meta.updateTag({ property: 'og:video:type', content: 'video/mp4' });
    this.meta.updateTag({ property: 'og:image', content: thumbnailAbsUrl });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:image', content: thumbnailAbsUrl });

    this.structuredData.setPageGraph(this.buildStructuredData(canonicalHref, videoAbsUrl, thumbnailAbsUrl));

    this.overviewParagraphs = translatedOverview.split('\n\n').map((p) => p.trim()).filter(Boolean);
    this.howItWorksParagraphs = translatedHowItWorks.split('\n\n').map((p) => p.trim()).filter(Boolean);

    this.otherVideos = Object.values(VIDEOS)
      .filter((v) => v.slug !== base.slug)
      .map((v) => ({
        slug: v.slug,
        icon: v.icon,
        label: this.t(`videoPages.${v.slug}.title`, v.title),
        tagline: this.t(`videoPages.${v.slug}.tagline`, v.tagline),
      }));
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  private canonicalHref(slug: string): string {
    return this.structuredData.absoluteUrl(this.languageService.currentLang(), 'videos', slug);
  }

  private buildStructuredData(canonicalHref: string, videoAbsUrl: string, thumbnailAbsUrl: string): JsonLdNode[] {
    const video = this.video;
    if (!video) {
      return [];
    }

    const lang = this.languageService.currentLang();
    const breadcrumb = this.structuredData.breadcrumbNode(
      this.structuredData.knowledgeBaseTrail(lang, video.title, canonicalHref),
    );

    const videoObject: JsonLdNode = {
      '@type': 'VideoObject',
      '@id': `${canonicalHref}#video`,
      name: video.metaTitle,
      description: video.metaDescription,
      thumbnailUrl: [thumbnailAbsUrl],
      contentUrl: videoAbsUrl,
      uploadDate: `${video.uploadDate}T00:00:00Z`,
      publisher: this.structuredData.organizationRef,
      isFamilyFriendly: true,
    };

    const webPage: JsonLdNode = {
      '@type': 'WebPage',
      '@id': `${canonicalHref}#webpage`,
      url: canonicalHref,
      name: video.metaTitle,
      description: video.metaDescription,
      abstract: video.tagline,
      isPartOf: this.structuredData.websiteRef,
      primaryImageOfPage: { '@id': `${canonicalHref}#video` },
      publisher: this.structuredData.organizationRef,
      inLanguage: lang,
      isAccessibleForFree: true,
      breadcrumb: { '@id': breadcrumb['@id'] },
    };

    return [webPage, videoObject, breadcrumb];
  }

  ctaLink(): string[] {
    return this.localizedLink(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  ctaHref(): string {
    return this.localizedHref(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  videoLanguageLink(languageCode: string): string[] {
    return ['/', languageCode, 'videos', this.baseVideo?.slug ?? ''];
  }

  videoLanguageHref(languageCode: string): string {
    return `/${languageCode}/videos/${this.baseVideo?.slug ?? ''}`;
  }

  relatedLinkPath(link: VideoRelatedLink): string[] {
    return this.localizedLink(link.routeSegment, link.slug);
  }

  relatedLinkHref(link: VideoRelatedLink): string {
    return this.localizedHref(link.routeSegment, link.slug);
  }
}
