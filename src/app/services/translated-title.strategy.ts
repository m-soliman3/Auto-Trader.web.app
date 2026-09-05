import { Injectable, inject } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

/**
 * Sets the document title and the `<meta name="description">` tag on every navigation,
 * translating both through ngx-translate and re-applying them on language change.
 *
 * Meta description resolution, per route:
 * - `data.description` — an i18n key resolved and written to the description tag.
 * - `data.selfDescribed: true` — the component writes its own description (learn/blog
 *   and feature detail pages do this from their own content), so leave the tag alone.
 *   Without this flag the strategy would clobber the component's description, because
 *   `updateTitle` runs on NavigationEnd, after the component's `ngOnInit`.
 * - neither — fall back to the site-wide default so a description from a previously
 *   visited route never leaks into a page that has none.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);

  private static readonly DEFAULT_DESCRIPTION_KEY = 'metaDescription.default';

  private currentTitleKey: string | undefined;
  private currentDescriptionKey: string | undefined;
  private readonly langChangeSubscription: Subscription;

  constructor() {
    super();
    this.langChangeSubscription = this.translate.onLangChange.subscribe(() => {
      if (this.currentTitleKey) {
        this.setTranslatedTitle(this.currentTitleKey);
      }
      if (this.currentDescriptionKey) {
        this.setTranslatedDescription(this.currentDescriptionKey);
      }
    });
  }

  ngOnDestroy(): void {
    this.langChangeSubscription.unsubscribe();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    this.updateDescription(routerState);

    const titleKey = this.buildTitle(routerState);
    if (!titleKey) {
      return;
    }
    this.currentTitleKey = titleKey;
    this.setTranslatedTitle(titleKey);
  }

  private updateDescription(routerState: RouterStateSnapshot): void {
    let route: ActivatedRouteSnapshot = routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }

    if (route.data?.['selfDescribed'] === true) {
      this.currentDescriptionKey = undefined;
      return;
    }

    const key = (route.data?.['description'] as string | undefined)
      ?? TranslatedTitleStrategy.DEFAULT_DESCRIPTION_KEY;
    this.currentDescriptionKey = key;
    this.setTranslatedDescription(key);
  }

  private setTranslatedTitle(key: string): void {
    this.translate.get(key).pipe(take(1)).subscribe((translated: string) => {
      this.document.title = translated === key ? key : translated;
    });
  }

  private setTranslatedDescription(key: string): void {
    this.translate.get(key).pipe(take(1)).subscribe((translated: string) => {
      if (!translated || translated === key) {
        return;
      }
      this.meta.updateTag({ name: 'description', content: translated });
      this.meta.updateTag({ property: 'og:description', content: translated });
    });
  }
}
