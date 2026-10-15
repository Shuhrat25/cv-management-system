import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    isDemo?: boolean;
  };
}

const DEMO_EMAILS = ['john@example.com', 'mary@example.com', 'sarah@example.com', 'admin@example.com'];
const DEMO_JWT_SECRET = 'super-secret-course-project-key-2026';

export function isSeededDemoUser(user: { email: string }): boolean {
  return DEMO_EMAILS.includes(user.email.trim().toLowerCase());
}

export function hasPrivateJwtSecret(): boolean {
  const secret = process.env.JWT_SECRET;
  return typeof secret === 'string' && secret.length >= 32 && secret !== DEMO_JWT_SECRET;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || DEMO_JWT_SECRET;
  const integrationEnabled = ['SF_ENABLED', 'SF_WRITES_ENABLED', 'ODOO_ENABLED']
    .some((key) => process.env[key] === 'true');
  if (integrationEnabled && !hasPrivateJwtSecret()) {
    throw new Error('External integrations require a private JWT_SECRET of at least 32 characters.');
  }
  return secret;
}

async function resolveUser(req: AuthRequest): Promise<AuthRequest['user']> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const decoded = jwt.verify(header.slice(7), getJwtSecret(), { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.id !== 'string') return undefined;
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.isBlocked) return undefined;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    // Recognize old demo JWTs and seeded accounts even after demo switching is disabled.
    isDemo: decoded.isDemo === true || isSeededDemoUser(user),
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    req.user = await resolveUser(req);
    if (!req.user) return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuthenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = undefined;
  }
  next();
};

export const requireIntegrationAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const operatorIds = (process.env.INTEGRATION_OPERATOR_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (req.user.role !== 'ADMIN' || req.user.isDemo || isSeededDemoUser(req.user) || !operatorIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'A dedicated integration administrator account is required.' });
  }
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== 'ADMIN' && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
