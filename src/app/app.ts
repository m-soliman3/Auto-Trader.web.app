import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { AccountModeService } from './services/account-mode.service';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { AiChatRibbon } from './components/ai-chat-ribbon';
import { ScrollMemoryService } from './services/scroll-memory.service';
import { SiteFooter } from './components/site-footer';
import { ConsentBannerComponent } from './components/consent-banner';
import { LanguageService } from './services/language.service';
import { HreflangService } from './services/hreflang.service';
import { UsageAnalyticsService } from './services/usage-analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, AiChatRibbon, SiteFooter, ConsentBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly accountMode = inject(AccountModeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly scrollMemory = inject(ScrollMemoryService);
  // Eagerly inject LanguageService so it initialises i18n and sets dir/lang on startup
  private readonly language = inject(LanguageService);
  // Eagerly inject HreflangService so it manages hreflang/canonical tags from startup
  private readonly hreflang = inject(HreflangService);
  // Eagerly inject analytics so user usage tracking starts at app boot.
  private readonly usageAnalytics = inject(UsageAnalyticsService);

  private readonly currentUrl = signal(this.router.url);

  showAssistantRibbon = computed(() => {
    const url = this.currentUrl();

    if (!this.auth.isLoggedIn()) {
      return url === '/' || url.startsWith('/login') || url.startsWith('/signup') || url.startsWith('/contact');
    }

    return url.startsWith('/dashboard') || url.startsWith('/settings') || url === '/';
  });

  constructor() {
    void this.accountMode;
    void this.scrollMemory;
    void this.language;
    void this.hreflang;
    void this.usageAnalytics;

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.currentUrl.set(this.router.url));
  }
}
