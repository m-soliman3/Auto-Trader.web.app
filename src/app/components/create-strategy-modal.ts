import {
  Component, inject, output, signal, computed, HostListener, ElementRef, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { STRATEGY_TEMPLATES, StrategyTemplate, StrategyService } from '../services/strategy.service';
import { ExchangeService } from '../services/exchange.service';
import { AccountModeService } from '../services/account-mode.service';
import { SYMBOLS, TIMEFRAMES, SymbolEntry } from '../services/bot.service';

type Step = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-create-strategy-modal',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  template: `
    <div class="csm-backdrop" (click)="close()">
      <div class="csm-modal" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="'strategies.createNew' | translate">

        <!-- Header -->
        <div class="csm-header">
          <div>
            <h2 class="csm-title">{{ 'strategies.createNew' | translate }}</h2>
            <p class="csm-sub">{{ stepSub }}</p>
          </div>
          <button class="csm-close" (click)="close()" [attr.aria-label]="'common.close' | translate">✕</button>
        </div>

        <!-- Step indicator -->
        <div class="csm-steps">
          <div class="csm-step" [class.active]="step() === 1" [class.done]="step() > 1">
            <span class="csm-step-num">{{ step() > 1 ? '✓' : '1' }}</span>
            <span class="csm-step-label">{{ 'strategies.stepLogic' | translate }}</span>
          </div>
          <div class="csm-step-divider"></div>
          <div class="csm-step" [class.active]="step() === 2" [class.done]="step() > 2">
            <span class="csm-step-num">{{ step() > 2 ? '✓' : '2' }}</span>
            <span class="csm-step-label">{{ 'strategies.stepBotSettings' | translate }}</span>
          </div>
          <div class="csm-step-divider"></div>
          <div class="csm-step" [class.active]="step() === 3" [class.done]="step() > 3">
            <span class="csm-step-num">{{ step() > 3 ? '✓' : '3' }}</span>
            <span class="csm-step-label">{{ 'strategies.stepStrategySettings' | translate }}</span>
          </div>
          <div class="csm-step-divider"></div>
          <div class="csm-step" [class.active]="step() === 4">
            <span class="csm-step-num">4</span>
            <span class="csm-step-label">{{ 'strategies.stepReview' | translate }}</span>
          </div>
        </div>

        <!-- ── STEP 1: Trading Logic ──────────────────────────────────────── -->
        @if (step() === 1) {
          <div class="csm-body">
            <div class="csm-field">
              <label class="csm-label">{{ 'strategies.tradingLogic' | translate }}</label>
              <div class="csm-template-grid">
                @for (t of templates; track t.id) {
                  <button
                    type="button"
                    class="csm-template-card"
                    [class.selected]="selectedTemplate()?.id === t.id"
                    (click)="selectTemplate(t)"
                  >
                    <span class="csm-tpl-icon">{{ t.icon }}</span>
                    <span class="csm-tpl-name">{{ t.name }}</span>
                    <span class="csm-tpl-desc">{{ t.shortDesc }}</span>
                    <span class="csm-tpl-risk" [style.color]="t.riskColor">{{ t.risk }} {{ 'strategies.risk' | translate }}</span>
                  </button>
                }
              </div>
            </div>

            @if (error()) {
              <p class="csm-error">{{ error() }}</p>
            }

            <div class="csm-footer">
              <button type="button" class="csm-btn secondary" (click)="close()">{{ 'common.cancel' | translate }}</button>
              <button type="button" class="csm-btn primary" (click)="toStep(2)">{{ 'common.next' | translate }} →</button>
            </div>
          </div>
        }

        <!-- ── STEP 2: Bot Settings ───────────────────────────────────────── -->
        @if (step() === 2) {
          <div class="csm-body">

            <!-- Selected logic summary -->
            <div class="csm-logic-badge">
              <span class="csm-logic-icon">{{ selectedTemplate()?.icon }}</span>
              <div>
                <div class="csm-logic-name">{{ selectedTemplate()?.name }}</div>
                <div class="csm-logic-desc">{{ selectedTemplate()?.shortDesc }}</div>
              </div>
            </div>

            <!-- Bot Name -->
            <div class="csm-field">
              <label class="csm-label" for="csm-botname">{{ 'strategies.botName' | translate }}</label>
              <input id="csm-botname" class="csm-input" type="text" [(ngModel)]="botName" [placeholder]="'strategies.botNamePlaceholder' | translate" />
            </div>

            <!-- Exchange -->
            <div class="csm-field">
              <label class="csm-label" for="csm-exchange">{{ 'strategies.exchange' | translate }}</label>
              @if (exchanges().length === 0) {
                <p class="csm-hint">{{ 'strategies.noExchanges' | translate }}</p>
              } @else {
                <select id="csm-exchange" class="csm-select" [(ngModel)]="exchangeLabel" (ngModelChange)="onExchangeChange($event)">
                  <option value="">{{ 'strategies.selectExchange' | translate }}</option>
                  @for (ex of exchanges(); track ex.label) {
                    <option [value]="ex.label">{{ ex.label }}</option>
                  }
                </select>
              }
            </div>

            <!-- Trading Pair + Timeframe -->
            <div class="csm-row">
              <div class="csm-field">
                <label class="csm-label">{{ 'strategies.tradingPair' | translate }}</label>
                <div class="csm-symbol-wrap">
                  <button type="button" class="csm-symbol-btn" (click)="toggleSymbolDropdown()">
                    @if (symbol) {
                      <span>{{ symbol }} <span class="csm-sym-name">{{ selectedSymbolName }}</span></span>
                    } @else {
                      <span class="csm-placeholder">{{ 'strategies.selectPair' | translate }}</span>
                    }
                    <svg class="csm-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  @if (symbolDropdownOpen) {
                    <div class="csm-symbol-dropdown">
                      <input class="csm-sym-search" type="text" [(ngModel)]="symbolSearch" [placeholder]="'strategies.searchPair' | translate" (click)="$event.stopPropagation()" />
                      <div class="csm-sym-list" (scroll)="onSymbolListScroll($event)">
                        @for (s of filteredSymbols; track s.symbol) {
                          <button type="button" class="csm-sym-item" [class.active]="symbol === s.symbol" (click)="selectSymbol(s.symbol)">
                            <span class="csm-sym-ticker">{{ s.symbol }}</span>
                            <span class="csm-sym-nm">{{ s.name }}</span>
                          </button>
                        }
                        @if (filteredSymbols.length === 0) {
                          <p class="csm-sym-empty">{{ 'strategies.noPairsFound' | translate }}</p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="csm-field">
                <label class="csm-label" for="csm-tf">{{ 'strategies.timeframe' | translate }}</label>
                <select id="csm-tf" class="csm-select" [(ngModel)]="timeframe">
                  <option value="">{{ 'strategies.selectTimeframe' | translate }}</option>
                  @for (tf of timeframes; track tf) {
                    <option [value]="tf">{{ tf }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Investment / Stop Loss / Take Profit -->
            <div class="csm-row three">
              <div class="csm-field">
                <label class="csm-label" for="csm-inv">{{ 'strategies.investmentAmount' | translate }}</label>
                <div class="csm-input-affix">
                  <span class="csm-prefix">$</span>
                  <input id="csm-inv" class="csm-input has-prefix" type="number" min="0" step="any" [(ngModel)]="investment" [placeholder]="'strategies.investmentPlaceholder' | translate" />
                </div>
              </div>
              <div class="csm-field">
                <label class="csm-label" for="csm-sl">{{ 'strategies.stopLoss' | translate }}</label>
                <div class="csm-input-affix">
                  <input id="csm-sl" class="csm-input has-suffix" type="number" min="0" max="100" step="any" [(ngModel)]="stopLoss" placeholder="e.g. 5" />
                  <span class="csm-suffix">%</span>
                </div>
              </div>
              <div class="csm-field">
                <label class="csm-label" for="csm-tp">{{ 'strategies.takeProfit' | translate }}</label>
                <div class="csm-input-affix">
                  <input id="csm-tp" class="csm-input has-suffix" type="number" min="0" max="1000" step="any" [(ngModel)]="takeProfit" placeholder="e.g. 10" />
                  <span class="csm-suffix">%</span>
                </div>
              </div>
            </div>

            @if (error()) {
              <p class="csm-error">{{ error() }}</p>
            }

            <div class="csm-footer">
              <button type="button" class="csm-btn secondary" (click)="back()">← {{ 'common.back' | translate }}</button>
              <button type="button" class="csm-btn primary" (click)="toStep(3)">{{ 'common.next' | translate }} →</button>
            </div>
          </div>
        }

        <!-- ── STEP 3: Strategy Settings ─────────────────────────────────── -->
        @if (step() === 3) {
          <div class="csm-body">

            <!-- Strategy Name -->
            <div class="csm-field">
              <label class="csm-label" for="csm-stratname">{{ 'strategies.strategyName' | translate }}</label>
              <input id="csm-stratname" class="csm-input" type="text" [(ngModel)]="strategyName" [placeholder]="'strategies.strategyNamePlaceholder' | translate" />
            </div>

            <!-- Trade Side -->
            <div class="csm-field">
              <label class="csm-label">{{ 'strategies.tradeSide' | translate }}</label>
              <div class="csm-toggle-row">
                <button type="button" class="csm-toggle-btn buy" [class.active]="tradeSide === 'buy'" (click)="tradeSide = 'buy'">
                  ↑ {{ 'strategies.buy' | translate }}
                </button>
                <button type="button" class="csm-toggle-btn sell" [class.active]="tradeSide === 'sell'" (click)="tradeSide = 'sell'">
                  ↓ {{ 'strategies.sell' | translate }}
                </button>
                <button type="button" class="csm-toggle-btn buy-sell" [class.active]="tradeSide === 'buySell'" (click)="tradeSide = 'buySell'">
                  ↕ {{ 'strategies.buySell' | translate }}
                </button>
              </div>
            </div>

            @if (error()) {
              <p class="csm-error">{{ error() }}</p>
            }

            <div class="csm-footer">
              <button type="button" class="csm-btn secondary" (click)="back()">← {{ 'common.back' | translate }}</button>
              <button type="button" class="csm-btn primary" (click)="toStep(4)">{{ 'common.next' | translate }} →</button>
            </div>
          </div>
        }

        <!-- ── STEP 4: Status & Review ────────────────────────────────────── -->
        @if (step() === 4) {
          <div class="csm-body">

            <!-- Initial Status -->
            <div class="csm-field">
              <label class="csm-label">{{ 'strategies.initialStatus' | translate }}</label>
              <div class="csm-toggle-row">
                <button type="button" class="csm-toggle-btn" [class.active]="strategyStatus === 'active'" (click)="strategyStatus = 'active'">
                  {{ 'common.active' | translate }}
                </button>
                <button type="button" class="csm-toggle-btn" [class.active]="strategyStatus === 'paused'" (click)="strategyStatus = 'paused'">
                  {{ 'common.paused' | translate }}
                </button>
              </div>
            </div>

            <!-- Review Summary -->
            <div class="csm-review">
              <div class="csm-review-title">{{ 'strategies.reviewSummary' | translate }}</div>
              <div class="csm-review-grid">
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.tradingLogic' | translate }}</span>
                  <span class="csm-review-val">{{ selectedTemplate()?.icon }} {{ selectedTemplate()?.name }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.botName' | translate }}</span>
                  <span class="csm-review-val">{{ botName }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.exchange' | translate }}</span>
                  <span class="csm-review-val">{{ exchangeLabel || '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.tradingPair' | translate }}</span>
                  <span class="csm-review-val">{{ symbol || '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.timeframe' | translate }}</span>
                  <span class="csm-review-val">{{ timeframe || '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.investmentAmount' | translate }}</span>
                  <span class="csm-review-val">{{ investment ? ('$' + investment) : '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.stopLoss' | translate }}</span>
                  <span class="csm-review-val">{{ stopLoss ? (stopLoss + '%') : '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.takeProfit' | translate }}</span>
                  <span class="csm-review-val">{{ takeProfit ? (takeProfit + '%') : '—' }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.strategyName' | translate }}</span>
                  <span class="csm-review-val">{{ strategyName }}</span>
                </div>
                <div class="csm-review-item">
                  <span class="csm-review-key">{{ 'strategies.tradeSide' | translate }}</span>
                  <span class="csm-review-val" [class.buy-text]="tradeSide === 'buy'" [class.sell-text]="tradeSide === 'sell'">
                    {{ tradeSide === 'buy' ? ('strategies.buy' | translate) : tradeSide === 'sell' ? ('strategies.sell' | translate) : ('strategies.buySell' | translate) }}
                  </span>
                </div>
              </div>
            </div>

            @if (error()) {
              <p class="csm-error">{{ error() }}</p>
            }

            <div class="csm-footer">
              <button type="button" class="csm-btn secondary" (click)="back()">← {{ 'common.back' | translate }}</button>
              <button type="button" class="csm-btn primary" (click)="create()" [disabled]="saving()">
                {{ saving() ? ('common.saving' | translate) : ('strategies.createStrategy' | translate) }}
              </button>
            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .csm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
    .csm-modal { background: var(--surface); border-radius: 16px; width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,0.25); display: flex; flex-direction: column; }
    .csm-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.2rem 1.4rem 0.8rem; border-bottom: 1px solid var(--border); }
    .csm-title { margin: 0; font-size: 1.15rem; color: var(--text-primary); }
    .csm-sub { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--text-secondary); }
    .csm-close { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; }
    .csm-close:hover { background: var(--bg); }
    /* Steps */
    .csm-steps { display: flex; align-items: center; padding: 0.7rem 1.4rem; gap: 0.35rem; border-bottom: 1px solid var(--border); overflow-x: auto; }
    .csm-step { display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; flex-shrink: 0; }
    .csm-step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--border); color: var(--text-secondary); font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .csm-step.active .csm-step-num { background: var(--accent); color: #fff; }
    .csm-step.done .csm-step-num { background: rgba(0,209,122,0.25); color: var(--accent); font-size: 0.65rem; }
    .csm-step-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; }
    .csm-step.active .csm-step-label { color: var(--text-primary); }
    .csm-step.done .csm-step-label { color: var(--accent); }
    .csm-step-divider { flex: 1; min-width: 12px; height: 1px; background: var(--border); }
    /* Body */
    .csm-body { padding: 1.2rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
    .csm-field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
    .csm-label { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
    .csm-input { border: 1px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--text-primary); padding: 0.6rem 0.75rem; font-size: 0.9rem; width: 100%; outline: none; box-sizing: border-box; }
    .csm-input:focus { border-color: rgba(0,209,122,0.5); }
    .csm-select { border: 1px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--text-primary); padding: 0.6rem 0.75rem; font-size: 0.9rem; width: 100%; cursor: pointer; }
    .csm-row { display: flex; gap: 0.75rem; }
    .csm-row.three { gap: 0.6rem; }
    .csm-hint { margin: 0; font-size: 0.82rem; color: var(--text-secondary); }
    /* Affix inputs */
    .csm-input-affix { position: relative; display: flex; align-items: center; }
    .csm-prefix { position: absolute; left: 0.75rem; color: var(--text-secondary); font-size: 0.88rem; pointer-events: none; }
    .csm-suffix { position: absolute; right: 0.75rem; color: var(--text-secondary); font-size: 0.88rem; pointer-events: none; }
    .csm-input.has-prefix { padding-left: 1.6rem; }
    .csm-input.has-suffix { padding-right: 1.8rem; width: 100%; }
    /* Logic badge (step 2 summary) */
    .csm-logic-badge { display: flex; align-items: flex-start; gap: 0.75rem; border: 1px solid rgba(0,209,122,0.3); border-radius: 10px; padding: 0.8rem 1rem; background: rgba(0,209,122,0.06); }
    .csm-logic-icon { font-size: 1.6rem; line-height: 1; flex-shrink: 0; }
    .csm-logic-name { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); }
    .csm-logic-desc { font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem; }
    /* Template grid */
    .csm-template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem; max-height: 380px; overflow-y: auto; padding-right: 2px; }
    .csm-template-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg); padding: 0.75rem 0.6rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; cursor: pointer; text-align: center; transition: border-color 0.15s, background 0.15s; }
    .csm-template-card:hover { border-color: rgba(0,209,122,0.4); background: rgba(0,209,122,0.04); }
    .csm-template-card.selected { border-color: var(--accent); background: rgba(0,209,122,0.08); box-shadow: 0 0 0 1px rgba(0,209,122,0.2) inset; }
    .csm-tpl-icon { font-size: 1.5rem; }
    .csm-tpl-name { font-size: 0.78rem; font-weight: 700; color: var(--text-primary); line-height: 1.3; }
    .csm-tpl-desc { font-size: 0.68rem; color: var(--text-secondary); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .csm-tpl-risk { font-size: 0.68rem; font-weight: 700; margin-top: 0.1rem; }
    /* Symbol dropdown */
    .csm-symbol-wrap { position: relative; }
    .csm-symbol-btn { width: 100%; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--text-primary); padding: 0.6rem 0.75rem; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; text-align: left; }
    .csm-symbol-btn:hover { border-color: rgba(0,209,122,0.4); }
    .csm-placeholder { color: var(--text-secondary); }
    .csm-sym-name { color: var(--text-secondary); font-size: 0.78rem; margin-left: 0.4rem; }
    .csm-chevron { width: 16px; height: 16px; color: var(--text-secondary); flex-shrink: 0; }
    .csm-symbol-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 200; }
    .csm-sym-search { width: 100%; border: none; border-bottom: 1px solid var(--border); background: transparent; color: var(--text-primary); padding: 0.6rem 0.75rem; font-size: 0.88rem; outline: none; box-sizing: border-box; border-radius: 10px 10px 0 0; }
    .csm-sym-list { max-height: 200px; overflow-y: auto; }
    .csm-sym-item { width: 100%; border: none; background: transparent; color: var(--text-primary); padding: 0.5rem 0.75rem; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; text-align: left; }
    .csm-sym-item:hover, .csm-sym-item.active { background: rgba(0,209,122,0.08); }
    .csm-sym-ticker { font-weight: 700; }
    .csm-sym-nm { color: var(--text-secondary); font-size: 0.76rem; }
    .csm-sym-empty { margin: 0.5rem 0.75rem; color: var(--text-secondary); font-size: 0.85rem; }
    /* Toggle row */
    .csm-toggle-row { display: flex; gap: 0.5rem; }
    .csm-toggle-btn { border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary); border-radius: 9px; padding: 0.55rem 1.2rem; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
    .csm-toggle-btn.active { border-color: var(--accent); background: rgba(0,209,122,0.12); color: var(--accent); }
    .csm-toggle-btn.buy.active { border-color: #00d17a; background: rgba(0,209,122,0.12); color: #00d17a; }
    .csm-toggle-btn.sell.active { border-color: #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; }
    /* Review */
    .csm-review { border: 1px solid var(--border); border-radius: 12px; background: var(--bg); overflow: hidden; }
    .csm-review-title { padding: 0.65rem 0.9rem; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    .csm-review-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .csm-review-item { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--border); }
    .csm-review-item:nth-last-child(-n+2) { border-bottom: none; }
    .csm-review-key { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
    .csm-review-val { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
    .buy-text { color: #00d17a; }
    .sell-text { color: #ef4444; }
    /* Footer */
    .csm-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .csm-btn { border-radius: 10px; padding: 0.58rem 1.1rem; font-size: 0.88rem; font-weight: 700; cursor: pointer; border: 1px solid var(--border); }
    .csm-btn.secondary { background: var(--surface-raised); color: var(--text-primary); }
    .csm-btn.primary { background: rgba(0,209,122,0.15); color: var(--accent); border-color: rgba(0,209,122,0.35); }
    .csm-btn.primary:hover:not(:disabled) { background: rgba(0,209,122,0.25); }
    .csm-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .csm-error { margin: 0; padding: 0.6rem 0.8rem; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); border-radius: 8px; color: #ef4444; font-size: 0.85rem; }
    @media (max-width: 520px) {
      .csm-row, .csm-row.three { flex-direction: column; }
      .csm-template-grid { grid-template-columns: repeat(2, 1fr); }
      .csm-review-grid { grid-template-columns: 1fr; }
      .csm-review-item:last-child { border-bottom: none; }
      .csm-review-item:nth-last-child(2) { border-bottom: 1px solid var(--border); }
      .csm-step-label { display: none; }
    }
  `],
})
export class CreateStrategyModal {
  private strategyService = inject(StrategyService);
  private exchangeSvc = inject(ExchangeService);
  private accountMode = inject(AccountModeService);
  private platformId = inject(PLATFORM_ID);
  private elRef = inject(ElementRef);

  closed = output<void>();
  created = output<void>();

  readonly templates = STRATEGY_TEMPLATES;
  readonly timeframes = TIMEFRAMES;
  readonly step = signal<Step>(1);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly selectedTemplate = signal<StrategyTemplate | null>(null);

  readonly exchanges = computed(() => this.exchangeSvc.connectionsByMode(this.accountMode.mode()));

  // Step 2 — Bot fields
  botName = '';
  exchangeLabel = '';
  exchangeId = '';
  symbol = '';
  symbolSearch = '';
  symbolDropdownOpen = false;
  displayLimit = 200;
  allSymbols: SymbolEntry[] = SYMBOLS;
  timeframe = '';
  investment = '';
  stopLoss = '';
  takeProfit = '';

  // Step 3 — Strategy fields
  strategyName = '';
  tradeSide: 'buy' | 'sell' | 'buySell' = 'buy';

  // Step 4
  strategyStatus: 'active' | 'paused' = 'active';

  get stepSub(): string {
    const subs: Record<number, string> = {
      1: 'Step 1 of 4 — Choose the trading logic for your bot',
      2: 'Step 2 of 4 — Configure your bot settings',
      3: 'Step 3 of 4 — Name your strategy and set trade direction',
      4: 'Step 4 of 4 — Set initial status and review',
    };
    return subs[this.step()] ?? '';
  }

  get filteredSymbols(): SymbolEntry[] {
    const q = this.symbolSearch.toLowerCase();
    if (q) {
      return this.allSymbols.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    return this.allSymbols.slice(0, this.displayLimit);
  }

  get selectedSymbolName(): string {
    return this.allSymbols.find(s => s.symbol === this.symbol)?.name ?? '';
  }

  private loadAllSymbols(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    fetch('/alpaca-symbols.json')
      .then(r => r.json())
      .then((data: SymbolEntry[]) => { this.allSymbols = data; })
      .catch(() => { /* keep curated fallback */ });
  }

  toggleSymbolDropdown(): void {
    this.symbolDropdownOpen = !this.symbolDropdownOpen;
    if (this.symbolDropdownOpen) {
      this.symbolSearch = '';
      this.displayLimit = 200;
      this.loadAllSymbols();
    }
  }

  onSymbolListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.displayLimit += 100;
    }
  }

  selectSymbol(sym: string): void {
    this.symbol = sym;
    this.symbolDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.symbolDropdownOpen = false;
    }
  }

  selectTemplate(t: StrategyTemplate): void {
    this.selectedTemplate.set(t);
    if (!this.botName) {
      this.botName = `My ${t.name} Bot`;
    }
    if (!this.strategyName) {
      this.strategyName = t.name;
    }
  }

  onExchangeChange(label: string): void {
    const conn = this.exchanges().find(e => e.label === label);
    this.exchangeId = conn?.exchangeId ?? '';
  }

  toStep(next: Step): void {
    this.error.set('');

    if (next === 2) {
      if (!this.selectedTemplate()) {
        this.error.set('strategies.errorSelectLogic');
        return;
      }
    }

    if (next === 3) {
      if (!this.botName.trim()) { this.error.set('strategies.errorBotName'); return; }
      if (!this.exchangeLabel) { this.error.set('strategies.errorExchange'); return; }
      if (!this.symbol) { this.error.set('strategies.errorSymbol'); return; }
      if (!this.timeframe) { this.error.set('strategies.errorTimeframe'); return; }
      const inv = Number.parseFloat(this.investment);
      if (!this.investment || isNaN(inv) || inv <= 0) { this.error.set('strategies.errorInvestment'); return; }
    }

    if (next === 4) {
      if (!this.strategyName.trim()) {
        this.strategyName = this.selectedTemplate()!.name;
      }
    }

    this.step.set(next);
  }

  back(): void {
    this.error.set('');
    this.step.update(s => (s - 1) as Step);
  }

  async create(): Promise<void> {
    this.error.set('');
    const tpl = this.selectedTemplate()!;
    const mode = this.accountMode.mode();
    this.saving.set(true);
    try {
      await this.strategyService.createUserStrategy({
        templateId: tpl.id,
        templateName: tpl.name,
        templateIcon: tpl.icon,
        name: this.strategyName.trim() || tpl.name,
        botName: this.botName.trim(),
        exchangeId: this.exchangeId,
        exchangeLabel: this.exchangeLabel,
        symbol: this.symbol,
        timeframe: this.timeframe,
        investment: Number.parseFloat(this.investment),
        stopLoss: Number.parseFloat(this.stopLoss) || 0,
        takeProfit: Number.parseFloat(this.takeProfit) || 0,
        accountMode: mode,
        tradeSide: this.tradeSide,
        status: this.strategyStatus,
      });
      this.created.emit();
      this.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'strategies.errorCreate';
      this.error.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
