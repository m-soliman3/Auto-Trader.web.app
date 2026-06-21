import { Component, DestroyRef, inject, signal, computed, ViewChild, OnDestroy, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { TourService } from '../services/tour.service';
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
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink, ConnectExchangeModal, CreateBotModal, BrowseStrategiesModal, EditBotModal, TranslateModule],
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
  tourService     = inject(TourService);
  private firebaseAuth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private translate = inject(TranslateService);
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
  exchangeDisconnectRiskConfirmed = signal(false);
  exchangeDisconnectConfirmText = signal('');
  exchangeDisconnectError = signal('');
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
  liveViewStrategyMarkers = signal<Array<{ index: number; type: 'entry' | 'exit'; price: number }>>([]);
  liveViewEmaLines = signal<{ ema9: Array<{ x: number; y: number }>, ema21: Array<{ x: number; y: number }> }>({ ema9: [], ema21: [] });
  liveViewEntryPrice = signal<number | null>(null);
  liveViewExitPrice = signal<number | null>(null);
  liveViewStrategyCategory = signal<string>('');
  runnerSummaries = signal<RunnerSummary[]>([]);
  runnerSummariesLoading = signal(false);
  runnerSummariesError = signal('');
  visibleRunnerSummaries = computed(() => this.runnerSummaries().slice(0, 5));
  remainingRunnerSummariesCount = computed(() => {
    return Math.max(0, this.runnerSummaries().length - 5);
  });
  liquidatingPositionKey = signal('');
  pendingLiquidationPosition = signal<PortfolioPositionRow | null>(null);
  liquidationConfirmMessage = signal('');
  showLiquidationConfirmModal = signal(false);
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private liveViewTimer: ReturnType<typeof setInterval> | null = null;

  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'nav.paper' : 'nav.real');
  visibleConnections = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));
  previewConnections = computed(() => this.visibleConnections().slice(0, 2));
  remainingConnectionsCount = computed(() => Math.max(0, this.visibleConnections().length - 2));
  visibleBots = computed(() => this.botService.botsByMode(this.accountMode.mode()));
  previewBots = computed(() => this.visibleBots().slice(0, 2));
  remainingBotsCount = computed(() => Math.max(0, this.visibleBots().length - 2));
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
  previewStrategies = computed(() => this.visibleStrategies().slice(0, 2));
  remainingStrategiesCount = computed(() => Math.max(0, this.visibleStrategies().length - 2));
  hasMainGridSectionsVisible = computed(() => this.dashboardLayout.isSectionVisible('mainGrid'));
  strategyTemplateMap = computed(() => {
    return new Map(this.strategyService.all().map(template => [template.id, template]));
  });
  liveViewStrategyTemplate = computed(() => {
    const strategy = this.liveViewStrategy();
    if (!strategy) return null;
    return this.strategyTemplateMap().get(strategy.templateId) ?? null;
  });
  canConfirmExchangeDisconnect = computed(() => {
    return this.exchangeDisconnectRiskConfirmed() && 
           this.exchangeDisconnectConfirmText() === this.t('dashboard.disconnectPlaceholder');
  });
  private readonly chartWidth = 100;
  private readonly chartHeight = 44;
  private readonly chartLeft = 8;
  private readonly chartRight = 1.5;
  private readonly chartTop = 2;
  private readonly chartBottom = 5;
  private readonly chartTicks = 4;

  constructor() {
    // Reactively redirect to the signup guide whenever auth resolves
    // and the user hasn't completed it yet (handles async Firebase restore).
    effect(() => {
      const user = this.auth.currentUser();
      if (user && !user.onboardingCompleted) {
        void this.router.navigate(['/signup-guide'], { replaceUrl: true });
      }
    });

    this.loadRunnerSummaries();
    // Auto-start the tour on first dashboard visit after onboarding.
    this.tourService.startIfFirstVisit();
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
      const botId = params.get('botId');
      const templateId = params.get('templateId');
      const strategyId = params.get('strategyId');
      if (action) {
        this.openAssistantAction(action, botId, templateId, strategyId);

        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { action: null, botId: null, templateId: null, strategyId: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

  }

  ngOnDestroy(): void {
    // Clean up timers on component destruction
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  private openAssistantAction(action: string, botId?: string | null, templateId?: string | null, strategyId?: string | null) {
    if (action === 'connect') {
      this.goToAddExchange();
      return;
    }

    if (action === 'bot') {
      this.goToAddBot();
      return;
    }

    if (action === 'edit-bot' && botId) {
      const bot = this.visibleBots().find(b => b.id === botId);
      if (bot && this.editBotModal) {
        this.editBotModal.open(bot);
      }
      return;
    }

    if (action === 'create-strategy' && templateId) {
      const template = this.strategyService.all().find(t => t.id === templateId);
      if (template) {
        this.strategyEditorMode.set('create');
        this.selectedTemplateForStrategy.set(template);
        this.showStrategyEditorModal.set(true);
      }
      return;
    }

    if (action === 'edit-strategy' && strategyId) {
      const strategy = this.visibleStrategies().find(s => s.id === strategyId);
      if (strategy) {
        this.strategyEditorMode.set('edit');
        this.openEditStrategy(strategy);
      }
      return;
    }

    if (action === 'strategies') {
      this.goToAddStrategy();
      return;
    }

    if (action === 'learn') {
      this.showToast(this.t('dashboard.assistantAskSpecific'));
      return;
    }

    this.showToast(this.t('dashboard.assistantUnknownAction'));
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
      this.runnerSummariesError.set(this.t('dashboard.backendMonitorDisabled'));
      this.runnerSummaries.set([]);
      return;
    }

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      this.runnerSummariesError.set(this.t('dashboard.signInRunnerStatus'));
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
      this.runnerSummariesError.set(this.t('dashboard.runnerStatusLoadError'));
    } finally {
      if (showLoader) {
        this.runnerSummariesLoading.set(false);
      }
    }
  }

  runnerStatusLabel(summary: RunnerSummary): string {
    if (summary.failed > 0) return 'dashboard.statusErrors';
    if (summary.executed > 0) return 'dashboard.statusExecuted';
    if (summary.skippedMarketClosed > 0) return 'dashboard.statusMarketClosed';
    return 'dashboard.statusNoSignal';
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
      { labelKey: 'dashboard.portfolioValue', value: selectedMode === 'paper' ? paperMoneyValue : realMoneyValue, secondaryValue: '', changeKey: '', changeParams: {}, positive: true, icon: '💼' },
      { labelKey: 'dashboard.activeBots',     value: String(active),                  secondaryValue: '', changeKey: 'dashboard.botsRunningCount', changeParams: {count: active}, positive: true,  icon: '🤖' },
      { labelKey: 'dashboard.totalTrades',    value: String(this.visibleBots().reduce((a,b)=>a+b.trades,0)), secondaryValue: '', changeKey: total ? 'dashboard.botsCount' : 'dashboard.getStarted', changeParams: {count: total}, positive: true,  icon: '📈' },
      { labelKey: 'dashboard.todayPnl', value: selectedMode === 'paper' ? paperPnlValue : realPnlValue, secondaryValue: '', changeKey: '', changeParams: {}, positive: true, icon: '⚡' },
    ];
  }

  quickActions = [
    { labelKey: 'dashboard.qaConnectLabel',       icon: '🔗', descKey: 'dashboard.qaConnectDesc',       action: 'connect' },
    { labelKey: 'dashboard.qaCreateBotLabel',     icon: '🤖', descKey: 'dashboard.qaCreateBotDesc',     action: 'bot' },
    { labelKey: 'dashboard.qaCreateStrategyLabel',icon: '📊', descKey: 'dashboard.qaCreateStrategyDesc',action: 'strategies' },
    { labelKey: 'dashboard.qaRunBacktestLabel',   icon: '🔬', descKey: 'dashboard.qaRunBacktestDesc',   action: 'backtest' },
  ];

  handleAction(action: string) {
    if (action === 'connect')    { this.goToAddExchange(); }
    else if (action === 'bot')   { this.goToAddBot(); }
    else if (action === 'strategies') { this.goToAddStrategy(); }
    else { this.showToast(this.t('dashboard.comingSoon')); }
  }

  goToAddExchange() {
    void this.router.navigate(['/exchanges'], { queryParams: { open: 'add' } });
  }

  goToAddBot() {
    void this.router.navigate(['/bots'], { queryParams: { open: 'add' } });
  }

  goToAddStrategy() {
    void this.router.navigate(['/strategies'], { queryParams: { open: 'add' } });
  }

  openExchangesPage() {
    void this.router.navigate(['/exchanges']);
  }

  openBotsPage() {
    void this.router.navigate(['/bots']);
  }

  openStrategiesPage() {
    void this.router.navigate(['/strategies']);
  }

  onStrategySelected(strategy: StrategyTemplate) {
    if (this.visibleBots().length === 0) {
      this.showToast(this.t('dashboard.createBotFirst'));
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
    const templateForUrl = this.strategyTemplateMap().get(strategy.templateId) ?? null;
    this.liveViewTradingViewUrl.set(this.buildTradingViewUrl(bot, templateForUrl));
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
      this.liveViewError.set(this.t('dashboard.liveDataStreamError'));
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

  private buildTradingViewUrl(bot: Bot | null, strategy: StrategyTemplate | null = null): SafeResourceUrl | null {
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

    // Build studies array from strategy indicators
    const studies = this.getStrategyStudies(strategy);

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
      studies: JSON.stringify(studies),
    });

    const url = `https://s.tradingview.com/widgetembed/?${params.toString()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private getStrategyStudies(strategy: StrategyTemplate | null): Array<{ id: string; version: Record<string, unknown> }> {
    if (!strategy) return [];

    const studies: Array<{ id: string; version: Record<string, unknown> }> = [];
    const tagLower = strategy.tags.map(t => t.toLowerCase());

    // Map strategy tags to TradingView studies
    const tagToStudy: Record<string, { id: string; settings: Record<string, unknown> }> = {
      'ema': {
        id: 'MAExp@tv-basicstudies',
        settings: { showMA: true, length: 9 },
      },
      'macd': {
        id: 'MACD@tv-basicstudies',
        settings: {},
      },
      'adx': {
        id: 'ADX@tv-basicstudies',
        settings: { length: 14 },
      },
      'rsi': {
        id: 'RSI@tv-basicstudies',
        settings: { length: 14 },
      },
      'bollinger': {
        id: 'BB@tv-basicstudies',
        settings: { length: 20 },
      },
      'supertrend': {
        id: 'Supertrend@tv-basicstudies',
        settings: { atrLength: 10, factor: 3 },
      },
      'atr': {
        id: 'ATR@tv-basicstudies',
        settings: { length: 14 },
      },
      'vwap': {
        id: 'VWAP@tv-basicstudies',
        settings: {},
      },
      'volume': {
        id: 'Volume@tv-basicstudies',
        settings: {},
      },
    };

    // Convert tags to lowercase and check for matches
    const addedStudies = new Set<string>();
    for (const tag of tagLower) {
      for (const [key, study] of Object.entries(tagToStudy)) {
        if (tag.includes(key) && !addedStudies.has(study.id)) {
          studies.push({
            id: study.id,
            version: study.settings,
          });
          addedStudies.add(study.id);
        }
      }
    }

    return studies;
  }

  private computeStrategyMarkers(strategy: StrategyTemplate, candles: InstrumentChartResponse['candles']): Array<{ index: number; type: 'entry' | 'exit'; price: number }> {
    const markers: Array<{ index: number; type: 'entry' | 'exit'; price: number }> = [];
    if (candles.length < 3) return markers;

    const category = strategy.category.toLowerCase();
    const tagsLower = strategy.tags.map(t => t.toLowerCase());

    // Detect potential entry/exit points based on strategy category
    if (category.includes('trend')) {
      // For trend strategies, mark potential crossovers
      this.detectTrendMarkers(candles, markers);
    } else if (category.includes('mean-reversion')) {
      // For mean reversion, mark potential reversals at extremes
      this.detectMeanReversionMarkers(candles, markers);
    } else if (category.includes('momentum')) {
      // For momentum strategies, mark breakouts
      this.detectMomentumMarkers(candles, markers);
    }

    return markers;
  }

  private detectTrendMarkers(candles: InstrumentChartResponse['candles'], markers: Array<{ index: number; type: 'entry' | 'exit'; price: number }>): void {
    // Detect simple EMA-like crossovers using close prices
    const closePrice = candles.map(c => c.close);
    const shortEMA = this.calculateEMA(closePrice, 9);
    const longEMA = this.calculateEMA(closePrice, 21);

    for (let i = 1; i < shortEMA.length; i++) {
      const prev = { short: shortEMA[i - 1], long: longEMA[i - 1] };
      const curr = { short: shortEMA[i], long: longEMA[i] };

      // Golden cross (bullish)
      if (prev.short <= prev.long && curr.short > curr.long) {
        markers.push({ index: i, type: 'entry', price: candles[i].close });
      }
      // Death cross (bearish)
      else if (prev.short >= prev.long && curr.short < curr.long) {
        markers.push({ index: i, type: 'exit', price: candles[i].close });
      }
    }
  }

  private detectMeanReversionMarkers(candles: InstrumentChartResponse['candles'], markers: Array<{ index: number; type: 'entry' | 'exit'; price: number }>): void {
    // Detect RSI-like extremes
    const closePrice = candles.map(c => c.close);
    const rsi = this.calculateRSI(closePrice, 14);

    for (let i = 0; i < rsi.length; i++) {
      // Oversold (entry signal)
      if (rsi[i] < 30) {
        markers.push({ index: i, type: 'entry', price: candles[i].close });
      }
      // Overbought (exit signal)
      else if (rsi[i] > 70) {
        markers.push({ index: i, type: 'exit', price: candles[i].close });
      }
    }
  }

  private detectMomentumMarkers(candles: InstrumentChartResponse['candles'], markers: Array<{ index: number; type: 'entry' | 'exit'; price: number }>): void {
    // Detect breakouts based on volatility
    const closePrice = candles.map(c => c.close);
    const highPrice = candles.map(c => c.high);
    const lowPrice = candles.map(c => c.low);

    const lookback = 5;
    for (let i = lookback; i < candles.length; i++) {
      const prev = candles.slice(i - lookback, i);
      const prevHigh = Math.max(...prev.map(c => c.high));
      const prevLow = Math.min(...prev.map(c => c.low));

      // Breakout above resistance
      if (closePrice[i] > prevHigh) {
        markers.push({ index: i, type: 'entry', price: candles[i].close });
      }
      // Breakdown below support
      else if (closePrice[i] < prevLow) {
        markers.push({ index: i, type: 'exit', price: candles[i].close });
      }
    }
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    let sum = 0;
    for (let i = 0; i < Math.min(period, prices.length); i++) {
      sum += prices[i];
    }
    ema[period - 1] = sum / period;

    for (let i = period; i < prices.length; i++) {
      const prevEMA = ema[i - 1] ?? prices[i];
      ema[i] = (prices[i] - prevEMA) * multiplier + prevEMA;
    }

    return ema;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    if (prices.length < period + 1) return [];

    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gain += change;
      else loss += -change;
    }

    let avgGain = gain / period;
    let avgLoss = loss / period;

    for (let i = period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }

    return rsi;
  }

  private computeEmaLines(candles: InstrumentChartResponse['candles']): { ema9: Array<{ x: number; y: number }>, ema21: Array<{ x: number; y: number }> } {
    const closePrice = candles.map(c => c.close);
    const ema9 = this.calculateEMA(closePrice, 9);
    const ema21 = this.calculateEMA(closePrice, 21);

    const ema9Data = ema9
      .map((price, index) => ({
        x: this.candleCenterX(index, candles.length),
        y: this.priceToY(price)
      }))
      .filter((point, index) => ema9[index] !== undefined);

    const ema21Data = ema21
      .map((price, index) => ({
        x: this.candleCenterX(index, candles.length),
        y: this.priceToY(price)
      }))
      .filter((point, index) => ema21[index] !== undefined);

    return { ema9: ema9Data, ema21: ema21Data };
  }

  private async loadStrategyLiveView(withLoader: boolean) {
    const bot = this.liveViewBot();
    const strategy = this.liveViewStrategy();
    if (!bot) {
      this.liveViewError.set(this.t('dashboard.liveViewNoBot'));
      return;
    }

    if (!strategy) {
      this.liveViewError.set(this.t('dashboard.liveViewNoStrategy'));
      return;
    }

    const currentUser = this.firebaseAuth.currentUser;
    if (!currentUser) {
      this.liveViewError.set(this.t('dashboard.liveViewSignInAgain'));
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
        this.liveViewError.set(this.t('dashboard.liveViewNotEnoughData'));
        this.liveViewCandles.set([]);
        return;
      }

      this.liveViewCandles.set(candles);
      this.liveViewLastPrice.set(payload.lastPrice);
      this.liveViewPriceChangePct.set(payload.changePct);
      this.liveViewUpdatedAt.set(payload.updatedAt ?? new Date().toISOString());
      this.liveViewMarketOpen.set(typeof payload.marketOpen === 'boolean' ? payload.marketOpen : null);
      this.liveViewMarketStatusReason.set(payload.marketStatusReason ?? '');
      
      // Compute strategy entry/exit markers for visualization
      const strategyTemplate = this.liveViewStrategyTemplate();
      if (strategyTemplate && candles.length > 0) {
        // Store strategy category for conditional rendering
        this.liveViewStrategyCategory.set(strategyTemplate.category.toLowerCase());
        
        const markers = this.computeStrategyMarkers(strategyTemplate, candles);
        this.liveViewStrategyMarkers.set(markers);
        
        // Compute strategy-specific indicators based on category
        const category = strategyTemplate.category.toLowerCase();
        if (category.includes('trend')) {
          // For trend strategies, show EMA lines
          const emaData = this.computeEmaLines(candles);
          this.liveViewEmaLines.set(emaData);
        } else {
          // Clear EMA lines for non-trend strategies
          this.liveViewEmaLines.set({ ema9: [], ema21: [] });
        }
        
        // Compute entry and exit price levels
        this.computeEntryExitLevels(markers);
      }
    } catch (err) {
      console.error('failed to load live instrument chart', err);
      this.liveViewError.set(this.t('dashboard.liveViewLoadError'));
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

  getEma9Points(): string {
    const points = this.liveViewEmaLines().ema9;
    if (points.length === 0) return '';
    return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  }

  getEma21Points(): string {
    const points = this.liveViewEmaLines().ema21;
    if (points.length === 0) return '';
    return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  }

  private computeEntryExitLevels(markers: Array<{ index: number; type: 'entry' | 'exit'; price: number }>): void {
    // Get the most recent entry and exit prices from markers
    const entryMarkers = markers.filter(m => m.type === 'entry');
    const exitMarkers = markers.filter(m => m.type === 'exit');
    
    // Use the most recent entry and exit prices
    const lastEntry = entryMarkers.length > 0 ? entryMarkers[entryMarkers.length - 1].price : null;
    const lastExit = exitMarkers.length > 0 ? exitMarkers[exitMarkers.length - 1].price : null;
    
    this.liveViewEntryPrice.set(lastEntry);
    this.liveViewExitPrice.set(lastExit);
  }

  getEntryLevelY(): number | null {
    const price = this.liveViewEntryPrice();
    return price !== null ? this.priceToY(price) : null;
  }

  getExitLevelY(): number | null {
    const price = this.liveViewExitPrice();
    return price !== null ? this.priceToY(price) : null;
  }

  assignedBotLabel(botId: string): string {
    return this.botService.bots().find(bot => bot.id === botId)?.name ?? this.t('dashboard.unknownBot');
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
      this.showToast(this.t('dashboard.strategyDeleted', { name: strategy.name }));
    } catch (err) {
      console.error('failed to delete strategy', err);
      this.showToast(this.t('dashboard.unableDeleteStrategy'));
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
      this.strategyFormError.set(this.t('dashboard.validation.enterStrategyName'));
      return;
    }

    const assignedBotId = this.strategyAssignedBotId();
    const assignedBot = this.visibleBots().find(bot => bot.id === assignedBotId);
    if (!assignedBot) {
      this.strategyFormError.set(this.t('dashboard.validation.selectExecutingBot'));
      return;
    }

    try {
      if (this.strategyEditorMode() === 'create') {
        const template = this.selectedTemplateForStrategy();
        if (!template) {
          this.strategyFormError.set(this.t('dashboard.validation.selectTemplateFirst'));
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
          this.showToast(this.t('dashboard.strategyCreatedBackendActive', { name: created.name }));
        } else {
          this.showToast(this.t('dashboard.strategyCreatedLinked', { name: created.name, botName: assignedBot.name }));
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
          this.showToast(this.t('dashboard.strategyUpdatedBackendSignals', { name: updated.name }));
        } else {
          this.showToast(this.t('dashboard.strategyUpdatedSuccess', { name: updated.name }));
        }
      }

      this.closeStrategyEditor();
    } catch (err) {
      console.error('failed to save strategy', err);
      const message = (err as { message?: string } | null)?.message;
      this.strategyFormError.set(message || this.t('dashboard.unableSaveStrategy'));
    }
  }

  strategyEditorTitle(): string {
    if (this.strategyEditorMode() === 'create') return this.t('dashboard.strategyEditorCreateTitle');
    if (this.strategyEditorMode() === 'edit') return this.t('dashboard.strategyEditorEditTitle');
    return this.t('dashboard.strategyEditorViewTitle');
  }

  strategyEditorActionLabel(): string {
    return this.strategyEditorMode() === 'edit'
      ? this.t('dashboard.strategyEditorSaveChanges')
      : this.t('dashboard.strategyEditorCreateAction');
  }

  isStrategyReadOnly(): boolean {
    return this.strategyEditorMode() === 'view';
  }

  strategiesSectionTitle(): string {
    return this.accountMode.mode() === 'paper'
      ? this.t('dashboard.myPaperMoneyStrategy')
      : this.t('dashboard.myRealMoneyStrategies');
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
          this.showToast(this.t('dashboard.strategyActivatedBackendRunning', { name: updated.name }));
        } else {
          this.showToast(this.t('dashboard.strategyActivatedActivateBot', { name: updated.name }));
        }
      } else {
        this.showToast(this.t('dashboard.strategyPaused', { name: updated.name }));
      }
    } catch (err) {
      console.error('failed to toggle strategy status', err);
      this.showToast(this.t('dashboard.unableUpdateStrategyStatus'));
    }
  }

  onConnected(conn: ConnectedExchange) {
    this.showToast(this.t('dashboard.exchangeConnectedSuccess', { label: conn.label }));
  }

  onBotCreated(bot: Bot) {
    this.showToast(this.t('dashboard.botLaunchedActive', { name: bot.name }));
  }

  removeExchange(label: string) {
    this.exchangeToDelete.set(label);
    this.exchangeDisconnectRiskConfirmed.set(false);
    this.exchangeDisconnectConfirmText.set('');
    this.exchangeDisconnectError.set('');
    this.showDeleteExchangeModal.set(true);
  }

  confirmDeleteExchange() {
    // Validate conditions
    if (!this.exchangeDisconnectRiskConfirmed()) {
      this.exchangeDisconnectError.set(this.t('dashboard.disconnectConfirmRiskRequired'));
      return;
    }

    if (this.exchangeDisconnectConfirmText() !== this.t('dashboard.disconnectPlaceholder')) {
      this.exchangeDisconnectError.set(this.t('dashboard.disconnectTypeExact'));
      return;
    }

    const label = this.exchangeToDelete();
    if (label) {
      this.exchangeService.remove(label);
      this.showDeleteExchangeModal.set(false);
      this.exchangeToDelete.set(null);
      this.exchangeDisconnectRiskConfirmed.set(false);
      this.exchangeDisconnectConfirmText.set('');
      this.exchangeDisconnectError.set('');
      this.showToast(this.t('dashboard.exchangeDisconnected'));
    }
  }

  cancelDeleteExchange() {
    this.showDeleteExchangeModal.set(false);
    this.exchangeToDelete.set(null);
    this.exchangeDisconnectRiskConfirmed.set(false);
    this.exchangeDisconnectConfirmText.set('');
    this.exchangeDisconnectError.set('');
  }

  async toggleBotStatus(bot: Bot) {
    const next: BotStatus = bot.status === 'active' ? 'paused' : 'active';
    try {
      await this.botService.setStatus(bot.id, next);
      if (next === 'active') {
        const linkedActiveStrategies = this.visibleStrategies().filter(strategy => strategy.assignedBotId === bot.id && (strategy.status ?? 'active') === 'active');
        if (linkedActiveStrategies.length === 0) {
          this.showToast(this.t('dashboard.botResumed', { name: bot.name }));
          return;
        }
        this.showToast(this.t('dashboard.botResumedWithStrategies', { name: bot.name }));
      } else {
        this.showToast(this.t('dashboard.botPaused', { name: bot.name }));
      }
    } catch (err) {
      console.error('failed to toggle bot status', err);
      this.showToast(this.t('dashboard.unableChangeBotStatus'));
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
      this.showToast(this.t('dashboard.botDeleted', { name: bot.name }));
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
    this.showToast(this.t('dashboard.botUpdatedSuccess', { name: bot.name }));
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
        ? this.t('dashboard.marketClosedConfirmWithReason', { reason: statusReason })
        : this.t('dashboard.marketClosedConfirm');

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
      this.showToast(this.t('dashboard.positionLiquidated', { symbol: position.symbol }));
    } catch (error: any) {
      this.showToast(error?.message || this.t('dashboard.unableLiquidatePosition'));
    } finally {
      this.liquidatingPositionKey.set('');
    }
  }

  get portfolioDetailsTitle() {
    if (this.portfolioDetailsView() === 'pnl') return this.t('dashboard.portfolioDetailsTitlePnl');
    if (this.portfolioDetailsView() === 'trades') return this.t('dashboard.portfolioDetailsTitleTrades');
    return this.t('dashboard.portfolioDetailsTitlePortfolio');
  }

  get portfolioDetailsEmptyMessage() {
    if (this.portfolioDetailsView() === 'pnl') return this.t('dashboard.portfolioDetailsEmptyPnl');
    if (this.portfolioDetailsView() === 'trades') return this.t('dashboard.portfolioDetailsEmptyTrades');
    return this.t('dashboard.portfolioDetailsEmptyPortfolio');
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
    const sideLabel = execution.side === 'sell'
      ? this.t('dashboard.sharesSold')
      : this.t('dashboard.sharesBought');
    if (shares === null) return `${sideLabel}: ${this.t('common.na')}`;
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
        return this.t('common.na');
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

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
