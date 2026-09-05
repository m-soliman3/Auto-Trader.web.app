import { Component } from '@angular/core';

/**
 * eToro affiliate banner (300x600 vertical creative).
 *
 * Previously this injected eToro's `iframe-creator.js` popular-investor widget, but
 * `pages.etoro.com` now returns HTTP 530 (Cloudflare Error 1016 — origin DNS failure)
 * on every path, so that widget could never render. It is replaced with the static
 * creative from the eToro Partners portal, which is served from the healthy
 * `med.etoro.com` host.
 *
 * Being static markup, this needs no browser guard and no `ngSkipHydration`: it
 * prerenders and hydrates like any other template.
 */
@Component({
  selector: 'app-ad-widget-etoro',
  standalone: true,
  template: `
    <a href="https://med.etoro.com/B21392_A122755_TClick.aspx" target="_top" tabindex="-1">
      <img src="https://med.etoro.com/B21392_A122755_TGet.aspx" alt="" width="300" height="600" />
    </a>
  `,
  host: { class: 'ad-banner ad-widget-etoro', 'aria-hidden': 'true' },
  styles: [`
    :host {
      display: none;
      /* Absolute (not fixed): the banner sits in the upper part of the page just
         below the navbar and scrolls away with the content, rather than tracking
         the viewport and overlapping the sections below the hero.
         Top-aligned with the left AvaTrade skyscraper at the same 96px offset. */
      position: absolute;
      top: 96px;
      /* Centred in the gutter OUTSIDE the 1200px content column, so the creative
         never covers page content. Percentages resolve against the initial
         containing block, which excludes the scrollbar (unlike 100vw). */
      right: calc((100% - 1200px) / 2 / 2 - 150px);
      width: 300px;
      height: 600px;
      z-index: 999;
    }
    :host img {
      display: block;
      width: 300px;
      height: 600px;
      border: 0;
    }
    /* 1200px column + 300px banner + breathing room on both sides. Below this the
       banner would sit on top of the content, so it is not shown at all. */
    @media (min-width: 1840px) {
      :host { display: block; }
    }
  `],
})
export class AdWidgetEtoro {}
