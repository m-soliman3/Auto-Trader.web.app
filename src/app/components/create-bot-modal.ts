import { Component, inject, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  BotService, STRATEGIES, SYMBOLS, TIMEFRAMES, Strategy, Bot,
} from '../services/bot.service';
import { ExchangeService } from '../services/exchange.service';

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

  closed  = output<void>();
  created = output<Bot>();

  strategies = STRATEGIES;
  symbols    = SYMBOLS;
  timeframes = TIMEFRAMES;

  exchanges = computed(() => this.exchangeSvc.connections());

  step     = signal<Step>(1);
  saving   = signal(false);
  error    = signal('');

  // Step 1
  selectedStrategy = signal<Strategy | null>(null);

  // Step 2 form
  botName      = '';
  exchangeLabel = '';
  symbol       = 'BTC/USDT';
  timeframe    = '1h';
  investment   = 500;
  stopLoss     = 3;
  takeProfit   = 6;

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
    this.error.set('');
    this.step.set(2);
  }

  toReview() {
    if (!this.botName.trim())       { this.error.set('Please enter a bot name.'); return; }
    if (!this.exchangeLabel && this.exchanges().length > 0) {
      this.exchangeLabel = this.exchanges()[0].label;
    }
    if (!this.exchangeLabel)        { this.error.set('Connect an exchange first.'); return; }
    if (this.investment < 10)       { this.error.set('Minimum investment is $10.'); return; }
    if (this.stopLoss < 0.1)        { this.error.set('Stop-loss must be at least 0.1%.'); return; }
    if (this.takeProfit < 0.1)      { this.error.set('Take-profit must be at least 0.1%.'); return; }
    this.error.set('');
    this.step.set(3);
  }

  launch() {
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
        investment:   this.investment,
        stopLoss:     this.stopLoss,
        takeProfit:   this.takeProfit,
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

  close() { this.closed.emit(); }
}
