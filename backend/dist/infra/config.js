"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    port: Number(process.env.PORT || 8080),
    runnerApiKey: String(process.env.RUNNER_API_KEY || ""),
    marketDataProvider: String(process.env.MARKET_DATA_PROVIDER || "yfinance").toLowerCase(),
    yfinancePythonBin: String(process.env.YFINANCE_PYTHON_BIN || "python3"),
    tradingviewApiKey: process.env.TRADINGVIEW_API_KEY || "",
};
