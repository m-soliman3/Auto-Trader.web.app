import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { COMPANY_INFO } from '../shared/company-info';
import { LANGUAGES } from './language.service';
import { PREMIUM_MONTHLY_PRICE_USD } from './subscription.service';
import { authGuard } from '../guards/auth.guard';

/** Canonical origin every absolute URL in structured data is built from. */
export const SITE_URL = COMPANY_INFO.canonicalOrigin;

/** Public brand name, as used in `<title>` and the meta descriptions. */
export const SITE_NAME = 'Invest-Begin';

/**
 * Stable `@id`s for the site-wide entities. Page-level schema references these instead of
 * repeating the publisher/organisation payload, so a crawler resolves one Organization for
 * the whole site rather than one per page.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_APPLICATION_ID = `${SITE_URL}/#software`;
const LOGO_ID = `${SITE_URL}/#logo`;

export type JsonLdNode = Record<string, unknown>;

export interface BreadcrumbEntry {
  name: string;
  url: string;
}

const SITE_SCHEMA_SELECTOR = 'script[data-schema="site"]';
const PAGE_SCHEMA_SELECTOR = 'script[data-schema="page"]';

const DEFAULT_DESCRIPTION_KEY = 'metaDescription.default';

/** Pages whose schema.org type is more specific than a plain WebPage. */
const PAGE_TYPE_BY_PATH: Record<string, string> = {
  '/contact': 'ContactPage',
  '/knowledge-base': 'CollectionPage',
  '/terms': 'WebPage',
  '/privacy': 'WebPage',
};

/**
 * Emits JSON-LD structured data into `<head>` for every page.
 *
 * Two scripts are maintained, both kept in sync with the current route and language and both
 * picked up by the prerender because they are written through DOCUMENT during render:
 *
 * - `script[data-schema="site"]` — the Organization and WebSite nodes, identical on every page.
 * - `script[data-schema="page"]` — what this particular page is (WebPage / Article / …) plus its
 *   BreadcrumbList.
 *
 * The page script is written from route metadata for ordinary routes. Routes flagged
 * `data.selfDescribed` (the learn/blog and feature detail pages) build richer schema from their
 * own content and push it with `setPageGraph`; this service leaves those alone, exactly as
 * TranslatedTitleStrategy does for the meta description, because a component's `ngOnInit` runs
 * *before* the NavigationEnd this service reacts to.
 *
 * Nothing here invents facts: no ratings, review counts or dates are emitted unless they exist in
 * the codebase already (article dates come from LEARN_PUBLISH_DATES, which mirrors sitemap.xml).
 */
@Injectable({ providedIn: 'root' })
export class StructuredDataService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.update(event.urlAfterRedirects));

    // Titles and descriptions are translated, so the schema has to follow the active language.
    this.translate.onLangChange.subscribe(() => this.update(this.router.url));

    this.update(this.router.url);
  }

  // ───────────────────────────── API for self-described pages ─────────────────────────────

  /**
   * Replaces the page-level graph with nodes built by a component. Only for routes marked
   * `data.selfDescribed`, which own their schema for as long as they are active.
   */
  setPageGraph(nodes: JsonLdNode[]): void {
    this.writeGraph(PAGE_SCHEMA_SELECTOR, 'page', nodes);
  }

  /** Absolute, canonical URL for a path, e.g. `absoluteUrl('en', 'learn', 'ema-indicator')`. */
  absoluteUrl(lang: string, ...segments: string[]): string {
    return [SITE_URL, lang, ...segments.filter(Boolean)].join('/');
  }

  /** A BreadcrumbList node; the trail must be ordered from the home page to the current page. */
  breadcrumbNode(trail: BreadcrumbEntry[]): JsonLdNode {
    return {
      '@type': 'BreadcrumbList',
      '@id': `${trail[trail.length - 1].url}#breadcrumb`,
      itemListElement: trail.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.name,
        item: entry.url,
      })),
    };
  }

  /** The trail shared by every content page: Home › Knowledge Base › this page. */
  knowledgeBaseTrail(lang: string, pageName: string, pageUrl: string): BreadcrumbEntry[] {
    return [
      { name: this.t('nav.home') || 'Home', url: this.absoluteUrl(lang) },
      {
        name: this.t('footer.knowledgeBase') || 'Knowledge Base',
        url: this.absoluteUrl(lang, 'knowledge-base'),
      },
      { name: pageName, url: pageUrl },
    ];
  }

  readonly organizationRef: JsonLdNode = { '@id': ORGANIZATION_ID };
  readonly websiteRef: JsonLdNode = { '@id': WEBSITE_ID };

  // ────────────────────────────────── route handling ──────────────────────────────────

  private update(url: string): void {
    const lang = this.langFromUrl(url);
    this.writeGraph(SITE_SCHEMA_SELECTOR, 'site', [
      this.organizationNode(),
      this.websiteNode(),
    ]);

    const route = this.deepestRoute();

    if (route.data?.['selfDescribed'] === true) {
      // The component supplies its own graph (and re-supplies it on language change).
      return;
    }

    if (this.isProtected(route)) {
      // Signed-in surfaces are not indexable content; HreflangService already marks them
      // `isAccessibleForFree: false`. Emitting a second WebPage node here would only give
      // crawlers two competing descriptions of the same page.
      this.removeScript(PAGE_SCHEMA_SELECTOR);
      return;
    }

    this.writeGraph(PAGE_SCHEMA_SELECTOR, 'page', this.defaultPageGraph(route, url, lang));
  }

  private defaultPageGraph(
    route: ActivatedRouteSnapshot,
    url: string,
    lang: string,
  ): JsonLdNode[] {
    const canonicalPath = this.canonicalPath(url);
    const pageUrl = this.absoluteUrl(lang, ...canonicalPath.split('/').filter(Boolean));
    const isHome = canonicalPath === '';

    const titleKey = typeof route.title === 'string' ? route.title : undefined;
    const fullTitle = titleKey ? this.t(titleKey) : '';
    const shortName = isHome
      ? this.t('nav.home') || 'Home'
      : this.shortTitle(fullTitle) || SITE_NAME;
    const description =
      this.t((route.data?.['description'] as string | undefined) ?? DEFAULT_DESCRIPTION_KEY) ||
      this.t(DEFAULT_DESCRIPTION_KEY);

    const nodes: JsonLdNode[] = [];
    const webPage: JsonLdNode = {
      '@type': PAGE_TYPE_BY_PATH[canonicalPath] ?? 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: fullTitle || shortName,
      description,
      isPartOf: this.websiteRef,
      about: this.organizationRef,
      inLanguage: lang,
      isAccessibleForFree: true,
    };

    if (isHome) {
      webPage['mainEntity'] = { '@id': SOFTWARE_APPLICATION_ID };
    } else {
      const trail: BreadcrumbEntry[] = [
        { name: this.t('nav.home') || 'Home', url: this.absoluteUrl(lang) },
        { name: shortName, url: pageUrl },
      ];
      const breadcrumb = this.breadcrumbNode(trail);
      webPage['breadcrumb'] = { '@id': breadcrumb['@id'] };
      nodes.push(breadcrumb);
    }

    nodes.unshift(webPage);

    if (isHome) {
      nodes.push(this.softwareApplicationNode(lang, description));
    }

    return nodes;
  }

  // ─────────────────────────────────── site-wide nodes ───────────────────────────────────

  private organizationNode(): JsonLdNode {
    return {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      alternateName: ['auto-Trading', 'AutoTrader'],
      legalName: COMPANY_INFO.legalName,
      url: SITE_URL,
      email: COMPANY_INFO.contactEmail,
      logo: {
        '@type': 'ImageObject',
        '@id': LOGO_ID,
        url: `${SITE_URL}/images/logo.png`,
        contentUrl: `${SITE_URL}/images/logo.png`,
        width: 512,
        height: 512,
        caption: SITE_NAME,
      },
      image: { '@id': LOGO_ID },
      address: {
        '@type': 'PostalAddress',
        ...COMPANY_INFO.postalAddress,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: COMPANY_INFO.contactEmail,
        url: this.absoluteUrl('en', 'contact'),
        availableLanguage: LANGUAGES.map((language) => language.code),
      },
    };
  }

  private websiteNode(): JsonLdNode {
    return {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SITE_NAME,
      alternateName: 'auto-Trading',
      url: SITE_URL,
      description: this.t(DEFAULT_DESCRIPTION_KEY),
      publisher: this.organizationRef,
      inLanguage: LANGUAGES.map((language) => language.code),
    };
  }

  /**
   * The product itself, referenced from the home page. Deliberately carries no
   * `aggregateRating` or `review`: the site has no published rating to report, and inventing
   * one is both dishonest and a Google structured-data violation.
   */
  private softwareApplicationNode(lang: string, description: string): JsonLdNode {
    return {
      '@type': 'SoftwareApplication',
      '@id': SOFTWARE_APPLICATION_ID,
      name: SITE_NAME,
      alternateName: 'auto-Trading',
      applicationCategory: 'FinanceApplication',
      applicationSubCategory: 'Automated trading platform',
      operatingSystem: 'Web browser',
      url: SITE_URL,
      description,
      publisher: this.organizationRef,
      provider: this.organizationRef,
      inLanguage: LANGUAGES.map((language) => language.code),
      offers: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: this.absoluteUrl(lang, 'signup'),
        },
        {
          '@type': 'Offer',
          name: 'Premium',
          price: String(PREMIUM_MONTHLY_PRICE_USD),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: this.absoluteUrl(lang, 'billing', 'checkout'),
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(PREMIUM_MONTHLY_PRICE_USD),
            priceCurrency: 'USD',
            referenceQuantity: {
              '@type': 'QuantitativeValue',
              value: 1,
              unitCode: 'MON',
            },
          },
        },
      ],
    };
  }

  // ───────────────────────────────────── plumbing ─────────────────────────────────────

  private writeGraph(selector: string, schemaName: string, nodes: JsonLdNode[]): void {
    if (nodes.length === 0) {
      this.removeScript(selector);
      return;
    }

    const existing = this.document.querySelector<HTMLScriptElement>(selector);
    const script = existing ?? this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-schema', schemaName);
    script.text = this.serialize({ '@context': 'https://schema.org', '@graph': nodes });

    if (!existing) {
      this.document.head.appendChild(script);
    }
  }

  private removeScript(selector: string): void {
    const existing = this.document.querySelector(selector);
    existing?.parentNode?.removeChild(existing);
  }

  /**
   * `<` and `&` are escaped so that content containing `</script>` — article text is user-facing
   * copy that can legitimately contain HTML-ish characters — cannot terminate the script element.
   */
  private serialize(payload: unknown): string {
    return JSON.stringify(payload)
      .replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E');
  }

  private t(key: string): string {
    const translated = this.translate.instant(key);
    return !translated || translated === key ? '' : translated;
  }

  /**
   * `Login — Invest-Begin | Access Your Automated Trading Platform` → `Login`.
   * Every locale follows the same `Page — Brand | Tagline` convention, so the first segment is
   * the page's own name — what a breadcrumb should show.
   */
  private shortTitle(title: string): string {
    return title.split(/\s[—|]\s/)[0].trim();
  }

  private deepestRoute(): ActivatedRouteSnapshot {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }

  private isProtected(route: ActivatedRouteSnapshot): boolean {
    return route.pathFromRoot.some((snapshot) =>
      (snapshot.routeConfig?.canActivate ?? []).some((guard) => guard === authGuard),
    );
  }

  private langFromUrl(url: string): string {
    const [first] = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    return LANGUAGES.some((language) => language.code === first) ? first : 'en';
  }

  /** Strips the language prefix and query string: `/en/features/ai-signals` → `/features/ai-signals`. */
  private canonicalPath(url: string): string {
    const segments = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length > 0 && LANGUAGES.some((language) => language.code === segments[0])) {
      segments.shift();
    }
    return segments.length > 0 ? '/' + segments.join('/') : '';
  }
}
