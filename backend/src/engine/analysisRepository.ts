import { db } from "../infra/firebase";
import { AnalysisSnapshot } from "./analysis";

/**
 * Snapshots live in a top-level `marketAnalysis` collection rather than under
 * `users/{uid}/`. The data is not user-specific, and keeping it outside the
 * user subtree means a reader (such as the MCP server) never needs access to
 * anything private — `users/{uid}/exchanges` holds broker API keys.
 *
 * No Firestore rule matches this collection, so client SDKs are denied by
 * default and only Admin SDK callers can read it.
 */
const COLLECTION = "marketAnalysis";

/** Firestore document ids cannot contain "/", which crypto pairs use. */
export function analysisDocId(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase().replace(/\//g, "-")}_${timeframe}`;
}

export async function saveAnalysisSnapshot(snapshot: AnalysisSnapshot): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(analysisDocId(snapshot.symbol, snapshot.timeframe))
    .set(snapshot);
}

export async function getAnalysisSnapshot(
  symbol: string,
  timeframe: string,
): Promise<AnalysisSnapshot | null> {
  const snap = await db.collection(COLLECTION).doc(analysisDocId(symbol, timeframe)).get();
  return snap.exists ? (snap.data() as AnalysisSnapshot) : null;
}

export async function listAnalysisSnapshots(limit = 100): Promise<AnalysisSnapshot[]> {
  const snap = await db
    .collection(COLLECTION)
    .limit(Math.max(1, Math.min(limit, 500)))
    .get();
  return snap.docs.map((doc) => doc.data() as AnalysisSnapshot);
}

/** Symbols that at least one active strategy trades, so the watchlist tracks real use. */
export async function symbolsFromActiveStrategies(): Promise<Array<{ symbol: string; timeframe: string }>> {
  const usersSnap = await db.collection("users").get();
  const seen = new Map<string, { symbol: string; timeframe: string }>();

  for (const userDoc of usersSnap.docs) {
    const strategiesSnap = await db
      .collection(`users/${userDoc.id}/strategies`)
      .where("status", "==", "active")
      .get();

    for (const doc of strategiesSnap.docs) {
      const data = doc.data() as { symbol?: string; timeframe?: string };
      const symbol = String(data.symbol || "").toUpperCase().trim();
      const timeframe = String(data.timeframe || "").trim();
      if (!symbol || !timeframe) continue;
      seen.set(`${symbol}_${timeframe}`, { symbol, timeframe });
    }
  }

  return [...seen.values()];
}
