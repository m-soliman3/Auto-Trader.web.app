import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';

@Component({
  selector: 'app-privacy-page',
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

        <h1>{{ 'privacy.title' | translate }}</h1>
        <p class="meta">{{ 'privacy.effectiveAndUpdated' | translate }}</p>

        <section><h2>{{ 'privacy.s1Title' | translate }}</h2><p>{{ 'privacy.s1Body' | translate }}</p></section>

        <section><h2>{{ 'privacy.s2Title' | translate }}</h2>
        <p><strong>{{ 'privacy.personalData' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Personal1' | translate }}</li><li>{{ 'privacy.s2Personal2' | translate }}</li><li>{{ 'privacy.s2Personal3' | translate }}</li><li>{{ 'privacy.s2Personal4' | translate }}</li><li>{{ 'privacy.s2Personal5' | translate }}</li></ul>
        <p><strong>{{ 'privacy.usageData' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Usage1' | translate }}</li><li>{{ 'privacy.s2Usage2' | translate }}</li><li>{{ 'privacy.s2Usage3' | translate }}</li><li>{{ 'privacy.s2Usage4' | translate }}</li></ul>
        <p><strong>{{ 'privacy.cookiesAndTracking' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Cookie1' | translate }}</li><li>{{ 'privacy.s2Cookie2' | translate }}</li><li>{{ 'privacy.s2Cookie3' | translate }}</li><li>{{ 'privacy.s2Cookie4' | translate }}</li></ul>
        <p><strong>{{ 'privacy.supportData' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Support1' | translate }}</li><li>{{ 'privacy.s2Support2' | translate }}</li></ul>
        <p><strong>{{ 'privacy.billingData' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Billing1' | translate }}</li><li>{{ 'privacy.s2Billing2' | translate }}</li><li>{{ 'privacy.s2Billing3' | translate }}</li></ul>
        <p><strong>{{ 'privacy.assistantData' | translate }}</strong></p>
        <ul><li>{{ 'privacy.s2Assistant1' | translate }}</li><li>{{ 'privacy.s2Assistant2' | translate }}</li></ul>
        </section>

        <section><h2>{{ 'privacy.s3Title' | translate }}</h2>
        <p>{{ 'privacy.s3Lead' | translate }}</p>
        <ul><li><strong>{{ 'privacy.consent' | translate }}</strong> {{ 'privacy.s3Consent' | translate }}</li><li><strong>{{ 'privacy.contract' | translate }}</strong> {{ 'privacy.s3Contract' | translate }}</li><li><strong>{{ 'privacy.legalObligation' | translate }}</strong> {{ 'privacy.s3Legal' | translate }}</li><li><strong>{{ 'privacy.legitimateInterests' | translate }}</strong> {{ 'privacy.s3Legitimate' | translate }}</li></ul>
        </section>

        <section><h2>{{ 'privacy.s4Title' | translate }}</h2>
        <ul><li>{{ 'privacy.s4Item1' | translate }}</li><li>{{ 'privacy.s4Item2' | translate }}</li><li>{{ 'privacy.s4Item3' | translate }}</li><li>{{ 'privacy.s4Item4' | translate }}</li><li>{{ 'privacy.s4Item5' | translate }}</li><li>{{ 'privacy.s4Item6' | translate }}</li><li>{{ 'privacy.s4Item7' | translate }}</li></ul>
        </section>

        <section><h2>{{ 'privacy.s5Title' | translate }}</h2>
        <ul><li><strong>{{ 'privacy.googleAnalyticsTagManager' | translate }}</strong> {{ 'privacy.s5Item1' | translate }}</li><li><strong>{{ 'privacy.firebase' | translate }}</strong> {{ 'privacy.s5Item2' | translate }}</li><li><strong>{{ 'privacy.exchangeApis' | translate }}</strong> {{ 'privacy.s5Item3' | translate }}</li><li><strong>{{ 'privacy.paymentProcessors' | translate }}</strong> {{ 'privacy.s5Item4' | translate }}</li><li><strong>{{ 'privacy.analyticsProviders' | translate }}</strong> {{ 'privacy.s5Item5' | translate }}</li><li><strong>{{ 'privacy.aiProviders' | translate }}</strong> {{ 'privacy.s5Item6' | translate }}</li><li><strong>{{ 'privacy.affiliatePartners' | translate }}</strong> {{ 'privacy.s5Item7' | translate }}</li></ul>
        <p>{{ 'privacy.s5Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s6Title' | translate }}</h2>
        <p>{{ 'privacy.s6Lead' | translate }}</p>
        <ul><li><strong>{{ 'privacy.rightOfAccess' | translate }}</strong> {{ 'privacy.s6Item1' | translate }}</li><li><strong>{{ 'privacy.rightToRectification' | translate }}</strong> {{ 'privacy.s6Item2' | translate }}</li><li><strong>{{ 'privacy.rightToErasure' | translate }}</strong> {{ 'privacy.s6Item3' | translate }}</li><li><strong>{{ 'privacy.rightToRestrict' | translate }}</strong> {{ 'privacy.s6Item4' | translate }}</li><li><strong>{{ 'privacy.rightToPortability' | translate }}</strong> {{ 'privacy.s6Item5' | translate }}</li><li><strong>{{ 'privacy.rightToObject' | translate }}</strong> {{ 'privacy.s6Item6' | translate }}</li><li><strong>{{ 'privacy.rightToWithdraw' | translate }}</strong> {{ 'privacy.s6Item7' | translate }}</li></ul>
        <p>{{ 'privacy.s6Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s7Title' | translate }}</h2>
        <p>{{ 'privacy.s7Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s8Title' | translate }}</h2>
        <p>{{ 'privacy.s8Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s9Title' | translate }}</h2>
        <p>{{ 'privacy.s9Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s10Title' | translate }}</h2>
        <p>{{ 'privacy.s10Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s11Title' | translate }}</h2>
        <p>{{ 'privacy.s11Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s12Title' | translate }}</h2>
        <p>{{ 'privacy.s12Body' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.s13Title' | translate }}</h2>
        <p><strong>{{ 'privacy.dataController' | translate }}</strong> Planck Software<br>
        <strong>{{ 'privacy.email' | translate }}</strong> <a href="mailto:founder@invest-begin.com">founder&#64;invest-begin.com</a><br>
        <strong>{{ 'privacy.website' | translate }}</strong> www.invest-begin.com<br>
        <strong>{{ 'privacy.forComplaints' | translate }}</strong> {{ 'privacy.s13ComplaintsBody' | translate }}</p>
        </section>

        <section><h2>{{ 'privacy.odrTitle' | translate }}</h2>
        <p>{{ 'privacy.odrBody' | translate }}</p>
        <p><a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">{{ 'privacy.odrLinkText' | translate }}</a></p>
        </section>
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
      .legal-card ul { margin: 0.45rem 0 0; padding-left: 1.1rem; color: var(--text-secondary); display: grid; gap: 0.28rem; }
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
export class PrivacyPage extends LocalizedLinks {
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
