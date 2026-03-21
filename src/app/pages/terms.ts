import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="legal-page">
      <div class="legal-card">
        <div class="legal-top">
          <div class="legal-links">
            <a routerLink="/" class="back-link">Home</a>
            <a routerLink="/contact" class="back-link">Contact</a>
          </div>
          <button type="button" class="close-btn" aria-label="Close" (click)="close()">X</button>
        </div>

        <h1>Terms of Service</h1>
        <p class="meta">Effective date: 13 March 2026</p>

        <section><h2>1. Acceptance of Terms</h2><p>By creating an account or using auto-Trading, you agree to these Terms of Service. If you do not agree, do not use the platform.</p></section>
        <section><h2>2. Eligibility and Account Responsibility</h2><p>You must be legally able to enter contracts in your jurisdiction. You are responsible for account security, API keys, and connected exchange or broker credentials.</p></section>
        <section><h2>3. Platform Scope</h2><p>auto-Trading provides software tools for strategy automation and market workflows. We do not act as your broker, exchange, custodian, or financial adviser.</p></section>
        <section><h2>4. Risk and User Decisions</h2><p>Trading involves substantial risk and can result in partial or total loss of capital. You are solely responsible for all configuration and trading decisions.</p></section>
        <section><h2>5. No Investment Advice</h2><p>Indicators, templates, analytics, and educational material are informational only and do not constitute financial, legal, or tax advice.</p></section>
        <section><h2>6. Availability and Service Changes</h2><p>We may update, suspend, or discontinue features at any time and do not guarantee uninterrupted uptime, execution timing, or third-party API availability.</p></section>
        <section><h2>7. Fees and Plans</h2><p>Feature limits and plan pricing are shown in-app and may change over time. Unless required by law, fees already charged are non-refundable.</p></section>
        <section><h2>8. Prohibited Use</h2><p>You may not use the platform for unlawful activity, unauthorized access, abuse of APIs, reverse engineering, or security-compromising behavior.</p></section>
        <section><h2>9. Limitation of Liability</h2><p>To the maximum extent permitted by law, auto-Trading is not liable for indirect or consequential losses, including trading losses, data loss, or business interruption.</p></section>
        <section><h2>10. Termination</h2><p>We may suspend or terminate access for Terms violations or security reasons. You may stop using the service at any time.</p></section>
        <section><h2>11. Changes to These Terms</h2><p>We may update these Terms periodically. Continued use after updates means you accept the revised Terms.</p></section>
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
export class TermsPage {
  constructor(private readonly location: Location) {}

  close(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    window.location.assign('/');
  }
}
