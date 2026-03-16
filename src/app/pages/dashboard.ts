import { Component, DestroyRef, inject, signal, computed, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { ExchangeService, ConnectedExchange, ExchangePortfolioBreakdown, PortfolioPositionRow, SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { BotService, Bot, BotStatus } from '../services/bot.service';
import { StrategyExecution, StrategyService, StrategyTemplate, UserStrategy } from '../services/strategy.service';
import { MarketStreamService } from '../services/market-stream.service';
import { ConnectExchangeModal } from '../components/connect-exchange-modal';
import { CreateBotModal } from '../components/create-bot-modal';
import { BrowseStrategiesModal } from '../components/browse-strategies-modal';
import { EditBotModal } from '../components/edit-bot-modal';
import { AccountModeService } from '../services/account-mode.service';
import { DashboardLayoutService, DashboardSectionId } from '../services/dashboard-layout.service';
import { environment } from '../../environments/environment';

interface InstrumentChartResponse {
  symbol: string;
  timeframe: string;
  exchangeId: string;
  marketOpen?: boolean;
  marketStatusReason?: string;
  candles: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  lastPrice: number;
  changePct: number;
  updatedAt: string;
}

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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ConnectExchangeModal, CreateBotModal, BrowseStrategiesModal, EditBotModal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnDestroy {
  auth            = inject(AuthService);
  exchangeService = inject(ExchangeService);
  botService      = inject(BotService);
  strategyService = inject(StrategyService);
  marketStream    = inject(MarketStreamService);
  accountMode     = inject(AccountModeService);
  dashboardLayout = inject(DashboardLayoutService);
  private firebaseAuth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private tradingBackendBaseUrl = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');

  private instrumentChartEndpoint(): string {
    if (!this.tradingBackendBaseUrl) {
      return '/api/getInstrumentChart';
    }

    return `${this.tradingBackendBaseUrl}/v1/instrument-chart`;
  }

  @ViewChild(EditBotModal) editBotModal!: EditBotModal;

  showExchangeModal   = signal(false);
  showBotModal        = signal(false);
  showStrategiesModal = signal(false);
  showStrategyEditorModal = signal(false);
  showEditBotModal    = signal(false);
  showPortfolioDetailsModal = signal(false);
  showDeleteBotModal  = signal(false);
  showDeleteStrategyModal = signal(false);
  showDeleteExchangeModal = signal(false);
  showStrategyLiveViewModal = signal(false);
  liveViewExpanded = signal(false);
  portfolioDetailsView = signal<'portfolio' | 'pnl' | 'trades'>('portfolio');
  strategyEditorMode = signal<'create' | 'view' | 'edit'>('create');
  selectedTemplateForStrategy = signal<StrategyTemplate | null>(null);
  strategyToManage = signal<UserStrategy | null>(null);
  strategyNameInput = signal('');
  strategyAssignedBotId = signal('');
  strategyStatusInput = signal<'active' | 'paused'>('active');
  strategyTradeSideInput = signal<'buy' | 'sell'>('buy');
  strategyNotes = signal('');
  strategyFormError = signal('');
  botToDelete = signal<Bot | null>(null);
  strategyToDelete = signal<UserStrategy | null>(null);
  exchangeToDelete = signal<string | null>(null);
  liveViewStrategy = signal<UserStrategy | null>(null);
  liveViewBot = signal<Bot | null>(null);
  liveViewIsLoading = signal(false);
  liveViewError = signal('');
  liveViewTradingViewUrl = signal<SafeResourceUrl | null>(null);
  liveViewCandles = signal<InstrumentChartResponse['candles']>([]);
  liveViewLastPrice = signal<number | null>(null);
  liveViewPriceChangePct = signal<number | null>(null);
  liveViewUpdatedAt = signal('');
  liveViewMarketOpen = signal<boolean | null>(null);
  liveViewMarketStatusReason = signal('');
  runnerSummaries = signal<RunnerSummary[]>([]);
  runnerSummariesLoading = signal(false);
  runnerSummariesError = signal('');
  liquidatingPositionKey = signal('');
  pendingLiquidationPosition = signal<PortfolioPositionRow | null>(null);
  liquidationConfirmMessage = signal('');
  showLiquidationConfirmModal = signal(false);
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private liveViewTimer: ReturnType<typeof setInterval> | null = null;

  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper Money' : 'Real Money');
  visibleConnections = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));
  visibleBots = computed(() => this.botService.botsByMode(this.accountMode.mode()));
  visibleActiveBots = computed(() => this.botService.activeBotsByMode(this.accountMode.mode()));
  hasVisibleExchange = computed(() => this.visibleConnections().length > 0);
  showGettingStartedChecklist = computed(() => {
    const hasExchange = this.hasVisibleExchange();
    const hasBot = this.visibleBots().length > 0;
    const hasActiveBot = this.visibleActiveBots().length > 0;
    return !(hasExchange && hasBot && hasActiveBot);
  });
  visibleStrategies = computed(() => {
    const visibleBotIds = new Set(this.visibleBots().map(bot => bot.id));
    return this.strategyService.userStrategies().filter(strategy => visibleBotIds.has(strategy.assignedBotId));
  });
  hasMainGridSectionsVisible = computed(() => this.dashboardLayout.isSectionVisible('mainGrid'));
  strategyTemplateMap = computed(() => {
    return new Map(this.strategyService.all().map(template => [template.id, template]));
  });
  private readonly chartWidth = 100;
  private readonly chartHeight = 44;
  private readonly chartLeft = 8;
  private readonly chartRight = 1.5;
  private readonly chartTop = 2;
  private readonly chartBottom = 5;
  private readonly chartTicks = 4;

  constructor() {
    this.loadRunnerSummaries();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const mode = params.get('mode');
        if (mode === 'paper' || mode === 'real') {
          if (this.accountMode.mode() !== mode) {
            this.accountMode.setMode(mode);
          }
          return;
        }

        void this.router.navigate(['/dashboard', this.accountMode.mode()], { replaceUrl: true });
      });

    this.route.queryParamMap.subscribe(params => {
      if (params.get('open') === 'trades') {
        this.portfolioDetailsView.set('trades');
        this.showPortfolioDetailsModal.set(true);
      }

      const action = params.get('action');
      if (action) {
        this.openAssistantAction(action);

        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { action: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

  }

  private openAssistantAction(action: string) {
    if (action === 'connect') {
      this.showExchangeModal.set(true);
      return;
    }

    if (action === 'bot') {
      this.showBotModal.set(true);
      return;
    }

    if (action === 'strategies') {
      this.showStrategiesModal.set(true);
      return;
    }

    if (action === 'learn') {
      this.showToast('Ask a more specific question and I will guide you step-by-step.');
      return;
    }

    this.showToast('Unknown assistant action.');
  }

  private runnerSummariesEndpoint(): string {
    if (!this.tradingBackendBaseUrl) {
      return '/api/runner-summaries';
    }

    return `${this.tradingBackendBaseUrl}/v1/runner-summaries`;
  }

  async refreshRunnerSummaries() {
    await this.loadRunnerSummaries(true);
  }

  private async loadRunnerSummaries(showLoader = true) {
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
        `${this.runnerSummariesEndpoint()}?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      ));

      this.runnerSummaries.set(payload.items ?? []);
    } catch (err) {
      console.error('failed to load backend runner summaries', err);
      this.runnerSummariesError.set('Unable to load backend runner status right now.');
    } finally {
      if (showLoader) {
        this.runnerSummariesLoading.set(false);
      }
    }
  }

  runnerStatusLabel(summary: RunnerSummary): string {
    if (summary.failed > 0) return 'Errors';
    if (summary.executed > 0) return 'Executed';
    if (summary.skippedMarketClosed > 0) return 'Market Closed';
    return 'No Signal';
  }

  runnerStatusClass(summary: RunnerSummary): 'runner-ok' | 'runner-warn' | 'runner-quiet' {
    if (summary.failed > 0) return 'runner-warn';
    if (summary.executed > 0) return 'runner-ok';
    return 'runner-quiet';
  }

  private readonly liveViewPriceBounds = computed(() => {
    const candles = this.liveViewCandles();
    if (candles.length === 0) {
      return { min: 0, max: 1 };
    }

    const highs = candles.map(candle => candle.high);
    const lows = candles.map(candle => candle.low);
    const rawMax = Math.max(...highs);
    const rawMin = Math.min(...lows);
    const padding = Math.max((rawMax - rawMin) * 0.08, rawMin * 0.0005, 0.0001);
    const min = Math.max(rawMin - padding, 0);
    const max = rawMax + padding;
    return { min, max: Math.max(max, min + 0.0001) };
  });

  liveViewPriceTicks = computed(() => {
    const { min, max } = this.liveViewPriceBounds();
    const ticks = Array.from({ length: this.chartTicks + 1 }, (_, idx) => {
      const ratio = idx / this.chartTicks;
      const price = max - ratio * (max - min);
      return {
        price,
        y: this.priceToY(price),
      };
    });
    return ticks;
  });

  liveViewTimeTicks = computed(() => {
    const candles = this.liveViewCandles();
    if (candles.length < 2) return [] as Array<{ x: number; label: string }>;

    const count = 4;
    return Array.from({ length: count }, (_, idx) => {
      const ratio = idx / (count - 1);
      const candleIndex = Math.min(candles.length - 1, Math.round(ratio * (candles.length - 1)));
      const candle = candles[candleIndex];
      return {
        x: this.candleCenterX(candleIndex, candles.length),
        label: this.formatCandleTime(candle?.time ?? ''),
      };
    });
  });

  get portfolioCards() {
    const hasEx = this.hasVisibleExchange();
    const active = this.visibleActiveBots().length;
    const total = this.visibleBots().length;
    const selectedMode = this.accountMode.mode();
    const portfolioByType = this.exchangeService.portfolioValuesByType();
    const pnlByType = this.exchangeService.pnlValuesByType();
    const portfolio = this.exchangeService.portfolioData();
    const isLoading = this.exchangeService.isLoadingPortfolio();
    const error = this.exchangeService.portfolioError();
    
    let realMoneyValue: string;
    let paperMoneyValue: string;
    let realPnlValue: string;
    let paperPnlValue: string;
    
    if (error) {
      realMoneyValue = 'Error';
      paperMoneyValue = 'Error';
    } else if (portfolio) {
      realMoneyValue = selectedMode === 'real' && portfolioByType.real !== null ? `$${this.formatNumber(portfolioByType.real)}` : '—';
      paperMoneyValue = selectedMode === 'paper' && portfolioByType.paper !== null ? `$${this.formatNumber(portfolioByType.paper)}` : '—';
    } else if (isLoading) {
      realMoneyValue = 'Fetching...';
      paperMoneyValue = 'Fetching...';
    } else if (hasEx) {
      realMoneyValue = '—';
      paperMoneyValue = '—';
    } else {
      realMoneyValue = '—';
      paperMoneyValue = '—';
    }
    
    if (error) {
      realPnlValue = 'Error';
      paperPnlValue = 'Error';
    } else if (portfolio) {
      realPnlValue = selectedMode === 'real' && pnlByType.real !== null ? `$${this.formatNumber(pnlByType.real)}` : '—';
      paperPnlValue = selectedMode === 'paper' && pnlByType.paper !== null ? `$${this.formatNumber(pnlByType.paper)}` : '—';
    } else if (isLoading) {
      realPnlValue = 'Fetching...';
      paperPnlValue = 'Fetching...';
    } else if (hasEx) {
      realPnlValue = '—';
      paperPnlValue = '—';
    } else {
      realPnlValue = '—';
      paperPnlValue = '—';
    }
    
    return [
      { label: `Portfolio Value (${this.modeLabel()})`, value: selectedMode === 'paper' ? paperMoneyValue : realMoneyValue, secondaryValue: '', change: '', positive: true, icon: '💼' },
      { label: 'Active Bots',     value: String(active),                  secondaryValue: '', change: active ? `${active} running` : '0 running', positive: true,  icon: '🤖' },
      { label: 'Total Trades',    value: String(this.visibleBots().reduce((a,b)=>a+b.trades,0)), secondaryValue: '', change: total ? `${total} bot(s)` : 'Get started', positive: true,  icon: '📈' },
      { label: `Today's P&L (${this.modeLabel()})`, value: selectedMode === 'paper' ? paperPnlValue : realPnlValue, secondaryValue: '', change: '', positive: true, icon: '⚡' },
    ];
  }

  quickActions = [
    { label: 'Connect Exchange',  icon: '🔗', desc: 'Link Binance, Coinbase & more',    action: 'connect' },
    { label: 'Create Bot',        icon: '🤖', desc: 'Build your first trading bot',      action: 'bot' },
    { label: 'Create Strategy',   icon: '📊', desc: 'Assign a real strategy to a bot',   action: 'strategies' },
    { label: 'Run Backtest',      icon: '🔬', desc: 'Test against historical data',      action: 'backtest' },
  ];

  handleAction(action: string) {
    if (action === 'connect')    { this.showExchangeModal.set(true); }
    else if (action === 'bot')   { this.showBotModal.set(true); }
    else if (action === 'strategies') { this.showStrategiesModal.set(true); }
    else { this.showToast('Coming soon — stay tuned! 🚀'); }
  }

  onStrategySelected(strategy: StrategyTemplate) {
    if (this.visibleBots().length === 0) {
      this.showToast('Create a bot first. A strategy must be assigned to an executing bot.');
      return;
    }

    this.strategyEditorMode.set('create');
    this.selectedTemplateForStrategy.set(strategy);
    this.strategyToManage.set(null);
    this.strategyNameInput.set(strategy.name);
    this.strategyAssignedBotId.set('');
    this.strategyStatusInput.set('active');
    this.strategyTradeSideInput.set('buy');
    this.strategyNotes.set('');
    this.strategyFormError.set('');
    this.showStrategyEditorModal.set(true);
  }

  strategyTemplateFor(strategy: UserStrategy): StrategyTemplate | null {
    return this.strategyTemplateMap().get(strategy.templateId) ?? null;
  }

  isDashboardSectionVisible(sectionId: DashboardSectionId): boolean {
    return this.dashboardLayout.isSectionVisible(sectionId);
  }

  dashboardSectionOrder(sectionId: DashboardSectionId): number {
    return this.dashboardLayout.sectionOrder(sectionId);
  }

  openStrategyLiveView(strategy: UserStrategy) {
    const bot = this.visibleBots().find(item => item.id === strategy.assignedBotId) ?? null;
    this.liveViewStrategy.set(strategy);
    this.liveViewBot.set(bot);
    this.liveViewTradingViewUrl.set(null);
    this.liveViewError.set('');
    this.liveViewCandles.set([]);
    this.liveViewLastPrice.set(null);
    this.liveViewPriceChangePct.set(null);
    this.liveViewUpdatedAt.set('');
    this.liveViewMarketOpen.set(null);
    this.liveViewMarketStatusReason.set('');
    this.liveViewExpanded.set(false);
    this.showStrategyLiveViewModal.set(true);

    this.loadStrategyLiveView(true);
    
    // Initialize WebSocket stream for real-time updates
    if (bot) {
      this.initializeMarketStream(bot);
    }
    
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
    }
    this.liveViewTimer = setInterval(() => {
      this.loadStrategyLiveView(false);
    }, 15000);
  }

  private async initializeMarketStream(bot: Bot) {
    try {
      if (this.marketStream.streamStatus() === 'disconnected') {
        await this.marketStream.connect();
      }
      // Subscribe to real-time candles
      this.marketStream.subscribe(bot.symbol, bot.timeframe, 5000);
      
      // Listen for updates
      let lastUpdateTime = Date.now();
      const subscription = setInterval(() => {
        const candles = this.marketStream.currentCandles();
        if (candles.length > 0) {
          this.liveViewCandles.set(candles);
          this.liveViewUpdatedAt.set(new Date().toISOString());
          
          // Update price info
          const lastCandle = candles[candles.length - 1];
          const firstCandle = candles[0];
          this.liveViewLastPrice.set(lastCandle.close);
          const changePct = firstCandle.close > 0 ? ((lastCandle.close - firstCandle.close) / firstCandle.close) * 100 : 0;
          this.liveViewPriceChangePct.set(changePct);
          
          lastUpdateTime = Date.now();
        }
      }, 500);
      
      // Clean up subscription when modal closes
      const closeWatcherTimer = setInterval(() => {
        if (!this.showStrategyLiveViewModal()) {
          clearInterval(subscription);
          clearInterval(closeWatcherTimer);
          this.marketStream.unsubscribe(bot.symbol);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to initialize market stream:', error);
      this.liveViewError.set('Unable to connect to live data stream');
    }
  }

  closeStrategyLiveView() {
    this.showStrategyLiveViewModal.set(false);
    this.liveViewTradingViewUrl.set(null);
    this.liveViewMarketOpen.set(null);
    this.liveViewMarketStatusReason.set('');
    this.liveViewExpanded.set(false);
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
    }
  }

  toggleLiveViewExpanded() {
    this.liveViewExpanded.set(!this.liveViewExpanded());
  }

  private buildTradingViewUrl(bot: Bot | null): SafeResourceUrl | null {
    if (!bot) return null;

    const intervalMap: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
    };

    const interval = intervalMap[String(bot.timeframe || '')] ?? '60';
    const rawSymbol = String(bot.symbol || '').toUpperCase().trim();
    const compact = rawSymbol.replace(/[^A-Z0-9]/g, '');

    let tradingViewSymbol = 'BINANCE:BTCUSDT';
    if (String(bot.exchangeId || '') === 'binance') {
      tradingViewSymbol = `BINANCE:${compact || 'BTCUSDT'}`;
    } else if (rawSymbol.includes('/')) {
      // For crypto pairs on non-Binance connectors, use Binance feed for charting.
      tradingViewSymbol = `BINANCE:${compact || 'BTCUSDT'}`;
    } else {
      // Stocks default to NASDAQ feed.
      tradingViewSymbol = `NASDAQ:${rawSymbol || 'AAPL'}`;
    }

    const params = new URLSearchParams({
      symbol: tradingViewSymbol,
      interval,
      hidesidetoolbar: '1',
      symboledit: '0',
      saveimage: '0',
      toolbarbg: '#0f172a',
      theme: 'dark',
      style: '1',
      timezone: 'Etc/UTC',
      withdateranges: '1',
      hide_top_toolbar: '1',
      hide_legend: '0',
      studies: '[]',
    });

    const url = `https://s.tradingview.com/widgetembed/?${params.toString()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnDestroy() {
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
    }
  }

  private async loadStrategyLiveView(withLoader: boolean) {
    const bot = this.liveViewBot();
    const strategy = this.liveViewStrategy();
    if (!bot) {
      this.liveViewError.set('No executing bot found for this strategy.');
      return;
    }

    if (!strategy) {
      this.liveViewError.set('Strategy details are unavailable.');
      return;
    }

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      this.liveViewError.set('Please sign in again to load live data.');
      return;
    }

    if (withLoader) {
      this.liveViewIsLoading.set(true);
    }
    this.liveViewError.set('');

    try {
      const idToken = await currentUser.getIdToken();
      const payload = await firstValueFrom(this.http.post<InstrumentChartResponse>(
        this.instrumentChartEndpoint(),
        { strategyId: strategy.id },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      ));

      const candles = (payload.candles ?? []).filter(candle => {
        return Number.isFinite(candle.open)
          && Number.isFinite(candle.high)
          && Number.isFinite(candle.low)
          && Number.isFinite(candle.close);
      });

      if (candles.length < 2) {
        this.liveViewError.set('Not enough market data to draw chart.');
        this.liveViewCandles.set([]);
        return;
      }

      this.liveViewCandles.set(candles);
      this.liveViewLastPrice.set(payload.lastPrice);
      this.liveViewPriceChangePct.set(payload.changePct);
      this.liveViewUpdatedAt.set(payload.updatedAt ?? new Date().toISOString());
      this.liveViewMarketOpen.set(typeof payload.marketOpen === 'boolean' ? payload.marketOpen : null);
      this.liveViewMarketStatusReason.set(payload.marketStatusReason ?? '');
    } catch (err) {
      console.error('failed to load live instrument chart', err);
      this.liveViewError.set('Unable to load live market data right now.');
    } finally {
      if (withLoader) {
        this.liveViewIsLoading.set(false);
      }
    }
  }

  priceToY(price: number): number {
    const { min, max } = this.liveViewPriceBounds();
    const chartMinY = this.chartTop;
    const chartMaxY = this.chartHeight - this.chartBottom;
    const ratio = (price - min) / Math.max(max - min, 1e-9);
    return chartMaxY - ratio * (chartMaxY - chartMinY);
  }

  candleCenterX(index: number, total: number): number {
    const chartMinX = this.chartLeft;
    const chartMaxX = this.chartWidth - this.chartRight;
    if (total <= 1) return chartMinX;
    const slot = (chartMaxX - chartMinX) / total;
    return chartMinX + slot * index + slot * 0.5;
  }

  candleBodyWidth(total: number): number {
    const chartMinX = this.chartLeft;
    const chartMaxX = this.chartWidth - this.chartRight;
    const slot = (chartMaxX - chartMinX) / Math.max(total, 1);
    return Math.max(Math.min(slot * 0.65, 0.9), 0.18);
  }

  candleBodyY(candle: InstrumentChartResponse['candles'][number]): number {
    const openY = this.priceToY(candle.open);
    const closeY = this.priceToY(candle.close);
    return Math.min(openY, closeY);
  }

  candleBodyHeight(candle: InstrumentChartResponse['candles'][number]): number {
    const openY = this.priceToY(candle.open);
    const closeY = this.priceToY(candle.close);
    return Math.max(Math.abs(closeY - openY), 0.25);
  }

  isBullishCandle(candle: InstrumentChartResponse['candles'][number]): boolean {
    return candle.close >= candle.open;
  }

  formatAxisPrice(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 1000) return value.toFixed(0);
    if (absValue >= 1) return value.toFixed(2);
    return value.toFixed(4);
  }

  private formatCandleTime(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '--';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  assignedBotLabel(botId: string): string {
    return this.botService.bots().find(bot => bot.id === botId)?.name ?? 'Unknown Bot';
  }

  openViewStrategy(strategy: UserStrategy) {
    this.strategyEditorMode.set('view');
    this.strategyToManage.set(strategy);
    this.selectedTemplateForStrategy.set(this.strategyTemplateMap().get(strategy.templateId) ?? null);
    this.strategyNameInput.set(strategy.name);
    this.strategyAssignedBotId.set(strategy.assignedBotId);
    this.strategyStatusInput.set(strategy.status ?? 'active');
    this.strategyTradeSideInput.set(strategy.tradeSide ?? 'buy');
    this.strategyNotes.set(strategy.notes);
    this.strategyFormError.set('');
    this.showStrategyEditorModal.set(true);
  }

  openEditStrategy(strategy: UserStrategy) {
    this.strategyEditorMode.set('edit');
    this.strategyToManage.set(strategy);
    this.selectedTemplateForStrategy.set(this.strategyTemplateMap().get(strategy.templateId) ?? null);
    this.strategyNameInput.set(strategy.name);
    this.strategyAssignedBotId.set(strategy.assignedBotId);
    this.strategyStatusInput.set(strategy.status ?? 'active');
    this.strategyTradeSideInput.set(strategy.tradeSide ?? 'buy');
    this.strategyNotes.set(strategy.notes);
    this.strategyFormError.set('');
    this.showStrategyEditorModal.set(true);
  }

  removeStrategy(strategy: UserStrategy) {
    this.strategyToDelete.set(strategy);
    this.showDeleteStrategyModal.set(true);
  }

  cancelDeleteStrategy() {
    this.showDeleteStrategyModal.set(false);
    this.strategyToDelete.set(null);
  }

  async confirmDeleteStrategy() {
    const strategy = this.strategyToDelete();
    if (!strategy) return;

    try {
      await this.strategyService.removeUserStrategy(strategy.id);
      this.showDeleteStrategyModal.set(false);
      this.strategyToDelete.set(null);
      this.showToast(`🗑 "${strategy.name}" deleted.`);
    } catch (err) {
      console.error('failed to delete strategy', err);
      this.showToast('Unable to delete strategy right now. Please try again.');
    }
  }

  closeStrategyEditor() {
    this.showStrategyEditorModal.set(false);
    this.strategyFormError.set('');
  }

  async saveStrategy() {
    if (this.strategyEditorMode() === 'view') {
      this.closeStrategyEditor();
      return;
    }

    const name = this.strategyNameInput().trim();
    if (!name) {
      this.strategyFormError.set('Please enter a strategy name.');
      return;
    }

    const assignedBotId = this.strategyAssignedBotId();
    const assignedBot = this.visibleBots().find(bot => bot.id === assignedBotId);
    if (!assignedBot) {
      this.strategyFormError.set('Please select the bot that will execute this strategy.');
      return;
    }

    try {
      if (this.strategyEditorMode() === 'create') {
        const template = this.selectedTemplateForStrategy();
        if (!template) {
          this.strategyFormError.set('Select a strategy template first.');
          return;
        }

        const created = await this.strategyService.createUserStrategy({
          templateId: template.id,
          templateName: template.name,
          templateIcon: template.icon,
          name,
          assignedBotId: assignedBot.id,
          assignedBotName: assignedBot.name,
          status: this.strategyStatusInput(),
          tradeSide: this.strategyTradeSideInput(),
          notes: this.strategyNotes(),
        });
        if (created.status === 'active' && assignedBot.status === 'active') {
          this.showToast(`📊 "${created.name}" created. Backend evaluation is active and orders will only run on entry/exit signals.`);
        } else {
          this.showToast(`📊 "${created.name}" created and linked to "${assignedBot.name}".`);
        }
      } else {
        const existing = this.strategyToManage();
        if (!existing) return;

        const updated = await this.strategyService.updateUserStrategy(existing.id, {
          name,
          assignedBotId: assignedBot.id,
          assignedBotName: assignedBot.name,
          status: this.strategyStatusInput(),
          tradeSide: this.strategyTradeSideInput(),
          notes: this.strategyNotes(),
        });
        if (updated.status === 'active' && assignedBot.status === 'active') {
          this.showToast(`✏️ "${updated.name}" updated. Backend evaluation will place orders only when signals trigger.`);
        } else {
          this.showToast(`✏️ "${updated.name}" updated successfully.`);
        }
      }

      this.closeStrategyEditor();
    } catch (err) {
      console.error('failed to save strategy', err);
      const message = (err as { message?: string } | null)?.message;
      this.strategyFormError.set(message || 'Unable to save strategy right now. Please try again.');
    }
  }

  strategyEditorTitle(): string {
    if (this.strategyEditorMode() === 'create') return 'Create Strategy';
    if (this.strategyEditorMode() === 'edit') return 'Edit Strategy';
    return 'View Strategy';
  }

  strategyEditorActionLabel(): string {
    return this.strategyEditorMode() === 'edit' ? 'Save Changes' : 'Create Strategy';
  }

  isStrategyReadOnly(): boolean {
    return this.strategyEditorMode() === 'view';
  }

  strategiesSectionTitle(): string {
    return this.accountMode.mode() === 'paper' ? 'My Paper Money Strategy' : 'My Real Money Strategies';
  }

  async toggleStrategyStatus(strategy: UserStrategy) {
    const nextStatus: 'active' | 'paused' = (strategy.status ?? 'active') === 'active' ? 'paused' : 'active';

    try {
      const updated = await this.strategyService.updateUserStrategy(strategy.id, {
        name: strategy.name,
        assignedBotId: strategy.assignedBotId,
        assignedBotName: strategy.assignedBotName,
        status: nextStatus,
        tradeSide: strategy.tradeSide ?? 'buy',
        notes: strategy.notes,
      });

      if (updated.status === 'active') {
        const assignedBot = this.visibleBots().find(bot => bot.id === updated.assignedBotId);
        if (assignedBot?.status === 'active') {
          this.showToast(`▶ "${updated.name}" activated. Backend evaluation is now running.`);
        } else {
          this.showToast(`▶ "${updated.name}" activated. Activate the assigned bot to execute trades.`);
        }
      } else {
        this.showToast(`⏸ "${updated.name}" paused.`);
      }
    } catch (err) {
      console.error('failed to toggle strategy status', err);
      this.showToast('Unable to update strategy status right now.');
    }
  }

  onConnected(conn: ConnectedExchange) {
    this.showToast(`✅ ${conn.label} connected successfully!`);
  }

  onBotCreated(bot: Bot) {
    this.showToast(`🤖 "${bot.name}" launched and is now active!`);
  }

  removeExchange(label: string) {
    this.exchangeToDelete.set(label);
    this.showDeleteExchangeModal.set(true);
  }

  confirmDeleteExchange() {
    const label = this.exchangeToDelete();
    if (label) {
      this.exchangeService.remove(label);
      this.showDeleteExchangeModal.set(false);
      this.exchangeToDelete.set(null);
      this.showToast('Exchange disconnected.');
    }
  }

  cancelDeleteExchange() {
    this.showDeleteExchangeModal.set(false);
    this.exchangeToDelete.set(null);
  }

  async toggleBotStatus(bot: Bot) {
    const next: BotStatus = bot.status === 'active' ? 'paused' : 'active';
    try {
      await this.botService.setStatus(bot.id, next);
      if (next === 'active') {
        const linkedActiveStrategies = this.visibleStrategies().filter(strategy => strategy.assignedBotId === bot.id && (strategy.status ?? 'active') === 'active');
        if (linkedActiveStrategies.length === 0) {
          this.showToast(`▶ "${bot.name}" resumed.`);
          return;
        }
        this.showToast(`▶ "${bot.name}" resumed. Linked strategies are now evaluated in backend for entry/exit signals.`);
      } else {
        this.showToast(`⏸ "${bot.name}" paused.`);
      }
    } catch (err) {
      console.error('failed to toggle bot status', err);
      this.showToast('Unable to change bot status right now.');
    }
  }

  removeBot(bot: Bot) {
    this.botToDelete.set(bot);
    this.showDeleteBotModal.set(true);
  }

  confirmDeleteBot() {
    const bot = this.botToDelete();
    if (bot) {
      this.botService.remove(bot.id);
      this.showDeleteBotModal.set(false);
      this.botToDelete.set(null);
      this.showToast(`🗑 "${bot.name}" deleted.`);
    }
  }

  cancelDeleteBot() {
    this.showDeleteBotModal.set(false);
    this.botToDelete.set(null);
  }

  showBotSettings(bot: Bot) {
    // Allow editing name and exchange even when active, fully read-only when stopped
    const isReadOnly = bot.status === 'stopped';
    this.editBotModal.open(bot, isReadOnly);
    this.showEditBotModal.set(true);
  }

  onBotUpdated(bot: Bot) {
    this.showEditBotModal.set(false);
    this.showToast(`✏️ "${bot.name}" updated successfully!`);
  }

  onPortfolioCardClick(index: number) {
    if (index === 0) {
      this.portfolioDetailsView.set('portfolio');
    } else if (index === 2) {
      this.portfolioDetailsView.set('trades');
    } else if (index === 3) {
      this.portfolioDetailsView.set('pnl');
    } else {
      return;
    }

    this.showPortfolioDetailsModal.set(true);
  }

  closePortfolioDetailsModal() {
    this.showPortfolioDetailsModal.set(false);
  }

  openTradeDetails(execution: StrategyExecution) {
    this.showPortfolioDetailsModal.set(false);
    this.router.navigate(['/trade', execution.id]);
  }

  get portfolioBreakdownRows() {
    return this.exchangeService.portfolioBreakdownByMode(this.accountMode.mode());
  }

  get openPositionsRows(): PortfolioPositionRow[] {
    return this.exchangeService.portfolioPositionsByMode(this.accountMode.mode());
  }

  get currentModePortfolioValue(): number | null {
    const byType = this.exchangeService.portfolioValuesByType();
    return this.accountMode.mode() === 'paper' ? byType.paper : byType.real;
  }

  get currentModePnlValue(): number | null {
    const byType = this.exchangeService.pnlValuesByType();
    return this.accountMode.mode() === 'paper' ? byType.paper : byType.real;
  }

  refreshPortfolioManagement() {
    this.exchangeService.refreshPortfolioData();
  }

  async liquidateOpenPosition(position: PortfolioPositionRow) {
    if (position.marketOpen === false) {
      const statusReason = position.marketStatusReason?.trim();
      const closedMessage = statusReason
        ? `Market is closed now (${statusReason}). Would you like to place an order for this position?`
        : 'Market is closed now. Would you like to place an order for this position?';

      this.pendingLiquidationPosition.set(position);
      this.liquidationConfirmMessage.set(closedMessage);
      this.showLiquidationConfirmModal.set(true);
      return;
    }

    await this.executeLiquidation(position);
  }

  closeLiquidationConfirmModal() {
    this.showLiquidationConfirmModal.set(false);
    this.pendingLiquidationPosition.set(null);
    this.liquidationConfirmMessage.set('');
  }

  async confirmLiquidationWhenClosed() {
    const position = this.pendingLiquidationPosition();
    this.closeLiquidationConfirmModal();
    if (!position) {
      return;
    }

    await this.executeLiquidation(position);
  }

  private async executeLiquidation(position: PortfolioPositionRow) {
    const key = `${position.exchangeLabel}:${position.symbol}`;
    this.liquidatingPositionKey.set(key);

    try {
      await this.exchangeService.liquidatePosition(position);
      this.showToast(`Position ${position.symbol} liquidated.`);
    } catch (error: any) {
      this.showToast(error?.message || 'Unable to liquidate position right now.');
    } finally {
      this.liquidatingPositionKey.set('');
    }
  }

  get portfolioDetailsTitle() {
    if (this.portfolioDetailsView() === 'pnl') return "Today's P&L Breakdown";
    if (this.portfolioDetailsView() === 'trades') return 'Executed Buy/Sell Orders';
    return 'Portfolio Value Breakdown';
  }

  get portfolioDetailsEmptyMessage() {
    if (this.portfolioDetailsView() === 'pnl') return 'No exchange P&L data available yet.';
    if (this.portfolioDetailsView() === 'trades') return 'No executed buy/sell orders yet.';
    return 'No exchange balances available yet.';
  }

  get isPnlDetailsView() {
    return this.portfolioDetailsView() === 'pnl';
  }

  get isTradesDetailsView() {
    return this.portfolioDetailsView() === 'trades';
  }

  get tradeDetailsRows(): StrategyExecution[] {
    if (!this.isTradesDetailsView) return [];

    const visibleBotIds = new Set(this.visibleBots().map(bot => bot.id));
    return this.strategyService.executions().filter(execution => visibleBotIds.has(execution.botId));
  }

  private toFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private executionPriceFor(execution: StrategyExecution): number | null {
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
  }

  private executionSharesFor(execution: StrategyExecution): number | null {
    if (Number.isFinite(Number(execution.shareQuantity)) && Number(execution.shareQuantity) > 0) {
      return Number(execution.shareQuantity);
    }

    const raw = (execution.rawOrder ?? {}) as Record<string, unknown>;
    return [
      raw['filled_qty'],
      raw['qty'],
      raw['executedQty'],
      raw['origQty'],
      raw['filled'],
      raw['size'],
    ]
      .map(value => this.toFiniteNumber(value))
      .find((value): value is number => !!value && value > 0) ?? null;
  }

  executionSharesLabel(execution: StrategyExecution): string {
    const shares = this.executionSharesFor(execution);
    const sideLabel = execution.side === 'sell' ? 'Shares sold' : 'Shares bought';
    if (shares === null) return `${sideLabel}: N/A`;
    return `${sideLabel}: ${shares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  }

  executionActualAmount(execution: StrategyExecution): number {
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

    const price = this.executionPriceFor(execution);
    const shares = this.executionSharesFor(execution);
    if (price && shares && shares > 0) {
      return price * shares;
    }

    const investment = this.toFiniteNumber(execution.investment);
    return investment && investment > 0 ? investment : 0;
  }

  formatBreakdownValue(row: ExchangePortfolioBreakdown): string {
    if (this.portfolioDetailsView() === 'pnl') {
      if (row.unrealizedPnl === null || row.unrealizedPnl === undefined || row.pnlPercentage === null || row.pnlPercentage === undefined) {
        return 'N/A';
      }

      const sign = row.unrealizedPnl >= 0 ? '+' : '';
      const pctSign = row.pnlPercentage >= 0 ? '+' : '';
      return `${sign}$${this.formatNumber(row.unrealizedPnl)} (${pctSign}${row.pnlPercentage.toFixed(2)}%)`;
    }
    return `$${this.formatNumber(row.portfolioValue)}`;
  }

  formatNumber(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exchangeName(id: string): string {
    return SUPPORTED_EXCHANGES.find(e => e.id === id)?.name ?? id;
  }

  exchangeLogo(id: string): string {
    return SUPPORTED_EXCHANGES.find(e => e.id === id)?.logo ?? '🔗';
  }

  isPaperExchange(id: string): boolean {
    return SUPPORTED_EXCHANGES.find(e => e.id === id)?.isPaper ?? false;
  }

  private showToast(msg: string) {
    this.toastMsg.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
