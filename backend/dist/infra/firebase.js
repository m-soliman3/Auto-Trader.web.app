"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.auth = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp();
}
exports.auth = firebase_admin_1.default.auth();
exports.db = firebase_admin_1.default.firestore();
exports.default = firebase_admin_1.default;
