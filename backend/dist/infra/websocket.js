"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocketServer = setupWebSocketServer;
const ws_1 = __importDefault(require("ws"));
const marketData_1 = require("../engine/marketData");
const subscriptions = new Map();
function setupWebSocketServer(server) {
    const wss = new ws_1.default.Server({ server });
    wss.on("connection", (ws) => {
        console.log("WebSocket client connected");
        subscriptions.set(ws, []);
        ws.on("message", async (data) => {
            try {
                const request = JSON.parse(data);
                if (request.type === "subscribe") {
                    await handleSubscribe(ws, request);
                }
                else if (request.type === "unsubscribe") {
                    handleUnsubscribe(ws, request.symbol);
                }
            }
            catch (error) {
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
                    if (sub.updateTimer)
                        clearInterval(sub.updateTimer);
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
async function handleSubscribe(ws, request) {
    const interval = request.interval || 5000; // Default 5 seconds
    const clientSubs = subscriptions.get(ws) || [];
    // Unsubscribe from existing subscription for this symbol
    handleUnsubscribe(ws, request.symbol);
    const subscription = {
        symbol: request.symbol,
        timeframe: request.timeframe,
        interval,
        exchangeId: "binance", // Default to Binance for now
    };
    // Send initial data
    try {
        const candles = await (0, marketData_1.fetchBinanceCandles)(request.symbol, request.timeframe, 80);
        ws.send(JSON.stringify({
            type: "initial",
            symbol: request.symbol,
            candles,
            timestamp: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error("Failed to fetch initial candles:", error);
        ws.send(JSON.stringify({
            error: `Failed to fetch data for ${request.symbol}`,
            symbol: request.symbol,
        }));
        return;
    }
    // Set up periodic updates
    subscription.updateTimer = setInterval(async () => {
        if (ws.readyState === ws_1.default.OPEN) {
            try {
                const candles = await (0, marketData_1.fetchBinanceCandles)(request.symbol, request.timeframe, 1);
                if (candles.length > 0) {
                    ws.send(JSON.stringify({
                        type: "update",
                        symbol: request.symbol,
                        candle: candles[0],
                        timestamp: new Date().toISOString(),
                    }));
                }
            }
            catch (error) {
                console.error(`Failed to fetch update for ${request.symbol}:`, error);
            }
        }
        else {
            // Clean up if connection closed
            if (subscription.updateTimer)
                clearInterval(subscription.updateTimer);
        }
    }, interval);
    clientSubs.push(subscription);
    subscriptions.set(ws, clientSubs);
    ws.send(JSON.stringify({
        type: "subscribed",
        symbol: request.symbol,
        message: `Subscribed to ${request.symbol} updates every ${interval}ms`,
    }));
}
function handleUnsubscribe(ws, symbol) {
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
