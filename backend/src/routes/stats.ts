import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      cvsLast24h,
      totalPositions,
      totalCandidates,
      totalRecruiters,
      totalCVs,
      latestPositions,
      allPositions,
      allProjects,
    ] = await Promise.all([
      prisma.cV.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.position.count(),
      prisma.user.count({ where: { role: 'CANDIDATE' } }),
      prisma.user.count({ where: { role: 'RECRUITER' } }),
      prisma.cV.count({ where: { isPublished: true } }),

      // Latest Positions
      prisma.position.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { cvs: true } },
        },
      }),

      // Positions with CV count for Popular ranking
      prisma.position.findMany({
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { cvs: true } },
        },
      }),

      // Candidate projects for Tag Cloud
      prisma.candidateProject.findMany({
        select: { tagsJson: true },
      }),
    ]);

    // Rank top 5 most popular positions by submitted CVs
    const mostPopularPositions = [...allPositions]
      .sort((a, b) => b._count.cvs - a._count.cvs)
      .slice(0, 5);

    // Aggregate tags for tag cloud
    const tagCountMap: Record<string, number> = {};

    // Collect tags from positions and candidate projects
    allPositions.forEach((pos) => {
      try {
        const tags: string[] = JSON.parse(pos.projectTagsJson || '[]');
        tags.forEach((tag) => {
          tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
        });
      } catch (e) {}
    });

    allProjects.forEach((proj) => {
      try {
        const tags: string[] = JSON.parse(proj.tagsJson || '[]');
        tags.forEach((tag) => {
          tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
        });
      } catch (e) {}
    });

    const tagCloud = Object.entries(tagCountMap).map(([tag, count]) => ({
      tag,
      count,
    }));

    res.json({
      stats: {
        cvsLast24h,
        totalPositions,
        totalCandidates,
        totalRecruiters,
        totalCVs,
      },
      latestPositions,
      mostPopularPositions,
      tagCloud,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
