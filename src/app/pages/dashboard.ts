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

  @ViewChild(EditBotModal) editBotModal!: EditBotModal;

  showExchangeModal   = signal(false);
  showBotModal        = signal(false);
  showStrategiesModal = signal(false);
  showEditBotModal    = signal(false);
  showPortfolioDetailsModal = signal(false);
  portfolioDetailsView = signal<'portfolio' | 'pnl'>('portfolio');
  preselectedStrategy = signal<StrategyTemplate | null>(null);
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  get portfolioCards() {
    const hasEx  = this.exchangeService.hasExchange();
    const active = this.botService.activeBots().length;
    const total  = this.botService.bots().length;
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
      realMoneyValue = portfolioByType.real !== null ? `$${portfolioByType.real.toFixed(2)}` : '—';
      paperMoneyValue = portfolioByType.paper !== null ? `$${portfolioByType.paper.toFixed(2)}` : '—';
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
      realPnlValue = pnlByType.real !== null ? `$${pnlByType.real.toFixed(2)}` : '—';
      paperPnlValue = pnlByType.paper !== null ? `$${pnlByType.paper.toFixed(2)}` : '—';
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
      { label: 'Portfolio Value', value: `Real Money: ${realMoneyValue}`, secondaryValue: `Paper Money: ${paperMoneyValue}`, change: '', positive: true, icon: '💼' },
      { label: 'Active Bots',     value: String(active),                  change: active ? `${active} running` : '0 running', positive: true,  icon: '🤖' },
      { label: 'Total Trades',    value: String(this.botService.bots().reduce((a,b)=>a+b.trades,0)), change: total ? `${total} bot(s)` : 'Get started', positive: true,  icon: '📈' },
      { label: "Today's P&L",    value: `Real Money: ${realPnlValue}`,    secondaryValue: `Paper Money: ${paperPnlValue}`, change: '', positive: true, icon: '⚡' },
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
    this.exchangeService.remove(label);
    this.showToast('Exchange disconnected.');
  }

  toggleBotStatus(bot: Bot) {
    const next: BotStatus = bot.status === 'active' ? 'paused' : 'active';
    this.botService.setStatus(bot.id, next);
    this.showToast(next === 'active' ? `▶ "${bot.name}" resumed.` : `⏸ "${bot.name}" paused.`);
  }

  removeBot(bot: Bot) {
    this.botService.remove(bot.id);
    this.showToast(`🗑 "${bot.name}" deleted.`);
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
    return this.exchangeService.portfolioBreakdown();
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
      return `${sign}$${row.unrealizedPnl.toFixed(2)} (${pctSign}${row.pnlPercentage.toFixed(2)}%)`;
    }
    return `$${row.portfolioValue.toFixed(2)}`;
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
