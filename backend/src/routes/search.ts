import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ positions: [], attributes: [], candidates: [], cvs: [] });
    }

    const positions = await prisma.position.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
      select: { id: true, title: true, description: true, createdAt: true },
    });

    const attributes = await prisma.attribute.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      include: { category: true },
      take: 5,
    });

    const candidates = await prisma.user.findMany({
      where: {
        role: 'CANDIDATE',
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { location: { contains: q } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, location: true, avatarUrl: true },
    });

    const cvs = await prisma.cV.findMany({
      where: {
        isPublished: true,
        OR: [
          { candidate: { name: { contains: q } } },
          { position: { title: { contains: q } } },
        ],
      },
      include: {
        candidate: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        _count: { select: { likes: true } },
      },
      take: 5,
    });

    res.json({
      positions,
      attributes,
      candidates,
      cvs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
