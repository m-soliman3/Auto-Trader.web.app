import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StrategyService, StrategyTemplate } from '../services/strategy.service';

@Component({
  selector: 'app-browse-strategies-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './browse-strategies-modal.html',
  styleUrl: './browse-strategies-modal.scss',
})
export class BrowseStrategiesModal {
  private strategyService = inject(StrategyService);

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
  results = computed(() =>
    this.strategyService.search(
      this.searchQuery(),
      this.activeMarket(),
      this.activeRisk(),
      this.activeCategory(),
    )
  );

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
