const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');

async function main() {
  if (process.env.DEMO_SEED !== 'true') {
    console.log('Demo seed disabled.');
    return;
  }
  const prisma = new PrismaClient();
  let empty;
  try {
    const counts = await Promise.all([
      prisma.user.count(), prisma.attributeCategory.count(), prisma.attribute.count(),
      prisma.candidateAttributeValue.count(), prisma.candidateProject.count(),
      prisma.position.count(), prisma.positionAttribute.count(), prisma.cV.count(),
      prisma.cVLike.count(), prisma.positionDiscussion.count()
    ]);
    empty = counts.every(count => count === 0);
  }
  finally { await prisma.$disconnect(); }
  if (!empty) {
    console.log('Existing application data found; demo data left unchanged.');
    return;
  }
  const result = spawnSync(process.execPath, ['node_modules/ts-node/dist/bin.js', 'prisma/seed.ts'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
main().catch((error) => { console.error(error.message); process.exit(1); });
