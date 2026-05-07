import { Router } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { verifyToken } from '../lib/middleware';

dotenv.config();

const router = Router();

import { db } from '../lib/firebase';

// We pass a relative path so passport dynamically resolves the domain!
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
    scope: ['repo', 'user:email', 'workflow'],
    proxy: true // Trust the x-forwarded-proto header from Vercel
  },
  async function(accessToken: string, refreshToken: string, profile: any, done: any) {
    try {
      const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
      const avatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('githubId', '==', String(profile.id)).limit(1).get();

      let dbUserId = '';
      if (snapshot.empty) {
        const newUserRef = await usersRef.add({
          githubId: String(profile.id),
          name: profile.displayName || profile.username,
          username: profile.username,
          avatarUrl: avatarUrl,
          email: email,
          githubToken: accessToken,
          createdAt: new Date().toISOString()
        });
        dbUserId = newUserRef.id;
      } else {
        const doc = snapshot.docs[0];
        dbUserId = doc.id;
        await doc.ref.update({
          name: profile.displayName || profile.username,
          username: profile.username,
          avatarUrl: avatarUrl,
          email: email,
          githubToken: accessToken,
        });
      }

      // Use an explicit 'dbId' field to avoid colliding with 'profile.id'
      return done(null, { ...profile, dbId: dbUserId });
    } catch (err) {
      return done(err);
    }
  }
));

// Initiate GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['repo', 'user:email', 'workflow'] }));

// GitHub OAuth Callback
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/', session: false }),
  (req, res) => {
    // Generate JWT
    const token = jwt.sign(
      { id: (req.user as any).dbId }, 
      process.env.JWT_SECRET || 'bravocloud_jwt_secret', 
      { expiresIn: '7d' }
    );
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?token=${token}`);
  }
);

router.get('/me', verifyToken, async (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

export default router;
