"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// GET /api/agents
// List all self-hosted agents for the current user
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const agentsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('agents').orderBy('createdAt', 'desc').get();
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ agents });
    }
    catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/agents
// Register a new self-hosted agent
router.post('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, os, architecture } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Agent name is required' });
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const newAgent = {
            name,
            os: os || 'Unknown',
            architecture: architecture || 'Unknown',
            status: 'Offline', // Default status until it connects
            token, // In a real app, you might only show this once or hash it
            createdAt: new Date().toISOString(),
            lastSeen: null,
            ipAddress: null,
        };
        const docRef = await firebase_1.db.collection('users').doc(userId).collection('agents').add(newAgent);
        res.json({ message: 'Agent generated successfully', agent: { id: docRef.id, ...newAgent } });
    }
    catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/agents/:id
// Remove an agent
router.delete('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('agents').doc(id).delete();
        res.json({ message: 'Agent deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
