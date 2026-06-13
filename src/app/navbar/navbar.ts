import { Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { AccountModeService, AccountMode } from '../services/account-mode.service';
import { LanguageService } from '../services/language.service';
import { UiPolicyService } from '../services/ui-policy.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { RealMoneyOnboardingService } from '../services/real-money-onboarding.service';
import { TourService } from '../services/tour.service';

@Component({
  selector: 'app-navbar',
  host: {
    '(window:scroll)': 'onScroll()'
  },
  imports: [RouterLink, RouterLinkActive, CommonModule, TranslateModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  accountMode = inject(AccountModeService);
  languageService = inject(LanguageService);
  uiPolicy = inject(UiPolicyService);
  realMoneyOnboarding = inject(RealMoneyOnboardingService);
  tourService = inject(TourService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly destroyRef = inject(DestroyRef);
  scrolled = signal(false);
  menuOpen = signal(false);
  userMenuOpen = signal(false);
  langMenuOpen = signal(false);
  dashboardLink = signal('/dashboard/real');
  currentUrl = signal(this.router.url);
  showThemeToggle = computed(() => this.auth.currentUser() === null);
  showAccountModeSwitch = computed(() => {
    return this.auth.currentUser() !== null && !this.hasPrimarySegment('settings');
  });
  showQuickGuide = computed(() => {
    return this.auth.currentUser() !== null && this.currentUrl().includes('/dashboard');
  });

  constructor() {
    effect(() => {
      if (!this.uiPolicy.canChangeLanguage()) {
        this.closeLangMenu();
      }
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.updateDashboardLink();
        this.closeMenu();
        this.closeUserMenu();
        this.closeLangMenu();
      });

    this.updateDashboardLink();
  }

  onScroll() {
    this.scrolled.set(window.scrollY > 20);
  }

  setMode(mode: AccountMode) {
    this.accountMode.setMode(mode);
    this.updateDashboardLink();

    if (this.hasPrimarySegment('dashboard')) {
      void this.router.navigate(this.localizedLink('dashboard', mode));
    }
  }

  toggleMenu() {
    this.closeUserMenu();
    this.closeLangMenu();
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  homeLink(): string[] {
    return this.localizedLink();
  }

  localizedLink(...segments: string[]): string[] {
    return ['/', this.languageService.currentLang(), ...segments];
  }

  onLogoClick(event?: Event) {
    if (this.auth.isLoggedIn()) {
      this.closeMenu();
      return;
    }

    this.onHomeClick(event);
  }

  onHomeClick(event?: Event) {
    this.closeMenu();

    if (!this.isHomeRoute()) {
      return;
    }

    event?.preventDefault();
    this.router
      .navigate([], { fragment: undefined })
      .then(() => queueMicrotask(() => this.viewportScroller.scrollToPosition([0, 0])));
  }

  onSectionClick(fragment: string, event: Event) {
    this.closeMenu();

    if (!this.isHomeRoute()) {
      return;
    }

    event.preventDefault();
    this.router
      .navigate([], { fragment })
      .then(() => queueMicrotask(() => this.viewportScroller.scrollToAnchor(fragment)));
  }

  toggleUserMenu() {
    this.closeMenu();
    this.closeLangMenu();
    this.userMenuOpen.update(v => !v);
  }

  closeUserMenu() {
    this.userMenuOpen.set(false);
  }

  toggleLangMenu() {
    this.closeMenu();
    this.closeUserMenu();
    this.langMenuOpen.update(v => !v);
  }

  closeLangMenu() {
    this.langMenuOpen.set(false);
  }

  selectLanguage(code: string) {
    this.languageService.setLanguage(code);
    this.closeLangMenu();
  }

  linkForLanguage(code: string): string[] {
    const parsed = this.router.parseUrl(this.currentUrl());
    const primary = parsed.root.children['primary'];
    const segments = primary?.segments.map(s => s.path) ?? [];
    const hasLangPrefix = segments.length > 0 &&
      this.languageService.languages.some(l => l.code === segments[0]);
    const restSegments = hasLangPrefix ? segments.slice(1) : segments;
    return ['/', code, ...restSegments];
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickTarget = event.target;
    if (!(clickTarget instanceof Node)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(clickTarget)) {
      this.closeMenu();
      this.closeUserMenu();
      this.closeLangMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.closeMenu();
    this.closeUserMenu();
    this.closeLangMenu();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.closeMenu();
    this.closeUserMenu();
    this.closeLangMenu();
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  private updateDashboardLink() {
    this.dashboardLink.set(this.router.serializeUrl(this.router.createUrlTree(this.localizedLink('dashboard', this.accountMode.mode()))));
  }

  private isHomeRoute(): boolean {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const primarySegments = urlTree.root.children['primary']?.segments ?? [];
    const normalizedPath = `/${primarySegments.map((segment) => segment.path).join('/')}`;
    const localizedHomePath = `/${this.languageService.currentLang()}`;

    return normalizedPath === '/' || normalizedPath === localizedHomePath;
  }

  private hasPrimarySegment(segment: string): boolean {
    const urlTree = this.router.parseUrl(this.currentUrl());
    const primarySegments = urlTree.root.children['primary']?.segments ?? [];
    return primarySegments.some((urlSegment) => urlSegment.path === segment);
  }
}
