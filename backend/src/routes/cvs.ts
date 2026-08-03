import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate / Get CV for a specific candidate and position
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { positionId, candidateId } = req.body;
    const targetCandidateId = String(candidateId || req.user!.id);

    if (req.user!.role === 'CANDIDATE' && req.user!.id !== targetCandidateId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const position = await prisma.position.findUnique({
      where: { id: String(positionId) },
      include: {
        attributes: {
          include: { attribute: { include: { category: true } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Check or create CV record
    let cv = await prisma.cV.findUnique({
      where: {
        candidateId_positionId: { candidateId: targetCandidateId, positionId: String(positionId) },
      },
    });

    if (!cv) {
      cv = await prisma.cV.create({
        data: {
          candidateId: targetCandidateId,
          positionId: String(positionId),
          isPublished: false,
          version: 1,
        },
      });
    }

    res.json({ cvId: cv.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// View Full Generated CV by CV ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cvId = String(req.params.id);

    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
      include: {
        candidate: { select: { id: true, name: true, email: true, location: true, avatarUrl: true } },
        position: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            attributes: {
              include: { attribute: { include: { category: true } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        likes: { select: { recruiterId: true } },
      },
    });

    if (!cv) {
      return res.status(404).json({ error: 'CV not found' });
    }

    // Fetch candidate's master attribute values
    const candidateAttrValues = await prisma.candidateAttributeValue.findMany({
      where: { candidateId: cv.candidateId },
      include: { attribute: true },
    });

    const valueMap = new Map<string, { value: string; version: number; id: string }>();
    candidateAttrValues.forEach((v) => {
      valueMap.set(v.attributeId, { value: v.value, version: v.version, id: v.id });
    });

    // Assemble dynamic attribute list for this CV
    const compiledAttributes = cv.position.attributes.map((pa) => {
      const valInfo = valueMap.get(pa.attributeId);
      const val = valInfo ? valInfo.value : '';
      const isEmpty = !val || val.trim() === '';

      return {
        positionAttrId: pa.id,
        attributeId: pa.attribute.id,
        name: pa.attribute.name,
        description: pa.attribute.description,
        dataType: pa.attribute.dataType,
        category: pa.attribute.category.name,
        options: pa.attribute.optionsJson ? JSON.parse(pa.attribute.optionsJson) : null,
        isRequired: pa.isRequired,
        value: val,
        valueRecordId: valInfo ? valInfo.id : null,
        version: valInfo ? valInfo.version : 0,
        isEmpty,
      };
    });

    const missingCount = compiledAttributes.filter((a) => a.isRequired && a.isEmpty).length;
    const canPublish = missingCount === 0;

    const candidateProjects = await prisma.candidateProject.findMany({
      where: { candidateId: cv.candidateId },
      orderBy: { createdAt: 'desc' },
    });

    const targetTags: string[] = JSON.parse(cv.position.projectTagsJson || '[]');
    let filteredProjects = candidateProjects;

    if (targetTags.length > 0) {
      filteredProjects = candidateProjects.filter((p) => {
        const pTags: string[] = JSON.parse(p.tagsJson || '[]');
        return targetTags.some((tag) => pTags.includes(tag));
      });
    }

    const displayedProjects = filteredProjects.slice(0, cv.position.maxProjects);

    res.json({
      cv: {
        id: cv.id,
        isPublished: cv.isPublished,
        version: cv.version,
        createdAt: cv.createdAt,
        updatedAt: cv.updatedAt,
        likesCount: cv.likes.length,
        likedByRecruiterIds: cv.likes.map((l: { recruiterId: string }) => l.recruiterId),
      },
      candidate: cv.candidate,
      position: cv.position,
      attributes: compiledAttributes,
      projects: displayedProjects,
      canPublish,
      missingCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inline edit attribute value on CV page
router.put('/:id/attributes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const cvId = String(req.params.id);
    const { attributeId, value, version } = req.body;

    const cv = await prisma.cV.findUnique({ where: { id: cvId } });
    if (!cv) return res.status(404).json({ error: 'CV not found' });

    if (req.user!.role === 'CANDIDATE' && cv.candidateId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: Recruiters cannot directly edit candidate CV attributes' });
    }

    const existing = await prisma.candidateAttributeValue.findUnique({
      where: {
        candidateId_attributeId: { candidateId: cv.candidateId, attributeId: String(attributeId) },
      },
    });

    let updatedVal;
    if (existing) {
      if (version !== undefined && existing.version !== version) {
        return res.status(409).json({
          error: 'Optimistic Locking Conflict: Attribute value was updated elsewhere.',
          currentVersion: existing.version,
        });
      }

      updatedVal = await prisma.candidateAttributeValue.update({
        where: { id: existing.id },
        data: {
          value: String(value ?? ''),
          version: existing.version + 1,
        },
      });
    } else {
      updatedVal = await prisma.candidateAttributeValue.create({
        data: {
          candidateId: cv.candidateId,
          attributeId: String(attributeId),
          value: String(value ?? ''),
          version: 1,
        },
      });
    }

    res.json(updatedVal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Publish / Unpublish CV
router.post('/:id/publish', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const cvId = String(req.params.id);
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
      include: {
        position: {
          include: { attributes: { include: { attribute: true } } },
        },
      },
    });

    if (!cv) return res.status(404).json({ error: 'CV not found' });

    if (req.user!.role === 'CANDIDATE' && cv.candidateId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const candidateAttrValues = await prisma.candidateAttributeValue.findMany({
      where: { candidateId: cv.candidateId },
    });
    const valMap = new Map(candidateAttrValues.map((v) => [v.attributeId, v.value]));

    const missingRequired = cv.position.attributes.filter((pa: any) => {
      if (!pa.isRequired) return false;
      const val = valMap.get(pa.attributeId);
      return !val || val.trim() === '';
    });

    if (missingRequired.length > 0) {
      return res.status(400).json({
        error: `Cannot publish CV: ${missingRequired.length} required attribute(s) are missing or empty. Please fill them first.`,
      });
    }

    const updatedCv = await prisma.cV.update({
      where: { id: cvId },
      data: {
        isPublished: true,
        version: cv.version + 1,
      },
    });

    res.json(updatedCv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Like / Unlike CV (Recruiters & Admins)
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const cvId = String(req.params.id);
    if (req.user!.role !== 'RECRUITER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Recruiters can like CVs' });
    }

    const existingLike = await prisma.cVLike.findUnique({
      where: {
        cvId_recruiterId: { cvId, recruiterId: req.user!.id },
      },
    });

    if (existingLike) {
      await prisma.cVLike.delete({ where: { id: existingLike.id } });
    } else {
      await prisma.cVLike.create({
        data: { cvId, recruiterId: req.user!.id },
      });
    }

    const likesCount = await prisma.cVLike.count({ where: { cvId } });
    res.json({ success: true, liked: !existingLike, likesCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List submitted CVs
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { positionId } = req.query;
    const where: any = {};

    if (positionId) {
      where.positionId = String(positionId);
    }
    if (req.user!.role === 'RECRUITER') {
      where.isPublished = true;
    }

    const cvs = await prisma.cV.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, email: true, location: true } },
        position: { select: { id: true, title: true } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(cvs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
