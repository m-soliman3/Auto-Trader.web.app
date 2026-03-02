import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StrategyService, StrategyTemplate } from '../services/strategy.service';
import { ExchangeService, SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { AccountModeService } from '../services/account-mode.service';

@Component({
  selector: 'app-browse-strategies-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './browse-strategies-modal.html',
  styleUrl: './browse-strategies-modal.scss',
})
export class BrowseStrategiesModal {
  private strategyService = inject(StrategyService);
  private exchangeService = inject(ExchangeService);
  private accountMode = inject(AccountModeService);

  closed   = output<void>();
  selected = output<StrategyTemplate>();

  // ── Filters ──────────────────────────────────────────────────────────────
  searchQuery = signal('');
  activeMarket   = signal('all');
  activeRisk     = signal('all');
  activeCategory = signal('all');
  detail         = signal<StrategyTemplate | null>(null);

  markets = [
    { value: 'all',    label: 'All Markets' },
    { value: 'crypto', label: '₿ Crypto' },
    { value: 'stocks', label: '📈 Stocks' },
    { value: 'forex',  label: '💱 Forex' },
  ];

  risks = [
    { value: 'all',    label: 'All Risk' },
    { value: 'low',    label: '🟢 Low' },
    { value: 'medium', label: '🟡 Medium' },
    { value: 'high',   label: '🔴 High' },
  ];

  categories = [
    { value: 'all',           label: 'All' },
    { value: 'trend',         label: 'Trend' },
    { value: 'mean-reversion',label: 'Mean Reversion' },
    { value: 'momentum',      label: 'Momentum' },
    { value: 'volatility',    label: 'Volatility' },
    { value: 'arbitrage',     label: 'Arbitrage' },
    { value: 'income',        label: 'Income' },
  ];

  // ── Derived list ─────────────────────────────────────────────────────────
  private allowedMarkets = computed(() => {
    const mode = this.accountMode.mode();
    const activeExchangeIds = this.exchangeService.connectionsByMode(mode).map(connection => connection.exchangeId);
    const sourceExchanges = activeExchangeIds.length > 0
      ? SUPPORTED_EXCHANGES.filter(exchange => activeExchangeIds.includes(exchange.id))
      : SUPPORTED_EXCHANGES.filter(exchange => (exchange.isPaper ?? false) === (mode === 'paper'));

    const marketSet = new Set<string>();
    for (const exchange of sourceExchanges) {
      if (exchange.category === 'crypto') {
        marketSet.add('crypto');
      }
      if (exchange.category === 'stocks') {
        marketSet.add('stocks');
      }
    }

    return marketSet;
  });

  results = computed(() => {
    const baseResults = this.strategyService.search(
      this.searchQuery(),
      this.activeMarket(),
      this.activeRisk(),
      this.activeCategory(),
    );

    const allowedMarkets = this.allowedMarkets();
    if (allowedMarkets.size === 0) {
      return [];
    }

    return baseResults.filter(strategy =>
      strategy.markets.some(market => market === 'multi' || allowedMarkets.has(market))
    );
  });

  isSaved(id: string) { return this.strategyService.isSaved(id); }

  savedIds = this.strategyService.savedIds;

  toggleSave(event: Event, id: string) {
    event.stopPropagation();
    this.strategyService.toggleSave(id);
  }

  openDetail(s: StrategyTemplate) { this.detail.set(s); }
  closeDetail() { this.detail.set(null); }

  useStrategy(s: StrategyTemplate) {
    this.selected.emit(s);
    this.close();
  }

  riskColor(risk: string): string {
    return risk === 'Low' ? '#00d17a' : risk === 'Medium' ? '#F7A600' : '#ef4444';
  }

  marketLabel(m: string): string {
    const map: Record<string, string> = { crypto: '₿', stocks: '📈', forex: '💱', multi: '🌐' };
    return map[m] ?? m;
  }

  close() { this.closed.emit(); }
}
