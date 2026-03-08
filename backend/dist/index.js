"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./infra/config");
const auth_1 = require("./api/auth");
const runner_1 = require("./engine/runner");
const execution_1 = require("./engine/execution");
const chart_1 = require("./engine/chart");
const repository_1 = require("./engine/repository");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "auto-trader-backend", at: new Date().toISOString() });
});
app.post("/v1/run-active-strategies", auth_1.requireRunnerKey, async (_req, res) => {
    try {
        const summary = await (0, runner_1.runActiveStrategiesOnce)();
        res.status(200).json(summary);
    }
    catch (error) {
        console.error("run-active-strategies error", error);
        res.status(500).json({ error: error?.message || "Internal server error" });
    }
});
app.get("/v1/admin/runner-summaries", auth_1.requireRunnerKey, async (req, res) => {
    try {
        const limitParam = Number.parseInt(String(req.query?.limit || "20"), 10);
        const summaries = await (0, repository_1.getRecentRunnerSummaries)(Number.isFinite(limitParam) ? limitParam : 20);
        res.status(200).json({
            count: summaries.length,
            items: summaries,
        });
    }
    catch (error) {
        console.error("runner-summaries error", error);
        res.status(500).json({ error: error?.message || "Internal server error" });
    }
});
app.get("/v1/runner-summaries", auth_1.requireUserAuth, async (req, res) => {
    try {
        const limitParam = Number.parseInt(String(req.query?.limit || "10"), 10);
        const summaries = await (0, repository_1.getRecentRunnerSummaries)(Number.isFinite(limitParam) ? limitParam : 10);
        res.status(200).json({
            count: summaries.length,
            items: summaries,
        });
    }
    catch (error) {
        console.error("runner-summaries (user) error", error);
        res.status(500).json({ error: error?.message || "Internal server error" });
    }
});
app.post("/v1/execute-strategy", auth_1.requireUserAuth, async (req, res) => {
    try {
        const strategyId = String(req.body?.strategyId || "");
        if (!strategyId) {
            res.status(400).json({ error: "strategyId is required" });
            return;
        }
        const result = await (0, execution_1.executeStrategyOrder)(String(req.userId), strategyId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(412).json({ error: error?.message || "Execution failed" });
    }
});
app.post("/v1/instrument-chart", auth_1.requireUserAuth, async (req, res) => {
    try {
        const strategyId = String(req.body?.strategyId || "");
        if (!strategyId) {
            res.status(400).json({ error: "strategyId is required" });
            return;
        }
        const chart = await (0, chart_1.resolveInstrumentChart)(String(req.userId), strategyId);
        res.status(200).json(chart);
    }
    catch (error) {
        res.status(412).json({ error: error?.message || "Unable to load chart" });
    }
});
app.listen(config_1.config.port, () => {
    console.log(`auto-trader-backend listening on port ${config_1.config.port}`);
});
