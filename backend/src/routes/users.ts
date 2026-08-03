import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all users (Admin only)
router.get('/', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        location: true,
        avatarUrl: true,
        isBlocked: true,
        version: true,
        createdAt: true,
        _count: { select: { cvs: true, positions: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role or block/unblock status with Optimistic Locking
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.id);
    const { role, isBlocked, version } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (version !== undefined && user.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: User record was modified by another administrator.',
        currentVersion: user.version,
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: role !== undefined ? String(role) : user.role,
        isBlocked: isBlocked !== undefined ? Boolean(isBlocked) : user.isBlocked,
        version: user.version + 1,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        location: true,
        isBlocked: true,
        version: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.id);
    const { version } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (version !== undefined && user.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: User record version mismatch.',
        currentVersion: user.version,
      });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, id: userId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
