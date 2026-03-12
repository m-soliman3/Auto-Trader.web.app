"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const config_1 = require("./config");
function resolveCredential() {
    const raw = config_1.config.firebaseServiceAccountJson;
    if (!raw) {
        return firebase_admin_1.default.credential.applicationDefault();
    }
    const parsed = JSON.parse(raw);
    return firebase_admin_1.default.credential.cert(parsed);
}
const existing = firebase_admin_1.default.apps.find((app) => !!app && app.name === config_1.config.firebaseAppName);
const firebaseApp = existing ?? firebase_admin_1.default.initializeApp({
    credential: resolveCredential(),
    projectId: config_1.config.firebaseProjectId,
}, config_1.config.firebaseAppName);
exports.auth = firebase_admin_1.default.auth(firebaseApp);
