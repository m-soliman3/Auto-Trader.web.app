/**
 * Transactional email helper using the EmailJS server-side API.
 *
 * EmailJS docs: https://www.emailjs.com/docs/rest-api/send/
 *
 * Required env vars (set via Cloud Run secrets / .env):
 *   EMAILJS_SERVICE_ID       – EmailJS service ID (e.g. "service_xxxxxxx")
 *   EMAILJS_PUBLIC_KEY       – EmailJS account public key
 *   EMAILJS_PRIVATE_KEY      – EmailJS account private key (required for server-side calls)
 *   EMAILJS_TOPUP_TEMPLATE_ID – EmailJS template ID for funding confirmation emails
 *
 * The funding confirmation template should contain variables:
 *   {{user_name}}        – recipient display name
 *   {{user_email}}       – recipient email (used as "To" address in the template)
 *   {{balance_usd}}      – amount topped up (e.g. "1,000")
 *   {{account_number}}   – Alpaca paper account number
 *   {{settlement_note}}  – human-readable settlement window note
 */

import fetch from "node-fetch";
import { config } from "../infra/config";

const EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send";
const RESEND_API_URL = "https://api.resend.com/emails";
const SIGNAL_ALERT_SENDER = "AutoTrader Signals <assistant@invest-begin.com>";
const SIGNAL_ALERT_RECIPIENT = "founder@invest-begin.com";

// Illustrative risk-management levels only — this app never places real TP/SL
// orders, so the email frames these as a friendly rule of thumb, not advice.
const SIGNAL_ALERT_STOP_LOSS_PCT = 0.02;
const SIGNAL_ALERT_TAKE_PROFIT_PCT = 0.05;

/**
 * Sends a demo account funding confirmation email to the user.
 * Non-fatal: logs a warning and returns if EmailJS is not configured or if the send fails.
 */
export async function sendTopUpConfirmationEmail(params: {
  userEmail: string;
  userName: string;
  balanceUsd: number;
  accountNumber: string;
}): Promise<void> {
  const { emailjsServiceId, emailjsPublicKey, emailjsPrivateKey, emailjsTopupTemplateId } = config;

  if (!emailjsServiceId || !emailjsPublicKey || !emailjsPrivateKey || !emailjsTopupTemplateId) {
    console.warn(
      "EmailJS not fully configured — skipping top-up confirmation email. " +
        "Set EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, and EMAILJS_TOPUP_TEMPLATE_ID.",
    );
    return;
  }

  const formattedBalance = params.balanceUsd.toLocaleString("en-US");

  const payload = {
    service_id: emailjsServiceId,
    template_id: emailjsTopupTemplateId,
    user_id: emailjsPublicKey,
    accessToken: emailjsPrivateKey,
    template_params: {
      user_name: params.userName || "Trader",
      user_email: params.userEmail,
      to_email: params.userEmail,
      balance_usd: formattedBalance,
      account_number: params.accountNumber,
      settlement_note:
        "Your funds are being processed via ACH transfer and will be available in your demo account within approximately 15 minutes.",
    },
  };

  try {
    const res = await fetch(EMAILJS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`EmailJS top-up confirmation failed (${res.status}): ${text}`);
    } else {
      console.log(`Top-up confirmation email sent to ${params.userEmail}`);
    }
  } catch (err) {
    console.warn(`Failed to send top-up confirmation email to ${params.userEmail}: ${err}`);
  }
}

/**
 * Sends a founder-facing "someone's bot just fired a signal" alert, written
 * as a casual Reddit-style post, whenever the auto-trader-execution demo
 * account's strategies buy or sell. Non-fatal: never throws, so a missing
 * RESEND_API_KEY or a delivery failure can't block real order execution.
 */
export async function sendStrategySignalEmail(params: {
  strategyName: string;
  templateId?: string;
  symbol: string;
  side: "buy" | "sell";
  timeframe: string;
  executionPrice: number | null;
  investment: number;
  exchangeId: string;
}): Promise<void> {
  const apiKey = config.resendApiKey;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — skipping strategy signal alert email.");
    return;
  }

  const sideLabel = params.side === "sell" ? "SELL" : "BUY";
  const sideEmoji = params.side === "sell" ? "🔴" : "🟢";
  const price = params.executionPrice;

  let priceLine = "market price (fill still settling)";
  let stopLossLine = "n/a — fill price wasn't available yet";
  let takeProfitLine = "n/a — fill price wasn't available yet";

  if (price && price > 0) {
    priceLine = `$${price.toFixed(2)}`;
    const stopLoss = params.side === "sell"
      ? price * (1 + SIGNAL_ALERT_STOP_LOSS_PCT)
      : price * (1 - SIGNAL_ALERT_STOP_LOSS_PCT);
    const takeProfit = params.side === "sell"
      ? price * (1 - SIGNAL_ALERT_TAKE_PROFIT_PCT)
      : price * (1 + SIGNAL_ALERT_TAKE_PROFIT_PCT);
    const rr = (SIGNAL_ALERT_TAKE_PROFIT_PCT / SIGNAL_ALERT_STOP_LOSS_PCT).toFixed(1);
    stopLossLine = `~$${stopLoss.toFixed(2)} (about ${(SIGNAL_ALERT_STOP_LOSS_PCT * 100).toFixed(0)}% ${params.side === "sell" ? "above" : "below"} entry)`;
    takeProfitLine = `~$${takeProfit.toFixed(2)} (about ${(SIGNAL_ALERT_TAKE_PROFIT_PCT * 100).toFixed(0)}% ${params.side === "sell" ? "below" : "above"} entry — roughly a ${rr}:1 reward-to-risk)`;
  }

  const subject = `${sideEmoji} [${params.symbol}] ${sideLabel} signal fired — ${params.strategyName}`;

  const text = `r/AutoTraderSignals • Posted by u/AutoTraderBot 🤖

**[${params.symbol}] Strategy "${params.strategyName}" just fired a ${sideLabel} signal — here's the play ${params.side === "sell" ? "📉" : "📈"}**

Yo 👋

The auto-trader-execution account's bot running **${params.strategyName}**${params.templateId ? ` (${params.templateId} template)` : ""} was watching **${params.symbol}** on the **${params.timeframe}** chart and just pulled the trigger:

- 🎯 Symbol: ${params.symbol}
- 📊 Strategy: ${params.strategyName}
- ${sideEmoji} Side: ${sideLabel}
- ⏱️ Timeframe: ${params.timeframe}
- 💵 Fill price: ${priceLine}
- 💰 Position size: $${Number(params.investment || 0).toFixed(2)}
- 🏦 Exchange: ${params.exchangeId}

**Where folks might set TP/SL** (just a friendly rule of thumb, not financial advice — always DYOR 🙏):
- 🛑 Stop Loss: ${stopLossLine}
- 🎯 Take Profit: ${takeProfitLine}

As always — past performance ≠ future results, size responsibly, and let the bot do its thing. 🚀

— Your friendly neighborhood Auto-Trader bot`;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SIGNAL_ALERT_SENDER,
        to: [SIGNAL_ALERT_RECIPIENT],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Resend strategy signal alert failed (${res.status}): ${errText}`);
    } else {
      console.log(`Strategy signal alert sent to ${SIGNAL_ALERT_RECIPIENT} for ${params.symbol} ${sideLabel}`);
    }
  } catch (err) {
    console.warn(`Failed to send strategy signal alert email: ${err}`);
  }
}
