import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, TranslateModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  languageService = inject(LanguageService);

  t(key: string, fallback: string): string {
    const value = this.translate.instant(key);
    return !value || value === key ? fallback : value;
  }

  /** Sends logged-in users straight to the dashboard */
  goToCta() {
    this.router.navigate([this.auth.isLoggedIn() ? '/dashboard' : '/signup']);
  }

  stats = [
    { value: '125K+', labelKey: 'home.stats.activeTraders' },
    { value: '$4.2B', labelKey: 'home.stats.volumeTraded' },
    { value: '99.9%', labelKey: 'home.stats.uptime' },
    { value: '38%', labelKey: 'home.stats.avgReturn' },
  ];

  features = [
    { icon: '⚡', titleKey: 'home.features.aiSignals.title', descKey: 'home.features.aiSignals.desc', slug: 'ai-signals' },
    { icon: '🔗', titleKey: 'home.features.multiExchange.title', descKey: 'home.features.multiExchange.desc', slug: 'multi-exchange' },
    { icon: '🛡️', titleKey: 'home.features.riskManagement.title', descKey: 'home.features.riskManagement.desc', slug: 'risk-management' },
    { icon: '📊', titleKey: 'home.features.backtesting.title', descKey: 'home.features.backtesting.desc', slug: 'backtesting' },
    { icon: '🔔', titleKey: 'home.features.smartAlerts.title', descKey: 'home.features.smartAlerts.desc', slug: 'smart-alerts' },
    { icon: '🌐', titleKey: 'home.features.noCode.title', descKey: 'home.features.noCode.desc', slug: 'no-code-builder' },
  ];

  steps = [
    { num: '01', titleKey: 'home.steps.step1.title', descKey: 'home.steps.step1.desc' },
    { num: '02', titleKey: 'home.steps.step2.title', descKey: 'home.steps.step2.desc' },
    { num: '03', titleKey: 'home.steps.step3.title', descKey: 'home.steps.step3.desc' },
  ];
}
