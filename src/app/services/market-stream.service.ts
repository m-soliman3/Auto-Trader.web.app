import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

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
  private http = inject(HttpClient);
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private usePolling = false;

  currentCandles = signal<Candle[]>([]);
  streamStatus = signal<'connected' | 'disconnected'>('disconnected');
  currentSymbol = signal<string>('');

  constructor() {
    this.wsUrl = this.getWebSocketUrl();
  }

  private getWebSocketUrl(): string {
    // Use the backend URL from environment
    const backendUrl = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');
    
    if (backendUrl) {
      // Convert https:// to wss:// and http:// to ws://
      const wsUrl = backendUrl
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:');
      return wsUrl;
    }

    // Fallback: construct from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Attempting WebSocket connection at: ${this.wsUrl}`);
        this.ws = new WebSocket(this.wsUrl);
        
        // Set a timeout for connection
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket connection timeout - falling back to polling');
            this.ws?.close();
            this.usePolling = true;
            this.streamStatus.set('connected');
            resolve();
          }
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connected successfully');
          this.usePolling = false;
          this.streamStatus.set('connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const update: MarketUpdate = JSON.parse(event.data);
            this.handleMarketUpdate(update);
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.warn('WebSocket error - falling back to polling:', error);
          this.usePolling = true;
          this.streamStatus.set('connected');
          resolve();
        };

        this.ws.onclose = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket closed');
          this.streamStatus.set('disconnected');
        };
      } catch (error) {
        console.warn('Unable to create WebSocket - using polling fallback:', error);
        this.usePolling = true;
        this.streamStatus.set('connected');
        resolve();
      }
    });
  }

  subscribe(symbol: string, timeframe: string, interval = 5000): void {
    this.currentSymbol.set(symbol);
    
    if (this.usePolling) {
      // Use HTTP polling fallback
      this.startPolling(symbol, timeframe, interval);
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      // Use WebSocket
      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          symbol,
          timeframe,
          interval,
        })
      );
    } else {
      console.warn('Not connected - starting polling fallback');
      this.startPolling(symbol, timeframe, interval);
    }
  }

  private startPolling(symbol: string, timeframe: string, interval: number): void {
    // Stop existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log(`Starting polling for ${symbol} every ${interval}ms`);
    
    // Fetch initial data
    this.fetchMarketData(symbol, timeframe);

    // Poll periodically
    this.pollingInterval = setInterval(() => {
      this.fetchMarketData(symbol, timeframe);
    }, interval);
  }

  private fetchMarketData(symbol: string, timeframe: string): void {
    // Use Cloud Function endpoint (routed through Firebase Hosting)
    const cloudFunctionUrl = '/api/getMarketData';
    const params = new URLSearchParams({
      symbol: symbol,
      timeframe: timeframe,
    });

    this.http.get(`${cloudFunctionUrl}?${params.toString()}`).subscribe({
      next: (response: any) => {
        if (response && response.candles) {
          this.currentCandles.set(response.candles);
        }
      },
      error: (err) => {
        console.error('Error fetching market data via Cloud Function:', err);
        // Try direct backend as fallback
        const backendUrl = String(environment.tradingBackendBaseUrl || '').replace(/\/$/, '');
        if (backendUrl) {
          this.http.get(`${backendUrl}/v1/instrument-chart?symbol=${symbol}&timeframe=${timeframe}`).subscribe({
            next: (response: any) => {
              if (response && response.candles) {
                this.currentCandles.set(response.candles);
              }
            },
            error: (err2) => {
              console.error('Error fetching from direct backend:', err2);
            }
          });
        }
      }
    });
  }

  unsubscribe(symbol: string): void {
    // Stop polling if active
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Send unsubscribe via WebSocket if connected
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
    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.streamStatus.set('disconnected');
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
