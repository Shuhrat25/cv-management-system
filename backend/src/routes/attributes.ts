import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Get Categories
router.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.attributeCategory.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Attributes
router.get('/', async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : undefined;
    const where: any = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.name = { contains: search };
    }

    const attributes = await prisma.attribute.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    res.json(attributes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Attribute
router.post('/', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, dataType, categoryId, options } = req.body;

    if (!name || !dataType || !categoryId) {
      return res.status(400).json({ error: 'Name, dataType, and categoryId are required' });
    }

    const existing = await prisma.attribute.findUnique({ where: { name: String(name) } });
    if (existing) {
      return res.status(400).json({ error: `Attribute with name "${name}" already exists` });
    }

    const attribute = await prisma.attribute.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        dataType: String(dataType),
        categoryId: String(categoryId),
        optionsJson: options ? JSON.stringify(options) : null,
        version: 1,
      },
      include: { category: true },
    });

    res.json(attribute);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Attribute with Optimistic Locking
router.put('/:id', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const attrId = String(req.params.id);
    const { name, description, dataType, categoryId, options, version } = req.body;

    const currentAttr = await prisma.attribute.findUnique({ where: { id: attrId } });
    if (!currentAttr) {
      return res.status(404).json({ error: 'Attribute not found' });
    }

    if (version !== undefined && currentAttr.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: This attribute was modified by another user. Please refresh and try again.',
        currentVersion: currentAttr.version,
      });
    }

    const updated = await prisma.attribute.update({
      where: { id: attrId },
      data: {
        name: String(name),
        description: description ? String(description) : null,
        dataType: String(dataType),
        categoryId: String(categoryId),
        optionsJson: options ? JSON.stringify(options) : null,
        version: currentAttr.version + 1,
      },
      include: { category: true },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Attribute with Optimistic Locking
router.delete('/:id', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const attrId = String(req.params.id);
    const { version } = req.body;

    const currentAttr = await prisma.attribute.findUnique({ where: { id: attrId } });
    if (!currentAttr) {
      return res.status(404).json({ error: 'Attribute not found' });
    }

    if (version !== undefined && currentAttr.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: Attribute version mismatch. Refresh before deleting.',
        currentVersion: currentAttr.version,
      });
    }

    await prisma.attribute.delete({ where: { id: attrId } });
    res.json({ success: true, id: attrId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
