import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { AccountModeService } from './services/account-mode.service';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { AiChatRibbon } from './components/ai-chat-ribbon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, AiChatRibbon],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly accountMode = inject(AccountModeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.currentUrl.set(this.router.url));
  }
}
