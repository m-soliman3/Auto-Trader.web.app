import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';

@Component({
  selector: 'app-disclaimer-page',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  template: `
    <div class="legal-page">
      <div class="legal-card">
        <div class="legal-top">
          <div class="legal-links">
            <a [routerLink]="localizedLink()" [attr.href]="localizedHref()" class="back-link">{{ 'legal.home' | translate }}</a>
            <a [routerLink]="localizedLink('contact')" [attr.href]="localizedHref('contact')" class="back-link">{{ 'legal.contact' | translate }}</a>
          </div>
          <button type="button" class="close-btn" [attr.aria-label]="'common.close' | translate" (click)="close()">X</button>
        </div>

        <h1>{{ 'disclaimer.title' | translate }}</h1>
        <p class="meta">{{ 'disclaimer.effectiveDate' | translate }}</p>

        <section><h2>{{ 'disclaimer.s1Title' | translate }}</h2><p>{{ 'disclaimer.s1Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s2Title' | translate }}</h2><p>{{ 'disclaimer.s2Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s3Title' | translate }}</h2><p>{{ 'disclaimer.s3Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s4Title' | translate }}</h2><p>{{ 'disclaimer.s4Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s5Title' | translate }}</h2><p>{{ 'disclaimer.s5Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s6Title' | translate }}</h2><p>{{ 'disclaimer.s6Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s7Title' | translate }}</h2><p>{{ 'disclaimer.s7Body' | translate }}</p></section>
        <section><h2>{{ 'disclaimer.s8Title' | translate }}</h2><p>{{ 'disclaimer.s8Body' | translate }}</p></section>
        <!-- TODO: Add regulatory status statement here once confirmed (e.g. "Planck Software is / is not a regulated financial advisor…"). Do NOT publish placeholder language — the founder will draft this section. -->
      </div>
    </div>
  `,
  styles: [
    `
      .legal-page { min-height: 100vh; padding: 5.8rem 1rem 2rem; display: flex; justify-content: center; background: radial-gradient(900px 440px at 50% -10%, rgba(0, 209, 122, 0.12), transparent 66%), linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%); }
      .legal-card { width: min(920px, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 1.4rem; }
      .legal-card h1 { margin: 0; color: var(--text-primary); font-size: 2rem; letter-spacing: -0.02em; }
      .legal-card h2 { margin: 0 0 0.45rem; color: var(--text-primary); font-size: 1.1rem; }
      .legal-card p { margin: 0; color: var(--text-secondary); line-height: 1.65; }
      .legal-card section { margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.85rem; }
      .legal-top { display: flex; justify-content: space-between; align-items: center; gap: 0.7rem; margin-bottom: 1rem; }
      .legal-links { display: flex; gap: 0.7rem; align-items: center; }
      .back-link { border: 1px solid var(--border); border-radius: 999px; padding: 0.35rem 0.8rem; color: var(--text-primary); text-decoration: none; font-size: 0.84rem; font-weight: 600; }
      .back-link:hover { border-color: rgba(0, 209, 122, 0.45); color: var(--accent); }
      .close-btn { width: 2rem; height: 2rem; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--text-primary); font-size: 0.95rem; font-weight: 700; line-height: 1; cursor: pointer; }
      .close-btn:hover { border-color: rgba(0, 209, 122, 0.45); color: var(--accent); }
      .meta { margin-top: 0.45rem !important; color: var(--text-muted) !important; font-size: 0.9rem; }
      @media (max-width: 720px) { .legal-card { padding: 1rem; } .legal-card h1 { font-size: 1.6rem; } }
    `,
  ],
})
export class DisclaimerPage extends LocalizedLinks {
  constructor(private readonly location: Location) {
    super();
  }

  close(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    window.location.assign('/');
  }
}
