import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountModeService } from '../services/account-mode.service';
import { ExchangeService, SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { ConnectExchangeModal } from '../components/connect-exchange-modal';
import { StrategyService } from '../services/strategy.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-exchanges-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ConnectExchangeModal, TranslateModule],
  template: `
    <div class="user-page">
      @if (showAddExchangeModal()) {
        <app-connect-exchange-modal
          (closed)="closeAddExchange()"
          (connected)="onExchangeConnected()"
        />
      }

      <!-- Disconnect Exchange Confirmation Modal -->
      @if (showDisconnectModal() && exchangeToDisconnect()) {
        <div class="disconnect-backdrop" (click)="cancelDisconnect()">
          <div class="disconnect-modal" (click)="$event.stopPropagation()">
            <div class="disconnect-header">
              <h3>{{ 'exchanges.confirmDisconnection' | translate }}</h3>
              <button type="button" class="disconnect-close" (click)="cancelDisconnect()" [attr.aria-label]="'common.close' | translate">✕</button>
            </div>
            <div class="disconnect-content">
              <p class="disconnect-question">{{ 'exchanges.disconnectQuestion' | translate }} <strong>{{ exchangeToDisconnect() }}</strong>?</p>
              <div class="disconnect-warning">
                <p><strong>⚠ {{ 'common.warning' | translate }}:</strong> {{ 'exchanges.disconnectWarning' | translate }}</p>
              </div>

              <div class="disconnect-section">
                <label class="disconnect-checkbox">
                  <input
                    type="checkbox"
                    [checked]="disconnectRiskConfirmed()"
                    (change)="disconnectRiskConfirmed.set($event.target.checked)"
                    [attr.aria-label]="'exchanges.understandRisksAria' | translate"
                  />
                  <span>{{ 'exchanges.understandRisks' | translate }}</span>
                </label>
              </div>

              <div class="disconnect-section">
                <label class="disconnect-label">{{ 'exchanges.typeDisconnectToConfirm' | translate }}</label>
                <input
                  type="text"
                  class="disconnect-input"
                  [value]="disconnectConfirmText()"
                  (input)="disconnectConfirmText.set($event.target.value)"
                  [placeholder]="'exchanges.disconnectPhrase' | translate"
                  [attr.aria-label]="'exchanges.typeToConfirmAria' | translate"
                />
              </div>

              @if (disconnectConfirmError()) {
                <div class="disconnect-error">{{ disconnectConfirmError() | translate }}</div>
              }
            </div>
            <div class="disconnect-actions">
              <button type="button" class="disconnect-btn-cancel" (click)="cancelDisconnect()">{{ 'common.cancel' | translate }}</button>
              <button 
                type="button"
                class="disconnect-btn-confirm" 
                (click)="confirmDisconnect()"
                [disabled]="!canConfirmDisconnect()"
              >
                {{ 'exchanges.disconnect' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

      <div class="page-shell">
        <aside class="page-index" [attr.aria-label]="'userPages.pageNavigation' | translate">
          <div class="index-title">{{ 'userPages.navigation' | translate }}</div>
          <div class="index-current">{{ modeLabel() }} {{ 'userPages.mode' | translate }}</div>
          <nav class="index-nav" [attr.aria-label]="'userPages.mainPages' | translate">
            <a class="index-link" [routerLink]="['/dashboard', accountMode.mode()]">{{ 'userPages.dashboard' | translate }}</a>
            <a class="index-link active" routerLink="/exchanges">{{ 'userPages.exchanges' | translate }}</a>
            <a class="index-link" routerLink="/bots">{{ 'userPages.bots' | translate }}</a>
            <a class="index-link" routerLink="/strategies">{{ 'userPages.strategies' | translate }}</a>
            <a class="index-link" routerLink="/portfolio-management">{{ 'userPages.portfolio' | translate }}</a>
            <a class="index-link" routerLink="/backend-runner">{{ 'userPages.backendRunner' | translate }}</a>
          </nav>
        </aside>

        <main class="page-main">
          <div class="page-header">
            <h1>{{ modeLabel() }} {{ 'exchanges.title' | translate }}</h1>
            <div class="header-actions">
              <button type="button" class="add-btn" (click)="openAddExchange()">+ {{ 'exchanges.addExchange' | translate }}</button>
              <a class="top-link" [routerLink]="['/dashboard', accountMode.mode()]">{{ 'userPages.backToDashboard' | translate }}</a>
            </div>
          </div>

          <section class="panel">
            <h2>{{ 'exchanges.connectedExchanges' | translate }}</h2>
            @if (visibleConnections().length > 0) {
              <div class="list">
                @for (conn of visibleConnections(); track conn.label) {
                  <button type="button" class="row" [class.selected]="selectedExchangeLabel() === conn.label" (click)="selectExchange(conn.label)">
                    <div>
                      <div class="title">{{ conn.label }}</div>
                       <div class="sub">{{ exchangeName(conn.exchangeId) }} · {{ 'exchanges.connected' | translate }} {{ conn.connectedAt | date:'mediumDate' }}</div>
                    </div>
                  </button>
                }
              </div>
            } @else {
               <p class="empty">{{ 'exchanges.noConnectionsPrefix' | translate }} {{ modeLabel().toLowerCase() }} {{ 'exchanges.noConnectionsSuffix' | translate }}</p>
             }
          </section>

          @if (selectedExchange(); as selected) {
            <section class="panel">
              <div class="details-header">
                <div>
                  <h2>{{ selected.label }} {{ 'exchanges.details' | translate }}</h2>
                  <p class="details-sub">{{ exchangeName(selected.exchangeId) }} · {{ 'exchanges.connected' | translate }} {{ selected.connectedAt | date:'medium' }}</p>
                </div>
                <div class="header-actions">
                  <button type="button" class="disconnect-btn" (click)="removeExchange(selected)">{{ 'exchanges.disconnect' | translate }}</button>
                </div>
              </div>

              <div class="credentials-grid">
                <div class="credential-card">
                  <div class="credential-label">{{ 'connectExchange.apiKey' | translate }}</div>
                  <div class="credential-value">{{ selected.apiKey }}</div>
                </div>
                <div class="credential-card">
                  <div class="credential-label">{{ 'connectExchange.apiSecret' | translate }}</div>
                  <div class="credential-value mono">{{ maskSecret(selected.secret) }}</div>
                </div>
              </div>

              <h3 class="trade-log-title">{{ 'exchanges.tradeLog' | translate }}</h3>
              @if (selectedTradeLogs().length > 0) {
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>{{ 'tradeDetails.executedAt' | translate }}</th>
                        <th>{{ 'portfolioManagement.symbol' | translate }}</th>
                        <th>{{ 'exchanges.side' | translate }}</th>
                        <th>{{ 'tradeDetails.strategy' | translate }}</th>
                        <th>{{ 'tradeDetails.bot' | translate }}</th>
                        <th>{{ 'exchanges.orderId' | translate }}</th>
                        <th>{{ 'exchanges.amount' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (execution of selectedTradeLogs(); track execution.id) {
                        <tr>
                          <td>{{ execution.executedAt | date:'medium' }}</td>
                          <td>{{ execution.symbol }}</td>
                          <td>{{ execution.side.toUpperCase() }}</td>
                          <td>{{ execution.strategyName }}</td>
                          <td>{{ execution.botName }}</td>
                          <td class="mono">{{ execution.orderId }}</td>
                          <td>
                            {{ execution.totalAmount !== null && execution.totalAmount !== undefined
                              ? ('$' + (execution.totalAmount | number:'1.2-2'))
                              : ('$' + (execution.investment | number:'1.2-2')) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                 <p class="empty">{{ 'exchanges.noTradesForExchange' | translate }}</p>
               }
             </section>
           }

          <section class="panel">
            <h2>{{ 'exchanges.supportedProviders' | translate }} {{ modeLabel() }}</h2>
            <div class="chips">
              @for (exchange of supportedVisible(); track exchange.id) {
                <span class="chip">{{ exchange.logo }} {{ exchange.name }}</span>
              }
            </div>
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
      .add-btn { border: 1px solid rgba(0, 209, 122, 0.3); background: rgba(0, 209, 122, 0.12); color: var(--accent); border-radius: 10px; padding: 0.5rem 0.78rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
      .top-link { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
      .panel { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 1rem; }
      .panel h2 { margin: 0 0 0.65rem; color: var(--text-primary); font-size: 1rem; }
      .list { display: grid; gap: 0.6rem; }
      .row { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.75rem; display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; width: 100%; text-align: left; cursor: pointer; }
      .row.selected { border-color: rgba(0, 209, 122, 0.45); box-shadow: 0 0 0 1px rgba(0, 209, 122, 0.2) inset; }
      .title { color: var(--text-primary); font-size: 0.92rem; font-weight: 700; }
      .sub { color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.15rem; }
      .details-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem; }
      .details-sub { margin: 0.15rem 0 0; color: var(--text-secondary); font-size: 0.82rem; }
      .header-actions { display: flex; gap: 0.5rem; }
      .disconnect-btn { border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.12); color: #ef4444; border-radius: 10px; padding: 0.48rem 0.74rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
      .disconnect-btn:hover { background: rgba(239, 68, 68, 0.2); }
      .credentials-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; margin-bottom: 0.95rem; }
      .credential-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.72rem; }
      .credential-label { color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .credential-value { margin-top: 0.2rem; color: var(--text-primary); font-size: 0.86rem; word-break: break-all; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
      .trade-log-title { margin: 0 0 0.55rem; color: var(--text-primary); font-size: 0.94rem; }
      .table-wrap { overflow-x: auto; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { text-align: left; padding: 0.58rem; border-bottom: 1px solid var(--border); color: var(--text-primary); font-size: 0.83rem; }
      .table th { color: var(--text-secondary); font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .chip { border: 1px solid var(--border); border-radius: 999px; background: var(--bg); color: var(--text-primary); padding: 0.35rem 0.7rem; font-size: 0.8rem; }
      .empty { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
      .disconnect-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
      .disconnect-modal { background: var(--surface); border-radius: 14px; border: 1px solid var(--border); box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15); max-width: 500px; width: 90%; }
      .disconnect-header { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; border-bottom: 1px solid var(--border); }
      .disconnect-header h3 { margin: 0; color: var(--text-primary); font-size: 1.1rem; }
      .disconnect-close { background: none; border: none; color: var(--text-secondary); font-size: 1.4rem; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
      .disconnect-close:hover { color: var(--text-primary); }
      .disconnect-content { padding: 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
      .disconnect-question { margin: 0; color: var(--text-primary); font-size: 0.95rem; line-height: 1.5; }
      .disconnect-warning { background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 0.8rem; border-radius: 8px; }
      .disconnect-warning p { margin: 0; color: var(--text-primary); font-size: 0.9rem; line-height: 1.5; }
      .disconnect-section { display: flex; flex-direction: column; gap: 0.4rem; }
      .disconnect-checkbox { display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer; }
      .disconnect-checkbox input { margin-top: 0.3rem; cursor: pointer; }
      .disconnect-checkbox span { color: var(--text-primary); font-size: 0.9rem; line-height: 1.5; }
      .disconnect-label { color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; }
      .disconnect-input { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text-primary); padding: 0.6rem 0.8rem; font-size: 0.9rem; }
      .disconnect-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
      .disconnect-error { background: rgba(239, 68, 68, 0.12); color: #ef4444; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.85rem; border: 1px solid rgba(239, 68, 68, 0.3); }
      .disconnect-actions { display: flex; gap: 0.8rem; padding: 1rem 1.2rem; border-top: 1px solid var(--border); justify-content: flex-end; }
      .disconnect-btn-cancel { border: 1px solid var(--border); background: var(--surface-raised); color: var(--text-primary); border-radius: 10px; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
      .disconnect-btn-cancel:hover { background: var(--bg); }
      .disconnect-btn-confirm { border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.12); color: #ef4444; border-radius: 10px; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
      .disconnect-btn-confirm:hover:not(:disabled) { background: rgba(239, 68, 68, 0.2); }
      .disconnect-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
      @media (max-width: 900px) {
        .page-shell { grid-template-columns: 210px minmax(0, 1fr); }
        .page-index { position: sticky; top: 96px; flex-direction: column; align-items: stretch; overflow: visible; scrollbar-width: auto; }
        .index-title, .index-current, .index-link { white-space: nowrap; }
        .credentials-grid { grid-template-columns: 1fr; }
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
export class ExchangesPage {
  readonly accountMode = inject(AccountModeService);
  readonly exchangeService = inject(ExchangeService);
  readonly strategyService = inject(StrategyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly showAddExchangeModal = signal(false);
  readonly selectedExchangeLabel = signal<string | null>(null);
  readonly showDisconnectModal = signal(false);
  readonly exchangeToDisconnect = signal<string | null>(null);
  readonly disconnectRiskConfirmed = signal(false);
  readonly disconnectConfirmText = signal('');
  readonly disconnectConfirmError = signal('');

  readonly modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper' : 'Real');
  readonly visibleConnections = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));
  readonly selectedExchange = computed(() => {
    const list = this.visibleConnections();
    const selectedLabel = this.selectedExchangeLabel();
    if (selectedLabel) {
      const match = list.find((conn) => conn.label === selectedLabel);
      if (match) {
        return match;
      }
    }

    return list.length > 0 ? list[0] : null;
  });
  readonly selectedTradeLogs = computed(() => {
    const selected = this.selectedExchange();
    if (!selected) {
      return [];
    }

    return this.strategyService.executions()
      .filter((execution) => execution.exchangeId === selected.exchangeId)
      .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt));
  });
  readonly supportedVisible = computed(() => {
    const showPaper = this.accountMode.mode() === 'paper';
    return SUPPORTED_EXCHANGES.filter((exchange) => (exchange.isPaper ?? false) === showPaper);
  });

  readonly canConfirmDisconnect = computed(() => {
    return this.disconnectRiskConfirmed() && this.disconnectConfirmText().toLowerCase() === 'disconnect this exchange';
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.showAddExchangeModal.set(params.get('open') === 'add');
    });
  }

  openAddExchange(): void {
    this.showAddExchangeModal.set(true);
  }

  closeAddExchange(): void {
    this.showAddExchangeModal.set(false);
    this.clearOpenQuery();
  }

  onExchangeConnected(): void {
    this.showAddExchangeModal.set(false);
    if (!this.selectedExchangeLabel()) {
      const first = this.visibleConnections()[0];
      if (first) {
        this.selectedExchangeLabel.set(first.label);
      }
    }
    this.clearOpenQuery();
  }

  selectExchange(label: string): void {
    this.selectedExchangeLabel.set(label);
  }

  removeExchange(conn: { label: string }): void {
    this.exchangeToDisconnect.set(conn.label);
    this.disconnectRiskConfirmed.set(false);
    this.disconnectConfirmText.set('');
    this.disconnectConfirmError.set('');
    this.showDisconnectModal.set(true);
  }

  confirmDisconnect(): void {
    if (!this.canConfirmDisconnect()) {
      if (!this.disconnectRiskConfirmed()) {
        this.disconnectConfirmError.set('exchanges.acknowledgeRisksToContinue');
      } else {
        this.disconnectConfirmError.set('exchanges.typeDisconnectToConfirmError');
      }
      return;
    }
    const label = this.exchangeToDisconnect();
    if (label) {
      this.exchangeService.remove(label);
      this.selectedExchangeLabel.set(null);
    }
    this.cancelDisconnect();
  }

  cancelDisconnect(): void {
    this.showDisconnectModal.set(false);
    this.exchangeToDisconnect.set(null);
    this.disconnectRiskConfirmed.set(false);
    this.disconnectConfirmText.set('');
    this.disconnectConfirmError.set('');
  }

  maskSecret(secret: string): string {
    const visible = secret.slice(0, 5);
    const maskedCount = Math.max(0, secret.length - 5);
    return visible + '*'.repeat(maskedCount);
  }

  private clearOpenQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  exchangeName(exchangeId: string): string {
    return SUPPORTED_EXCHANGES.find((exchange) => exchange.id === exchangeId)?.name ?? exchangeId;
  }
}
