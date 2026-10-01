import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';
import { LEARN_PAGES } from './learn/learn-detail';

interface SitemapCard {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  imageUrl?: string;
}

/** Platform features shown on the knowledge base — titles come from the featurePages translations. */
const FEATURE_CARDS: { slug: string; icon: string }[] = [
  { slug: 'ai-signals', icon: '⚡' },
  { slug: 'multi-exchange', icon: '🔗' },
  { slug: 'risk-management', icon: '🛡️' },
  { slug: 'backtesting', icon: '📊' },
  { slug: 'smart-alerts', icon: '🔔' },
  { slug: 'no-code-builder', icon: '🌐' },
];

/** Video guides shown on the knowledge base — titles come from the videoPages translations. */
const VIDEO_CARDS: { slug: string; icon: string }[] = [
  { slug: 'connect-exchange', icon: '🔗' },
  { slug: 'create-strategy', icon: '🧩' },
  { slug: 'let-it-work-for-you', icon: '🛡️' },
];

@Component({
  selector: 'app-sitemap',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './sitemap.html',
  styleUrl: './sitemap.scss',
})
export class SitemapPage {
  languageService = inject(LanguageService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly features   = signal<SitemapCard[]>([]);
  readonly videos     = signal<SitemapCard[]>([]);
  readonly strategies = signal<SitemapCard[]>([]);
  readonly signals    = signal<SitemapCard[]>([]);
  readonly blogPosts  = signal<SitemapCard[]>([]);

  constructor() {
    this.applyTranslatedCards();

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTranslatedCards());
  }

  private t(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return translated === key || typeof translated !== 'string' ? fallback : translated;
  }

  private applyTranslatedCards(): void {
    this.features.set(
      FEATURE_CARDS.map(f => ({
        slug: f.slug,
        icon: f.icon,
        title: this.t(`featurePages.${f.slug}.title`, f.slug),
        tagline: this.t(`featurePages.${f.slug}.tagline`, ''),
      })),
    );

    this.videos.set(
      VIDEO_CARDS.map(v => ({
        slug: v.slug,
        icon: v.icon,
        title: this.t(`videoPages.${v.slug}.title`, v.slug),
        tagline: this.t(`videoPages.${v.slug}.tagline`, ''),
      })),
    );

    const cardsFor = (category: string): SitemapCard[] =>
      Object.values(LEARN_PAGES)
        .filter(p => p.category === category)
        .map(p => ({
          slug: p.slug,
          icon: p.icon,
          title: this.t(`learnPages.${p.slug}.title`, p.title),
          tagline: this.t(`learnPages.${p.slug}.tagline`, p.tagline),
          imageUrl: p.imageUrl,
        }));

    this.strategies.set(cardsFor('strategy'));
    this.signals.set(cardsFor('signal'));
    this.blogPosts.set(cardsFor('blog'));
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }
}
