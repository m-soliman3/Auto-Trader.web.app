import WebSocket from "ws";
import { Server } from "http";
import { fetchBinanceCandles, fetchAlpacaStockBars } from "../engine/marketData";
import { Candle } from "../types/domain";

interface SubscriptionRequest {
  type: "subscribe" | "unsubscribe";
  symbol: string;
  timeframe: string;
  interval?: number; // milliseconds between updates
}

interface SubscriptionState {
  symbol: string;
  timeframe: string;
  interval: number;
  exchangeId: string;
  apiKey?: string;
  apiSecret?: string;
  updateTimer?: NodeJS.Timeout;
}

const subscriptions = new Map<WebSocket, SubscriptionState[]>();

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket client connected");
    subscriptions.set(ws, []);

    ws.on("message", async (data: string) => {
      try {
        const request: SubscriptionRequest = JSON.parse(data);

        if (request.type === "subscribe") {
          await handleSubscribe(ws, request);
        } else if (request.type === "unsubscribe") {
          handleUnsubscribe(ws, request.symbol);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ error: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      // Clear all subscriptions and timers for this client
      const clientSubs = subscriptions.get(ws);
      if (clientSubs) {
        clientSubs.forEach((sub) => {
          if (sub.updateTimer) clearInterval(sub.updateTimer);
        });
      }
      subscriptions.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return wss;
}

async function handleSubscribe(ws: WebSocket, request: SubscriptionRequest) {
  const interval = request.interval || 5000; // Default 5 seconds
  const clientSubs = subscriptions.get(ws) || [];

  // Unsubscribe from existing subscription for this symbol
  handleUnsubscribe(ws, request.symbol);

  const subscription: SubscriptionState = {
    symbol: request.symbol,
    timeframe: request.timeframe,
    interval,
    exchangeId: "binance", // Default to Binance for now
  };

  // Send initial data
  try {
    const candles = await fetchBinanceCandles(request.symbol, request.timeframe, 80);
    ws.send(
      JSON.stringify({
        type: "initial",
        symbol: request.symbol,
        candles,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("Failed to fetch initial candles:", error);
    ws.send(
      JSON.stringify({
        error: `Failed to fetch data for ${request.symbol}`,
        symbol: request.symbol,
      })
    );
    return;
  }

  // Set up periodic updates
  subscription.updateTimer = setInterval(async () => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const candles = await fetchBinanceCandles(request.symbol, request.timeframe, 1);
        if (candles.length > 0) {
          ws.send(
            JSON.stringify({
              type: "update",
              symbol: request.symbol,
              candle: candles[0],
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch (error) {
        console.error(`Failed to fetch update for ${request.symbol}:`, error);
      }
    } else {
      // Clean up if connection closed
      if (subscription.updateTimer) clearInterval(subscription.updateTimer);
    }
  }, interval);

  clientSubs.push(subscription);
  subscriptions.set(ws, clientSubs);

  ws.send(
    JSON.stringify({
      type: "subscribed",
      symbol: request.symbol,
      message: `Subscribed to ${request.symbol} updates every ${interval}ms`,
    })
  );
}

function handleUnsubscribe(ws: WebSocket, symbol: string) {
  const clientSubs = subscriptions.get(ws) || [];
  const index = clientSubs.findIndex((sub) => sub.symbol === symbol);

  if (index !== -1) {
    const subscription = clientSubs[index];
    if (subscription.updateTimer) {
      clearInterval(subscription.updateTimer);
    }
    clientSubs.splice(index, 1);
  }
}
