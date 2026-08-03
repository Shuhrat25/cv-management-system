import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

export async function evaluateAccessRules(candidateId: string, accessRulesJsonStr: string): Promise<{ isEligible: boolean; failedRules: string[] }> {
  try {
    const rules = JSON.parse(accessRulesJsonStr || '[]');
    if (!rules || rules.length === 0) return { isEligible: true, failedRules: [] };

    const candidateValues = await prisma.candidateAttributeValue.findMany({
      where: { candidateId },
      include: { attribute: true },
    });

    const valuesMap = new Map<string, string>();
    candidateValues.forEach((cv) => valuesMap.set(cv.attributeId, cv.value));

    const failedRules: string[] = [];

    for (const rule of rules) {
      const { attributeId, attributeName, operator, value: requiredVal } = rule;
      const actualVal = valuesMap.get(attributeId);

      let rulePassed = false;
      if (actualVal !== undefined && actualVal !== null && actualVal !== '') {
        if (operator === 'EQ') {
          rulePassed = String(actualVal).toLowerCase() === String(requiredVal).toLowerCase();
        } else if (operator === 'NEQ') {
          rulePassed = String(actualVal).toLowerCase() !== String(requiredVal).toLowerCase();
        } else if (operator === 'GTE') {
          rulePassed = parseFloat(actualVal) >= parseFloat(requiredVal);
        } else if (operator === 'LTE') {
          rulePassed = parseFloat(actualVal) <= parseFloat(requiredVal);
        } else if (operator === 'CONTAINS') {
          rulePassed = String(actualVal).toLowerCase().includes(String(requiredVal).toLowerCase());
        }
      }

      if (!rulePassed) {
        failedRules.push(`${attributeName || 'Attribute'} (${operator} ${requiredVal})`);
      }
    }

    return { isEligible: failedRules.length === 0, failedRules };
  } catch (e) {
    return { isEligible: true, failedRules: [] };
  }
}

// Get positions list
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const candidateId = req.query.candidateId ? String(req.query.candidateId) : undefined;
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        attributes: {
          include: { attribute: { include: { category: true } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { cvs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (candidateId) {
      const results = await Promise.all(
        positions.map(async (pos) => {
          const accessInfo = await evaluateAccessRules(candidateId, pos.accessRulesJson);
          return {
            ...pos,
            isEligible: accessInfo.isEligible,
            failedRules: accessInfo.failedRules,
          };
        })
      );
      return res.json(results);
    }

    res.json(positions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single position details
router.get('/:id', async (req, res) => {
  try {
    const posId = String(req.params.id);
    const position = await prisma.position.findUnique({
      where: { id: posId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        attributes: {
          include: { attribute: { include: { category: true } } },
          orderBy: { order: 'asc' },
        },
        cvs: {
          include: {
            candidate: { select: { id: true, name: true, email: true, location: true, avatarUrl: true } },
            _count: { select: { likes: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        discussions: {
          include: { author: { select: { id: true, name: true, role: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json(position);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create position
router.post('/', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, isPublic, accessRules, projectTags, maxProjects, attributes } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const position = await prisma.position.create({
      data: {
        title: String(title),
        description: String(description),
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        accessRulesJson: JSON.stringify(accessRules || []),
        projectTagsJson: JSON.stringify(projectTags || []),
        maxProjects: Number(maxProjects || 3),
        createdById: req.user!.id,
        version: 1,
      },
    });

    if (attributes && Array.isArray(attributes)) {
      await Promise.all(
        attributes.map((attrId: string, index: number) =>
          prisma.positionAttribute.create({
            data: {
              positionId: position.id,
              attributeId: String(attrId),
              isRequired: true,
              order: index + 1,
            },
          })
        )
      );
    }

    const created = await prisma.position.findUnique({
      where: { id: position.id },
      include: {
        attributes: { include: { attribute: true } },
      },
    });

    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate Position
router.post('/:id/duplicate', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const posId = String(req.params.id);
    const sourcePos = await prisma.position.findUnique({
      where: { id: posId },
      include: { attributes: true },
    });

    if (!sourcePos) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const duplicated = await prisma.position.create({
      data: {
        title: `${sourcePos.title} (Copy)`,
        description: sourcePos.description,
        isPublic: sourcePos.isPublic,
        accessRulesJson: sourcePos.accessRulesJson,
        projectTagsJson: sourcePos.projectTagsJson,
        maxProjects: sourcePos.maxProjects,
        createdById: req.user!.id,
        version: 1,
      },
    });

    await Promise.all(
      sourcePos.attributes.map((pa: { attributeId: string; isRequired: boolean; order: number }) =>
        prisma.positionAttribute.create({
          data: {
            positionId: duplicated.id,
            attributeId: pa.attributeId,
            isRequired: pa.isRequired,
            order: pa.order,
          },
        })
      )
    );

    res.json(duplicated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Position with Optimistic Locking
router.put('/:id', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const posId = String(req.params.id);
    const { title, description, isPublic, accessRules, projectTags, maxProjects, attributes, version } = req.body;

    const currentPos = await prisma.position.findUnique({ where: { id: posId } });
    if (!currentPos) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (version !== undefined && currentPos.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: Position was updated by another recruiter. Please refresh.',
        currentVersion: currentPos.version,
      });
    }

    await prisma.position.update({
      where: { id: posId },
      data: {
        title: String(title),
        description: String(description),
        isPublic: Boolean(isPublic),
        accessRulesJson: JSON.stringify(accessRules || []),
        projectTagsJson: JSON.stringify(projectTags || []),
        maxProjects: Number(maxProjects || 3),
        version: currentPos.version + 1,
      },
    });

    if (attributes && Array.isArray(attributes)) {
      await prisma.positionAttribute.deleteMany({ where: { positionId: posId } });
      await Promise.all(
        attributes.map((attrId: string, index: number) =>
          prisma.positionAttribute.create({
            data: {
              positionId: posId,
              attributeId: String(attrId),
              isRequired: true,
              order: index + 1,
            },
          })
        )
      );
    }

    const fullUpdated = await prisma.position.findUnique({
      where: { id: posId },
      include: { attributes: { include: { attribute: true } } },
    });

    res.json(fullUpdated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Position
router.delete('/:id', authenticate, requireRole('RECRUITER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const posId = String(req.params.id);
    const { version } = req.body;

    const currentPos = await prisma.position.findUnique({ where: { id: posId } });
    if (!currentPos) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (version !== undefined && currentPos.version !== version) {
      return res.status(409).json({
        error: 'Optimistic Locking Conflict: Position version mismatch.',
        currentVersion: currentPos.version,
      });
    }

    await prisma.position.delete({ where: { id: posId } });
    res.json({ success: true, id: posId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
