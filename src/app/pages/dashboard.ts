import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ExchangeService, ConnectedExchange, ExchangePortfolioBreakdown, SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { BotService, Bot, BotStatus } from '../services/bot.service';
import { StrategyService, StrategyTemplate } from '../services/strategy.service';
import { ConnectExchangeModal } from '../components/connect-exchange-modal';
import { CreateBotModal } from '../components/create-bot-modal';
import { BrowseStrategiesModal } from '../components/browse-strategies-modal';
import { EditBotModal } from '../components/edit-bot-modal';
import { AccountModeService } from '../services/account-mode.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, ConnectExchangeModal, CreateBotModal, BrowseStrategiesModal, EditBotModal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  auth            = inject(AuthService);
  exchangeService = inject(ExchangeService);
  botService      = inject(BotService);
  strategyService = inject(StrategyService);
  accountMode     = inject(AccountModeService);

  @ViewChild(EditBotModal) editBotModal!: EditBotModal;

  showExchangeModal   = signal(false);
  showBotModal        = signal(false);
  showStrategiesModal = signal(false);
  showEditBotModal    = signal(false);
  showPortfolioDetailsModal = signal(false);
  showDeleteBotModal  = signal(false);
  showDeleteExchangeModal = signal(false);
  portfolioDetailsView = signal<'portfolio' | 'pnl'>('portfolio');
  preselectedStrategy = signal<StrategyTemplate | null>(null);
  botToDelete = signal<Bot | null>(null);
  exchangeToDelete = signal<string | null>(null);
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper Money' : 'Real Money');
  visibleConnections = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));
  visibleBots = computed(() => this.botService.botsByMode(this.accountMode.mode()));
  visibleActiveBots = computed(() => this.botService.activeBotsByMode(this.accountMode.mode()));
  hasVisibleExchange = computed(() => this.visibleConnections().length > 0);

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
    { label: 'Browse Strategies', icon: '📊', desc: 'Pre-built strategies & templates',  action: 'strategies' },
    { label: 'Run Backtest',      icon: '🔬', desc: 'Test against historical data',      action: 'backtest' },
  ];

  handleAction(action: string) {
    if (action === 'connect')    { this.showExchangeModal.set(true); }
    else if (action === 'bot')   { this.showBotModal.set(true); }
    else if (action === 'strategies') { this.showStrategiesModal.set(true); }
    else { this.showToast('Coming soon — stay tuned! 🚀'); }
  }

  onStrategySelected(strategy: StrategyTemplate) {
    this.preselectedStrategy.set(strategy);
    this.showBotModal.set(true);
    this.showToast(`📊 "${strategy.name}" selected — configure your bot below!`);
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

  toggleBotStatus(bot: Bot) {
    const next: BotStatus = bot.status === 'active' ? 'paused' : 'active';
    this.botService.setStatus(bot.id, next);
    this.showToast(next === 'active' ? `▶ "${bot.name}" resumed.` : `⏸ "${bot.name}" paused.`);
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

  get portfolioBreakdownRows() {
    return this.exchangeService.portfolioBreakdownByMode(this.accountMode.mode());
  }

  get portfolioDetailsTitle() {
    return this.portfolioDetailsView() === 'pnl' ? "Today's P&L Breakdown" : 'Portfolio Value Breakdown';
  }

  get portfolioDetailsEmptyMessage() {
    return this.portfolioDetailsView() === 'pnl'
      ? 'No exchange P&L data available yet.'
      : 'No exchange balances available yet.';
  }

  get isPnlDetailsView() {
    return this.portfolioDetailsView() === 'pnl';
  }

  formatBreakdownValue(row: ExchangePortfolioBreakdown): string {
    if (this.portfolioDetailsView() === 'pnl') {
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
