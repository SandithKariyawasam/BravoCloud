import { Router } from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Max 5MB file size
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

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

    // Fetch log drains
    const drainsSnapshot = await db.collection('users').doc(userId).collection('drains').get();
    const drains = drainsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      user: {
        id: userDoc.id,
        name: userData?.name,
        username: userData?.username,
        email: userData?.email,
        avatarUrl: userData?.avatarUrl,
        githubId: userData?.githubId,
        billingPlan: userData?.billingPlan || 'Hobby (Free)',
        drains
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

// Upload Avatar to Cloudinary
router.post('/avatar', verifyToken, upload.single('avatar'), async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload to Cloudinary using upload_stream
    const uploadToCloudinary = (buffer: Buffer): Promise<string> => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'bravocloud_avatars', public_id: `user_${userId}` },
          (error, result) => {
            if (error) return reject(error);
            resolve(result!.secure_url);
          }
        );
        stream.end(buffer);
      });
    };

    const avatarUrl = await uploadToCloudinary(req.file.buffer);

    // Update Firestore user document
    await db.collection('users').doc(userId).update({ avatarUrl });

    res.json({ message: 'Avatar updated successfully', avatarUrl });
  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// Generate a new Personal Access Token
router.post('/tokens', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Token name is required' });

    // Generate a secure random token, embedding the userId for efficient O(1) lookups
    const secretPart = crypto.randomBytes(24).toString('hex');
    const tokenSecret = `bc_${userId}_${secretPart}`;
    
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

// Create a new Log Drain
router.post('/drains', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, type, url, secretToken } = req.body;
    
    if (!name || !type || !url) return res.status(400).json({ error: 'Missing required drain fields' });

    const newDrain = {
      name,
      type,
      url,
      secretToken: secretToken || null,
      createdAt: new Date().toISOString()
    };

    const drainRef = await db.collection('users').doc(userId).collection('drains').add(newDrain);
    
    res.json({ message: 'Log drain created successfully', drain: { id: drainRef.id, ...newDrain } });
  } catch (error: any) {
    console.error('Error creating drain:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a Log Drain
router.delete('/drains/:drainId', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { drainId } = req.params;
    
    await db.collection('users').doc(userId).collection('drains').doc(drainId).delete();
    
    res.json({ message: 'Log drain deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting drain:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
