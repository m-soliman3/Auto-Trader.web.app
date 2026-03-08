"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUserAuth = requireUserAuth;
exports.requireRunnerKey = requireRunnerKey;
const firebase_1 = require("../infra/firebase");
const config_1 = require("../infra/config");
async function requireUserAuth(req, res, next) {
    try {
        const authHeader = String(req.headers.authorization || "");
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) {
            res.status(401).json({ error: "Missing bearer token" });
            return;
        }
        const decoded = await firebase_1.auth.verifyIdToken(token);
        req.userId = decoded.uid;
        next();
    }
    catch (error) {
        res.status(401).json({ error: error?.message || "Unauthorized" });
    }
}
function requireRunnerKey(req, res, next) {
    const provided = String(req.headers["x-runner-key"] || "");
    if (!config_1.config.runnerApiKey || provided !== config_1.config.runnerApiKey) {
        res.status(401).json({ error: "Invalid runner key" });
        return;
    }
    next();
}
