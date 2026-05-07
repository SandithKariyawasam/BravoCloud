"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_1 = require("./firebase");
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'bravocloud_jwt_secret');
        // Fetch fresh user data from Firestore
        const userDoc = await firebase_1.db.collection('users').doc(decoded.id).get();
        if (!userDoc.exists) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = { id: userDoc.id, ...userDoc.data() };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.verifyToken = verifyToken;
