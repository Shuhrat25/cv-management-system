import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { authenticate, AuthRequest, getJwtSecret, isSeededDemoUser } from '../middleware/auth';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = Router();
const generateToken = (user: { id: string; email: string; role: string; name: string }, isDemo = isSeededDemoUser(user)) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, isDemo },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, location } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (role === 'ADMIN') {
      return res.status(403).json({ error: 'Administrator accounts cannot be created through public registration.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role === 'RECRUITER' ? 'RECRUITER' : 'CANDIDATE',
        location: location || 'Tashkent, Uzbekistan',
      },
    });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, location: user.location } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account has been blocked' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, location: user.location, avatarUrl: user.avatarUrl } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Demo Accounts for seamless switching
router.get('/demo-users', async (_req, res) => {
  if (process.env.DEMO_SEED !== 'true') return res.json([]);
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, location: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users.filter(isSeededDemoUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Switch to demo user
router.post('/switch-demo', async (req, res) => {
  if (process.env.DEMO_SEED !== 'true') return res.status(403).json({ error: 'Demo switching is disabled.' });
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!isSeededDemoUser(user)) {
      return res.status(403).json({ error: 'Only seeded demonstration accounts can be selected.' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    const token = generateToken(user, true);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, location: user.location, avatarUrl: user.avatarUrl } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, location: true, avatarUrl: true, isBlocked: true, version: true },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Google Sign-In
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
      user = await prisma.user.create({
        data: {
          email: payload.email,
          passwordHash: randomPassword,
          name: payload.name || payload.email,
          role: 'CANDIDATE',
          avatarUrl: payload.picture,
        },
      });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account has been blocked' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, location: user.location, avatarUrl: user.avatarUrl },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GitHub OAuth - Step 1: redirect to GitHub
router.get('/github', (_req, res) => {
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=read:user user:email`;
  res.redirect(redirectUri);
});

// GitHub OAuth - Step 2: handle callback
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_no_code`);
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData: any = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_token_failed`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser: any = await userRes.json();

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails: any = await emailRes.json();
    const primaryEmail =
      Array.isArray(emails) ? emails.find((e: any) => e.primary)?.email || emails[0]?.email : ghUser.email;

    if (!primaryEmail) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_no_email`);
    }

    let user = await prisma.user.findUnique({ where: { email: primaryEmail } });
    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          passwordHash: randomPassword,
          name: ghUser.name || ghUser.login,
          role: 'CANDIDATE',
          avatarUrl: ghUser.avatar_url,
        },
      });
    }

    if (user.isBlocked) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_blocked`);
    }

    const token = generateToken(user);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}`);
  } catch (err: any) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=github_failed`);
  }
});

export default router;
