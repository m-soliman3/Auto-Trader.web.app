export function isCryptoLikeSymbol(symbol: string): boolean {
  return symbol.includes("/");
}

function getUsEasternClockParts(now: Date): { weekday: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    weekday: map.weekday || "",
    hour: Number.parseInt(map.hour || "0", 10),
    minute: Number.parseInt(map.minute || "0", 10),
  };
}

export function marketSessionForExchange(exchangeId: string, symbol: string, now = new Date()): { isOpen: boolean; reason: string } {
  const normalized = exchangeId.toLowerCase();

  // ── 24/7 crypto exchanges ────────────────────────────────────────
  const cryptoExchanges = [
    "binance", "coinbase",
    "kraken",
    "robinhood-crypto",
    "bybit", "bybit-testnet",
    "okx", "okx-demo",
    "kucoin", "kucoin-sandbox",
    "bitfinex",
    "gateio",
    "mexc",
    "deribit", "deribit-testnet",
  ];
  if (cryptoExchanges.includes(normalized)) {
    return { isOpen: true, reason: "Crypto market is 24/7." };
  }

  // ── Alpaca (stocks + crypto) ────────────────────────────────────
  if (normalized === "alpaca" || normalized === "alpaca-paper") {
    if (isCryptoLikeSymbol(symbol)) {
      return { isOpen: true, reason: "Alpaca crypto market is 24/7." };
    }
    return usEquitiesSession(now);
  }

  // ── US-hours stock brokers ──────────────────────────────────────
  const usStockBrokers = [
    "tradier", "tradier-sandbox",
    "tastytrade",
    "schwab", "schwab-paper",
    "interactive-brokers", "interactive-brokers-paper",
  ];
  if (usStockBrokers.includes(normalized)) {
    return usEquitiesSession(now);
  }

  // ── IG Group — CFDs on many markets; use US hours as default ───
  if (normalized === "ig-group" || normalized === "ig-group-demo") {
    return usEquitiesSession(now);
  }

  return { isOpen: false, reason: `Exchange "${exchangeId}" is not supported.` };
}

function usEquitiesSession(now: Date): { isOpen: boolean; reason: string } {
  const clock = getUsEasternClockParts(now);
  if (clock.weekday === "Sat" || clock.weekday === "Sun") {
    return { isOpen: false, reason: "US equities market is closed on weekends." };
  }
  const minutes = clock.hour * 60 + clock.minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  if (minutes < open || minutes >= close) {
    return { isOpen: false, reason: "US equities market hours are 09:30–16:00 ET." };
  }
  return { isOpen: true, reason: "US equities regular session is open." };
}
