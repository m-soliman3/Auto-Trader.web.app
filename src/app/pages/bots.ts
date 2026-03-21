import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { Bot, BotService } from '../services/bot.service';
import { StrategyService } from '../services/strategy.service';
import { CreateBotModal } from '../components/create-bot-modal';

@Component({
  selector: 'app-bots-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CreateBotModal],
  template: `
    <div class="user-page">
      @if (showAddBotModal()) {
        <app-create-bot-modal
          (closed)="closeAddBot()"
          (created)="onBotCreated($event)"
        />
      }

      <div class="page-shell">
        <aside class="page-index" aria-label="Page navigation">
          <div class="index-title">Navigation</div>
          <div class="index-current">{{ modeLabel() }} Mode</div>
          <nav class="index-nav" aria-label="Main pages">
            <a class="index-link" [routerLink]="['/dashboard', accountMode.mode()]">Dashboard</a>
            <a class="index-link" routerLink="/exchanges">Exchanges</a>
            <a class="index-link active" routerLink="/bots">Bots</a>
            <a class="index-link" routerLink="/strategies">Strategies</a>
            <a class="index-link" routerLink="/portfolio-management">Portfolio</a>
            <a class="index-link" routerLink="/backend-runner">Backend Runner</a>
          </nav>
        </aside>

        <main class="page-main">
          <div class="page-header">
            <h1>{{ modeLabel() }} Bots</h1>
            <div class="header-actions">
              <button type="button" class="add-btn" (click)="openAddBot()">+ New Bot</button>
              <a class="top-link" [routerLink]="['/dashboard', accountMode.mode()]">Back to Dashboard</a>
            </div>
          </div>

          @if (visibleBots().length > 0) {
            <div class="bots-layout">
              <section class="panel">
                <div class="list">
                  @for (bot of visibleBots(); track bot.id) {
                    <button type="button" class="row" [class.selected]="selectedBot()?.id === bot.id" (click)="selectBot(bot.id)">
                      <div>
                        <div class="row-title">{{ bot.name }}</div>
                        <div class="row-sub">{{ bot.exchangeLabel }} · {{ bot.symbol }} · {{ bot.timeframe }}</div>
                      </div>
                      <span class="badge" [class.active]="bot.status === 'active'" [class.paused]="bot.status !== 'active'">
                        {{ bot.status === 'active' ? 'Active' : 'Paused' }}
                      </span>
                    </button>
                  }
                </div>
              </section>

              @if (selectedBot(); as bot) {
                <section class="panel details-panel">
                  <div class="details-header">
                    <div>
                      <h2>{{ bot.name }}</h2>
                      <p class="details-sub">Created {{ bot.createdAt | date:'medium' }}</p>
                    </div>
                    <button type="button" class="toggle-btn" (click)="toggleBotStatus(bot)" [disabled]="statusSaving() === bot.id">
                      {{ statusSaving() === bot.id ? 'Saving...' : (bot.status === 'active' ? 'Pause Bot' : 'Resume Bot') }}
                    </button>
                  </div>

                  <div class="details-grid">
                    <div class="detail-card"><div class="detail-label">Exchange</div><div class="detail-value">{{ bot.exchangeLabel }}</div></div>
                    <div class="detail-card"><div class="detail-label">Symbol</div><div class="detail-value">{{ bot.symbol }}</div></div>
                    <div class="detail-card"><div class="detail-label">Timeframe</div><div class="detail-value">{{ bot.timeframe }}</div></div>
                    <div class="detail-card"><div class="detail-label">Investment</div><div class="detail-value">{{ '$' + (bot.investment | number:'1.2-2') }}</div></div>
                    <div class="detail-card"><div class="detail-label">Stop Loss</div><div class="detail-value">{{ bot.stopLoss }}%</div></div>
                    <div class="detail-card"><div class="detail-label">Take Profit</div><div class="detail-value">{{ bot.takeProfit }}%</div></div>
                    <div class="detail-card"><div class="detail-label">Total Trades</div><div class="detail-value">{{ bot.trades }}</div></div>
                    <div class="detail-card"><div class="detail-label">P&L</div><div class="detail-value" [class.pnl-pos]="bot.pnl >= 0" [class.pnl-neg]="bot.pnl < 0">{{ (bot.pnl >= 0 ? '+' : '') + '$' + (bot.pnl | number:'1.2-2') }}</div></div>
                  </div>

                  <h3 class="log-title">Trade Log</h3>
                  @if (selectedBotTradeLogs().length > 0) {
                    <div class="table-wrap">
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Executed At</th><th>Symbol</th><th>Side</th><th>Strategy</th><th>Order ID</th><th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (ex of selectedBotTradeLogs(); track ex.id) {
                            <tr>
                              <td>{{ ex.executedAt | date:'medium' }}</td>
                              <td>{{ ex.symbol }}</td>
                              <td>{{ ex.side.toUpperCase() }}</td>
                              <td>{{ ex.strategyName }}</td>
                              <td class="mono">{{ ex.orderId }}</td>
                              <td>{{ ex.totalAmount !== null && ex.totalAmount !== undefined ? ('$' + (ex.totalAmount | number:'1.2-2')) : ('$' + (ex.investment | number:'1.2-2')) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="empty">No trades logged yet for this bot.</p>
                  }
                </section>
              }
            </div>
          } @else {
            <section class="panel">
              <p class="empty">No {{ modeLabel().toLowerCase() }} bots created yet. Use Dashboard to add your first bot.</p>
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
      .bots-layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 1rem; align-items: start; }
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
      .pnl-pos { color: #16c784 !important; }
      .pnl-neg { color: #ef4444 !important; }
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
        .bots-layout { grid-template-columns: 1fr; }
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
export class BotsPage {
  readonly accountMode = inject(AccountModeService);
  readonly botService = inject(BotService);
  readonly strategyService = inject(StrategyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly showAddBotModal = signal(false);
  readonly selectedBotId = signal<string | null>(null);
  readonly statusSaving = signal('');

  readonly modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper' : 'Real');
  readonly visibleBots = computed(() => this.botService.botsByMode(this.accountMode.mode()));
  readonly selectedBot = computed(() => {
    const id = this.selectedBotId();
    const bots = this.visibleBots();
    if (id) {
      const match = bots.find((b) => b.id === id);
      if (match) return match;
    }
    return bots.length > 0 ? bots[0] : null;
  });
  readonly selectedBotTradeLogs = computed(() => {
    const bot = this.selectedBot();
    if (!bot) return [];
    return this.strategyService.executions()
      .filter((ex) => ex.botId === bot.id)
      .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt));
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.showAddBotModal.set(params.get('open') === 'add');
    });
  }

  selectBot(id: string): void {
    this.selectedBotId.set(id);
  }

  async toggleBotStatus(bot: Bot): Promise<void> {
    const next = bot.status === 'active' ? 'paused' : 'active';
    this.statusSaving.set(bot.id);
    try {
      await this.botService.setStatus(bot.id, next);
    } finally {
      this.statusSaving.set('');
    }
  }

  openAddBot(): void {
    this.showAddBotModal.set(true);
  }

  closeAddBot(): void {
    this.showAddBotModal.set(false);
    this.clearOpenQuery();
  }

  onBotCreated(_bot: Bot): void {
    this.showAddBotModal.set(false);
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
