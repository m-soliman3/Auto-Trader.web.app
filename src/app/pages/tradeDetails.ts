import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { StrategyService } from '../services/strategy.service';

@Component({
  selector: 'app-trade-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trade-details.html',
  styleUrl: './trade-details.scss'
})
export class TradeDetails {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private strategyService = inject(StrategyService);
  private accountMode = inject(AccountModeService);

  dashboardLink = computed(() => ['/dashboard', this.accountMode.mode()]);

  tradeId = computed(() => String(this.route.snapshot.paramMap.get('id') || ''));

  trade = computed(() => {
    const id = this.tradeId();
    if (!id) return null;
    return this.strategyService.executions().find(execution => execution.id === id) ?? null;
  });

  private toFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  executionPrice = computed(() => {
    const execution = this.trade();
    if (!execution) return null;

    if (Number.isFinite(Number(execution.executionPrice)) && Number(execution.executionPrice) > 0) {
      return Number(execution.executionPrice);
    }

    const raw = (execution.rawOrder ?? {}) as Record<string, unknown>;
    const direct = [
      raw['filled_avg_price'],
      raw['avg_execution_price'],
      raw['average_price'],
      raw['avgPrice'],
      raw['price'],
    ]
      .map(value => this.toFiniteNumber(value))
      .find((value): value is number => !!value && value > 0);
    if (direct) return direct;

    const fills = Array.isArray(raw['fills']) ? (raw['fills'] as Array<Record<string, unknown>>) : [];
    if (fills.length > 0) {
      let quoteSum = 0;
      let qtySum = 0;
      for (const fill of fills) {
        const price = this.toFiniteNumber(fill['price']) ?? 0;
        const qty = this.toFiniteNumber(fill['qty']) ?? 0;
        if (price > 0 && qty > 0) {
          quoteSum += price * qty;
          qtySum += qty;
        }
      }
      if (qtySum > 0) return quoteSum / qtySum;
    }

    return null;
  });

  shareQuantity = computed(() => {
    const execution = this.trade();
    if (!execution) return null;

    if (Number.isFinite(Number(execution.shareQuantity)) && Number(execution.shareQuantity) > 0) {
      return Number(execution.shareQuantity);
    }

    const raw = (execution.rawOrder ?? {}) as Record<string, unknown>;
    const quantity = [
      raw['filled_qty'],
      raw['qty'],
      raw['executedQty'],
      raw['origQty'],
      raw['filled'],
      raw['size'],
    ]
      .map(value => this.toFiniteNumber(value))
      .find((value): value is number => !!value && value > 0);
    if (quantity) return quantity;

    return null;
  });

  totalAmount = computed(() => {
    const execution = this.trade();
    if (!execution) return null;

    if (Number.isFinite(Number(execution.totalAmount)) && Number(execution.totalAmount) > 0) {
      return Number(execution.totalAmount);
    }

    const raw = (execution.rawOrder ?? {}) as Record<string, unknown>;
    const direct = [
      raw['filled_notional'],
      raw['notional'],
      raw['cummulativeQuoteQty'],
      raw['executed_value'],
      raw['amount'],
    ]
      .map(value => this.toFiniteNumber(value))
      .find((value): value is number => !!value && value > 0);
    if (direct) return direct;

    const qty = this.shareQuantity();
    const price = this.executionPrice();
    if (qty && price) return qty * price;

    const investment = this.toFiniteNumber(execution.investment);
    return investment && investment > 0 ? investment : null;
  });

  goBack() {
    this.router.navigate(this.dashboardLink(), { queryParams: { open: 'trades' } });
  }
}
