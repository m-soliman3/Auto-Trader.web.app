"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCryptoLikeSymbol = isCryptoLikeSymbol;
exports.marketSessionForExchange = marketSessionForExchange;
function isCryptoLikeSymbol(symbol) {
    return symbol.includes("/");
}
function getUsEasternClockParts(now) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const map = {};
    for (const part of parts) {
        if (part.type !== "literal")
            map[part.type] = part.value;
    }
    return {
        weekday: map.weekday || "",
        hour: Number.parseInt(map.hour || "0", 10),
        minute: Number.parseInt(map.minute || "0", 10),
    };
}
function marketSessionForExchange(exchangeId, symbol, now = new Date()) {
    const normalized = exchangeId.toLowerCase();
    if (normalized === "binance") {
        return { isOpen: true, reason: "Crypto market is 24/7." };
    }
    if (normalized === "alpaca" || normalized === "alpaca-paper") {
        if (isCryptoLikeSymbol(symbol)) {
            return { isOpen: true, reason: "Alpaca crypto market is 24/7." };
        }
        const clock = getUsEasternClockParts(now);
        if (clock.weekday === "Sat" || clock.weekday === "Sun") {
            return { isOpen: false, reason: "US equities market is closed on weekends." };
        }
        const minutes = clock.hour * 60 + clock.minute;
        const open = 9 * 60 + 30;
        const close = 16 * 60;
        if (minutes < open || minutes >= close) {
            return { isOpen: false, reason: "US equities market hours are 09:30-16:00 ET." };
        }
        return { isOpen: true, reason: "US equities regular session is open." };
    }
    return { isOpen: false, reason: `Exchange ${exchangeId} is not supported.` };
}
