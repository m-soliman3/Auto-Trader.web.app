export interface AppConfig {
  port: number;
  runnerApiKey: string;
  marketDataProvider: "yfinance" | "native";
  yfinancePythonBin: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 8080),
  runnerApiKey: String(process.env.RUNNER_API_KEY || ""),
  marketDataProvider: String(process.env.MARKET_DATA_PROVIDER || "yfinance").toLowerCase() === "native" ? "native" : "yfinance",
  yfinancePythonBin: String(process.env.YFINANCE_PYTHON_BIN || "python3"),
};
