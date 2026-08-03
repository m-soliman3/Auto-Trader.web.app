import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../environments/environment';

type ServiceStatus = 'checking' | 'operational' | 'degraded' | 'down';

interface ServiceCheck {
  key: string;
  nameKey: string;
  descKey: string;
  url: string;
  status: ServiceStatus;
  latencyMs: number | null;
  checkedAt: Date | null;
  detail: string;
}

@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="status-page">
      <header class="status-header">
        <a class="status-logo" routerLink="/">
          <img src="/icons/logo.svg" alt="AutoTrader" height="32" />
        </a>
        <h1>{{ 'status.title' | translate }}</h1>
        <p class="status-subtitle">{{ 'status.subtitle' | translate }}</p>

        <div class="overall-banner" [class]="overallClass()">
          <span class="overall-dot"></span>
          <span class="overall-label">{{ overallLabelKey() | translate }}</span>
        </div>
      </header>

      <main class="status-main">
        <section class="services-section">
          <h2 class="section-title">{{ 'status.servicesTitle' | translate }}</h2>

          <div class="services-list">
            @for (svc of services(); track svc.key) {
              <div class="service-row">
                <div class="service-info">
                  <span class="service-name">{{ svc.nameKey | translate }}</span>
                  <span class="service-desc">{{ svc.descKey | translate }}</span>
                </div>

                <div class="service-status-area">
                  <div class="status-bar-wrap">
                    <div class="status-bar" [class]="'bar-' + svc.status"></div>
                  </div>
                  <span class="status-label" [class]="'label-' + svc.status">
                    {{ ('status.' + svc.status) | translate }}
                  </span>
                </div>

                <div class="service-meta">
                  @if (svc.latencyMs !== null) {
                    <span class="latency">{{ svc.latencyMs }}ms</span>
                  }
                  @if (svc.checkedAt) {
                    <span class="checked-at">
                      {{ 'status.checkedAt' | translate }}
                      {{ svc.checkedAt | date:'HH:mm:ss' }}
                    </span>
                  }
                  @if (svc.detail) {
                    <span class="detail-msg">{{ svc.detail }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <div class="refresh-bar">
          <button class="refresh-btn" (click)="checkAll()" [disabled]="isChecking()">
            @if (isChecking()) {
              {{ 'status.checking' | translate }}
            } @else {
              {{ 'status.refresh' | translate }}
            }
          </button>
          @if (lastFullCheck()) {
            <span class="last-check">
              {{ 'status.lastFullCheck' | translate }}
              {{ lastFullCheck() | date:'HH:mm:ss' }}
            </span>
          }
        </div>
      </main>

      <footer class="status-footer">
        <a routerLink="/">{{ 'status.backHome' | translate }}</a>
        <span>·</span>
        <a routerLink="/contact">{{ 'status.contactSupport' | translate }}</a>
      </footer>
    </div>
  `,
  styles: [`
    .status-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--background, #0f1117);
      color: var(--text-primary, #e2e8f0);
      font-family: inherit;
    }

    .status-header {
      text-align: center;
      padding: 3rem 1.5rem 2rem;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
    }

    .status-logo {
      display: inline-block;
      margin-bottom: 1.5rem;
    }

    .status-header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: var(--text-primary, #e2e8f0);
    }

    .status-subtitle {
      color: var(--text-secondary, #94a3b8);
      margin: 0 0 1.5rem;
      font-size: 0.95rem;
    }

    /* ── Overall banner ── */
    .overall-banner {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 1.4rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .overall-banner.all-good {
      background: rgba(34,197,94,0.12);
      color: #22c55e;
      border: 1px solid rgba(34,197,94,0.3);
    }
    .overall-banner.some-issues {
      background: rgba(234,179,8,0.12);
      color: #eab308;
      border: 1px solid rgba(234,179,8,0.3);
    }
    .overall-banner.major-outage {
      background: rgba(239,68,68,0.12);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.3);
    }
    .overall-banner.checking {
      background: rgba(148,163,184,0.1);
      color: #94a3b8;
      border: 1px solid rgba(148,163,184,0.2);
    }

    .overall-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
    }
    .overall-banner.all-good .overall-dot { animation: pulse-green 2s infinite; }

    @keyframes pulse-green {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Main ── */
    .status-main {
      flex: 1;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary, #94a3b8);
      margin: 0 0 1rem;
    }

    /* ── Service rows ── */
    .services-list {
      background: var(--card-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 12px;
      overflow: hidden;
    }

    .service-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
    }
    .service-row:last-child { border-bottom: none; }

    .service-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .service-name {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .service-desc {
      font-size: 0.8rem;
      color: var(--text-secondary, #94a3b8);
    }

    /* ── Status bar ── */
    .service-status-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      min-width: 120px;
    }

    .status-bar-wrap {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      overflow: hidden;
    }
    .status-bar {
      height: 100%;
      border-radius: 999px;
      transition: background 0.4s;
    }
    .bar-operational { background: #22c55e; width: 100%; }
    .bar-degraded    { background: #eab308; width: 60%; }
    .bar-down        { background: #ef4444; width: 25%; }
    .bar-checking    {
      background: linear-gradient(90deg, transparent, #94a3b8, transparent);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      width: 100%;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .status-label {
      font-size: 0.75rem;
      font-weight: 600;
    }
    .label-operational { color: #22c55e; }
    .label-degraded    { color: #eab308; }
    .label-down        { color: #ef4444; }
    .label-checking    { color: #94a3b8; }

    /* ── Meta ── */
    .service-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.15rem;
      min-width: 80px;
    }
    .latency {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary, #e2e8f0);
    }
    .checked-at {
      font-size: 0.72rem;
      color: var(--text-secondary, #94a3b8);
    }
    .detail-msg {
      font-size: 0.72rem;
      color: #ef4444;
      max-width: 120px;
      text-align: right;
    }

    /* ── Refresh bar ── */
    .refresh-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .refresh-btn {
      padding: 0.5rem 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--border, rgba(255,255,255,0.12));
      background: transparent;
      color: var(--text-primary, #e2e8f0);
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.2s;
    }
    .refresh-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.06);
    }
    .refresh-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .last-check {
      font-size: 0.8rem;
      color: var(--text-secondary, #94a3b8);
    }

    /* ── Footer ── */
    .status-footer {
      text-align: center;
      padding: 1.5rem;
      font-size: 0.85rem;
      color: var(--text-secondary, #94a3b8);
      border-top: 1px solid var(--border, rgba(255,255,255,0.08));
      display: flex;
      justify-content: center;
      gap: 0.75rem;
    }
    .status-footer a {
      color: inherit;
      text-decoration: none;
    }
    .status-footer a:hover { color: var(--text-primary, #e2e8f0); }

    @media (max-width: 600px) {
      .service-row {
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto;
      }
      .service-meta {
        display: none;
      }
    }
  `],
})
export class StatusPage implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly TRADING_BACKEND_URL = environment.tradingBackendBaseUrl;
  private readonly CHATBOT_BACKEND_URL = environment.chatbotBackendBaseUrl;

  private readonly SERVICE_DEFINITIONS: Omit<ServiceCheck, 'status' | 'latencyMs' | 'checkedAt' | 'detail'>[] = [
    {
      key: 'trading-backend',
      nameKey: 'status.services.tradingBackend.name',
      descKey: 'status.services.tradingBackend.desc',
      url: `${this.TRADING_BACKEND_URL}/health`,
    },
    {
      key: 'chatbot-backend',
      nameKey: 'status.services.chatbotBackend.name',
      descKey: 'status.services.chatbotBackend.desc',
      url: `${this.CHATBOT_BACKEND_URL}/health`,
    },
  ];

  services = signal<ServiceCheck[]>(
    this.SERVICE_DEFINITIONS.map((def) => ({
      ...def,
      status: 'checking',
      latencyMs: null,
      checkedAt: null,
      detail: '',
    })),
  );

  isChecking = signal(false);
  lastFullCheck = signal<Date | null>(null);

  private autoRefreshHandle: ReturnType<typeof globalThis.setInterval> | null = null;

  overallClass(): string {
    const statuses = this.services().map((s) => s.status);
    if (statuses.every((s) => s === 'checking')) return 'checking';
    if (statuses.every((s) => s === 'operational')) return 'all-good';
    if (statuses.some((s) => s === 'down')) return 'major-outage';
    return 'some-issues';
  }

  overallLabelKey(): string {
    const cls = this.overallClass();
    if (cls === 'checking') return 'status.overallChecking';
    if (cls === 'all-good') return 'status.overallOperational';
    if (cls === 'major-outage') return 'status.overallMajorOutage';
    return 'status.overallSomeIssues';
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.checkAll();
    // Auto-refresh every 60 seconds
    this.autoRefreshHandle = globalThis.setInterval(() => this.checkAll(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.autoRefreshHandle !== null) {
      globalThis.clearInterval(this.autoRefreshHandle);
    }
  }

  async checkAll(): Promise<void> {
    if (!this.isBrowser || this.isChecking()) return;
    this.isChecking.set(true);

    // Set all to checking
    this.services.update((list) => list.map((s) => ({ ...s, status: 'checking', latencyMs: null, detail: '' })));

    await Promise.all(this.SERVICE_DEFINITIONS.map((def, i) => this.checkService(def, i)));

    this.lastFullCheck.set(new Date());
    this.isChecking.set(false);
  }

  private async checkService(
    def: Omit<ServiceCheck, 'status' | 'latencyMs' | 'checkedAt' | 'detail'>,
    index: number,
  ): Promise<void> {
    const start = performance.now();
    let status: ServiceStatus = 'down';
    let latencyMs: number | null = null;
    let detail = '';

    try {
      const response = await fetch(def.url, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      latencyMs = Math.round(performance.now() - start);

      if (response.ok) {
        status = latencyMs > 3_000 ? 'degraded' : 'operational';
      } else {
        status = 'degraded';
        detail = `HTTP ${response.status}`;
      }
    } catch (err: any) {
      latencyMs = Math.round(performance.now() - start);
      status = 'down';
      detail = err?.name === 'TimeoutError' ? 'Timeout' : 'Unreachable';
    }

    this.services.update((list) => {
      const updated = [...list];
      updated[index] = { ...updated[index], status, latencyMs, checkedAt: new Date(), detail };
      return updated;
    });
  }
}
