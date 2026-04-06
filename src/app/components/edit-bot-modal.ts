import { Component, inject, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BotService, Bot, SYMBOLS, TIMEFRAMES } from '../services/bot.service';
import { ExchangeService } from '../services/exchange.service';
import { AccountModeService } from '../services/account-mode.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-edit-bot-modal',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './edit-bot-modal.html',
  styleUrl: './edit-bot-modal.scss',
})
export class EditBotModal {
  private botService = inject(BotService);
  private exchangeService = inject(ExchangeService);
  private accountMode = inject(AccountModeService);
  private translate = inject(TranslateService);

  closed = output<void>();
  updated = output<Bot>();

  bot = signal<Bot | null>(null);
  error = signal('');
  saving = signal(false);
  isReadOnly = signal(false);
  isActive = signal(false);

  // Form fields
  botName = '';
  selectedExchangeLabel = '';
  investment = '';
  stopLoss = '';
  takeProfit = '';
  timeframe = '';
  symbol = '';

  symbols = SYMBOLS;
  timeframes = TIMEFRAMES;
  exchanges = computed(() => this.exchangeService.connectionsByMode(this.accountMode.mode()));

  open(bot: Bot, isReadOnly: boolean = false) {
    this.isReadOnly.set(isReadOnly);
    this.isActive.set(bot.status === 'active');
    this.bot.set(bot);
    this.botName = bot.name;
    this.selectedExchangeLabel = bot.exchangeLabel;
    this.investment = String(bot.investment);
    this.stopLoss = String(bot.stopLoss);
    this.takeProfit = String(bot.takeProfit);
    this.timeframe = bot.timeframe;
    this.symbol = bot.symbol;
    this.error.set('');
  }

  save() {
    const current = this.bot();
    if (!current || this.isReadOnly() || this.isActive()) return;

    // Validate bot name
    if (!this.botName.trim()) {
      this.error.set(this.translate.instant('editBot.validation.botNameRequired'));
      return;
    }

    // Validate exchange selection
    if (!this.selectedExchangeLabel.trim()) {
      this.error.set(this.translate.instant('editBot.validation.selectExchange'));
      return;
    }

    const investmentError = this.validateInvestment(true);
    if (investmentError) {
      this.error.set(investmentError);
      return;
    }

    const stopLossError = this.validateStopLoss(true);
    if (stopLossError) {
      this.error.set(stopLossError);
      return;
    }

    const takeProfitError = this.validateTakeProfit(true);
    if (takeProfitError) {
      this.error.set(takeProfitError);
      return;
    }

    if (!this.timeframe.trim()) {
      this.error.set(this.translate.instant('editBot.validation.selectTimeframe'));
      return;
    }

    if (!this.symbol.trim()) {
      this.error.set(this.translate.instant('editBot.validation.selectSymbol'));
      return;
    }

    this.error.set('');
    this.saving.set(true);

    const inv = parseFloat(this.investment);
    const sl = parseFloat(this.stopLoss);
    const tp = parseFloat(this.takeProfit);

    (async () => {
      try {
        // Find the exchange to get the exchangeId
        const selectedExchange = this.exchanges().find(ex => ex.label === this.selectedExchangeLabel);
        
        // Build updates object - always include name and exchange
        const updates: Partial<Bot> = {
          name: this.botName.trim(),
          exchangeLabel: this.selectedExchangeLabel.trim(),
          exchangeId: selectedExchange?.exchangeId || current.exchangeId,
        };
        
        // Only include restricted fields if bot is paused
        if (!this.isActive()) {
          updates.investment = inv;
          updates.stopLoss = sl;
          updates.takeProfit = tp;
          updates.timeframe = this.timeframe.trim();
          updates.symbol = this.symbol.trim();
        }
        
        await this.botService.update(current.id, updates);

        const updatedBot: Bot = {
          ...current,
          name: this.botName.trim(),
          exchangeLabel: this.selectedExchangeLabel.trim(),
          exchangeId: selectedExchange?.exchangeId || current.exchangeId,
        };
        
        // Only include restricted fields if bot is paused
        if (!this.isActive()) {
          updatedBot.investment = inv;
          updatedBot.stopLoss = sl;
          updatedBot.takeProfit = tp;
          updatedBot.timeframe = this.timeframe.trim();
          updatedBot.symbol = this.symbol.trim();
        }

        this.saving.set(false);
        this.error.set('');
        this.updated.emit(updatedBot);
        this.close();
      } catch (err: any) {
        console.error('failed to update bot', err);
        const errorMsg = err?.message || this.translate.instant('editBot.validation.failedToUpdate');
        this.error.set(errorMsg);
        this.saving.set(false);
      }
    })();
  }

  close() {
    this.bot.set(null);
    this.closed.emit();
  }
  
  private getAvailablePortfolioValue(label: string): number | null {
    const selectedLabel = label.trim();
    if (!selectedLabel) return null;
  
    const row = this.exchangeService
      .portfolioBreakdownByMode(this.accountMode.mode())
      .find(breakdown => breakdown.label === selectedLabel);
  
    return row?.portfolioValue ?? null;
  }

  isFormCompleteAndValid(): boolean {
    if (!this.botName.trim()) return false;
    if (!this.selectedExchangeLabel.trim()) return false;
    if (!this.timeframe.trim()) return false;
    if (!this.symbol.trim()) return false;

    if (this.validateInvestment(true)) return false;
    if (this.validateStopLoss(true)) return false;
    if (this.validateTakeProfit(true)) return false;

    return true;
  }

  private validateInvestment(showMissing: boolean): string | null {
    const rawInvestment = this.normalizeNumericInput(this.investment);
    if (!rawInvestment) {
      return showMissing ? this.translate.instant('editBot.validation.enterInvestmentAmount') : null;
    }

    if (!this.isNumericValue(rawInvestment)) return this.translate.instant('editBot.validation.investmentNumbersOnly');

    const inv = Number.parseFloat(rawInvestment);
    if (!Number.isFinite(inv)) return this.translate.instant('editBot.validation.validInvestmentAmount');
    if (inv <= 0) return this.translate.instant('editBot.validation.investmentPositive');

    const availablePortfolioValue = this.getAvailablePortfolioValue(this.selectedExchangeLabel);
    if (availablePortfolioValue === null || !Number.isFinite(availablePortfolioValue)) {
      return showMissing ? this.translate.instant('editBot.validation.portfolioValueUnavailable') : null;
    }
    if (inv > availablePortfolioValue) {
      return this.translate.instant('editBot.validation.investmentExceedsPortfolio', {
        amount: availablePortfolioValue.toFixed(2),
      });
    }

    return null;
  }

  private validateStopLoss(showMissing: boolean): string | null {
    const rawStopLoss = this.normalizeNumericInput(this.stopLoss);
    if (!rawStopLoss) {
      return showMissing ? this.translate.instant('editBot.validation.enterStopLoss') : null;
    }

    if (!this.isNumericValue(rawStopLoss)) return this.translate.instant('editBot.validation.stopLossNumbersOnly');

    const sl = Number.parseFloat(rawStopLoss);
    if (!Number.isFinite(sl)) return this.translate.instant('editBot.validation.validStopLoss');
    if (sl < 0.1 || sl > 50) return this.translate.instant('editBot.validation.stopLossRange');

    return null;
  }

  private validateTakeProfit(showMissing: boolean): string | null {
    const rawTakeProfit = this.normalizeNumericInput(this.takeProfit);
    if (!rawTakeProfit) {
      return showMissing ? this.translate.instant('editBot.validation.enterTakeProfit') : null;
    }

    if (!this.isNumericValue(rawTakeProfit)) return this.translate.instant('editBot.validation.takeProfitNumbersOnly');

    const tp = Number.parseFloat(rawTakeProfit);
    if (!Number.isFinite(tp)) return this.translate.instant('editBot.validation.validTakeProfit');
    if (tp < 0.1 || tp > 50) return this.translate.instant('editBot.validation.takeProfitRange');

    return null;
  }

  private isNumericValue(value: string): boolean {
    return /^\d*\.?\d+$/.test(value.trim());
  }

  private normalizeNumericInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  shouldShowExchangeHint(): boolean {
    return !this.selectedExchangeLabel.trim()
      && this.error() === this.translate.instant('editBot.validation.selectExchange');
  }
}
