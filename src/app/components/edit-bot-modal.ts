import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BotService, Bot, SYMBOLS, TIMEFRAMES } from '../services/bot.service';

@Component({
  selector: 'app-edit-bot-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './edit-bot-modal.html',
  styleUrl: './edit-bot-modal.scss',
})
export class EditBotModal {
  private botService = inject(BotService);

  closed = output<void>();
  updated = output<Bot>();

  bot = signal<Bot | null>(null);
  error = signal('');
  saving = signal(false);
  isReadOnly = signal(false);

  // Form fields
  investment = '';
  stopLoss = '';
  takeProfit = '';
  timeframe = '';
  symbol = '';

  symbols = SYMBOLS;
  timeframes = TIMEFRAMES;

  open(bot: Bot, isReadOnly: boolean = false) {
    this.isReadOnly.set(isReadOnly);
    this.bot.set(bot);
    this.investment = String(bot.investment);
    this.stopLoss = String(bot.stopLoss);
    this.takeProfit = String(bot.takeProfit);
    this.timeframe = bot.timeframe;
    this.symbol = bot.symbol;
    this.error.set('');
  }

  save() {
    const current = this.bot();
    if (!current || this.isReadOnly()) return;

    // Validate inputs
    const inv = parseFloat(this.investment);
    const sl = parseFloat(this.stopLoss);
    const tp = parseFloat(this.takeProfit);

    if (isNaN(inv) || inv <= 0) {
      this.error.set('Investment must be a positive number.');
      return;
    }

    if (isNaN(sl) || sl < 0 || sl >= 100) {
      this.error.set('Stop Loss must be between 0 and 99.99%.');
      return;
    }

    if (isNaN(tp) || tp <= 0 || tp >= 100) {
      this.error.set('Take Profit must be between 0.01 and 99.99%.');
      return;
    }

    if (sl >= tp) {
      this.error.set('Take Profit must be greater than Stop Loss.');
      return;
    }

    if (!this.timeframe.trim()) {
      this.error.set('Please select a timeframe.');
      return;
    }

    if (!this.symbol.trim()) {
      this.error.set('Please select a symbol.');
      return;
    }

    this.error.set('');
    this.saving.set(true);

    (async () => {
      try {
        await this.botService.update(current.id, {
          investment: inv,
          stopLoss: sl,
          takeProfit: tp,
          timeframe: this.timeframe.trim(),
          symbol: this.symbol.trim(),
        });

        const updatedBot = {
          ...current,
          investment: inv,
          stopLoss: sl,
          takeProfit: tp,
          timeframe: this.timeframe.trim(),
          symbol: this.symbol.trim(),
        };

        this.saving.set(false);
        this.error.set('');
        this.updated.emit(updatedBot);
        this.close();
      } catch (err: any) {
        console.error('failed to update bot', err);
        const errorMsg = err?.message || 'Failed to update bot. Please try again.';
        this.error.set(errorMsg);
        this.saving.set(false);
      }
    })();
  }

  close() {
    this.bot.set(null);
    this.closed.emit();
  }
}
