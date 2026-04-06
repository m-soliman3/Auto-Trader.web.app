import { Component, inject, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  BotService, STRATEGIES, SYMBOLS, TIMEFRAMES, Strategy, Bot,
} from '../services/bot.service';
import { ExchangeService } from '../services/exchange.service';
import { AccountModeService } from '../services/account-mode.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type Step = 1 | 2 | 3;

@Component({
  selector: 'app-create-bot-modal',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './create-bot-modal.html',
  styleUrl: './create-bot-modal.scss',
})
export class CreateBotModal {
  private botService  = inject(BotService);
  private exchangeSvc = inject(ExchangeService);
  private accountMode = inject(AccountModeService);
  private translate = inject(TranslateService);

  closed  = output<void>();
  created = output<Bot>();

  strategies = STRATEGIES;
  symbols    = SYMBOLS;
  timeframes = TIMEFRAMES;

  exchanges = computed(() => this.exchangeSvc.connectionsByMode(this.accountMode.mode()));
  modeLabel = computed(() => this.accountMode.mode() === 'paper' ? 'createBot.modePaperMoney' : 'createBot.modeRealMoney');
  isPaperMode = computed(() => this.accountMode.mode() === 'paper');

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
        this.error.set(err?.message || this.translate.instant('createBot.validation.unableToCreateBot'));
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
    if (!this.selectedStrategy()) return this.translate.instant('createBot.validation.selectStrategyFirst');
    if (!this.botName.trim()) return this.translate.instant('createBot.validation.enterBotName');

    const availableExchanges = this.exchanges();
    if (availableExchanges.length === 0) return this.translate.instant('createBot.validation.connectExchangeFirst');
    if (!this.exchangeLabel.trim()) return this.translate.instant('createBot.validation.selectExchange');
    if (!availableExchanges.some(ex => ex.label === this.exchangeLabel)) return this.translate.instant('createBot.validation.selectValidExchange');

    if (!this.symbol.trim()) return this.translate.instant('createBot.validation.selectTradingPair');
    if (!this.symbols.includes(this.symbol)) return this.translate.instant('createBot.validation.selectValidTradingPair');

    if (!this.timeframe.trim()) return this.translate.instant('createBot.validation.selectTimeframe');
    if (!this.timeframes.includes(this.timeframe)) return this.translate.instant('createBot.validation.selectValidTimeframe');

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
      return showMissing ? this.translate.instant('createBot.validation.enterInvestmentAmount') : null;
    }

    if (!this.isNumericValue(rawInvestment)) return this.translate.instant('createBot.validation.investmentNumbersOnly');

    const investment = Number.parseFloat(rawInvestment);
    if (!Number.isFinite(investment)) return this.translate.instant('createBot.validation.validInvestmentAmount');
    if (investment <= 0) return this.translate.instant('createBot.validation.investmentPositive');

    const availablePortfolioValue = this.getAvailablePortfolioValue(this.exchangeLabel);
    if (availablePortfolioValue === null || !Number.isFinite(availablePortfolioValue)) {
      return showMissing ? this.translate.instant('createBot.validation.portfolioValueUnavailable') : null;
    }
    if (investment > availablePortfolioValue) {
      return this.translate.instant('createBot.validation.investmentExceedsPortfolio', {
        amount: availablePortfolioValue.toFixed(2),
      });
    }

    return null;
  }

  private validateStopLoss(showMissing: boolean): string | null {
    const rawStopLoss = this.normalizeNumericInput(this.stopLoss);
    if (!rawStopLoss) {
      return showMissing ? this.translate.instant('createBot.validation.enterStopLoss') : null;
    }

    if (!this.isNumericValue(rawStopLoss)) return this.translate.instant('createBot.validation.stopLossNumbersOnly');

    const stopLoss = Number.parseFloat(rawStopLoss);
    if (!Number.isFinite(stopLoss)) return this.translate.instant('createBot.validation.validStopLoss');
    if (stopLoss < 0.1 || stopLoss > 50) return this.translate.instant('createBot.validation.stopLossRange');

    return null;
  }

  private validateTakeProfit(showMissing: boolean): string | null {
    const rawTakeProfit = this.normalizeNumericInput(this.takeProfit);
    if (!rawTakeProfit) {
      return showMissing ? this.translate.instant('createBot.validation.enterTakeProfit') : null;
    }

    if (!this.isNumericValue(rawTakeProfit)) return this.translate.instant('createBot.validation.takeProfitNumbersOnly');

    const takeProfit = Number.parseFloat(rawTakeProfit);
    if (!Number.isFinite(takeProfit)) return this.translate.instant('createBot.validation.validTakeProfit');
    if (takeProfit < 0.1 || takeProfit > 50) return this.translate.instant('createBot.validation.takeProfitRange');

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

  shouldShowExchangeHint(): boolean {
    return !this.exchangeLabel.trim()
      && this.error() === this.translate.instant('createBot.validation.selectExchange');
  }
}
