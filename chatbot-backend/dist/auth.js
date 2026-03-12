"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUserAuth = requireUserAuth;
const firebase_1 = require("./firebase");
async function requireUserAuth(req, res, next) {
    try {
        const authHeader = String(req.headers.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!token) {
            res.status(401).json({ error: 'Missing bearer token' });
            return;
        }
        const decoded = await firebase_1.auth.verifyIdToken(token);
        req.userId = decoded.uid;
        next();
    }
    catch (error) {
        res.status(401).json({ error: error?.message || 'Unauthorized' });
    }
}
