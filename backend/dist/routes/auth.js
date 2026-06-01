"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
const firebase_1 = require("../lib/firebase");
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback',
    scope: ['repo', 'user:email', 'workflow']
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
        const user = {
            id: dbUserId,
            githubId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            accessToken,
            avatarUrl: profile.photos?.[0]?.value
        };
        return done(null, user);
    }
    catch (err) {
        return done(err);
    }
}));
passport_1.default.serializeUser((user, done) => {
    done(null, user);
});
passport_1.default.deserializeUser((user, done) => {
    done(null, user);
});
router.get('/github', passport_1.default.authenticate('github', { scope: ['user:email', 'repo', 'workflow'] }));
router.get('/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/login' }), function (req, res) {
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard');
});
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        // Don't send the access token to the frontend for security
        const { accessToken, ...safeUser } = req.user;
        res.json({ user: safeUser });
    }
    else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.json({ success: true });
    });
});
exports.default = router;
