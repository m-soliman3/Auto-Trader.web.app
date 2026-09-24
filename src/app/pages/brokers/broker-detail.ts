import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { Exchange } from '../../services/exchange.service';
import { JsonLdNode, StructuredDataService } from '../../services/structured-data.service';
import { LocalizedLinks } from '../../shared/localized-links';
import { LEARN_PAGES } from '../learn/learn-detail';
import { BROKER_PAGES, BrokerGuide, BrokerPageData, brokerExchange, brokerPage } from './broker-pages';
import { BROKER_GUIDES } from './broker-guides';

interface BrokerView extends BrokerPageData {
  name: string;
  logo: string;
  color: string;
  category: Exchange['category'];
  overviewParagraphs: string[];
  /** Homepage URL without scheme, `www.` or trailing slash, for display. */
  homepageLabel: string;
  guide: BrokerGuide & { feesParagraphs: string[]; strategies: (BrokerGuide['strategies'][number] & { title: string })[] };
}

interface BrokerNavLink {
  slug: string;
  name: string;
  logo: string;
  category: Exchange['category'];
}

@Component({
  selector: 'app-broker-detail',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './broker-detail.html',
  styleUrl: './broker-detail.scss',
})
export class BrokerDetailPage extends LocalizedLinks implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private meta = inject(Meta);
  private structuredData = inject(StructuredDataService);

  private base: BrokerPageData | null = null;
  broker: BrokerView | null = null;
  exchange: Exchange | null = null;
  paperExchange: Exchange | null = null;
  otherBrokers: BrokerNavLink[] = [];

  ngOnInit(): void {
    // Ensure first render has data even before the paramMap stream emits.
    this.load(this.route.snapshot.paramMap.get('slug') ?? '');

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.load(params.get('slug') ?? ''));

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTranslations());
  }

  private load(slug: string): void {
    const data = brokerPage(slug);
    const exchange = brokerExchange(slug);
    if (!data || !exchange) {
      void this.router.navigate(['/', this.languageService.currentLang()]);
      return;
    }

    this.base = data;
    this.exchange = exchange;
    this.paperExchange = data.paperId ? brokerExchange(data.paperId) ?? null : null;
    this.applyTranslations();
  }

  private t(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return !translated || translated === key ? fallback : translated;
  }

  private paragraphs(text: string): string[] {
    return text.split('\n\n').map((p) => p.trim()).filter(Boolean);
  }

  private applyTranslations(): void {
    const base = this.base;
    const exchange = this.exchange;
    if (!base || !exchange) {
      return;
    }

    const keyRoot = `brokerPages.${base.slug}`;
    const overview = this.t(`${keyRoot}.overview`, base.overview);
    const guide = BROKER_GUIDES[base.slug];
    const feesAndAccounts = this.t(`${keyRoot}.feesAndAccounts`, guide.feesAndAccounts);
    const list = (field: 'apiSetup' | 'strengths' | 'limitations') =>
      guide[field].map((item, i) => this.t(`${keyRoot}.${field}.${i}`, item));

    this.broker = {
      ...base,
      name: exchange.name,
      logo: exchange.logo,
      color: exchange.color,
      category: exchange.category,
      tagline: this.t(`${keyRoot}.tagline`, base.tagline),
      headquarters: this.t(`${keyRoot}.headquarters`, base.headquarters),
      overview,
      overviewParagraphs: this.paragraphs(overview),
      homepageLabel: base.homepageUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      metaTitle: this.t(`${keyRoot}.metaTitle`, base.metaTitle),
      metaDescription: this.t(`${keyRoot}.metaDescription`, base.metaDescription),
      guide: {
        apiSetup: list('apiSetup'),
        feesAndAccounts,
        feesParagraphs: this.paragraphs(feesAndAccounts),
        availability: this.t(`${keyRoot}.availability`, guide.availability),
        strengths: list('strengths'),
        limitations: list('limitations'),
        strategies: guide.strategies.map((strategy, i) => ({
          slug: strategy.slug,
          title: this.t(`learnPages.${strategy.slug}.title`, LEARN_PAGES[strategy.slug]?.title ?? strategy.slug),
          reason: this.t(`${keyRoot}.strategies.${i}.reason`, strategy.reason),
        })),
        faqs: guide.faqs.map((faq, i) => ({
          question: this.t(`${keyRoot}.faqs.${i}.question`, faq.question),
          answer: this.t(`${keyRoot}.faqs.${i}.answer`, faq.answer),
        })),
      },
    };

    this.otherBrokers = BROKER_PAGES
      .filter((page) => page.slug !== base.slug)
      .map((page) => brokerExchange(page.slug))
      .filter((e): e is Exchange => !!e)
      .map((e) => ({ slug: e.id, name: e.name, logo: e.logo, category: e.category }));

    const canonicalHref = this.structuredData.absoluteUrl(this.languageService.currentLang(), 'brokers', base.slug);
    this.document.title = this.broker.metaTitle;
    this.meta.updateTag({ name: 'description', content: this.broker.metaDescription });
    this.meta.updateTag({ property: 'og:title', content: this.broker.metaTitle });
    this.meta.updateTag({ property: 'og:description', content: this.broker.metaDescription });
    this.meta.updateTag({ property: 'og:url', content: canonicalHref });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.structuredData.setPageGraph(this.buildStructuredData(canonicalHref));
  }

  /**
   * WebPage + BreadcrumbList + FAQPage JSON-LD. The page is about a third-party broker, so
   * `about` names that company (with its homepage as `url`) rather than the AutoTrader product.
   */
  private buildStructuredData(canonicalHref: string): JsonLdNode[] {
    const broker = this.broker;
    if (!broker) {
      return [];
    }

    const lang = this.languageService.currentLang();
    const breadcrumb = this.structuredData.breadcrumbNode([
      { name: this.t('nav.home', 'Home'), url: this.structuredData.absoluteUrl(lang) },
      {
        name: this.t('home.supportedBrokers.title', 'Supported Brokers'),
        url: `${this.structuredData.absoluteUrl(lang)}#supported-brokers`,
      },
      { name: broker.name, url: canonicalHref },
    ]);

    const webPage: JsonLdNode = {
      '@type': 'WebPage',
      '@id': `${canonicalHref}#webpage`,
      url: canonicalHref,
      name: broker.metaTitle,
      description: broker.metaDescription,
      abstract: broker.tagline,
      isPartOf: this.structuredData.websiteRef,
      about: {
        '@type': 'Organization',
        name: broker.name,
        url: broker.homepageUrl,
        foundingDate: String(broker.founded),
      },
      publisher: this.structuredData.organizationRef,
      inLanguage: lang,
      isAccessibleForFree: true,
      breadcrumb: { '@id': breadcrumb['@id'] },
    };

    const faqPage: JsonLdNode = {
      '@type': 'FAQPage',
      '@id': `${canonicalHref}#faq`,
      inLanguage: lang,
      mainEntity: broker.guide.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    };

    return [webPage, breadcrumb, faqPage];
  }

  connectionLabel(): string {
    const exchange = this.exchange;
    if (!exchange) {
      return '';
    }
    if (exchange.id === 'alpaca') {
      return this.t('brokerDetail.connectionOAuth', 'One-click OAuth or API keys');
    }
    if (exchange.id === 'interactive-brokers') {
      return this.t('brokerDetail.connectionGateway', 'IB Gateway or TWS running locally');
    }
    return exchange.hasPassphrase
      ? this.t('brokerDetail.connectionPassphrase', 'API key, secret & passphrase')
      : this.t('brokerDetail.connectionKeys', 'API key & secret');
  }

  ctaRouterLink(): string[] {
    return this.localizedLink(this.auth.isLoggedIn() ? 'dashboard' : 'signup');
  }

  ctaQueryParams(): Record<string, string> | null {
    return this.auth.isLoggedIn() ? null : { broker: this.base?.slug ?? '' };
  }

  ctaHref(): string {
    return this.auth.isLoggedIn()
      ? this.localizedHref('dashboard')
      : `${this.localizedHref('signup')}?broker=${this.base?.slug ?? ''}`;
  }
}
