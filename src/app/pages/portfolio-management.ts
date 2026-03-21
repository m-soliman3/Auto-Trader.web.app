import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { ExchangeService } from '../services/exchange.service';

@Component({
  selector: 'app-portfolio-management-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="user-page">
      <div class="page-shell">
        <aside class="page-index" aria-label="Page navigation">
          <div class="index-title">Navigation</div>
          <div class="index-current">{{ modeLabel() }} Mode</div>
          <nav class="index-nav" aria-label="Main pages">
            <a class="index-link" [routerLink]="['/dashboard', accountMode.mode()]">Dashboard</a>
            <a class="index-link" routerLink="/exchanges">Exchanges</a>
            <a class="index-link" routerLink="/bots">Bots</a>
            <a class="index-link" routerLink="/strategies">Strategies</a>
            <a class="index-link active" routerLink="/portfolio-management">Portfolio</a>
            <a class="index-link" routerLink="/backend-runner">Backend Runner</a>
          </nav>
        </aside>

        <main class="page-main">
          <div class="page-header">
            <h1>{{ modeLabel() }} Portfolio Management</h1>
            <div class="header-actions">
              <button type="button" class="refresh-btn" (click)="refresh()" [disabled]="exchangeService.isLoadingPortfolio()">
                {{ exchangeService.isLoadingPortfolio() ? 'Refreshing...' : 'Refresh' }}
              </button>
              <a class="top-link" [routerLink]="['/dashboard', accountMode.mode()]">Back to Dashboard</a>
            </div>
          </div>

          <section class="panel summary-grid">
            <article class="summary-card">
              <div class="summary-label">Portfolio Value</div>
              <div class="summary-value">{{ portfolioValue() !== null ? ('$' + (portfolioValue() | number:'1.2-2')) : 'N/A' }}</div>
            </article>
            <article class="summary-card">
              <div class="summary-label">Unrealized P&L</div>
              <div class="summary-value" [class.pnl-pos]="(pnlValue() ?? 0) >= 0" [class.pnl-neg]="(pnlValue() ?? 0) < 0">
                {{ pnlValue() !== null ? ((pnlValue()! >= 0 ? '+' : '') + '$' + (pnlValue() | number:'1.2-2')) : 'N/A' }}
              </div>
            </article>
          </section>

          @if (exchangeService.portfolioError()) {
            <section class="panel error">{{ exchangeService.portfolioError() }}</section>
          }

          <section class="panel">
            <h2>Exchange Breakdown</h2>
            @if (breakdownRows().length > 0) {
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Exchange</th>
                      <th>Value</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of breakdownRows(); track row.label) {
                      <tr>
                        <td>{{ row.label }}</td>
                        <td>{{ '$' + (row.portfolioValue | number:'1.2-2') }}</td>
                        <td [class.pnl-pos]="(row.unrealizedPnl ?? 0) >= 0" [class.pnl-neg]="(row.unrealizedPnl ?? 0) < 0">
                          {{ row.unrealizedPnl !== null ? ((row.unrealizedPnl >= 0 ? '+' : '') + '$' + (row.unrealizedPnl | number:'1.2-2')) : 'N/A' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty">No portfolio rows yet. Connect an exchange to load portfolio data.</p>
            }
          </section>

          <section class="panel">
            <h2>Open Positions</h2>
            @if (positionRows().length > 0) {
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Exchange</th>
                      <th>Qty</th>
                      <th>Value</th>
                      <th>P/L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (position of positionRows(); track position.exchangeLabel + ':' + position.symbol) {
                      <tr>
                        <td>{{ position.symbol }}</td>
                        <td>{{ position.exchangeLabel }}</td>
                        <td>{{ position.quantity | number:'1.2-8' }}</td>
                        <td>{{ '$' + (position.marketValue | number:'1.2-2') }}</td>
                        <td [class.pnl-pos]="(position.pnlPercentage ?? 0) >= 0" [class.pnl-neg]="(position.pnlPercentage ?? 0) < 0">
                          {{ position.pnlPercentage !== null && position.pnlPercentage !== undefined ? ((position.pnlPercentage >= 0 ? '+' : '') + (position.pnlPercentage | number:'1.2-2') + '%') : 'N/A' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty">No open positions in {{ modeLabel() }} mode.</p>
            }
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .user-page { min-height: 100vh; padding: 100px 1.5rem 2rem; background: var(--bg); }
      .page-shell { max-width: 1480px; margin: 0 auto; display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 1.2rem; }
      .page-index { border: 1px solid var(--border); border-radius: 14px; background: linear-gradient(180deg, var(--surface-raised), var(--bg)); padding: 0.9rem; position: sticky; top: 96px; height: fit-content; display: flex; flex-direction: column; gap: 0.4rem; }
      .index-title { font-size: 0.76rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem; }
      .index-current { border: 1px solid rgba(0, 209, 122, 0.35); border-radius: 10px; color: var(--accent); background: rgba(0, 209, 122, 0.12); font-size: 0.92rem; font-weight: 700; padding: 0.58rem 0.7rem; }
      .index-nav { display: grid; gap: 0.35rem; margin-top: 0.45rem; }
      .index-link { border: 1px solid var(--border); border-radius: 9px; color: var(--text-secondary); background: var(--surface); text-decoration: none; font-size: 0.84rem; font-weight: 700; padding: 0.45rem 0.6rem; transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease; }
      .index-link:hover { border-color: rgba(0, 209, 122, 0.35); color: var(--text-primary); }
      .index-link.active { border-color: rgba(0, 209, 122, 0.45); color: var(--accent); background: rgba(0, 209, 122, 0.1); }
      .page-main { display: flex; flex-direction: column; gap: 1rem; }
      .page-header { display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; }
      .page-header h1 { margin: 0; font-size: 1.45rem; color: var(--text-primary); }
      .header-actions { display: flex; align-items: center; gap: 0.6rem; }
      .refresh-btn { border: 1px solid rgba(0, 209, 122, 0.3); background: rgba(0, 209, 122, 0.12); color: var(--accent); border-radius: 10px; padding: 0.5rem 0.8rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
      .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .top-link { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
      .panel { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 1rem; }
      .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
      .summary-card { border: 1px solid var(--border); border-radius: 12px; background: var(--bg); padding: 0.8rem; }
      .summary-label { color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .summary-value { margin-top: 0.22rem; color: var(--text-primary); font-size: 1.15rem; font-weight: 800; }
      .table-wrap { overflow-x: auto; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { text-align: left; padding: 0.62rem; border-bottom: 1px solid var(--border); color: var(--text-primary); font-size: 0.86rem; }
      .table th { color: var(--text-secondary); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .panel h2 { margin: 0 0 0.65rem; color: var(--text-primary); font-size: 1rem; }
      .pnl-pos { color: #16c784 !important; }
      .pnl-neg { color: #ef4444 !important; }
      .error { color: #ef4444; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); }
      .empty { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
      @media (max-width: 900px) {
        .page-shell { grid-template-columns: 210px minmax(0, 1fr); }
        .page-index { position: sticky; top: 96px; flex-direction: column; align-items: stretch; overflow: visible; scrollbar-width: auto; }
        .index-title, .index-current, .index-link { white-space: nowrap; }
        .summary-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .user-page { padding: 88px 0.9rem 1.5rem; }
        .page-shell { grid-template-columns: 1fr; gap: 0.85rem; }
        .page-index { position: static; top: auto; }
        .index-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .index-link { text-align: center; }
        .page-header { flex-direction: column; align-items: flex-start; }
        .header-actions { width: 100%; justify-content: space-between; }
      }
    `,
  ],
})
export class PortfolioManagementPage {
  readonly accountMode = inject(AccountModeService);
  readonly exchangeService = inject(ExchangeService);

  readonly modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper' : 'Real');
  readonly portfolioValue = computed(() => this.exchangeService.portfolioValuesByType()[this.accountMode.mode()]);
  readonly pnlValue = computed(() => this.exchangeService.pnlValuesByType()[this.accountMode.mode()]);
  readonly breakdownRows = computed(() => this.exchangeService.portfolioBreakdownByMode(this.accountMode.mode()));
  readonly positionRows = computed(() => this.exchangeService.portfolioPositionsByMode(this.accountMode.mode()));

  refresh(): void {
    void this.exchangeService.refreshPortfolioData(true);
  }
}
