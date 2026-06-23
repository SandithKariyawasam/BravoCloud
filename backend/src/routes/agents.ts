import { Router } from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import crypto from 'crypto';

const router = Router();

// GET /api/agents
// List all self-hosted agents for the current user
router.get('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const agentsSnapshot = await db.collection('users').doc(userId).collection('agents').orderBy('createdAt', 'desc').get();
    const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ agents });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents
// Register a new self-hosted agent
router.post('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, os, architecture } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    
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

    const docRef = await db.collection('users').doc(userId).collection('agents').add(newAgent);
    res.json({ message: 'Agent generated successfully', agent: { id: docRef.id, ...newAgent } });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/agents/:id
// Remove an agent
router.delete('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await db.collection('users').doc(userId).collection('agents').doc(id).delete();
    
    res.json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
