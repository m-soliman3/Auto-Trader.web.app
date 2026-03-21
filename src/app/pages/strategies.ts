import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { BotService } from '../services/bot.service';
import { StrategyService, StrategyTemplate } from '../services/strategy.service';
import { BrowseStrategiesModal } from '../components/browse-strategies-modal';

@Component({
  selector: 'app-strategies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BrowseStrategiesModal],
  template: `
    <div class="user-page">
      @if (showAddStrategyModal()) {
        <app-browse-strategies-modal
          (closed)="closeAddStrategy()"
          (selected)="onStrategySelected($event)"
        />
      }

      <div class="page-shell">
        <aside class="page-index" aria-label="Page navigation">
          <div class="index-title">Navigation</div>
          <div class="index-current">{{ modeLabel() }} Mode</div>
          <nav class="index-nav" aria-label="Main pages">
            <a class="index-link" [routerLink]="['/dashboard', accountMode.mode()]">Dashboard</a>
            <a class="index-link" routerLink="/exchanges">Exchanges</a>
            <a class="index-link" routerLink="/bots">Bots</a>
            <a class="index-link active" routerLink="/strategies">Strategies</a>
            <a class="index-link" routerLink="/portfolio-management">Portfolio</a>
            <a class="index-link" routerLink="/backend-runner">Backend Runner</a>
          </nav>
        </aside>

        <main class="page-main">
          <div class="page-header">
            <h1>{{ modeLabel() }} Strategies</h1>
            <div class="header-actions">
              <button type="button" class="add-btn" (click)="openAddStrategy()">+ New Strategy</button>
              <a class="top-link" [routerLink]="['/dashboard', accountMode.mode()]">Back to Dashboard</a>
            </div>
          </div>

          @if (visibleStrategies().length > 0) {
            <div class="strategies-layout">
              <section class="panel">
                <div class="list">
                  @for (strategy of visibleStrategies(); track strategy.id) {
                    <button type="button" class="row" [class.selected]="selectedStrategyId() === strategy.id" (click)="selectStrategy(strategy.id)">
                      <div>
                        <div class="row-title">{{ strategy.name }}</div>
                        <div class="row-sub">{{ strategy.templateIcon }} {{ strategy.templateName }} · {{ strategy.assignedBotName }}</div>
                      </div>
                      <span class="badge" [class.active]="strategy.status === 'active'" [class.paused]="strategy.status !== 'active'">
                        {{ strategy.status === 'active' ? 'Active' : 'Paused' }}
                      </span>
                    </button>
                  }
                </div>
              </section>

              @if (selectedStrategy(); as strategy) {
                <section class="panel details-panel">
                  <div class="details-header">
                    <div>
                      <h2>{{ strategy.name }}</h2>
                      <p class="details-sub">{{ strategy.templateIcon }} {{ strategy.templateName }} · Updated {{ strategy.updatedAt | date:'mediumDate' }}</p>
                    </div>
                    <button type="button" class="toggle-btn" (click)="toggleStrategyStatus(strategy)" [disabled]="statusSaving() === strategy.id">
                      {{ statusSaving() === strategy.id ? 'Saving...' : (strategy.status === 'active' ? 'Pause Strategy' : 'Resume Strategy') }}
                    </button>
                  </div>

                  <div class="details-grid">
                    <div class="detail-card"><div class="detail-label">Assigned Bot</div><div class="detail-value">{{ strategy.assignedBotName }}</div></div>
                    <div class="detail-card"><div class="detail-label">Trade Side</div><div class="detail-value">{{ strategy.tradeSide.toUpperCase() }}</div></div>
                    <div class="detail-card"><div class="detail-label">Status</div><div class="detail-value">{{ strategy.status | titlecase }}</div></div>
                    <div class="detail-card"><div class="detail-label">Created</div><div class="detail-value">{{ strategy.createdAt | date:'mediumDate' }}</div></div>
                  </div>

                  @if (strategy.notes) {
                    <div class="notes-card"><div class="detail-label">Notes</div><div class="notes-text">{{ strategy.notes }}</div></div>
                  }

                  <h3 class="log-title">Execution Log</h3>
                  @if (selectedStrategyExecLogs().length > 0) {
                    <div class="table-wrap">
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Executed At</th><th>Symbol</th><th>Side</th><th>Bot</th><th>Order ID</th><th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (ex of selectedStrategyExecLogs(); track ex.id) {
                            <tr>
                              <td>{{ ex.executedAt | date:'medium' }}</td>
                              <td>{{ ex.symbol }}</td>
                              <td>{{ ex.side.toUpperCase() }}</td>
                              <td>{{ ex.botName }}</td>
                              <td class="mono">{{ ex.orderId }}</td>
                              <td>{{ ex.totalAmount !== null && ex.totalAmount !== undefined ? ('$' + (ex.totalAmount | number:'1.2-2')) : ('$' + (ex.investment | number:'1.2-2')) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="empty">No executions logged yet for this strategy.</p>
                  }
                </section>
              }
            </div>
          } @else {
            <section class="panel">
              <p class="empty">No {{ modeLabel().toLowerCase() }} strategies configured yet. Use Dashboard to create one.</p>
            </section>
          }
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
      .add-btn { border: 1px solid rgba(0, 209, 122, 0.3); background: rgba(0, 209, 122, 0.12); color: var(--accent); border-radius: 10px; padding: 0.5rem 0.78rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
      .top-link { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
      .panel { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 1rem; }
      .strategies-layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 1rem; align-items: start; }
      .details-panel { min-width: 0; }
      .table-wrap { overflow-x: auto; }
      .table { width: 100%; border-collapse: collapse; }
      .list { display: grid; gap: 0.55rem; }
      .row { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.72rem 0.85rem; display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; width: 100%; text-align: left; cursor: pointer; }
      .row.selected { border-color: rgba(0, 209, 122, 0.45); box-shadow: 0 0 0 1px rgba(0, 209, 122, 0.18) inset; }
      .row-title { color: var(--text-primary); font-size: 0.9rem; font-weight: 700; }
      .row-sub { color: var(--text-secondary); font-size: 0.78rem; margin-top: 0.12rem; }
      .badge { border-radius: 999px; padding: 0.2rem 0.5rem; font-size: 0.7rem; font-weight: 700; border: 1px solid transparent; white-space: nowrap; }
      .badge.active { color: var(--accent); background: rgba(0, 209, 122, 0.12); border-color: rgba(0, 209, 122, 0.3); }
      .badge.paused { color: var(--text-secondary); background: var(--surface-raised); border-color: var(--border); }
      .details-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.85rem; }
      .details-header h2 { margin: 0; font-size: 1rem; color: var(--text-primary); }
      .details-sub { margin: 0.12rem 0 0; color: var(--text-secondary); font-size: 0.8rem; }
      .toggle-btn { border: 1px solid var(--border); background: var(--surface-raised); color: var(--text-primary); border-radius: 10px; padding: 0.46rem 0.72rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .toggle-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .details-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; margin-bottom: 0.9rem; }
      .detail-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.65rem; }
      .detail-label { color: var(--text-secondary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .detail-value { margin-top: 0.18rem; color: var(--text-primary); font-size: 0.88rem; font-weight: 700; }
      .notes-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.7rem; margin-bottom: 0.9rem; }
      .notes-text { margin-top: 0.25rem; color: var(--text-primary); font-size: 0.86rem; line-height: 1.5; }
      .log-title { margin: 0 0 0.55rem; color: var(--text-primary); font-size: 0.94rem; font-weight: 700; }
      .table-wrap { overflow-x: auto; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { text-align: left; padding: 0.58rem; border-bottom: 1px solid var(--border); color: var(--text-primary); font-size: 0.83rem; }
      .table th { color: var(--text-secondary); font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .empty { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
      @media (max-width: 900px) {
        .page-shell { grid-template-columns: 210px minmax(0, 1fr); }
        .page-index { position: sticky; top: 96px; flex-direction: column; align-items: stretch; overflow: visible; scrollbar-width: auto; }
        .index-title, .index-current, .index-link { white-space: nowrap; }
        .strategies-layout { grid-template-columns: 1fr; }
        .details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
export class StrategiesPage {
  readonly accountMode = inject(AccountModeService);
  readonly botService = inject(BotService);
  readonly strategyService = inject(StrategyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly showAddStrategyModal = signal(false);
  readonly selectedStrategyId = signal<string | null>(null);
  readonly statusSaving = signal('');

  readonly modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper' : 'Real');
  readonly visibleStrategies = computed(() => {
    const visibleBotIds = new Set(this.botService.botsByMode(this.accountMode.mode()).map((bot) => bot.id));
    return this.strategyService.userStrategies().filter((strategy) => visibleBotIds.has(strategy.assignedBotId));
  });
  readonly selectedStrategy = computed(() => {
    const id = this.selectedStrategyId();
    const list = this.visibleStrategies();
    if (id) {
      const match = list.find((s) => s.id === id);
      if (match) return match;
    }
    return list.length > 0 ? list[0] : null;
  });
  readonly selectedStrategyExecLogs = computed(() => {
    const strategy = this.selectedStrategy();
    if (!strategy) return [];
    return this.strategyService.executions()
      .filter((ex) => ex.strategyId === strategy.id)
      .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt));
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.showAddStrategyModal.set(params.get('open') === 'add');
    });
  }

  selectStrategy(id: string): void {
    this.selectedStrategyId.set(id);
  }

  async toggleStrategyStatus(strategy: import('../services/strategy.service').UserStrategy): Promise<void> {
    const next = strategy.status === 'active' ? 'paused' : 'active';
    this.statusSaving.set(strategy.id);
    try {
      await this.strategyService.setStatus(strategy.id, next);
    } finally {
      this.statusSaving.set('');
    }
  }

  openAddStrategy(): void {
    this.showAddStrategyModal.set(true);
  }

  closeAddStrategy(): void {
    this.showAddStrategyModal.set(false);
    this.clearOpenQuery();
  }

  onStrategySelected(_strategy: StrategyTemplate): void {
    this.showAddStrategyModal.set(false);
    this.clearOpenQuery();
  }

  private clearOpenQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
