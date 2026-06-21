import express from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET all tickets for a user
router.get('/tickets', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const ticketsSnapshot = await db.collection('support_tickets')
      .where('userId', '==', userId)
      .get();
      
    let tickets = ticketsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    // Sort by createdAt descending
    tickets.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST a new support ticket
router.post('/tickets', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { subject, description, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    const ticketId = uuidv4();
    const newTicket = {
      userId,
      subject,
      description,
      priority: priority || 'Low',
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('support_tickets').doc(ticketId).set(newTicket);

    res.json({ success: true, ticket: { id: ticketId, ...newTicket } });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

export default router;
