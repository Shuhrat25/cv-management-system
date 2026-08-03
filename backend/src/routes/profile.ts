import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get Candidate Personal Profile
router.get('/:userId?', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.userId ? String(req.params.userId) : req.user!.id;

    if (req.user!.role === 'CANDIDATE' && req.user!.id !== targetUserId) {
      return res.status(403).json({ error: 'Forbidden: You can only access your own profile' });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        location: true,
        avatarUrl: true,
        version: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const attributeValues = await prisma.candidateAttributeValue.findMany({
      where: { candidateId: targetUserId },
      include: { attribute: { include: { category: true } } },
    });

    const projects = await prisma.candidateProject.findMany({
      where: { candidateId: targetUserId },
      orderBy: { createdAt: 'desc' },
    });

    const cvs = await prisma.cV.findMany({
      where: { candidateId: targetUserId },
      include: {
        position: { select: { id: true, title: true, isPublic: true } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      user,
      attributeValues,
      projects,
      cvs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile Built-in Me fields
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, location, avatarUrl, version } = req.body;
    const userId = req.user!.id;

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    if (version !== undefined && currentUser.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: Profile was updated in another session.',
        currentVersion: currentUser.version,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name ? String(name) : currentUser.name,
        location: location !== undefined ? String(location) : currentUser.location,
        avatarUrl: avatarUrl !== undefined ? String(avatarUrl) : currentUser.avatarUrl,
        version: currentUser.version + 1,
      },
      select: { id: true, email: true, name: true, role: true, location: true, avatarUrl: true, version: true },
    });

    res.json(updatedUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save/Update Attribute Values (Auto-Save Endpoint)
router.post('/attribute-values/auto-save', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items, candidateId } = req.body;
    const targetUserId = candidateId ? String(candidateId) : req.user!.id;

    if (req.user!.role === 'CANDIDATE' && req.user!.id !== targetUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = [];
    const conflictErrors = [];

    for (const item of items) {
      const { attributeId, value, version } = item;
      const attrId = String(attributeId);

      const existing = await prisma.candidateAttributeValue.findUnique({
        where: {
          candidateId_attributeId: { candidateId: targetUserId, attributeId: attrId },
        },
      });

      if (existing) {
        if (version !== undefined && existing.version !== version) {
          conflictErrors.push({
            attributeId: attrId,
            message: `Version conflict for attribute. Server version: ${existing.version}, sent: ${version}`,
            serverVersion: existing.version,
          });
          continue;
        }

        const updated = await prisma.candidateAttributeValue.update({
          where: { id: existing.id },
          data: {
            value: String(value ?? ''),
            version: existing.version + 1,
          },
          include: { attribute: true },
        });
        results.push(updated);
      } else {
        const created = await prisma.candidateAttributeValue.create({
          data: {
            candidateId: targetUserId,
            attributeId: attrId,
            value: String(value ?? ''),
            version: 1,
          },
          include: { attribute: true },
        });
        results.push(created);
      }
    }

    if (conflictErrors.length > 0) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict detected for some attributes',
        conflicts: conflictErrors,
        savedResults: results,
      });
    }

    res.json({ success: true, savedResults: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Projects Management
router.post('/projects', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, startDate, endDate, description, tags } = req.body;
    if (!name || !startDate || !description) {
      return res.status(400).json({ error: 'Name, startDate, and description are required' });
    }

    const project = await prisma.candidateProject.create({
      data: {
        candidateId: req.user!.id,
        name: String(name),
        startDate: String(startDate),
        endDate: endDate ? String(endDate) : null,
        description: String(description),
        tagsJson: JSON.stringify(tags || []),
        version: 1,
      },
    });

    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const projId = String(req.params.id);
    const { name, startDate, endDate, description, tags, version } = req.body;

    const project = await prisma.candidateProject.findUnique({ where: { id: projId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user!.role === 'CANDIDATE' && project.candidateId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (version !== undefined && project.version !== version) {
      return res.status(409).json({ error: 'Optimistic locking conflict on project update.' });
    }

    const updated = await prisma.candidateProject.update({
      where: { id: projId },
      data: {
        name: String(name),
        startDate: String(startDate),
        endDate: endDate ? String(endDate) : null,
        description: String(description),
        tagsJson: JSON.stringify(tags || []),
        version: project.version + 1,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const projId = String(req.params.id);
    const project = await prisma.candidateProject.findUnique({ where: { id: projId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user!.role === 'CANDIDATE' && project.candidateId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.candidateProject.delete({ where: { id: projId } });
    res.json({ success: true, id: projId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
