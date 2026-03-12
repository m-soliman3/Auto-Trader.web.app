"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const auth_1 = require("./auth");
const assistant_1 = require("./assistant");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: config_1.config.allowedOrigin === '*' ? true : config_1.config.allowedOrigin }));
app.use(express_1.default.json({ limit: '1mb' }));
app.get('/health', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'auto-trader-chatbot-backend',
        at: new Date().toISOString(),
    });
});
app.post('/v1/public-chat', async (req, res) => {
    try {
        const body = req.body;
        const message = String(body?.message || '').trim();
        const history = Array.isArray(body?.history) ? body.history : [];
        if (!message) {
            res.status(400).json({ error: 'message is required' });
            return;
        }
        const sanitizedHistory = history
            .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant'))
            .map((turn) => ({
            role: turn.role,
            content: String(turn.content || '').slice(0, 2000),
        }))
            .filter((turn) => turn.content.length > 0);
        const response = await (0, assistant_1.generateAssistantReply)(message, sanitizedHistory, false);
        res.status(200).json(response);
    }
    catch (error) {
        console.error('public-chat endpoint failed', error);
        res.status(500).json({ error: error?.message || 'Internal server error' });
    }
});
app.post('/v1/chat', auth_1.requireUserAuth, async (req, res) => {
    try {
        const body = req.body;
        const message = String(body?.message || '').trim();
        const history = Array.isArray(body?.history) ? body.history : [];
        if (!message) {
            res.status(400).json({ error: 'message is required' });
            return;
        }
        const sanitizedHistory = history
            .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant'))
            .map((turn) => ({
            role: turn.role,
            content: String(turn.content || '').slice(0, 2000),
        }))
            .filter((turn) => turn.content.length > 0);
        const response = await (0, assistant_1.generateAssistantReply)(message, sanitizedHistory, true);
        res.status(200).json(response);
    }
    catch (error) {
        console.error('chat endpoint failed', error);
        res.status(500).json({ error: error?.message || 'Internal server error' });
    }
});
app.listen(config_1.config.port, () => {
    console.log(`auto-trader-chatbot-backend listening on port ${config_1.config.port}`);
});
