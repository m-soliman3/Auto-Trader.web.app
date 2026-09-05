import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <footer class="site-footer" aria-label="Site footer">
      <div class="footer-container">
        <div class="footer-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#00d17a"/>
            <polyline points="4,22 10,14 16,18 22,8 28,12" stroke="#0d0f14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span>auto-Trading</span>
        </div>

        <p class="footer-copy">{{ 'footer.copyright' | translate }}</p>

        <div class="footer-links">
          <a [routerLink]="localizedLink('privacy')" [attr.href]="localizedHref('privacy')">{{ 'footer.privacy' | translate }}</a>
          <a [routerLink]="localizedLink('terms')" [attr.href]="localizedHref('terms')">{{ 'footer.terms' | translate }}</a>
          <a [routerLink]="localizedLink('disclaimer')" [attr.href]="localizedHref('disclaimer')">{{ 'footer.disclaimer' | translate }}</a>
          <a [routerLink]="localizedLink('collecting-data')" [attr.href]="localizedHref('collecting-data')">{{ 'footer.collectingData' | translate }}</a>
          <a [routerLink]="localizedLink('contact')" [attr.href]="localizedHref('contact')">{{ 'footer.contact' | translate }}</a>
          <a [routerLink]="localizedLink('knowledge-base')" [attr.href]="localizedHref('knowledge-base')">{{ 'footer.knowledgeBase' | translate }}</a>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .site-footer {
        background: var(--surface);
        border-top: 1px solid var(--border);
        padding: 2rem 1rem;
      }

      .footer-container {
        max-width: 1480px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .footer-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 700;
        font-size: 1rem;
        color: var(--text-primary);
      }

      .footer-copy {
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin: 0;
      }

      .footer-links {
        display: flex;
        gap: 1.5rem;
      }

      .footer-links a {
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.85rem;
      }

      .footer-links a:hover {
        color: var(--accent);
      }

      @media (max-width: 600px) {
        .site-footer {
          padding: 1.2rem 0.8rem;
        }

        .footer-container {
          flex-direction: column;
          text-align: center;
        }

        .footer-links {
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }
      }
    `,
  ],
})
export class SiteFooter {
  private readonly languageService = inject(LanguageService);

  /**
   * Footer links must carry the active locale prefix. An unprefixed `/privacy`
   * bypasses `languagePrefixMatcher`, falls through Hosting's `**` rewrite to the
   * CSR shell, and is indexed with the site-wide default meta description — which
   * is what made these pages show up as duplicates in Bing's report.
   */
  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  localizedHref(...segments: string[]): string {
    return `/${[this.languageService.currentLang(), ...segments].join('/')}`;
  }
}
