import { Router } from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import crypto from 'crypto';

const router = Router();

// Get Global Settings (Profile, Billing, Tokens)
router.get('/settings', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Fetch active API tokens (excluding the secret value for security)
    const tokensSnapshot = await db.collection('users').doc(userId).collection('tokens').get();
    const tokens = tokensSnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, name: data.name, createdAt: data.createdAt, lastUsed: data.lastUsed };
    });

    res.json({
      user: {
        id: userDoc.id,
        name: userData?.name,
        username: userData?.username,
        email: userData?.email,
        avatarUrl: userData?.avatarUrl,
        githubId: userData?.githubId,
        billingPlan: userData?.billingPlan || 'Hobby (Free)'
      },
      tokens
    });
  } catch (error: any) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Profile
router.patch('/settings', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, username } = req.body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (username !== undefined) updates.username = username;

    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(userId).update(updates);
    }
    
    const updatedDoc = await db.collection('users').doc(userId).get();
    res.json({ message: 'Profile updated', user: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error: any) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate a new Personal Access Token
router.post('/tokens', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Token name is required' });

    // Generate a secure random token
    const tokenSecret = `bc_${crypto.randomBytes(32).toString('hex')}`;
    // In a real app, we would hash tokenSecret before saving, and only store the hash.
    // For BravoCloud V1, we'll store it hashed to demonstrate best practices.
    const tokenHash = crypto.createHash('sha256').update(tokenSecret).digest('hex');

    const tokenRef = db.collection('users').doc(userId).collection('tokens').doc();
    await tokenRef.set({
      name,
      hash: tokenHash,
      createdAt: new Date().toISOString(),
      lastUsed: null
    });

    // We only return the plain token THIS ONE TIME.
    res.json({ 
      message: 'Token generated successfully', 
      token: { id: tokenRef.id, name, createdAt: new Date().toISOString() },
      secret: tokenSecret
    });
  } catch (error: any) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke a Personal Access Token
router.delete('/tokens/:tokenId', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { tokenId } = req.params;
    
    await db.collection('users').doc(userId).collection('tokens').doc(tokenId).delete();
    
    res.json({ message: 'Token revoked successfully' });
  } catch (error: any) {
    console.error('Error revoking token:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
