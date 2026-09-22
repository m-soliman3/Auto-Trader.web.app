import { inject } from '@angular/core';
import { LanguageService } from '../services/language.service';

/**
 * Every internal link on a crawlable page must carry the active locale prefix.
 *
 * A locale-less path such as `/signup` misses `languagePrefixMatcher`, has no
 * prerendered `index.html`, and is not in Hosting's `redirects` list — so it
 * falls through the `**` rewrite to `index.csr.html`. That shell answers 200
 * with an empty `<app-root>`, the site-wide default title/description and no
 * canonical, which is exactly what a crawler files as a blank, duplicate page.
 *
 * Components that render links extend this so `localizedLink()` (for the router)
 * and `localizedHref()` (for the prerendered `href`, which is what crawlers and
 * no-JS clients follow) stay the only way internal URLs are built.
 */
export abstract class LocalizedLinks {
  readonly languageService = inject(LanguageService);

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }
}
