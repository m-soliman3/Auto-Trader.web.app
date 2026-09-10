/**
 * Read-side helper for Alpaca "Connect Apps" OAuth tokens.
 *
 * The OAuth flow itself (authorize redirect + code-for-token exchange) lives
 * in the Firebase Functions project (functions/src/index.ts — alpacaOAuthStart
 * / alpacaOAuthCallback), which writes access tokens into the top-level
 * `alpaca_oauth_tokens` Firestore collection, doc id `${uid}_${env}`.
 *
 * That collection is deliberately outside `users/{uid}/`, so no Firestore
 * security rule matches it and the access token is never readable by a
 * client SDK — only Admin SDK callers (this backend, and the Functions
 * project) can read it. This module only reads; it never writes tokens.
 *
 * IMPORTANT: the collection name / doc id scheme here must stay in sync with
 * functions/src/index.ts's ALPACA_OAUTH_TOKENS_COLLECTION.
 */

import { db } from "../infra/firebase";

const ALPACA_OAUTH_TOKENS_COLLECTION = "alpaca_oauth_tokens";

/**
 * Returns the stored Alpaca OAuth access token for this user/env, or null if
 * the user hasn't connected Alpaca via OAuth for that environment.
 */
export async function getAlpacaOAuthAccessToken(
  uid: string,
  env: "live" | "paper",
): Promise<string | null> {
  const snap = await db.collection(ALPACA_OAUTH_TOKENS_COLLECTION).doc(`${uid}_${env}`).get();
  if (!snap.exists) return null;

  const accessToken = String(snap.data()?.accessToken || "").trim();
  return accessToken || null;
}
