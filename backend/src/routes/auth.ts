import { Router } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback',
    scope: ['repo', 'user:email']
  },
  function(accessToken: string, refreshToken: string, profile: any, done: any) {
    const user = {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      accessToken,
      avatarUrl: profile.photos?.[0]?.value
    };
    return done(null, user);
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

router.get('/github',
  passport.authenticate('github', { scope: [ 'user:email', 'repo' ] }));

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard');
  });

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    // Don't send the access token to the frontend for security
    const { accessToken, ...safeUser } = req.user as any;
    res.json({ user: safeUser });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ success: true });
  });
});

export default router;
