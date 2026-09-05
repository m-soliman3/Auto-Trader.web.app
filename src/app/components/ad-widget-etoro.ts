import { Component } from '@angular/core';

/**
 * eToro affiliate banner (300x600 vertical creative, `B20158_A122755`).
 *
 * Do not reintroduce eToro's `iframe-creator.js` popular-investor widget. Its host
 * `pages.etoro.com` returns HTTP 530 (Cloudflare Error 1016 — origin DNS failure)
 * on every path, so that widget could never render. This is the static creative
 * from the Partners portal, served from the healthy `med.etoro.com` host.
 *
 * Being static markup, this needs no browser guard and no `ngSkipHydration`: it
 * prerenders and hydrates like any other template.
 */
@Component({
  selector: 'app-ad-widget-etoro',
  standalone: true,
  template: `
    <a href="https://med.etoro.com/B20158_A122755_TClick.aspx" target="_top" tabindex="-1">
      <img src="https://med.etoro.com/B20158_A122755_TGet.aspx" alt="" width="300" height="600" />
    </a>
  `,
  host: { class: 'ad-banner ad-widget-etoro', 'aria-hidden': 'true' },
  styles: [`
    :host {
      display: none;
      /* Absolute (not fixed): the banner sits in the upper part of the page just
         below the navbar and scrolls away with the content, rather than tracking
         the viewport and overlapping the sections below the hero.
         Same 96px offset as the left AvaTrade skyscraper, so the two are top-aligned. */
      position: absolute;
      top: 96px;
      /* Span the whole gutter OUTSIDE the 1200px content column and centre the
         creative in it, so the banner can never cover page content. Percentages
         resolve against the initial containing block, which excludes the scrollbar
         (unlike 100vw). */
      right: 0;
      width: calc((100% - 1200px) / 2);
      padding: 0 1rem;
      box-sizing: border-box;
      justify-content: center;
      align-items: flex-start;
      z-index: 999;
    }
    :host img {
      display: block;
      /* The creative is a fixed 300x600. Fill the gutter but never exceed its
         native size, and let the height follow so the 1:2 ratio is preserved at
         every width. The width/height attributes supply that ratio up front, so
         there is no layout shift while the image loads. */
      width: 100%;
      max-width: 300px;
      height: auto;
      border: 0;
    }
    /* Shown from the same width as the AvaTrade skyscraper so the two appear and
       disappear together. Below 1480px the gutter is too narrow for either. */
    @media (min-width: 1480px) {
      :host { display: flex; }
    }
  `],
})
export class AdWidgetEtoro {}
