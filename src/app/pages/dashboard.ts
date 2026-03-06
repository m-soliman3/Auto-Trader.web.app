import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ExchangeService, ConnectedExchange, ExchangePortfolioBreakdown, SUPPORTED_EXCHANGES } from '../services/exchange.service';
import { BotService, Bot, BotStatus } from '../services/bot.service';
import { StrategyExecution, StrategyService, StrategyTemplate, UserStrategy } from '../services/strategy.service';
import { ConnectExchangeModal } from '../components/connect-exchange-modal';
import { CreateBotModal } from '../components/create-bot-modal';
import { BrowseStrategiesModal } from '../components/browse-strategies-modal';
import { EditBotModal } from '../components/edit-bot-modal';
import { AccountModeService } from '../services/account-mode.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ConnectExchangeModal, CreateBotModal, BrowseStrategiesModal, EditBotModal],
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
  showStrategyEditorModal = signal(false);
  showEditBotModal    = signal(false);
  showPortfolioDetailsModal = signal(false);
  showDeleteBotModal  = signal(false);
  showDeleteStrategyModal = signal(false);
  showDeleteExchangeModal = signal(false);
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
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper Money' : 'Real Money');
  visibleConnections = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));
  visibleBots = computed(() => this.botService.botsByMode(this.accountMode.mode()));
  visibleActiveBots = computed(() => this.botService.activeBotsByMode(this.accountMode.mode()));
  hasVisibleExchange = computed(() => this.visibleConnections().length > 0);
  visibleStrategies = computed(() => {
    const visibleBotIds = new Set(this.visibleBots().map(bot => bot.id));
    return this.strategyService.userStrategies().filter(strategy => visibleBotIds.has(strategy.assignedBotId));
  });
  strategyTemplateMap = computed(() => {
    return new Map(this.strategyService.all().map(template => [template.id, template]));
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
      this.strategyFormError.set('Unable to save strategy right now. Please try again.');
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

  get portfolioBreakdownRows() {
    return this.exchangeService.portfolioBreakdownByMode(this.accountMode.mode());
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
