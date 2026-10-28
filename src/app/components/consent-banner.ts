import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedLinks } from '../shared/localized-links';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <!-- Blocks the page until the visitor accepts or declines; styles.scss also locks scrolling. -->
    <div class="consent-backdrop" *ngIf="showBanner" aria-hidden="true"></div>

    <div class="consent-overlay" *ngIf="showBanner" [class.is-expanded]="isExpanded"
         role="dialog" aria-modal="true" [attr.aria-label]="'consent.title' | translate">
      <!-- Collapsed bar -->
      <div class="consent-bar" *ngIf="!isExpanded">
        <div class="consent-bar-copy">
          <strong class="consent-bar-title">{{ 'consent.title' | translate }}</strong>
          <span class="consent-bar-text">{{ 'consent.description' | translate }}</span>
        </div>
        <div class="consent-bar-actions">
          <button class="consent-btn consent-btn-decline" (click)="handleDecline()">
            {{ 'consent.declineAll' | translate }}
          </button>
          <button class="consent-btn consent-btn-accept" (click)="handleAccept()">
            {{ 'consent.acceptAll' | translate }}
          </button>
          <button class="consent-expand-btn" (click)="toggleExpand()" [attr.aria-label]="'consent.expandDetails' | translate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- Expanded full view -->
      <div class="consent-banner" *ngIf="isExpanded">
        <div class="consent-collapse-row">
          <button class="consent-expand-btn consent-collapse-btn" (click)="toggleExpand()" [attr.aria-label]="'consent.collapseDetails' | translate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
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
                <p>{{ 'consent.moreInfoText' | translate }} <a [routerLink]="localizedLink('privacy')" [attr.href]="localizedHref('privacy')" class="consent-link">{{ 'consent.privacyPolicyLink' | translate }}</a>.</p>
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
    /* Both sit above the fixed navbar (z-index 10000) so nothing on the page stays clickable. */
    .consent-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(5, 7, 12, 0.6);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      animation: fadeIn 0.3s ease-out;
    }

    .consent-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10002;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Collapsed bar ── */
    .consent-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 20px max(24px, calc((100% - 1200px) / 2));
      background: var(--surface, #161a24);
      border-top: 3px solid var(--accent, #00d17a);
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
      color: var(--text-primary, #f0f2f7);
    }

    .consent-bar-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .consent-bar-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary, #f0f2f7);
    }

    .consent-bar-text {
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-secondary, #8b95a9);
    }

    .consent-bar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .consent-expand-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      border-radius: 6px;
      background: var(--surface-raised, #1e2330);
      color: var(--text-secondary, #8b95a9);
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .consent-expand-btn:hover {
      border-color: var(--accent, #00d17a);
      color: var(--accent, #00d17a);
    }

    /* ── Expand/collapse row inside full panel ── */
    .consent-collapse-row {
      display: flex;
      justify-content: center;
      padding: 8px 0 0;
      background: var(--surface, #161a24);
    }

    .consent-collapse-btn {
      width: 40px;
      height: 24px;
      border-radius: 4px;
    }

    /* ── Expanded full panel ── */
    .consent-banner {
      background: var(--surface, #161a24);
      border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      color: var(--text-primary, #f0f2f7);
      max-height: 50vh;
      overflow-y: auto;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
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
      padding: 24px 32px 32px;
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

    /* Declining has to be as easy to see as accepting, so this is outlined, not muted. */
    .consent-btn-decline {
      background: transparent;
      border: 1px solid var(--text-secondary, #8b95a9);
      color: var(--text-primary, #f0f2f7);
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

    .consent-btn-sm {
      padding: 6px 14px;
      font-size: 11px;
    }

    @media (max-width: 640px) {
      .consent-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
        padding: 16px;
      }

      .consent-bar-title {
        font-size: 16px;
      }

      .consent-bar-text {
        font-size: 13px;
      }

      .consent-bar-actions .consent-btn {
        flex: 1;
      }

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
export class ConsentBannerComponent extends LocalizedLinks implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  showBanner: boolean = false;
  isExpanded: boolean = false;
  private readonly STORAGE_KEY = 'gtm-consent';
  private readonly COOKIE_NAME = 'gtm-consent';
  /** Accepted consent never expires; declined consent expires after this many days. */
  private readonly DECLINE_DAYS = 30;
  /** ~10 years in days — effectively permanent for accepted consent. */
  private readonly ACCEPT_DAYS = 3650;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkConsent();
    }
  }

  checkConsent(): void {
    // Check localStorage first (most reliable), then fall back to cookie.
    const stored = this.readStorage();
    this.showBanner = stored === null;
  }

  handleAccept(): void {
    this.writeStorage('accepted');
    this.setCookie(this.COOKIE_NAME, 'accepted', this.ACCEPT_DAYS);
    this.showBanner = false;
    this.loadGTM();
  }

  handleDecline(): void {
    this.writeStorage('declined');
    this.setCookie(this.COOKIE_NAME, 'declined', this.DECLINE_DAYS);
    this.showBanner = false;
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  /** Read consent from localStorage (primary) or cookie (fallback). */
  private readStorage(): string | null {
    try {
      const ls = localStorage.getItem(this.STORAGE_KEY);
      if (ls !== null) return ls;
    } catch (_) { /* localStorage blocked */ }
    return this.getCookie(this.COOKIE_NAME);
  }

  /** Persist consent to localStorage (primary). */
  private writeStorage(value: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, value);
    } catch (_) { /* localStorage blocked — cookie-only fallback */ }
  }

  private getCookie(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escapedName + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie =
      `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  private loadGTM(): void {
    if ((window as any).dataLayer) {
      (window as any).dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    }
  }
}
