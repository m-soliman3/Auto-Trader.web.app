import { Injectable, signal } from '@angular/core';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketUpdate {
  type: 'initial' | 'update' | 'subscribed' | 'error';
  symbol: string;
  candles?: Candle[];
  candle?: Candle;
  timestamp: string;
  error?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class MarketStreamService {
  private ws: WebSocket | null = null;
  private wsUrl: string;

  currentCandles = signal<Candle[]>([]);
  streamStatus = signal<'connected' | 'disconnected'>('disconnected');
  currentSymbol = signal<string>('');

  constructor() {
    this.wsUrl = this.getWebSocketUrl();
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.streamStatus.set('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          const update: MarketUpdate = JSON.parse(event.data);
          this.handleMarketUpdate(update);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.streamStatus.set('disconnected');
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.streamStatus.set('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  subscribe(symbol: string, timeframe: string, interval = 5000): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.currentSymbol.set(symbol);
      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          symbol,
          timeframe,
          interval,
        })
      );
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  unsubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          symbol,
        })
      );
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMarketUpdate(update: MarketUpdate): void {
    console.log('Market update:', update);

    if (update.type === 'initial' && update.candles) {
      this.currentCandles.set(update.candles);
    } else if (update.type === 'update' && update.candle) {
      const candles = this.currentCandles();
      // Replace last candle or add new one
      if (candles.length > 0 && candles[candles.length - 1].time === update.candle.time) {
        candles[candles.length - 1] = update.candle;
      } else {
        candles.push(update.candle);
      }
      this.currentCandles.set([...candles]);
    } else if (update.type === 'error') {
      console.error('Market stream error:', update.error);
    }
  }
}
