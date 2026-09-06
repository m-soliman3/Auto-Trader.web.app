import express from "express";
import cors from "cors";
import http from "http";
import { config } from "./infra/config";
import { requireAnalysisReadKey, requireRunnerKey, requireUserAuth } from "./api/auth";
import { runActiveStrategiesOnce } from "./engine/runner";
import { executeStrategyOrder } from "./engine/execution";
import { resolveInstrumentChart } from "./engine/chart";
import { getRecentRunnerSummaries, getRecentUserRunnerSummaries } from "./engine/repository";
import { runAnalysisOnce } from "./engine/analysisRunner";
import { getAnalysisSnapshot, listAnalysisSnapshots } from "./engine/analysisRepository";
import { setupWebSocketServer } from "./infra/websocket";
import { provisionAlpacaPaperAccount, seedAlpacaPaperBalance, fetchAlpacaBrokerPortfolio, deleteAlpacaBrokerAccount } from "./api/alpaca-paper";
import { sendTopUpConfirmationEmail } from "./api/email";
import { db, auth as firebaseAuth } from "./infra/firebase";

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "auto-trader-backend", at: new Date().toISOString() });
});

app.post("/v1/run-active-strategies", requireRunnerKey, async (_req, res) => {
  try {
    const summary = await runActiveStrategiesOnce();
    res.status(200).json(summary);
  } catch (error: any) {
    console.error("run-active-strategies error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

app.get("/v1/admin/runner-summaries", requireRunnerKey, async (req, res) => {
  try {
    const limitParam = Number.parseInt(String(req.query?.limit || "20"), 10);
    const summaries = await getRecentRunnerSummaries(Number.isFinite(limitParam) ? limitParam : 20);
    res.status(200).json({
      count: summaries.length,
      items: summaries,
    });
  } catch (error: any) {
    console.error("runner-summaries error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

app.get("/v1/runner-summaries", requireUserAuth, async (req, res) => {
  try {
    const uid = String(req.userId);
    const limitParam = Number.parseInt(String(req.query?.limit || "10"), 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const fromParam = req.query?.from ? String(req.query.from) : undefined;
    const toParam = req.query?.to ? String(req.query.to) : undefined;
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const summaries = await getRecentUserRunnerSummaries(uid, limit, from, to);
    res.status(200).json({
      count: summaries.length,
      items: summaries,
    });
  } catch (error: any) {
    console.error("runner-summaries (user) error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

app.post("/v1/execute-strategy", requireUserAuth, async (req, res) => {
  try {
    const strategyId = String(req.body?.strategyId || "");
    if (!strategyId) {
      res.status(400).json({ error: "strategyId is required" });
      return;
    }

    const result = await executeStrategyOrder(String(req.userId), strategyId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(412).json({ error: error?.message || "Execution failed" });
  }
});

app.post("/v1/instrument-chart", requireUserAuth, async (req, res) => {
  try {
    const strategyId = String(req.body?.strategyId || "");
    if (!strategyId) {
      res.status(400).json({ error: "strategyId is required" });
      return;
    }

    const chart = await resolveInstrumentChart(String(req.userId), strategyId);
    res.status(200).json(chart);
  } catch (error: any) {
    res.status(412).json({ error: error?.message || "Unable to load chart" });
  }
});

/**
 * POST /v1/paper-topup
 *
 * Provisions an Alpaca Broker sandbox account for the authenticated user,
 * seeds it with the requested paper balance, and persists all account
 * details + generated API credentials to Firestore.
 *
 * Body: { balanceUsd: number }  (must be 1_000 | 10_000 | 100_000)
 */
app.post("/v1/paper-topup", requireUserAuth, async (req, res) => {
  try {
    const ALLOWED_BALANCES = [1_000, 10_000, 100_000];
    const balanceUsd = Number(req.body?.balanceUsd);
    if (!ALLOWED_BALANCES.includes(balanceUsd)) {
      res.status(400).json({ error: `balanceUsd must be one of ${ALLOWED_BALANCES.join(", ")}` });
      return;
    }

    const uid = String(req.userId);

    // Prevent duplicate provisioning: if user already has an alpaca paper
    // account stored, return the existing details.
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() as Record<string, any> | undefined;

    if (userData?.alpacaBrokerAccountId && userData?.alpacaPaperAccountNumber) {
      // Account exists — seed the new balance on top of what's already there.
      await seedAlpacaPaperBalance(userData.alpacaBrokerAccountId, balanceUsd);

      const newBalance = (userData.alpacaPaperBalance ?? 0) + balanceUsd;
      await userRef.set({ alpacaPaperBalance: newBalance }, { merge: true });

      // Send funding confirmation email (non-fatal)
      const fbUserForEmail = await firebaseAuth.getUser(uid).catch(() => null);
      if (fbUserForEmail?.email) {
        void sendTopUpConfirmationEmail({
          userEmail: fbUserForEmail.email,
          userName: fbUserForEmail.displayName ?? "Trader",
          balanceUsd,
          accountNumber: userData.alpacaPaperAccountNumber,
        });
      }

      res.status(200).json({
        accountId: userData.alpacaBrokerAccountId,
        accountNumber: userData.alpacaPaperAccountNumber,
        balance: newBalance,
        alpacaApiKey: userData.alpacaPaperApiKey ?? "",
        alpacaApiSecret: userData.alpacaPaperApiSecret ?? "",
      });
      return;
    }

    // Fetch user identity for the Alpaca account creation payload.
    const fbUser = await firebaseAuth.getUser(uid);
    const email = fbUser.email ?? `${uid}@autotrader.demo`;
    const displayName = fbUser.displayName ?? "Demo User";

    const account = await provisionAlpacaPaperAccount(uid, balanceUsd, email, displayName);

    // Persist to Firestore under the user's document.
    await userRef.set(
      {
        paperOnboarded: true,
        alpacaBrokerAccountId: account.accountId,
        alpacaPaperAccountNumber: account.accountNumber,
        alpacaPaperBalance: account.balance,
        // Store the trading API credentials so the backend engine can
        // use them when executing orders on this paper account.
        alpacaPaperApiKey: account.alpacaApiKey,
        alpacaPaperApiSecret: account.alpacaApiSecret,
        alpacaPaperProvisionedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Send funding confirmation email (non-fatal)
    void sendTopUpConfirmationEmail({
      userEmail: email,
      userName: displayName,
      balanceUsd,
      accountNumber: account.accountNumber,
    });

    res.status(200).json({
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      balance: account.balance,
      alpacaApiKey: account.alpacaApiKey,
      alpacaApiSecret: account.alpacaApiSecret,
    });
  } catch (error: any) {
    console.error("paper-topup error", error);
    res.status(500).json({ error: error?.message || "Failed to provision paper trading account." });
  }
});

/**
 * DELETE /v1/paper-account
 *
 * Closes the authenticated user's Alpaca Broker sandbox sub-account and
 * removes all related fields from the Firestore user document.
 * Called when the user disconnects their paper trading exchange.
 */
app.delete("/v1/paper-account", requireUserAuth, async (req, res) => {
  try {
    const uid = String(req.userId);

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() as Record<string, any> | undefined;
    const accountId = userData?.alpacaBrokerAccountId;

    if (accountId) {
      await deleteAlpacaBrokerAccount(accountId);
    }

    // Remove paper-trading fields from the user document regardless
    await userRef.update({
      alpacaBrokerAccountId: null,
      alpacaPaperApiKey: null,
      alpacaPaperApiSecret: null,
      alpacaPaperBalance: null,
    });

    res.status(200).json({ deleted: true });
  } catch (error: any) {
    console.error("paper-account delete error", error);
    res.status(500).json({ error: error?.message || "Failed to delete paper account." });
  }
});

/**
 * GET /v1/paper-portfolio
 *
 * Returns the live portfolio (equity, positions) for the authenticated user's
 * Alpaca Broker sandbox sub-account.  Uses the broker's OAuth2 credentials so
 * this works regardless of whether Trading API keys were generated for the
 * sub-account.
 */
app.get("/v1/paper-portfolio", requireUserAuth, async (req, res) => {
  try {
    const uid = String(req.userId);

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as Record<string, any> | undefined;
    const accountId = userData?.alpacaBrokerAccountId;

    if (!accountId) {
      res.status(404).json({ error: "No paper trading account found. Please top up first." });
      return;
    }

    const portfolio = await fetchAlpacaBrokerPortfolio(accountId);
    res.status(200).json(portfolio);
  } catch (error: any) {
    console.error("paper-portfolio error", error);
    res.status(500).json({ error: error?.message || "Failed to fetch paper portfolio." });
  }
});

/**
 * GET /v1/paper-balance-status
 *
 * Lightweight endpoint that checks whether the Alpaca account's actual cash
 * balance has reached the expected balance stored in Firestore.
 * Used by the frontend to poll during ACH settlement after a top-up.
 *
 * Response: { confirmed: boolean, actualBalance: number, expectedBalance: number }
 */
app.get("/v1/paper-balance-status", requireUserAuth, async (req, res) => {
  try {
    const uid = String(req.userId);

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as Record<string, any> | undefined;
    const accountId = userData?.alpacaBrokerAccountId;
    const expectedBalance = Number(userData?.alpacaPaperBalance ?? 0);

    if (!accountId) {
      res.status(404).json({ error: "No paper trading account found." });
      return;
    }

    const portfolio = await fetchAlpacaBrokerPortfolio(accountId);
    const actualBalance = portfolio.portfolioValue;
    const confirmed = actualBalance >= expectedBalance * 0.99;

    res.status(200).json({ confirmed, actualBalance, expectedBalance });
  } catch (error: any) {
    console.error("paper-balance-status error", error);
    res.status(500).json({ error: error?.message || "Failed to check balance status." });
  }
});

// ── Market analysis (read-only surface for the MCP connector) ────────────────
//
// `POST /v1/run-analysis` is the Cloud Scheduler trigger. It writes snapshots
// to the top-level `marketAnalysis` collection and never places an order.
app.post("/v1/run-analysis", requireRunnerKey, async (req, res) => {
  try {
    const extra = Array.isArray(req.body?.targets) ? req.body.targets : [];
    const summary = await runAnalysisOnce(extra);
    res.status(200).json(summary);
  } catch (error: any) {
    console.error("run-analysis error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

app.get("/v1/analysis", requireAnalysisReadKey, async (req, res) => {
  try {
    const limitParam = Number.parseInt(String(req.query?.limit || "100"), 10);
    const items = await listAnalysisSnapshots(Number.isFinite(limitParam) ? limitParam : 100);
    res.status(200).json({ count: items.length, items });
  } catch (error: any) {
    console.error("analysis list error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

app.get("/v1/analysis/:symbol", requireAnalysisReadKey, async (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const timeframe = String(req.query?.timeframe || "1h");
    const snapshot = await getAnalysisSnapshot(symbol, timeframe);
    if (!snapshot) {
      res.status(404).json({
        error: `No analysis snapshot for ${symbol} on ${timeframe}.`,
        hint: "Add it to ANALYSIS_SYMBOLS/ANALYSIS_TIMEFRAMES, or wait for the next scheduled run.",
      });
      return;
    }
    res.status(200).json(snapshot);
  } catch (error: any) {
    console.error("analysis get error", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

setupWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`auto-trader-backend listening on port ${config.port}`);
});
