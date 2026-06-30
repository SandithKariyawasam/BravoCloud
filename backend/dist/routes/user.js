"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
// Max 5MB file size
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});
const router = (0, express_1.Router)();
// Get Global Settings (Profile, Billing, Tokens)
router.get('/settings', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userDoc.data();
        // Fetch active API tokens (excluding the secret value for security)
        const tokensSnapshot = await firebase_1.db.collection('users').doc(userId).collection('tokens').get();
        const tokens = tokensSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, createdAt: data.createdAt, lastUsed: data.lastUsed };
        });
        // Fetch log drains
        const drainsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('drains').get();
        const drains = drainsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Fetch alerts
        const alertsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('alerts').get();
        const alerts = alertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({
            user: {
                id: userDoc.id,
                name: userData?.name,
                username: userData?.username,
                email: userData?.email,
                avatarUrl: userData?.avatarUrl,
                githubId: userData?.githubId,
                billingPlan: userData?.billingPlan || 'Hobby (Free)',
                drains,
                alerts
            },
            tokens
        });
    }
    catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update Profile
router.patch('/settings', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, username } = req.body;
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (username !== undefined)
            updates.username = username;
        if (Object.keys(updates).length > 0) {
            await firebase_1.db.collection('users').doc(userId).update(updates);
        }
        const updatedDoc = await firebase_1.db.collection('users').doc(userId).get();
        res.json({ message: 'Profile updated', user: { id: updatedDoc.id, ...updatedDoc.data() } });
    }
    catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// Upload Avatar to Cloudinary
router.post('/avatar', middleware_1.verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        // Upload to Cloudinary using upload_stream
        const uploadToCloudinary = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary_1.v2.uploader.upload_stream({ folder: 'bravocloud_avatars', public_id: `user_${userId}` }, (error, result) => {
                    if (error)
                        return reject(error);
                    resolve(result.secure_url);
                });
                stream.end(buffer);
            });
        };
        const avatarUrl = await uploadToCloudinary(req.file.buffer);
        // Update Firestore user document
        await firebase_1.db.collection('users').doc(userId).update({ avatarUrl });
        res.json({ message: 'Avatar updated successfully', avatarUrl });
    }
    catch (error) {
        console.error('Error uploading avatar:', error);
        res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
});
// Generate a new Personal Access Token
router.post('/tokens', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Token name is required' });
        // Generate a secure random token, embedding the userId for efficient O(1) lookups
        const secretPart = crypto_1.default.randomBytes(24).toString('hex');
        const tokenSecret = `bc_${userId}_${secretPart}`;
        // In a real app, we would hash tokenSecret before saving, and only store the hash.
        // For BravoCloud V1, we'll store it hashed to demonstrate best practices.
        const tokenHash = crypto_1.default.createHash('sha256').update(tokenSecret).digest('hex');
        const tokenRef = firebase_1.db.collection('users').doc(userId).collection('tokens').doc();
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
    }
    catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: error.message });
    }
});
// Revoke a Personal Access Token
router.delete('/tokens/:tokenId', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { tokenId } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('tokens').doc(tokenId).delete();
        res.json({ message: 'Token revoked successfully' });
    }
    catch (error) {
        console.error('Error revoking token:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create a new Log Drain
router.post('/drains', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type, url, secretToken } = req.body;
        if (!name || !type || !url)
            return res.status(400).json({ error: 'Missing required drain fields' });
        const newDrain = {
            name,
            type,
            url,
            secretToken: secretToken || null,
            createdAt: new Date().toISOString()
        };
        const drainRef = await firebase_1.db.collection('users').doc(userId).collection('drains').add(newDrain);
        res.json({ message: 'Log drain created successfully', drain: { id: drainRef.id, ...newDrain } });
    }
    catch (error) {
        console.error('Error creating drain:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete a Log Drain
router.delete('/drains/:drainId', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { drainId } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('drains').doc(drainId).delete();
        res.json({ message: 'Log drain deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting drain:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create a new Alert
router.post('/alerts', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { event, method, target } = req.body;
        if (!event || !method || !target)
            return res.status(400).json({ error: 'Missing required alert fields' });
        const newAlert = {
            event,
            method,
            target,
            createdAt: new Date().toISOString()
        };
        const alertRef = await firebase_1.db.collection('users').doc(userId).collection('alerts').add(newAlert);
        res.json({ message: 'Alert created successfully', alert: { id: alertRef.id, ...newAlert } });
    }
    catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete an Alert
router.delete('/alerts/:alertId', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { alertId } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('alerts').doc(alertId).delete();
        res.json({ message: 'Alert deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
