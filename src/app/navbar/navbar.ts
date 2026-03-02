import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { AccountModeService, AccountMode } from '../services/account-mode.service';

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
  scrolled = signal(false);
  menuOpen = signal(false);

  onScroll() {
    this.scrolled.set(window.scrollY > 20);
  }

  setMode(mode: AccountMode) {
    this.accountMode.setMode(mode);
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  initials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }
}
