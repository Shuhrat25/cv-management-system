import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get discussions for a position
router.get('/position/:positionId', async (req, res) => {
  try {
    const positionId = String(req.params.positionId);
    const posts = await prisma.positionDiscussion.findMany({
      where: { positionId },
      include: {
        author: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post message to position discussion
router.post('/position/:positionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const positionId = String(req.params.positionId);
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }

    const post = await prisma.positionDiscussion.create({
      data: {
        positionId,
        authorId: req.user!.id,
        content: String(content).trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });

    res.json(post);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
