"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// GET all tickets for a user
router.get('/tickets', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const ticketsSnapshot = await firebase_1.db.collection('support_tickets')
            .where('userId', '==', userId)
            .get();
        let tickets = ticketsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // Sort by createdAt descending
        tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ tickets });
    }
    catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});
// POST a new support ticket
router.post('/tickets', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { subject, description, priority } = req.body;
        if (!subject || !description) {
            return res.status(400).json({ error: 'Subject and description are required' });
        }
        const ticketId = (0, uuid_1.v4)();
        const newTicket = {
            userId,
            subject,
            description,
            priority: priority || 'Low',
            status: 'Open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await firebase_1.db.collection('support_tickets').doc(ticketId).set(newTicket);
        res.json({ success: true, ticket: { id: ticketId, ...newTicket } });
    }
    catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});
exports.default = router;
