import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { AccountModeService, AccountMode } from '../services/account-mode.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  host: {
    '(window:scroll)': 'onScroll()'
  },
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  accountMode = inject(AccountModeService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  scrolled = signal(false);
  menuOpen = signal(false);
  userMenuOpen = signal(false);
  dashboardLink = signal('/dashboard/real');
  currentUrl = signal(this.router.url);
  showAccountModeSwitch = computed(() => {
    return this.auth.currentUser() !== null && !this.currentUrl().startsWith('/settings');
  });

  constructor() {
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
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  toggleUserMenu() {
    this.closeMenu();
    this.userMenuOpen.update(v => !v);
  }

  closeUserMenu() {
    this.userMenuOpen.set(false);
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
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.closeMenu();
    this.closeUserMenu();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.closeMenu();
    this.closeUserMenu();
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  private updateDashboardLink() {
    this.dashboardLink.set(`/dashboard/${this.accountMode.mode()}`);
  }
}
