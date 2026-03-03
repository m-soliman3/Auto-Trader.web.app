import { Component, inject, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  BotService, STRATEGIES, SYMBOLS, TIMEFRAMES, Strategy, Bot,
} from '../services/bot.service';
import { ExchangeService } from '../services/exchange.service';
import { AccountModeService } from '../services/account-mode.service';

type Step = 1 | 2 | 3;

@Component({
  selector: 'app-create-bot-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './create-bot-modal.html',
  styleUrl: './create-bot-modal.scss',
})
export class CreateBotModal {
  private botService  = inject(BotService);
  private exchangeSvc = inject(ExchangeService);
  private accountMode = inject(AccountModeService);

  closed  = output<void>();
  created = output<Bot>();

  strategies = STRATEGIES;
  symbols    = SYMBOLS;
  timeframes = TIMEFRAMES;

  exchanges = computed(() => this.exchangeSvc.connectionsByMode(this.accountMode.mode()));
  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'Paper Money' : 'Real Money');

  step     = signal<Step>(1);
  saving   = signal(false);
  error    = signal('');

  // Step 1
  selectedStrategy = signal<Strategy | null>(null);

  // Step 2 form
  botName      = '';
  exchangeLabel = '';
  symbol       = '';
  timeframe    = '';
  investment   = '';
  stopLoss     = '';
  takeProfit   = '';

  get stepTitle(): string {
    return ['', 'Choose a Strategy', 'Configure Your Bot', 'Review & Launch'][this.step()];
  }

  get stepSub(): string {
    return [
      '',
      'Pick the trading logic that fits your style',
      'Set exchange, pair, and risk parameters',
      'Double-check everything before going live',
    ][this.step()];
  }

  selectStrategy(s: Strategy) {
    this.selectedStrategy.set(s);
    this.botName = `My ${s.name} Bot`;
    this.exchangeLabel = '';
    this.symbol = '';
    this.timeframe = '';
    this.investment = '';
    this.stopLoss = '';
    this.takeProfit = '';
    this.error.set('');
    this.step.set(2);
  }

  toReview() {
    const validationError = this.validateConfig();
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    this.error.set('');
    this.step.set(3);
  }

  launch() {
    const validationError = this.validateConfig();
    if (validationError) {
      this.error.set(validationError);
      this.step.set(2);
      return;
    }

    const investment = Number.parseFloat(this.investment);
    const stopLoss = Number.parseFloat(this.stopLoss);
    const takeProfit = Number.parseFloat(this.takeProfit);

    const strat = this.selectedStrategy()!;
    const exchange = this.exchanges().find(e => e.label === this.exchangeLabel);
    this.saving.set(true);

    setTimeout(() => {
      const bot: Bot = {
        id:           crypto.randomUUID(),
        name:         this.botName.trim(),
        strategyId:   strat.id,
        strategyName: strat.name,
        exchangeLabel: this.exchangeLabel,
        exchangeId:   exchange?.exchangeId ?? '',
        symbol:       this.symbol,
        timeframe:    this.timeframe,
        investment,
        stopLoss,
        takeProfit,
        status:       'active',
        trades:       0,
        pnl:          0,
        createdAt:    new Date().toISOString(),
      };
      this.botService.add(bot);
      this.saving.set(false);
      this.created.emit(bot);
      this.close();
    }, 900);
  }

  back() {
    this.error.set('');
    this.step.update(s => (s - 1) as Step);
  }

  private validateConfig(): string | null {
    if (!this.selectedStrategy()) return 'Please select a strategy first.';
    if (!this.botName.trim()) return 'Please enter a bot name.';

    const availableExchanges = this.exchanges();
    if (availableExchanges.length === 0) return 'Connect an exchange first.';
    if (!this.exchangeLabel.trim()) return 'Please select an exchange.';
    if (!availableExchanges.some(ex => ex.label === this.exchangeLabel)) return 'Please select a valid exchange.';

    if (!this.symbol.trim()) return 'Please select a trading pair.';
    if (!this.symbols.includes(this.symbol)) return 'Please select a valid trading pair.';

    if (!this.timeframe.trim()) return 'Please select a timeframe.';
    if (!this.timeframes.includes(this.timeframe)) return 'Please select a valid timeframe.';

    const investment = Number.parseFloat(this.investment);
    if (!Number.isFinite(investment)) return 'Please enter an investment amount.';
    if (investment < 10) return 'Minimum investment is $10.';

    const stopLoss = Number.parseFloat(this.stopLoss);
    if (!Number.isFinite(stopLoss)) return 'Please enter a stop-loss value.';
    if (stopLoss < 0.1) return 'Stop-loss must be at least 0.1%.';
    if (stopLoss > 50) return 'Stop-loss must not exceed 50%.';

    const takeProfit = Number.parseFloat(this.takeProfit);
    if (!Number.isFinite(takeProfit)) return 'Please enter a take-profit value.';
    if (takeProfit < 0.1) return 'Take-profit must be at least 0.1%.';
    if (takeProfit > 500) return 'Take-profit must not exceed 500%.';
    if (takeProfit <= stopLoss) return 'Take-profit must be greater than stop-loss.';

    return null;
  }

  close() { this.closed.emit(); }
}
