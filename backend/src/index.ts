import express from "express";
import cors from "cors";
import http from "http";
import { config } from "./infra/config";
import { requireRunnerKey, requireUserAuth } from "./api/auth";
import { runActiveStrategiesOnce } from "./engine/runner";
import { executeStrategyOrder } from "./engine/execution";
import { resolveInstrumentChart } from "./engine/chart";
import { getRecentRunnerSummaries } from "./engine/repository";
import { setupWebSocketServer } from "./infra/websocket";
import { provisionAlpacaPaperAccount, seedAlpacaPaperBalance } from "./api/alpaca-paper";
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
    const limitParam = Number.parseInt(String(req.query?.limit || "10"), 10);
    const summaries = await getRecentRunnerSummaries(Number.isFinite(limitParam) ? limitParam : 10);
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

setupWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`auto-trader-backend listening on port ${config.port}`);
});
