import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, Input, PLATFORM_ID, afterNextRender, inject } from '@angular/core';

/**
 * Injects the AvaPartner skyscraper ad iframe client-side.
 * Isolated in its own component (used with `ngSkipHydration`) so Angular's
 * hydration reconciliation doesn't strip the manually-created iframe.
 *
 * `side` controls which gutter the banner sits in, left or right of the content column.
 */
@Component({
  selector: 'app-ad-banner-skyscraper',
  standalone: true,
  template: '',
  host: {
    class: 'ad-banner ad-banner-skyscraper',
    'aria-hidden': 'true',
    '[class.ad-banner-skyscraper--right]': 'side === "right"',
  },
  styles: [`
    :host {
      display: none;
      /* Absolute (not fixed): the banner sits in the upper part of the page just
         below the navbar and scrolls away with the content, rather than tracking
         the viewport as the user scrolls. */
      position: absolute;
      top: 96px;
      /* Centred in the gutter OUTSIDE the 1200px content column (see eToro banner). */
      left: calc((100% - 1200px) / 2 / 2 - 60px);
      width: 120px;
      height: 600px;
      z-index: 999;
    }
    :host(.ad-banner-skyscraper--right) {
      left: auto;
      right: calc((100% - 1200px) / 2 / 2 - 60px);
    }
    /* 1200px column + 120px banner + breathing room on both sides. */
    @media (min-width: 1480px) {
      :host { display: block; }
    }
  `],
})
export class AdBannerSkyscraper {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input() side: 'left' | 'right' = 'left';

  constructor() {
    afterNextRender(() => this.loadAd());
  }

  private loadAd(): void {
    if (!this.isBrowser) {
      return;
    }

    const url = 'https://tracking.avapartner.com/impression/?affid=179290&html5Id=37212&adTheme=833&campaign=183700&campaignName=Default%20Campaign&tag=179290';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', `${url}&sid=${Math.random()}`);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('style', 'width:120px;height:600px;border:0;');
    iframe.setAttribute('title', 'Advertisement');
    this.host.nativeElement.appendChild(iframe);
  }
}
