import { Component, OnInit, OnDestroy, inject, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketStreamService, Candle } from '../services/market-stream.service';

@Component({
  selector: 'app-market-stream-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="market-stream-container">
      <div class="header">
        <h2>Live Market Data Stream</h2>
        <div class="status-badge" [class.connected]="streamService.streamStatus() === 'connected'">
          {{ streamService.streamStatus() | uppercase }}
        </div>
      </div>

      <div class="controls">
        <div class="input-group">
          <label for="symbol">Symbol:</label>
          <input
            id="symbol"
            [(ngModel)]="selectedSymbol"
            type="text"
            placeholder="e.g., BTC/USDT, ETH/USDT"
            (keyup.enter)="startStream()"
          />
        </div>

        <div class="input-group">
          <label for="timeframe">Timeframe:</label>
          <select id="timeframe" [(ngModel)]="selectedTimeframe">
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="1d">1 day</option>
          </select>
        </div>

        <div class="input-group">
          <label for="interval">Update Interval (ms):</label>
          <input id="interval" [(ngModel)]="updateInterval" type="number" min="1000" step="1000" />
        </div>

        <button (click)="startStream()" class="btn btn-primary">Subscribe</button>
        <button (click)="stopStream()" class="btn btn-secondary">Unsubscribe</button>
        <button (click)="connectWS()" class="btn btn-connect">Connect WS</button>
      </div>

      <div class="info-panel">
        <div class="info-item">
          <span class="label">Current Symbol:</span>
          <span class="value">{{ streamService.currentSymbol() }}</span>
        </div>
        <div class="info-item">
          <span class="label">Total Candles:</span>
          <span class="value">{{ streamService.currentCandles().length }}</span>
        </div>
        <div class="info-item" *ngIf="lastCandle">
          <span class="label">Last Price:</span>
          <span class="value">{{ lastCandle.close | number: '1.2-8' }}</span>
        </div>
        <div class="info-item" *ngIf="lastCandle">
          <span class="label">High/Low:</span>
          <span class="value">{{ lastCandle.high | number: '1.2-8' }} / {{ lastCandle.low | number: '1.2-8' }}</span>
        </div>
        <div class="info-item" *ngIf="lastCandle">
          <span class="label">Volume:</span>
          <span class="value">{{ lastCandle.volume | number: '1.0-2' }}</span>
        </div>
        <div class="info-item" *ngIf="lastCandle">
          <span class="label">Last Update:</span>
          <span class="value">{{ lastCandle.time }}</span>
        </div>
      </div>

      <div class="candles-container">
        <h3>Candle History</h3>
        <table class="candles-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let candle of streamService.currentCandles(); let last = last" [class.latest]="last">
              <td>{{ formatTime(candle.time) }}</td>
              <td>{{ candle.open | number: '1.2-8' }}</td>
              <td>{{ candle.high | number: '1.2-8' }}</td>
              <td>{{ candle.low | number: '1.2-8' }}</td>
              <td class="close-price" [class.up]="candle.close >= candle.open" [class.down]="candle.close < candle.open">
                {{ candle.close | number: '1.2-8' }}
              </td>
              <td>{{ candle.volume | number: '1.0-2' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .market-stream-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #eee;
    }

    .header h2 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }

    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background-color: #ffebee;
      color: #c62828;
    }

    .status-badge.connected {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
      padding: 20px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .input-group label {
      font-weight: 600;
      font-size: 13px;
      color: #555;
    }

    .input-group input,
    .input-group select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
    }

    .input-group input:focus,
    .input-group select:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
    }

    .btn {
      padding: 10px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background-color: #1976d2;
      color: white;
    }

    .btn-primary:hover {
      background-color: #1565c0;
    }

    .btn-secondary {
      background-color: #757575;
      color: white;
    }

    .btn-secondary:hover {
      background-color: #616161;
    }

    .btn-connect {
      background-color: #388e3c;
      color: white;
    }

    .btn-connect:hover {
      background-color: #2e7d32;
    }

    .info-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 6px;
    }

    .info-item .label {
      font-weight: 600;
      color: #666;
      font-size: 13px;
    }

    .info-item .value {
      color: #1976d2;
      font-weight: 600;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .candles-container {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
    }

    .candles-container h3 {
      margin: 0 0 15px 0;
      font-size: 18px;
      color: #333;
    }

    .candles-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .candles-table thead {
      background-color: #f5f5f5;
      border-bottom: 2px solid #ddd;
    }

    .candles-table th {
      padding: 12px;
      text-align: right;
      font-weight: 600;
      color: #666;
    }

    .candles-table th:first-child {
      text-align: left;
    }

    .candles-table td {
      padding: 10px 12px;
      text-align: right;
      border-bottom: 1px solid #eee;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .candles-table td:first-child {
      text-align: left;
      color: #666;
    }

    .candles-table tbody tr:hover {
      background-color: #f9f9f9;
    }

    .candles-table tbody tr.latest {
      background-color: #e3f2fd;
      font-weight: 600;
    }

    .close-price.up {
      color: #4caf50;
    }

    .close-price.down {
      color: #f44336;
    }
  `,
})
export class MarketStreamDemoComponent implements OnInit, OnDestroy {
  streamService = inject(MarketStreamService);

  @Input() initialSymbol = 'BTC/USDT';
  @Input() initialTimeframe = '1h';
  
  selectedSymbol = 'BTC/USDT';
  selectedTimeframe = '1h';
  updateInterval = 5000;
  lastCandle: Candle | null = null;

  constructor() {
    effect(() => {
      const candles = this.streamService.currentCandles();
      if (candles && candles.length > 0) {
        this.lastCandle = candles[candles.length - 1];
      }
    });
  }

  async ngOnInit() {
    this.selectedSymbol = this.initialSymbol;
    this.selectedTimeframe = this.initialTimeframe;
    await this.connectWS();
  }

  async connectWS(): Promise<void> {
    try {
      if (this.streamService.streamStatus() === 'disconnected') {
        await this.streamService.connect();
        console.log('WebSocket connected');
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  startStream(): void {
    const symbol = this.selectedSymbol.trim();
    const timeframe = this.selectedTimeframe;
    const interval = this.updateInterval;

    if (!symbol) {
      alert('Please enter a symbol');
      return;
    }

    if (this.streamService.streamStatus() !== 'connected') {
      alert('WebSocket is not connected. Click "Connect WS" first.');
      return;
    }

    console.log(`Subscribing to ${symbol} on ${timeframe} timeframe: ${interval}ms updates`);
    this.streamService.subscribe(symbol, timeframe, interval);
  }

  stopStream(): void {
    const symbol = this.streamService.currentSymbol();
    if (symbol) {
      this.streamService.unsubscribe(symbol);
      console.log(`Unsubscribed from ${symbol}`);
    }
  }

  formatTime(timeStr: string): string {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString();
    } catch {
      return timeStr;
    }
  }

  ngOnDestroy(): void {
    this.stopStream();
    this.streamService.disconnect();
  }
}
