import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';

/**
 * Site-wide "no guaranteed results" notice, rendered as the top row of the fixed navbar.
 *
 * It collapses once the page is scrolled so it never sits on top of sticky page content,
 * but the space it needs at the top of the page stays reserved: its full height is
 * published as `--risk-banner-height`, which `.app-main` adds to its top padding. So
 * collapsing never makes the page jump. `styles.scss` carries a pre-hydration estimate
 * of that height for the prerendered HTML.
 */
@Component({
  selector: 'app-risk-banner',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  template: `
    <div class="risk-banner" [class.collapsed]="collapsed()" role="note" [attr.aria-label]="'riskBanner.label' | translate">
      <p #content class="risk-banner-text">
        <svg class="risk-banner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ 'riskBanner.text' | translate }}
        <a
          class="risk-banner-link"
          [routerLink]="localizedLink('terms')"
          fragment="automated-trading"
          [attr.href]="localizedHref('terms') + '#automated-trading'"
          [attr.tabindex]="collapsed() ? -1 : null"
        >{{ 'riskBanner.link' | translate }}</a>
      </p>
    </div>
  `,
  styles: [`
    .risk-banner {
      overflow: hidden;
      max-height: var(--risk-banner-height, 6rem);
      background: var(--surface-raised);
      transition: max-height 0.3s ease;
    }

    .risk-banner.collapsed {
      max-height: 0;
    }

    /* The border lives here rather than on .risk-banner so the measured height includes it. */
    .risk-banner-text {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0.45rem 1.5rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.8rem;
      line-height: 1.45;
      text-align: center;
    }

    .risk-banner-icon {
      vertical-align: -2px;
      margin-inline-end: 0.35rem;
      color: #e0a800;
    }

    .risk-banner-link {
      color: var(--accent);
      font-weight: 600;
      white-space: nowrap;
      margin-inline-start: 0.25rem;
    }

    @media (max-width: 640px) {
      .risk-banner-text { padding: 0.4rem 1rem; font-size: 0.75rem; }
    }
  `],
})
export class RiskBanner extends LocalizedLinks {
  readonly collapsed = input(false);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    super();
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);

    // Browser-only. The text's own box keeps its full height while the wrapper is collapsed,
    // so this reports the reserved height even when the banner is hidden.
    afterNextRender(() => {
      const content = this.content().nativeElement;
      const observer = new ResizeObserver(() => {
        root.style.setProperty('--risk-banner-height', `${content.offsetHeight}px`);
      });
      observer.observe(content);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        root.style.removeProperty('--risk-banner-height');
      });
    });
  }
}
