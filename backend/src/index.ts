import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import githubRoutes from './routes/github';
import projectsRoutes from './routes/projects';
import deploymentsRoutes from './routes/deployments';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'bravocloud_super_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/deployments', deploymentsRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to BravoCloud API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`BravoCloud Backend running on http://localhost:${PORT}`);
  });
}

export default app;
