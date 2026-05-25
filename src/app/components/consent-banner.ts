import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="consent-overlay" *ngIf="showBanner">
      <div class="consent-banner">
        <div class="consent-content">
          <h3 class="consent-title">{{ 'consent.title' | translate }}</h3>
          <p class="consent-description">
            {{ 'consent.description' | translate }}
          </p>
          
          <div class="consent-details">
            <details class="consent-details-group">
              <summary class="consent-summary">{{ 'consent.whatDataTitle' | translate }}</summary>
              <div class="consent-details-content">
                <ul>
                  <li><strong>{{ 'consent.essentialData' | translate }}</strong> {{ 'consent.essentialDataDesc' | translate }}</li>
                  <li><strong>{{ 'consent.analyticsData' | translate }}</strong> {{ 'consent.analyticsDataDesc' | translate }}</li>
                  <li><strong>{{ 'consent.marketingData' | translate }}</strong> {{ 'consent.marketingDataDesc' | translate }}</li>
                  <li><strong>{{ 'consent.cookiesData' | translate }}</strong> {{ 'consent.cookiesDataDesc' | translate }}</li>
                </ul>
              </div>
            </details>

            <details class="consent-details-group">
              <summary class="consent-summary">{{ 'consent.yourRightsTitle' | translate }}</summary>
              <div class="consent-details-content">
                <p>{{ 'consent.yourRightsLead' | translate }}</p>
                <ul>
                  <li>{{ 'consent.rightAccess' | translate }}</li>
                  <li>{{ 'consent.rightCorrection' | translate }}</li>
                  <li>{{ 'consent.rightDeletion' | translate }}</li>
                  <li>{{ 'consent.rightObject' | translate }}</li>
                  <li>{{ 'consent.rightWithdraw' | translate }}</li>
                </ul>
                <p>{{ 'consent.moreInfoText' | translate }} <a routerLink="/privacy" class="consent-link">{{ 'consent.privacyPolicyLink' | translate }}</a>.</p>
              </div>
            </details>
          </div>

          <div class="consent-actions">
            <button class="consent-btn consent-btn-decline" (click)="handleDecline()">
              {{ 'consent.declineAll' | translate }}
            </button>
            <button class="consent-btn consent-btn-accept" (click)="handleAccept()">
              {{ 'consent.acceptAll' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .consent-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-end;
      z-index: 9999;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .consent-banner {
      background: var(--surface, #161a24);
      border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      color: var(--text-primary, #f0f2f7);
      animation: slideUp 0.3s ease-out;
      max-height: 80vh;
      overflow-y: auto;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .consent-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px;
    }

    .consent-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: var(--text-primary, #f0f2f7);
    }

    .consent-description {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-secondary, #8b95a9);
      margin: 0 0 20px 0;
    }

    .consent-details {
      margin: 20px 0;
    }

    .consent-details-group {
      margin-bottom: 12px;
      padding: 0;
    }

    .consent-summary {
      cursor: pointer;
      user-select: none;
      padding: 12px 16px;
      background: var(--surface-raised, #1e2330);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      border-radius: 6px;
      color: var(--text-primary, #f0f2f7);
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .consent-summary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--accent, #00d17a);
    }

    .consent-summary::marker {
      color: var(--accent, #00d17a);
    }

    .consent-details-content {
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-secondary, #8b95a9);
      line-height: 1.6;
    }

    .consent-details-content ul {
      list-style: none;
      padding: 0;
      margin: 8px 0;
    }

    .consent-details-content li {
      padding: 6px 0;
      margin-left: 16px;
      position: relative;
    }

    .consent-details-content li:before {
      content: "•";
      position: absolute;
      left: -12px;
      color: var(--accent, #00d17a);
    }

    .consent-details-content p {
      margin: 8px 0;
    }

    .consent-link {
      color: var(--accent, #00d17a);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s ease;
    }

    .consent-link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    .consent-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      justify-content: flex-end;
    }

    .consent-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .consent-btn-decline {
      background: transparent;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      color: var(--text-secondary, #8b95a9);
    }

    .consent-btn-decline:hover {
      border-color: var(--text-secondary, #8b95a9);
      color: var(--text-primary, #f0f2f7);
      background: rgba(255, 255, 255, 0.02);
    }

    .consent-btn-accept {
      background: var(--accent, #00d17a);
      color: var(--bg, #0d0f14);
      border: none;
    }

    .consent-btn-accept:hover {
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 209, 122, 0.3);
    }

    @media (max-width: 640px) {
      .consent-content {
        padding: 20px;
      }

      .consent-title {
        font-size: 18px;
      }

      .consent-description {
        font-size: 13px;
      }

      .consent-actions {
        flex-direction: column-reverse;
        gap: 8px;
      }

      .consent-btn {
        width: 100%;
      }
    }
  `]
})
export class ConsentBannerComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  showBanner: boolean = false;
  private readonly CONSENT_KEY = 'gtm-consent';
  private readonly CONSENT_TIMESTAMP_KEY = 'gtm-consent-timestamp';
  private readonly THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkConsent();
    }
  }

  checkConsent(): void {
    const consentGiven = localStorage.getItem(this.CONSENT_KEY);
    const consentTimestamp = localStorage.getItem(this.CONSENT_TIMESTAMP_KEY);

    if (!consentGiven) {
      // First time user - show banner
      this.showBanner = true;
    } else if (consentTimestamp) {
      // User has given consent before - check if 30 days have passed
      const lastConsentTime = parseInt(consentTimestamp, 10);
      const currentTime = new Date().getTime();
      const timeSinceLastConsent = currentTime - lastConsentTime;

      if (timeSinceLastConsent >= this.THIRTY_DAYS_MS) {
        // More than 30 days have passed - show banner again
        this.showBanner = true;
      }
    }
  }

  handleAccept(): void {
    const currentTimestamp = new Date().getTime().toString();
    localStorage.setItem(this.CONSENT_KEY, 'accepted');
    localStorage.setItem(this.CONSENT_TIMESTAMP_KEY, currentTimestamp);
    this.showBanner = false;
    // Load GTM if not already loaded
    this.loadGTM();
  }

  handleDecline(): void {
    const currentTimestamp = new Date().getTime().toString();
    localStorage.setItem(this.CONSENT_KEY, 'declined');
    localStorage.setItem(this.CONSENT_TIMESTAMP_KEY, currentTimestamp);
    this.showBanner = false;
  }

  private loadGTM(): void {
    // GTM is already in the index.html, this is just for reference
    // In a real implementation, you might conditionally load GTM based on consent
    if ((window as any).dataLayer) {
      (window as any).dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    }
  }
}
