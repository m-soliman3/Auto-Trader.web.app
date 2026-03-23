import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-page',
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

        <h1>Privacy Policy</h1>
        <p class="meta">Effective date: 22 March 2026 | Last Updated: 22 March 2026</p>

        <section><h2>1. Introduction</h2><p>Auto-Trading ("Company", "we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services, in compliance with the General Data Protection Regulation (GDPR) and other applicable privacy laws.</p></section>

        <section><h2>2. Information We Collect</h2>
        <p><strong>Personal Data:</strong></p>
        <ul><li>Account information (name, email, phone number, country)</li><li>Authentication data and login credentials</li><li>Trading preferences and bot configurations</li><li>Strategy settings and execution history</li><li>Connected exchange API information (stored securely)</li></ul>
        <p><strong>Usage Data:</strong></p>
        <ul><li>Browser type, IP address, and device information</li><li>Pages visited and time spent on pages</li><li>User interactions and feature usage patterns</li><li>Error logs and technical diagnostics</li></ul>
        <p><strong>Cookies and Tracking Technologies:</strong></p>
        <ul><li>Session cookies for authentication</li><li>Preference cookies to remember your settings</li><li>Analytics cookies via Google Analytics and Google Tag Manager</li><li>Marketing cookies to analyze campaign performance</li></ul>
        <p><strong>Support Data:</strong></p>
        <ul><li>Messages submitted through contact forms</li><li>Support tickets and communications</li></ul>
        </section>

        <section><h2>3. Legal Basis for Processing (GDPR)</h2>
        <p>We process your personal data based on:</p>
        <ul><li><strong>Consent:</strong> You have explicitly consented to our data collection and use</li><li><strong>Contract:</strong> Processing is necessary to provide our services to you</li><li><strong>Legal Obligation:</strong> Processing is required by applicable laws and regulations</li><li><strong>Legitimate Interests:</strong> Processing is necessary for our legitimate business interests, such as improving service quality</li></ul>
        </section>

        <section><h2>4. How We Use Your Data</h2>
        <ul><li>Provide, maintain, and improve our trading platform</li><li>Authenticate users and secure accounts</li><li>Store and sync your trading bots, strategies, and configurations</li><li>Analyze platform usage to enhance user experience</li><li>Send service updates and support communications</li><li>Comply with legal and regulatory requirements</li><li>Detect and prevent fraud or security issues</li></ul>
        </section>

        <section><h2>5. Third-Party Integrations</h2>
        <ul><li><strong>Google Analytics & Google Tag Manager:</strong> For tracking website usage and user behavior</li><li><strong>Firebase:</strong> For hosting, authentication, and real-time database services</li><li><strong>Exchange APIs:</strong> Your API keys are used solely for trading execution</li></ul>
        <p>We only share the minimum data necessary with these services and maintain data processor agreements in compliance with GDPR Article 28.</p>
        </section>

        <section><h2>6. Your Rights Under GDPR</h2>
        <p>As an EU resident, you have the following rights:</p>
        <ul><li><strong>Right of Access:</strong> Request a copy of your personal data</li><li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li><li><strong>Right to Erasure (Right to be Forgotten):</strong> Request deletion of your data</li><li><strong>Right to Restrict Processing:</strong> Limit how we process your data</li><li><strong>Right to Data Portability:</strong> Receive your data in a portable format</li><li><strong>Right to Object:</strong> Oppose our processing of your data</li><li><strong>Right to Withdraw Consent:</strong> Withdraw consent without affecting prior processing</li></ul>
        <p>To exercise these rights, contact us at support@auto-trading.app</p>
        </section>

        <section><h2>7. Data Security</h2>
        <p>We implement industry-standard security measures including encryption, secure authentication, and regular security audits. However, no online transmission is completely secure, and we cannot guarantee absolute security.</p>
        </section>

        <section><h2>8. Data Retention</h2>
        <p>We retain your personal data for as long as necessary to provide our services, comply with legal obligations, and resolve disputes. You can request deletion at any time, except where legal obligations require retention.</p>
        </section>

        <section><h2>9. API Credentials and Sensitive Information</h2>
        <p>Exchange API keys are encrypted and used only to enable trading functionality. You are responsible for maintaining the security of your API keys and setting appropriate permission scopes. We recommend regular key rotation.</p>
        </section>

        <section><h2>10. Cookies and Consent</h2>
        <p>When you first visit our website, you will see a consent banner asking for your permission to use cookies and analytics. You can manage your preferences at any time. If you decline analytics cookies, Google Tag Manager will not collect your data.</p>
        </section>

        <section><h2>11. International Data Transfers</h2>
        <p>Your data may be transferred to and processed in countries outside the EU. We ensure appropriate safeguards are in place for international transfers, including Standard Contractual Clauses.</p>
        </section>

        <section><h2>12. Changes to This Policy</h2>
        <p>We may update this policy periodically. Material changes will be communicated to you via email, and the updated effective date will be reflected on this page. Your continued use of our services constitutes acceptance of the updated policy.</p>
        </section>

        <section><h2>13. Contact Information</h2>
        <p><strong>Data Controller:</strong> Auto-Trading<br>
        <strong>Email:</strong> support@auto-trading.app<br>
        <strong>Website:</strong> https://auto-trading.app<br>
        <strong>For complaints:</strong> You have the right to lodge a complaint with your local data protection authority.</p>
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
export class PrivacyPage {
  constructor(private readonly location: Location) {}

  close(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    window.location.assign('/');
  }
}
