"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const middleware_1 = require("../lib/middleware");
dotenv_1.default.config();
const router = (0, express_1.Router)();
const firebase_1 = require("../lib/firebase");
// We pass a relative path so passport dynamically resolves the domain!
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
    scope: ['repo', 'user:email', 'workflow'],
    proxy: true // Trust the x-forwarded-proto header from Vercel
}, async function (accessToken, refreshToken, profile, done) {
    try {
        const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
        const usersRef = firebase_1.db.collection('users');
        const snapshot = await usersRef.where('githubId', '==', String(profile.id)).limit(1).get();
        let dbUserId = '';
        if (snapshot.empty) {
            const newUserRef = await usersRef.add({
                githubId: String(profile.id),
                name: profile.displayName || profile.username,
                email: email,
                githubToken: accessToken,
                createdAt: new Date().toISOString()
            });
            dbUserId = newUserRef.id;
        }
        else {
            const doc = snapshot.docs[0];
            dbUserId = doc.id;
            await doc.ref.update({
                name: profile.displayName || profile.username,
                email: email,
                githubToken: accessToken,
            });
        }
        // Use an explicit 'dbId' field to avoid colliding with 'profile.id'
        return done(null, { ...profile, dbId: dbUserId });
    }
    catch (err) {
        return done(err);
    }
}));
// Initiate GitHub OAuth
router.get('/github', passport_1.default.authenticate('github', { scope: ['repo', 'user:email', 'workflow'] }));
// GitHub OAuth Callback
router.get('/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/', session: false }), (req, res) => {
    // Generate JWT
    const token = jsonwebtoken_1.default.sign({ id: req.user.dbId }, process.env.JWT_SECRET || 'bravocloud_jwt_secret', { expiresIn: '7d' });
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?token=${token}`);
});
router.get('/me', middleware_1.verifyToken, async (req, res) => {
    res.json({ user: req.user });
});
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});
exports.default = router;
