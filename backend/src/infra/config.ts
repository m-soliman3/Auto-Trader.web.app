export interface AppConfig {
  port: number;
  runnerApiKey: string;
  marketDataProvider: "yfinance" | "native" | "tradingview";
  yfinancePythonBin: string;
  tradingviewApiKey?: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 8080),
  runnerApiKey: String(process.env.RUNNER_API_KEY || ""),
  marketDataProvider: String(process.env.MARKET_DATA_PROVIDER || "yfinance").toLowerCase() as "yfinance" | "native" | "tradingview",
  yfinancePythonBin: String(process.env.YFINANCE_PYTHON_BIN || "python3"),
  tradingviewApiKey: process.env.TRADINGVIEW_API_KEY || "",
};
