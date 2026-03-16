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

    setTimeout(async () => {
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

      try {
        await this.botService.add(bot);
        this.saving.set(false);
        this.error.set('');
        this.created.emit(bot);
        this.close();
      } catch (err: any) {
        this.saving.set(false);
        this.error.set(err?.message || 'Unable to create bot right now. Please try again.');
      }
    }, 900);
  }

  back() {
    this.error.set('');
    this.step.update(s => (s - 1) as Step);
  }

  private getAvailablePortfolioValue(label: string): number | null {
    const selectedLabel = label.trim();
    if (!selectedLabel) return null;

    const row = this.exchangeSvc
      .portfolioBreakdownByMode(this.accountMode.mode())
      .find(breakdown => breakdown.label === selectedLabel);

    return row?.portfolioValue ?? null;
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

    const investmentError = this.validateInvestment(true);
    if (investmentError) return investmentError;

    const stopLossError = this.validateStopLoss(true);
    if (stopLossError) return stopLossError;

    const takeProfitError = this.validateTakeProfit(true);
    if (takeProfitError) return takeProfitError;

    return null;
  }

  private validateInvestment(showMissing: boolean): string | null {
    const rawInvestment = this.normalizeNumericInput(this.investment);
    if (!rawInvestment) {
      return showMissing ? 'Please enter an investment amount.' : null;
    }

    if (!this.isNumericValue(rawInvestment)) return 'Investment amount accepts numbers only.';

    const investment = Number.parseFloat(rawInvestment);
    if (!Number.isFinite(investment)) return 'Please enter a valid investment amount.';
    if (investment <= 0) return 'Investment amount must be a positive number.';

    const availablePortfolioValue = this.getAvailablePortfolioValue(this.exchangeLabel);
    if (availablePortfolioValue === null || !Number.isFinite(availablePortfolioValue)) {
      return showMissing ? 'Portfolio value for the selected exchange is not available yet. Please wait and try again.' : null;
    }
    if (investment > availablePortfolioValue) {
      return `Investment amount cannot exceed the available portfolio value ($${availablePortfolioValue.toFixed(2)}).`;
    }

    return null;
  }

  private validateStopLoss(showMissing: boolean): string | null {
    const rawStopLoss = this.normalizeNumericInput(this.stopLoss);
    if (!rawStopLoss) {
      return showMissing ? 'Please enter a stop-loss value.' : null;
    }

    if (!this.isNumericValue(rawStopLoss)) return 'Stop-loss accepts numbers only.';

    const stopLoss = Number.parseFloat(rawStopLoss);
    if (!Number.isFinite(stopLoss)) return 'Please enter a valid stop-loss value.';
    if (stopLoss < 0.1 || stopLoss > 50) return 'Stop-loss must be between 0.1% and 50.0%.';

    return null;
  }

  private validateTakeProfit(showMissing: boolean): string | null {
    const rawTakeProfit = this.normalizeNumericInput(this.takeProfit);
    if (!rawTakeProfit) {
      return showMissing ? 'Please enter a take-profit value.' : null;
    }

    if (!this.isNumericValue(rawTakeProfit)) return 'Take-profit accepts numbers only.';

    const takeProfit = Number.parseFloat(rawTakeProfit);
    if (!Number.isFinite(takeProfit)) return 'Please enter a valid take-profit value.';
    if (takeProfit < 0.1 || takeProfit > 50) return 'Take-profit must be between 0.1% and 50.0%.';

    return null;
  }

  private isNumericValue(value: string): boolean {
    return /^\d*\.?\d+$/.test(value.trim());
  }

  private normalizeNumericInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  close() { this.closed.emit(); }
}
