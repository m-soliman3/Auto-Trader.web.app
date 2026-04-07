import { Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { AccountModeService, AccountMode } from '../services/account-mode.service';
import { LanguageService } from '../services/language.service';
import { UiPolicyService } from '../services/ui-policy.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';

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
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  scrolled = signal(false);
  menuOpen = signal(false);
  userMenuOpen = signal(false);
  langMenuOpen = signal(false);
  dashboardLink = signal('/dashboard/real');
  currentUrl = signal(this.router.url);
  showThemeToggle = computed(() => this.currentUrl().startsWith('/settings'));
  showAccountModeSwitch = computed(() => {
    return this.auth.currentUser() !== null && !this.currentUrl().startsWith('/settings');
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

    if (this.router.url.startsWith('/dashboard')) {
      void this.router.navigate(['/dashboard', mode]);
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
    this.dashboardLink.set(`/dashboard/${this.accountMode.mode()}`);
  }
}
