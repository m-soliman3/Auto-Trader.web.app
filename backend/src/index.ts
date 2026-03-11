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

setupWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`auto-trader-backend listening on port ${config.port}`);
});
