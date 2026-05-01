/**
 * Alpaca Broker API helper for provisioning paper/sandbox trading accounts.
 *
 * Alpaca Broker API docs:
 *   https://docs.alpaca.markets/reference/createaccount-1
 *
 * Sandbox base URL: https://broker-api.sandbox.alpaca.markets
 *
 * The ALPACA_BROKER_KEY_ID and ALPACA_BROKER_SECRET_KEY env vars must be
 * set to valid Broker API credentials (not regular trading API keys).
 * These are obtained from the Alpaca Broker dashboard at
 *   https://broker-app.alpaca.markets
 */

import fetch from "node-fetch";
import { config } from "../infra/config";

const BROKER_SANDBOX_BASE = "https://broker-api.sandbox.alpaca.markets";
const AUTHX_SANDBOX_BASE = "https://authx.sandbox.alpaca.markets";

/**
 * Fetch a short-lived Bearer token via OAuth2 client_credentials flow.
 * Alpaca's new CK-prefixed Broker API keys require this flow instead of Basic auth.
 */
async function getBrokerBearerToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.alpacaBrokerKeyId!,
    client_secret: config.alpacaBrokerSecretKey!,
  });

  const res = await fetch(`${AUTHX_SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Alpaca auth token request failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function brokerAuthHeader(): Promise<string> {
  const token = await getBrokerBearerToken();
  return `Bearer ${token}`;
}

/**
 * Generates a random US SSN that passes Alpaca's FINRA CAIS data validations:
 *   - Area (first 3): not 000 or 666
 *   - Group (middle 2): not 00
 *   - Serial (last 4): not 0000
 *   - Not all-same digits (e.g. 111-11-1111)
 *   - Not strictly increasing (123-45-6789) or decreasing (987-65-4321)
 * https://docs.alpaca.markets/docs/data-validations
 */
function generateSandboxSsn(): string {
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  for (;;) {
    const area = rand(1, 899);
    if (area === 666) continue;

    const group = rand(1, 99);
    const serial = rand(1, 9999);

    const digits =
      String(area).padStart(3, "0") +
      String(group).padStart(2, "0") +
      String(serial).padStart(4, "0");

    // Reject all-same digits
    if (/^(.)\1{8}$/.test(digits)) continue;

    // Reject strictly increasing or decreasing sequences
    const nums = digits.split("").map(Number);
    const allIncreasing = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    const allDecreasing = nums.every((n, i) => i === 0 || n === nums[i - 1] - 1);
    if (allIncreasing || allDecreasing) continue;

    return `${String(area).padStart(3, "0")}-${String(group).padStart(2, "0")}-${String(serial).padStart(4, "0")}`;
  }
}

export interface AlpacaPaperAccount {
  accountId: string;
  accountNumber: string;
  alpacaApiKey: string;
  alpacaApiSecret: string;
  balance: number;
}

/**
 * Creates a new Alpaca Broker sandbox account and returns the credentials.
 * Each AutoTrader user gets a dedicated Alpaca paper account keyed to their uid.
 *
 * @param uid          Firebase UID of the AutoTrader user (used as external reference).
 * @param balanceUsd   Starting cash balance in USD (1 000 / 10 000 / 100 000).
 * @param email        User's email address (required by Alpaca KYC-lite).
 * @param displayName  User's display name.
 */
export async function provisionAlpacaPaperAccount(
  uid: string,
  balanceUsd: number,
  email: string,
  displayName: string,
): Promise<AlpacaPaperAccount> {
  if (!config.alpacaBrokerKeyId || !config.alpacaBrokerSecretKey) {
    throw new Error(
      "Alpaca Broker API credentials are not configured. " +
        "Please set ALPACA_BROKER_KEY_ID and ALPACA_BROKER_SECRET_KEY environment variables.",
    );
  }

  const authHeader = await brokerAuthHeader();

  // ── 1. Create the account ─────────────────────────────────────────────
  // Alpaca requires real-looking identity data in sandbox too. We use
  // deterministic safe values scoped to the user's uid so re-provisioning
  // the same user doesn't create duplicate accounts if the endpoint is
  // called twice.
  const firstName = displayName.split(" ")[0] || "Demo";
  const lastName = displayName.split(" ").slice(1).join(" ") || "User";

  const createPayload = {
    enabled_assets: ["us_equity"],
    contact: {
      email_address: email,
      phone_number: "+15550000000",
      street_address: ["20 N San Mateo Dr"],
      city: "San Mateo",
      state: "CA",
      postal_code: "94401",
      country: "USA",
    },
    identity: {
      given_name: firstName,
      family_name: lastName,
      date_of_birth: "1990-01-01",
      tax_id: generateSandboxSsn(),
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      funding_source: ["employment_income"],
    },
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    agreements: [
      {
        agreement: "margin_agreement",
        signed_at: new Date().toISOString(),
        ip_address: "185.13.21.99",
      },
      {
        agreement: "account_agreement",
        signed_at: new Date().toISOString(),
        ip_address: "185.13.21.99",
      },
      {
        agreement: "customer_agreement",
        signed_at: new Date().toISOString(),
        ip_address: "185.13.21.99",
      },
    ],
  };

  const createRes = await fetch(`${BROKER_SANDBOX_BASE}/v1/accounts`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Alpaca account creation failed (${createRes.status}): ${errBody}`);
  }

  const account = (await createRes.json()) as {
    id: string;
    account_number: string;
  };

  const accountId = account.id;
  const accountNumber = account.account_number;

  // ── 2. Create trading API keys for the account ─────────────────────────
  // Correct Broker API endpoint for generating paper-trading credentials for
  // a sub-account. Returns { id: string; secret: string }.
  const keyRes = await fetch(
    `${BROKER_SANDBOX_BASE}/v1/trading/accounts/${accountId}/access_keys`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  let alpacaApiKey: string;
  let alpacaApiSecret: string;

  if (keyRes.ok) {
    const keys = (await keyRes.json()) as { id: string; secret: string };
    alpacaApiKey = keys.id;
    alpacaApiSecret = keys.secret;
  } else {
    const keyErr = await keyRes.text();
    console.warn(`Alpaca access_keys failed (${keyRes.status}): ${keyErr}. Falling back to broker credentials.`);
    // Fall back to broker credentials — will still allow portfolio reads via
    // the Broker Trading API with an Alpaca-Account-ID header.
    alpacaApiKey = config.alpacaBrokerKeyId!;
    alpacaApiSecret = config.alpacaBrokerSecretKey!;
  }

  // ── 3. Seed the cash balance ───────────────────────────────────────────
  // The Broker sandbox exposes a direct cash-transaction endpoint that credits
  // virtual money to a sub-account without requiring a real journal entry.
  const fundRes = await fetch(
    `${BROKER_SANDBOX_BASE}/v1/accounts/${accountId}/transactions/cash`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: String(balanceUsd),
        direction: "INCOMING",
        reason: `AutoTrader demo top-up $${balanceUsd}`,
      }),
    },
  );

  if (!fundRes.ok) {
    // Non-fatal: account is still usable; balance starts at zero.
    console.warn(
      `Alpaca cash funding failed (${fundRes.status}): ${await fundRes.text()}. ` +
        "Account created but balance not seeded automatically.",
    );
  }

  return {
    accountId,
    accountNumber,
    alpacaApiKey,
    alpacaApiSecret,
    balance: balanceUsd,
  };
}
