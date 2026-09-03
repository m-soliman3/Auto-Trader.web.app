import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, afterNextRender, inject } from '@angular/core';

/**
 * Injects the AvaPartner skyscraper ad iframe client-side.
 * Isolated in its own component (used with `ngSkipHydration`) so Angular's
 * hydration reconciliation doesn't strip the manually-created iframe.
 */
@Component({
  selector: 'app-ad-banner-skyscraper',
  standalone: true,
  template: '',
  host: { class: 'ad-banner ad-banner-skyscraper', 'aria-hidden': 'true' },
})
export class AdBannerSkyscraper {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
