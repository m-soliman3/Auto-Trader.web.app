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
