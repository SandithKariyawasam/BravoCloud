"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_1 = require("../lib/firebase");
const router = express_1.default.Router();
const FORBIDDEN_WORDS = [
    'anal', 'anus', 'arse', 'arsehole', 'ass', 'assbag', 'assclown', 'asshat', 'asshole', 'asswipe',
    'ballbag', 'balls', 'ballsack', 'bastard', 'bellend', 'bestiality', 'bimbo', 'bitch', 'blowjob', 'bollocks',
    'boob', 'boobs', 'bullshit', 'buttplug', 'chode', 'clit', 'clitoris', 'cock', 'cockblock', 'cockface',
    'cockhead', 'cockmunch', 'cocksucker', 'crap', 'cum', 'cumguzzler', 'cumshot', 'cumstain', 'cunt', 'dick',
    'dildo', 'dipshit', 'dogshit', 'douche', 'douchebag', 'dumbass', 'dyke', 'ejaculate', 'fag', 'faggot',
    'fatass', 'filth', 'foreskin', 'fuck', 'fuckbag', 'fuckboy', 'fucker', 'fuckface', 'fuckhead', 'fucking',
    'fucktard', 'fuckwad', 'fuckwit', 'goddamn', 'handjob', 'hardon', 'hentai', 'homo', 'hooker', 'horseshit',
    'incel', 'jackass', 'jackoff', 'jerkoff', 'jizz', 'knob', 'knobhead', 'labia', 'lameass', 'lesbo',
    'masturbate', 'milf', 'minger', 'motherfucker', 'motherfucking', 'munter', 'necrophilia', 'nigga', 'nigger', 'nutsack',
    'paedo', 'pecker', 'pedo', 'pedophile', 'piss', 'pissed', 'pissflaps', 'pisshead', 'porn', 'porno',
    'prick', 'pube', 'pubes', 'pussy', 'queer', 'retard', 'rimjob', 'schlong', 'scrotum', 'shag',
    'shemale', 'shit', 'shite', 'shithead', 'shitting', 'shitstain', 'skank', 'slapper', 'slut', 'smegma',
    'snatch', 'testicle', 'tits', 'titties', 'tosser', 'tranny', 'twat', 'vagina', 'wank', 'wanker',
    'whore'
];
function filterText(text) {
    let filtered = text;
    FORBIDDEN_WORDS.forEach(word => {
        // Replace whole words case-insensitively with asterisks
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
}
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
        const sanitizedText = filterText(text);
        const message = {
            roomId,
            senderId: senderId || 'admin',
            senderName: senderName || (isAdmin ? 'Support Agent' : 'User'),
            text: sanitizedText,
            isAdmin: !!isAdmin,
            timestamp: new Date().toISOString()
        };
        // Save message
        await firebase_1.db.collection('live_chats').doc(roomId).collection('messages').add(message);
        // Update room metadata for admin dashboard
        await firebase_1.db.collection('live_chats').doc(roomId).set({
            lastMessage: sanitizedText,
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
// DELETE /api/chat
// Terminate a chat session
router.delete('/', async (req, res) => {
    try {
        const { roomId } = req.query;
        if (!roomId)
            return res.status(400).json({ error: 'Missing roomId' });
        // Delete all messages in the room
        const messagesSnapshot = await firebase_1.db.collection('live_chats').doc(roomId).collection('messages').get();
        const batch = firebase_1.db.batch();
        messagesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        // Delete the room document itself
        const roomRef = firebase_1.db.collection('live_chats').doc(roomId);
        batch.delete(roomRef);
        await batch.commit();
        res.status(200).json({ message: 'Chat terminated successfully' });
    }
    catch (err) {
        console.error('Error terminating chat:', err);
        res.status(500).json({ error: 'Failed to terminate chat' });
    }
});
exports.default = router;
