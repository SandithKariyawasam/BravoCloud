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

// --- AGENT DAEMON ENDPOINTS ---
// These do not use verifyToken because the agent passes its generated token in the body.

const findAgentByToken = async (token: string) => {
  const usersSnapshot = await db.collection('users').get();
  for (const userDoc of usersSnapshot.docs) {
    const agentsSnapshot = await db.collection('users').doc(userDoc.id).collection('agents').where('token', '==', token).get();
    if (!agentsSnapshot.empty) {
      return { userId: userDoc.id, agentId: agentsSnapshot.docs[0].id, agent: agentsSnapshot.docs[0].data() };
    }
  }
  return null;
};

// POST /api/agents/poll
router.post('/poll', async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const agentData = await findAgentByToken(token);
    if (!agentData) return res.status(401).json({ error: 'Invalid token' });

    // Update agent status to online and lastSeen
    await db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
      status: 'Online',
      lastSeen: new Date().toISOString()
    });

    // Check for pending jobs
    const jobsSnapshot = await db.collection('users').doc(agentData.userId).collection('agent_jobs')
      .where('agentId', '==', agentData.agentId)
      .where('status', '==', 'Pending')
      .limit(1)
      .get();

    if (jobsSnapshot.empty) {
      return res.json({ job: null });
    }

    const jobDoc = jobsSnapshot.docs[0];
    await jobDoc.ref.update({ status: 'InProgress', startedAt: new Date().toISOString() });

    res.json({ job: { id: jobDoc.id, ...jobDoc.data() } });
  } catch (error: any) {
    console.error('Error polling agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents/logs
router.post('/logs', async (req: any, res: any) => {
  try {
    const { token, jobId, log } = req.body;
    const agentData = await findAgentByToken(token);
    if (!agentData) return res.status(401).json({ error: 'Invalid token' });

    await db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId).collection('logs').add({
      log,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents/complete
router.post('/complete', async (req: any, res: any) => {
  try {
    const { token, jobId, status } = req.body;
    const agentData = await findAgentByToken(token);
    if (!agentData) return res.status(401).json({ error: 'Invalid token' });

    await db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId).update({
      status, // 'Success' or 'Failed'
      completedAt: new Date().toISOString()
    });

    // Set agent back to Online (idle) instead of InProgress
    await db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
      status: 'Online'
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN TEST ENDPOINTS ---

// POST /api/agents/admin/queue-job
router.post('/admin/queue-job', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { agentId, repository } = req.body;

    const newJob = {
      agentId,
      repository: repository || 'https://github.com/example/repo',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
    res.json({ message: 'Job queued successfully', jobId: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
