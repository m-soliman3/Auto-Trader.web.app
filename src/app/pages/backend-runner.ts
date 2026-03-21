import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountModeService } from '../services/account-mode.service';
import { environment } from '../../environments/environment';

interface RunnerSummary {
  totalActiveStrategies: number;
  executed: number;
  skipped: number;
  skippedMarketClosed: number;
  failed: number;
  ranAt: string;
}

interface RunnerSummariesResponse {
  count: number;
  items: RunnerSummary[];
}

type RunnerExecutionFilter = 'all' | 'executed' | 'not-executed';
type RunnerDatePreset = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

@Component({
  selector: 'app-backend-runner-page',
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
            <a class="index-link" routerLink="/portfolio-management">Portfolio</a>
            <a class="index-link active" routerLink="/backend-runner">Backend Runner</a>
          </nav>
        </aside>

        <main class="page-main">
          <div class="page-header">
            <h1>Backend Runner</h1>
            <div class="header-actions">
              <button type="button" class="refresh-btn" (click)="refresh()" [disabled]="runnerSummariesLoading()">
                {{ runnerSummariesLoading() ? 'Refreshing...' : 'Refresh' }}
              </button>
              <a class="top-link" [routerLink]="['/dashboard', accountMode.mode()]">Back to Dashboard</a>
            </div>
          </div>

          <section class="panel">
            <div class="filters-row">
              <label class="filter-field">
                <span>Date Range</span>
                <select [value]="pendingDatePreset()" (change)="onDatePresetChange($any($event.target).value)">
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this-week">This Week</option>
                  <option value="last-week">Last Week</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label class="filter-field">
                <span>Date From</span>
                <input
                  type="date"
                  [value]="pendingFromDateFilter()"
                  [disabled]="pendingDatePreset() !== 'custom'"
                  (input)="onFromDateFilterChange($any($event.target).value)"
                />
              </label>

              <label class="filter-field">
                <span>Date To</span>
                <input
                  type="date"
                  [value]="pendingToDateFilter()"
                  [disabled]="pendingDatePreset() !== 'custom'"
                  (input)="onToDateFilterChange($any($event.target).value)"
                />
              </label>

              <label class="filter-field">
                <span>Status</span>
                <select [value]="pendingStatusFilter()" (change)="onStatusFilterChange($any($event.target).value)">
                  <option value="all">All</option>
                  <option value="executed">Executed</option>
                  <option value="not-executed">Not Executed</option>
                </select>
              </label>

              <button type="button" class="apply-filters-btn" (click)="applyFilters()" [disabled]="!hasPendingFilterChanges()">
                Apply Filters
              </button>

              <button type="button" class="clear-filters-btn" (click)="clearFilters()" [disabled]="!hasActiveFilters()">
                Clear Filters
              </button>
            </div>

            @if (runnerSummariesError()) {
              <div class="runner-error">{{ runnerSummariesError() }}</div>
            } @else if (runnerSummariesLoading() && runnerSummaries().length === 0) {
              <div class="runner-loading">Loading backend runner summaries...</div>
            } @else if (runnerSummaries().length === 0) {
              <div class="runner-empty">No runner summaries yet.</div>
            } @else if (filteredRunnerSummaries().length === 0) {
              <div class="runner-empty">No runner summaries match the selected filters.</div>
            } @else {
              <div class="runner-list">
                @for (summary of filteredRunnerSummaries(); track summary.ranAt) {
                  <div class="runner-row">
                    <div class="runner-left">
                      <div class="runner-time">{{ summary.ranAt | date:'medium' }}</div>
                      <div class="runner-stats">
                        Active: {{ summary.totalActiveStrategies }} · Executed: {{ summary.executed }} · Failed: {{ summary.failed }}
                      </div>
                    </div>
                    <span class="runner-badge" [class.runner-ok]="runnerStatusClass(summary) === 'runner-ok'" [class.runner-warn]="runnerStatusClass(summary) === 'runner-warn'" [class.runner-quiet]="runnerStatusClass(summary) === 'runner-quiet'">
                      {{ runnerStatusLabel(summary) }}
                    </span>
                  </div>
                }
              </div>
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
      .filters-row { display: flex; align-items: flex-end; gap: 0.7rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
      .filter-field { display: grid; gap: 0.3rem; }
      .filter-field span { color: var(--text-secondary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
      .filter-field input, .filter-field select { border: 1px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--text-primary); padding: 0.45rem 0.55rem; font-size: 0.84rem; min-width: 165px; }
      .apply-filters-btn { border: 1px solid rgba(0, 209, 122, 0.35); border-radius: 9px; background: rgba(0, 209, 122, 0.12); color: var(--accent); padding: 0.45rem 0.65rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
      .apply-filters-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .clear-filters-btn { border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-primary); padding: 0.45rem 0.65rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
      .clear-filters-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .runner-list { display: grid; gap: 0.7rem; }
      .runner-row { display: flex; align-items: center; justify-content: space-between; gap: 0.9rem; padding: 0.72rem 0.8rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
      .runner-time { color: var(--text-primary); font-size: 0.9rem; font-weight: 700; }
      .runner-stats { color: var(--text-secondary); font-size: 0.78rem; margin-top: 0.14rem; }
      .runner-badge { border-radius: 999px; padding: 0.2rem 0.55rem; font-size: 0.7rem; font-weight: 700; border: 1px solid transparent; white-space: nowrap; }
      .runner-badge.runner-ok { color: var(--accent); background: rgba(0, 209, 122, 0.12); border-color: rgba(0, 209, 122, 0.3); }
      .runner-badge.runner-warn { color: #f59e0b; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); }
      .runner-badge.runner-quiet { color: var(--text-secondary); background: var(--surface-raised); border-color: var(--border); }
      .runner-error { color: #ef4444; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.24); border-radius: 10px; padding: 0.7rem; }
      .runner-empty, .runner-loading { color: var(--text-secondary); font-size: 0.9rem; }
      @media (max-width: 900px) {
        .page-shell { grid-template-columns: 210px minmax(0, 1fr); }
        .page-index { position: sticky; top: 96px; flex-direction: column; align-items: stretch; overflow: visible; scrollbar-width: auto; }
        .index-title, .index-current, .index-link { white-space: nowrap; }
      }
      @media (max-width: 640px) {
        .user-page { padding: 88px 0.9rem 1.5rem; }
        .page-shell { grid-template-columns: 1fr; gap: 0.85rem; }
        .page-index { position: static; top: auto; }
        .index-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .index-link { text-align: center; }
        .page-header { flex-direction: column; align-items: flex-start; }
        .header-actions { width: 100%; justify-content: space-between; }
        .filters-row { align-items: stretch; }
        .filter-field input, .filter-field select { min-width: 0; width: 100%; }
      }
    `,
  ],
})
export class BackendRunnerPage {
  readonly accountMode = inject(AccountModeService);
  readonly modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper' : 'Real');
  private readonly firebaseAuth = inject(Auth);
  private readonly http = inject(HttpClient);
  private readonly tradingBackendBaseUrl = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');

  readonly runnerSummaries = signal<RunnerSummary[]>([]);
  readonly runnerSummariesLoading = signal(false);
  readonly runnerSummariesError = signal('');
  readonly selectedFromDateFilter = signal('');
  readonly selectedToDateFilter = signal('');
  readonly selectedDatePreset = signal<RunnerDatePreset>('custom');
  readonly statusFilter = signal<RunnerExecutionFilter>('all');
  readonly pendingFromDateFilter = signal('');
  readonly pendingToDateFilter = signal('');
  readonly pendingDatePreset = signal<RunnerDatePreset>('custom');
  readonly pendingStatusFilter = signal<RunnerExecutionFilter>('all');
  readonly hasActiveFilters = computed(() => {
    return this.selectedDatePreset() !== 'custom'
      || this.selectedFromDateFilter().length > 0
      || this.selectedToDateFilter().length > 0
      || this.statusFilter() !== 'all';
  });
  readonly hasPendingFilterChanges = computed(() => {
    return this.pendingDatePreset() !== this.selectedDatePreset()
      || this.pendingFromDateFilter() !== this.selectedFromDateFilter()
      || this.pendingToDateFilter() !== this.selectedToDateFilter()
      || this.pendingStatusFilter() !== this.statusFilter();
  });
  readonly filteredRunnerSummaries = computed(() => {
    const fromDateFilter = this.selectedFromDateFilter();
    const toDateFilter = this.selectedToDateFilter();
    const statusFilter = this.statusFilter();

    return this.runnerSummaries().filter((summary) => {
      const summaryDate = this.toDateInputValue(summary.ranAt);

      if (fromDateFilter && toDateFilter) {
        const rangeStart = fromDateFilter <= toDateFilter ? fromDateFilter : toDateFilter;
        const rangeEnd = fromDateFilter <= toDateFilter ? toDateFilter : fromDateFilter;
        if (summaryDate < rangeStart || summaryDate > rangeEnd) {
          return false;
        }
      } else if (fromDateFilter) {
        if (summaryDate !== fromDateFilter) {
          return false;
        }
      } else if (toDateFilter) {
        if (summaryDate !== toDateFilter) {
          return false;
        }
      }

      if (statusFilter === 'executed' && summary.executed <= 0) {
        return false;
      }

      if (statusFilter === 'not-executed' && summary.executed > 0) {
        return false;
      }

      return true;
    });
  });

  constructor() {
    void this.loadRunnerSummaries();
  }

  runnerStatusClass(summary: RunnerSummary): 'runner-ok' | 'runner-warn' | 'runner-quiet' {
    if (summary.failed > 0) return 'runner-warn';
    if (summary.executed > 0) return 'runner-ok';
    return 'runner-quiet';
  }

  runnerStatusLabel(summary: RunnerSummary): string {
    if (summary.failed > 0) return 'Has Failures';
    if (summary.executed > 0) return 'Executed';
    return 'No Executions';
  }

  refresh(): void {
    void this.loadRunnerSummaries(true);
  }

  onFromDateFilterChange(value: string): void {
    this.pendingFromDateFilter.set(value);
  }

  onToDateFilterChange(value: string): void {
    this.pendingToDateFilter.set(value);
  }

  onStatusFilterChange(value: RunnerExecutionFilter): void {
    this.pendingStatusFilter.set(value);
  }

  onDatePresetChange(value: RunnerDatePreset): void {
    this.pendingDatePreset.set(value);
    if (value === 'custom') {
      return;
    }

    const range = this.getPresetDateRange(value);
    this.pendingFromDateFilter.set(range.from);
    this.pendingToDateFilter.set(range.to);
  }

  applyFilters(): void {
    this.selectedDatePreset.set(this.pendingDatePreset());
    this.selectedFromDateFilter.set(this.pendingFromDateFilter());
    this.selectedToDateFilter.set(this.pendingToDateFilter());
    this.statusFilter.set(this.pendingStatusFilter());
  }

  clearFilters(): void {
    this.pendingDatePreset.set('custom');
    this.pendingFromDateFilter.set('');
    this.pendingToDateFilter.set('');
    this.pendingStatusFilter.set('all');
    this.selectedDatePreset.set('custom');
    this.selectedFromDateFilter.set('');
    this.selectedToDateFilter.set('');
    this.statusFilter.set('all');
  }

  private runnerSummariesEndpoint(): string {
    if (!this.tradingBackendBaseUrl) {
      return '/api/runner-summaries';
    }

    return `${this.tradingBackendBaseUrl}/v1/runner-summaries`;
  }

  private async loadRunnerSummaries(showLoader = true): Promise<void> {
    if (!this.tradingBackendBaseUrl) {
      this.runnerSummariesError.set('Backend monitor is disabled. Set tradingBackendBaseUrl in environment.');
      this.runnerSummaries.set([]);
      return;
    }

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      this.runnerSummariesError.set('Sign in to view backend runner status.');
      return;
    }

    if (showLoader) {
      this.runnerSummariesLoading.set(true);
    }
    this.runnerSummariesError.set('');

    try {
      const idToken = await currentUser.getIdToken();
      const payload = await firstValueFrom(this.http.get<RunnerSummariesResponse>(
        `${this.runnerSummariesEndpoint()}?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      ));
      this.runnerSummaries.set(payload.items ?? []);
    } catch {
      this.runnerSummariesError.set('Unable to load backend runner status right now.');
    } finally {
      if (showLoader) {
        this.runnerSummariesLoading.set(false);
      }
    }
  }

  private toDateInputValue(dateIso: string): string {
    const dt = new Date(dateIso);
    if (Number.isNaN(dt.getTime())) {
      return '';
    }

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getPresetDateRange(preset: RunnerDatePreset): { from: string; to: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      const day = this.toDateInputValue(today.toISOString());
      return { from: day, to: day };
    }

    if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const day = this.toDateInputValue(yesterday.toISOString());
      return { from: day, to: day };
    }

    if (preset === 'this-week' || preset === 'last-week') {
      const start = new Date(today);
      const dayOfWeek = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dayOfWeek);
      if (preset === 'last-week') {
        start.setDate(start.getDate() - 7);
      }
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        from: this.toDateInputValue(start.toISOString()),
        to: this.toDateInputValue(end.toISOString()),
      };
    }

    if (preset === 'this-month' || preset === 'last-month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      if (preset === 'last-month') {
        start.setMonth(start.getMonth() - 1);
      }
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return {
        from: this.toDateInputValue(start.toISOString()),
        to: this.toDateInputValue(end.toISOString()),
      };
    }

    return { from: '', to: '' };
  }
}
