export interface AppConfig {
  port: number;
  runnerApiKey: string;
  marketDataProvider: "yfinance" | "native" | "tradingview";
  yfinancePythonBin: string;
  tradingviewApiKey?: string;
  /** Alpaca Broker API credentials for auto-provisioning paper accounts. */
  alpacaBrokerKeyId?: string;
  alpacaBrokerSecretKey?: string;
  /** EmailJS credentials for transactional emails (funding confirmation, etc.). */
  emailjsServiceId?: string;
  emailjsPublicKey?: string;
  emailjsPrivateKey?: string;
  /** EmailJS template ID for demo account top-up confirmation emails. */
  emailjsTopupTemplateId?: string;
  /** Resend API key for freeform transactional emails (e.g. strategy signal alerts). */
  resendApiKey?: string;
  /** Read-only key for the market-analysis endpoints. Never grants execution. */
  analysisReadKey: string;
  /** Symbols the analysis runner always covers. */
  analysisSymbols: string[];
  /** Timeframes each watchlist symbol is analysed on. */
  analysisTimeframes: string[];
  /** Also analyse every symbol an active strategy trades. */
  analysisIncludeStrategySymbols: boolean;
  /** Analyse closed markets too, so weekend questions still get answers. */
  analysisWhenClosed: boolean;
  /** While closed, only re-analyse a symbol once its snapshot is this old. */
  analysisClosedRefreshMinutes: number;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 8080),
  runnerApiKey: String(process.env.RUNNER_API_KEY || ""),
  marketDataProvider: String(process.env.MARKET_DATA_PROVIDER || "yfinance").toLowerCase() as "yfinance" | "native" | "tradingview",
  yfinancePythonBin: String(process.env.YFINANCE_PYTHON_BIN || "python3"),
  tradingviewApiKey: process.env.TRADINGVIEW_API_KEY || "",
  alpacaBrokerKeyId: process.env.ALPACA_BROKER_KEY_ID || "",
  alpacaBrokerSecretKey: process.env.ALPACA_BROKER_SECRET_KEY || "",
  emailjsServiceId: process.env.EMAILJS_SERVICE_ID || "Auto-Trader",
  emailjsPublicKey: process.env.EMAILJS_PUBLIC_KEY || "gLTFDfDYuNpAvYzQJ",
  emailjsPrivateKey: process.env.EMAILJS_PRIVATE_KEY || "EATS9AlStHHuuQOzW5TbE",
  emailjsTopupTemplateId: process.env.EMAILJS_TOPUP_TEMPLATE_ID || "template_nwywmjp",
  resendApiKey: process.env.RESEND_API_KEY || "",
  analysisReadKey: String(process.env.ANALYSIS_READ_KEY || ""),
  analysisSymbols: String(process.env.ANALYSIS_SYMBOLS || "AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL,META,SPY,QQQ,BTC/USD,ETH/USD,EUR/USD,GBP/USD,USD/JPY")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  analysisTimeframes: String(process.env.ANALYSIS_TIMEFRAMES || "1h,1d")
    .split(",").map((s) => s.trim()).filter(Boolean),
  analysisIncludeStrategySymbols: String(process.env.ANALYSIS_INCLUDE_STRATEGY_SYMBOLS || "true") !== "false",
  analysisWhenClosed: String(process.env.ANALYSIS_WHEN_CLOSED || "true") !== "false",
  analysisClosedRefreshMinutes: Number(process.env.ANALYSIS_CLOSED_REFRESH_MINUTES || 60),
};
