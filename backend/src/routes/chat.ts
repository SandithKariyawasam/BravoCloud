import express from 'express';
import { db } from '../lib/firebase';

const router = express.Router();

// GET /api/chat?roomId=USER_ID
// Fetch messages for a specific room
router.get('/', async (req: any, res: any) => {
  try {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

    const messagesSnapshot = await db.collection('live_chats')
      .doc(roomId as string)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(messages);
  } catch (err: any) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat
// Send a new message
router.post('/', async (req: any, res: any) => {
  try {
    const { roomId, senderId, senderName, text, isAdmin } = req.body;
    if (!roomId || !text) return res.status(400).json({ error: 'Missing roomId or text' });

    const message = {
      roomId,
      senderId: senderId || 'admin',
      senderName: senderName || (isAdmin ? 'Support Agent' : 'User'),
      text,
      isAdmin: !!isAdmin,
      timestamp: new Date().toISOString()
    };

    // Save message
    await db.collection('live_chats').doc(roomId).collection('messages').add(message);

    // Update room metadata for admin dashboard
    await db.collection('live_chats').doc(roomId).set({
      lastMessage: text,
      lastActive: message.timestamp,
      userId: roomId,
      ...( !isAdmin && senderName ? { userName: senderName } : {} )
    }, { merge: true });

    res.status(201).json(message);
  } catch (err: any) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/chat/admin/rooms
// Fetch all active chat rooms for the admin dashboard
router.get('/admin/rooms', async (req: any, res: any) => {
  try {
    const roomsSnapshot = await db.collection('live_chats')
      .orderBy('lastActive', 'desc')
      .limit(50)
      .get();

    const rooms = roomsSnapshot.docs.map(doc => ({
      roomId: doc.id,
      ...doc.data()
    }));

    res.json(rooms);
  } catch (err: any) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router;
