import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-disclaimer-page',
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

        <h1>Disclaimer</h1>
        <p class="meta">Effective date: 13 March 2026</p>

        <section><h2>1. Platform Use and Responsibility</h2><p>auto-Trading is a live software platform designed for real users. You are solely responsible for how you configure and use strategies, indicators, automation rules, and account-level risk controls.</p></section>
        <section><h2>2. Not Financial Advice</h2><p>Nothing on auto-Trading constitutes investment, legal, accounting, or tax advice. Seek qualified professional guidance before making decisions.</p></section>
        <section><h2>3. No Guarantee of Results</h2><p>Past performance does not guarantee future results. Backtests, simulations, and hypothetical outcomes may differ substantially from live trading.</p></section>
        <section><h2>4. Trading Risk Warning</h2><p>Trading digital assets, equities, forex, and derivatives is high risk and may not be suitable for all users. You can lose some or all capital.</p></section>
        <section><h2>5. Third-Party Services</h2><p>The platform depends on external exchanges, brokers, data feeds, and APIs. We are not responsible for third-party outages, delays, or policy changes.</p></section>
        <section><h2>6. Execution and Connectivity</h2><p>We do not guarantee execution timing, fill prices, slippage outcomes, or uninterrupted connectivity under volatile market conditions.</p></section>
        <section><h2>7. User Responsibility</h2><p>You are fully responsible for API permissions, risk limits, strategy rules, and ongoing monitoring of your own account activity.</p></section>
        <section><h2>8. Jurisdiction and Compliance</h2><p>You are responsible for compliance with all laws and regulations applicable to your jurisdiction and trading activity.</p></section>
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
export class DisclaimerPage {
  constructor(private readonly location: Location) {}

  close(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    window.location.assign('/');
  }
}
