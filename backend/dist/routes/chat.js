"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_1 = require("../lib/firebase");
const router = express_1.default.Router();
// GET /api/chat?roomId=USER_ID
// Fetch messages for a specific room
router.get('/', async (req, res) => {
    try {
        const { roomId } = req.query;
        if (!roomId)
            return res.status(400).json({ error: 'Missing roomId' });
        const messagesSnapshot = await firebase_1.db.collection('live_chats')
            .doc(roomId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();
        const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(messages);
    }
    catch (err) {
        console.error('Error fetching chat messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
// POST /api/chat
// Send a new message
router.post('/', async (req, res) => {
    try {
        const { roomId, senderId, senderName, text, isAdmin } = req.body;
        if (!roomId || !text)
            return res.status(400).json({ error: 'Missing roomId or text' });
        const message = {
            roomId,
            senderId: senderId || 'admin',
            senderName: senderName || (isAdmin ? 'Support Agent' : 'User'),
            text,
            isAdmin: !!isAdmin,
            timestamp: new Date().toISOString()
        };
        // Save message
        await firebase_1.db.collection('live_chats').doc(roomId).collection('messages').add(message);
        // Update room metadata for admin dashboard
        await firebase_1.db.collection('live_chats').doc(roomId).set({
            lastMessage: text,
            lastActive: message.timestamp,
            userId: roomId,
            ...(!isAdmin && senderName ? { userName: senderName } : {})
        }, { merge: true });
        res.status(201).json(message);
    }
    catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
// GET /api/chat/admin/rooms
// Fetch all active chat rooms for the admin dashboard
router.get('/admin/rooms', async (req, res) => {
    try {
        const roomsSnapshot = await firebase_1.db.collection('live_chats')
            .orderBy('lastActive', 'desc')
            .limit(50)
            .get();
        const rooms = roomsSnapshot.docs.map(doc => ({
            roomId: doc.id,
            ...doc.data()
        }));
        res.json(rooms);
    }
    catch (err) {
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});
exports.default = router;
