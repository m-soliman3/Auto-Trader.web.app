"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listActiveStrategies = listActiveStrategies;
exports.getStrategy = getStrategy;
exports.getBot = getBot;
exports.getExchangeByLabel = getExchangeByLabel;
exports.writeExecution = writeExecution;
exports.updateStrategy = updateStrategy;
exports.updateBot = updateBot;
exports.saveRunnerSummary = saveRunnerSummary;
exports.getRecentRunnerSummaries = getRecentRunnerSummaries;
const firebase_1 = require("../infra/firebase");
async function listActiveStrategies() {
    const usersSnap = await firebase_1.db.collection("users").get();
    const result = [];
    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const strategiesSnap = await firebase_1.db.collection(`users/${uid}/strategies`).where("status", "==", "active").get();
        for (const strategyDoc of strategiesSnap.docs) {
            result.push({
                uid,
                strategyId: strategyDoc.id,
                strategy: strategyDoc.data(),
            });
        }
    }
    return result;
}
async function getStrategy(uid, strategyId) {
    const snap = await firebase_1.db.doc(`users/${uid}/strategies/${strategyId}`).get();
    return snap.exists ? snap.data() : null;
}
async function getBot(uid, botId) {
    const snap = await firebase_1.db.doc(`users/${uid}/bots/${botId}`).get();
    return snap.exists ? snap.data() : null;
}
async function getExchangeByLabel(uid, exchangeLabel) {
    const snap = await firebase_1.db.doc(`users/${uid}/exchanges/${exchangeLabel}`).get();
    return snap.exists ? snap.data() : null;
}
async function writeExecution(uid, payload) {
    await firebase_1.db.collection(`users/${uid}/executions`).add(payload);
}
async function updateStrategy(uid, strategyId, updates) {
    await firebase_1.db.doc(`users/${uid}/strategies/${strategyId}`).set(updates, { merge: true });
}
async function updateBot(uid, botId, updates) {
    await firebase_1.db.doc(`users/${uid}/bots/${botId}`).set(updates, { merge: true });
}
async function saveRunnerSummary(summary) {
    await firebase_1.db.collection("backendRunnerSummaries").add(summary);
}
async function getRecentRunnerSummaries(limit = 20) {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const snap = await firebase_1.db
        .collection("backendRunnerSummaries")
        .orderBy("ranAt", "desc")
        .limit(boundedLimit)
        .get();
    return snap.docs.map((doc) => doc.data());
}
