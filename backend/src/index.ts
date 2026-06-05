import express from 'express';
import cors from 'cors';
import passport from 'passport';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import githubRoutes from './routes/github';
import projectsRoutes from './routes/projects';
import deploymentsRoutes from './routes/deployments';
import analyticsRoutes from './routes/analytics';
import { db } from './lib/firebase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.set('trust proxy', 1);

app.use(passport.initialize());

app.use('/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/deployments', deploymentsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to BravoCloud API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Global error handler for debugging
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Fatal Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || String(err),
    oauth_details: err.oauthError ? err.oauthError.data : null,
    stack: process.env.NODE_ENV === 'production' ? 'hidden' : err.stack
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`BravoCloud Backend running on http://localhost:${PORT}`);
  });
}

export default app;
