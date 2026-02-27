import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ExchangeService, ConnectedExchange, SUPPORTED_EXCHANGES } from '../services/exchange.service';
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
  preselectedStrategy = signal<StrategyTemplate | null>(null);
  toastMsg          = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  get portfolioCards() {
    const hasEx  = this.exchangeService.hasExchange();
    const active = this.botService.activeBots().length;
    const total  = this.botService.bots().length;
    return [
      { label: 'Portfolio Value', value: hasEx ? '$0.00' : '—',          change: hasEx ? '+0.00%' : 'Connect exchange', positive: true,  icon: '💼' },
      { label: 'Active Bots',     value: String(active),                  change: active ? `${active} running` : '0 running', positive: true,  icon: '🤖' },
      { label: 'Total Trades',    value: String(this.botService.bots().reduce((a,b)=>a+b.trades,0)), change: total ? `${total} bot(s)` : 'Get started', positive: true,  icon: '📈' },
      { label: "Today's P&L",    value: hasEx ? '$0.00' : '—',          change: hasEx ? '+0.00%' : 'Connect exchange', positive: true,  icon: '⚡' },
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
    const isReadOnly = bot.status !== 'paused';
    this.editBotModal.open(bot, isReadOnly);
    this.showEditBotModal.set(true);
  }

  onBotUpdated(bot: Bot) {
    this.showEditBotModal.set(false);
    this.showToast(`✏️ "${bot.name}" updated successfully!`);
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
