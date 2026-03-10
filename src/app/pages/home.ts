import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  private auth   = inject(AuthService);
  private router = inject(Router);

  /** Sends logged-in users straight to the dashboard */
  goToCta() {
    this.router.navigate([this.auth.isLoggedIn() ? '/dashboard' : '/signup']);
  }
  stats = [
    { value: '125K+', label: 'Active Traders' },
    { value: '$4.2B', label: 'Volume Traded' },
    { value: '99.9%', label: 'Uptime' },
    { value: '38%', label: 'Avg. Annual Return' },
  ];

  features = [
    {
      icon: '⚡',
      title: 'AI-Powered Signals',
      desc: 'Machine-learning models scan thousands of assets in real time and surface high-probability trade setups automatically.'
    },
    {
      icon: '🔗',
      title: 'Multi-Exchange Support',
      desc: 'Connect Binance, Coinbase, Kraken, Bybit, and 30+ more exchanges through a single unified API.'
    },
    {
      icon: '🛡️',
      title: 'Risk Management',
      desc: 'Customisable stop-loss, take-profit, position sizing, and portfolio exposure limits protect your capital 24/7.'
    },
    {
      icon: '📊',
      title: 'Advanced Backtesting',
      desc: 'Test your strategies against years of tick-level historical data before committing a single dollar to live trading.'
    },
    {
      icon: '🔔',
      title: 'Smart Alerts',
      desc: 'Get real-time push, email, or Telegram notifications when conditions are met, trades execute, or drawdown limits trip.'
    },
    {
      icon: '🌐',
      title: 'No-Code Builder',
      desc: 'Drag-and-drop strategy builder lets you automate complex logic without writing a single line of code.'
    },
  ];

  steps = [
    { num: '01', title: 'Connect Your Exchange', desc: 'Link your exchange account via API keys in under 2 minutes. Your funds stay safely on the exchange at all times.' },
    { num: '02', title: 'Choose or Build a Bot', desc: 'Pick from a library of proven strategies or craft your own logic with our intuitive no-code builder.' },
    { num: '03', title: 'Let It Trade for You', desc: 'Sit back while auto-Trading monitors markets around the clock, executing trades and managing risk automatically.' },
  ];

}
