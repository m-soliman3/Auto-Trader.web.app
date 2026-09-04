import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, afterNextRender, inject } from '@angular/core';

interface EtoroWidgetSettings {
  feedType: string;
  pageName: string;
  container: string;
  culture: string;
  disclaimerType: string;
  isEtoro: boolean;
  clickTag: string;
  color: string;
  w_size: string;
  etoroUrl: string;
}

declare global {
  interface Window {
    widgetSettings?: EtoroWidgetSettings;
  }
}

/**
 * Injects the eToro popular-investor widget iframe client-side.
 * Isolated in its own component (used with `ngSkipHydration`) so Angular's
 * hydration reconciliation doesn't strip the manually-created iframe.
 */
@Component({
  selector: 'app-ad-widget-etoro',
  standalone: true,
  template: '<div id="etoro-widget"></div>',
  host: { class: 'ad-banner ad-widget-etoro', 'aria-hidden': 'true' },
})
export class AdWidgetEtoro {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    afterNextRender(() => this.loadWidget());
  }

  private loadWidget(): void {
    if (!this.isBrowser) {
      return;
    }

    window.widgetSettings = {
      feedType: 'popular-investor',
      pageName: 'Default',
      container: 'etoro-widget',
      culture: 'en-gb',
      disclaimerType: 'fca',
      isEtoro: true,
      clickTag: '',
      color: 'white',
      w_size: 's_300x250',
      etoroUrl: 'https://med.etoro.com/B14328_A122755_TClick_ADVTrue.aspx',
    };

    const script = document.createElement('script');
    script.src = 'https://pages.etoro.com/widgets/widget-redesign/pi-rankings-new/iframe-creator.js?v=1';
    script.type = 'text/javascript';
    document.body.appendChild(script);
  }
}
