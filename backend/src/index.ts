import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import attributeRoutes from './routes/attributes';
import positionRoutes from './routes/positions';
import profileRoutes from './routes/profile';
import cvRoutes from './routes/cvs';
import discussionRoutes from './routes/discussions';
import searchRoutes from './routes/search';
import statsRoutes from './routes/stats';
import userRoutes from './routes/users';
import externalApiRoutes from './routes/externalApi';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// app.use(cors());
app.use(cors({
  origin: [
    'https://cv-management-system-57ra-dun.vercel.app',
    'https://cv-management-system-57ra-git-main-shuhrat25s-projects.vercel.app',
    'https://cv-management-system-57ra-c9yncc4nf-shuhrat25s-projects.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cvs', cvRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/external', externalApiRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Course Project Backend running on http://localhost:${PORT}`);
});
