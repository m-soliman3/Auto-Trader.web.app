import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="legal-page">
      <div class="legal-card">
        <div class="legal-top">
          <a routerLink="/" class="back-link">Home</a>
          <a routerLink="/contact" class="back-link">Contact</a>
        </div>

        <h1>Privacy Policy</h1>
        <p class="meta">Effective date: 13 March 2026</p>

        <section><h2>1. Overview</h2><p>This Privacy Policy explains how auto-Trading collects, uses, stores, and protects your personal data when you use the app and website.</p></section>
        <section><h2>2. Data We Collect</h2><ul><li>Account data such as name, email, and authentication identifiers.</li><li>App usage data including preferences, bot configurations, and strategy settings.</li><li>Technical diagnostics such as device/browser details and error logs.</li><li>Support messages submitted through contact channels.</li></ul></section>
        <section><h2>3. How We Use Data</h2><ul><li>Provide and operate core platform features.</li><li>Authenticate users and secure accounts.</li><li>Store and sync settings, bots, and strategies.</li><li>Improve reliability and product quality.</li><li>Respond to support requests.</li></ul></section>
        <section><h2>4. API Credentials and Sensitive Information</h2><p>Exchange API keys are used only to enable connected trading functionality. You are responsible for safe key permission scope and key rotation.</p></section>
        <section><h2>5. Sharing and Processors</h2><p>We may use infrastructure and support providers to deliver the service. We do not sell your personal data.</p></section>
        <section><h2>6. Data Retention</h2><p>Data is retained only as long as required for service operation, legal compliance, dispute handling, and security needs.</p></section>
        <section><h2>7. Your Rights</h2><p>Depending on your jurisdiction, you may request access, correction, deletion, restriction, objection, or portability of your personal data.</p></section>
        <section><h2>8. Security</h2><p>We apply reasonable technical and organizational safeguards, but no internet-based system can be guaranteed fully secure.</p></section>
        <section><h2>9. Policy Updates</h2><p>We may update this policy periodically. Material changes are reflected by an updated effective date.</p></section>
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
      .legal-top { display: flex; gap: 0.7rem; margin-bottom: 1rem; }
      .back-link { border: 1px solid var(--border); border-radius: 999px; padding: 0.35rem 0.8rem; color: var(--text-primary); text-decoration: none; font-size: 0.84rem; font-weight: 600; }
      .back-link:hover { border-color: rgba(0, 209, 122, 0.45); color: var(--accent); }
      .meta { margin-top: 0.45rem !important; color: var(--text-muted) !important; font-size: 0.9rem; }
      @media (max-width: 720px) { .legal-card { padding: 1rem; } .legal-card h1 { font-size: 1.6rem; } }
    `,
  ],
})
export class PrivacyPage {}
