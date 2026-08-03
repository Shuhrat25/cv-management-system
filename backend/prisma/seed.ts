import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  await prisma.cVLike.deleteMany();
  await prisma.positionDiscussion.deleteMany();
  await prisma.cV.deleteMany();
  await prisma.positionAttribute.deleteMany();
  await prisma.position.deleteMany();
  await prisma.candidateProject.deleteMany();
  await prisma.candidateAttributeValue.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.attributeCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const john = await prisma.user.create({
    data: {
      email: 'john@example.com',
      passwordHash,
      name: 'John Smith',
      role: 'CANDIDATE',
      location: 'Tashkent, Uzbekistan',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
  });

  const mary = await prisma.user.create({
    data: {
      email: 'mary@example.com',
      passwordHash,
      name: 'Mary Johnson',
      role: 'CANDIDATE',
      location: 'Samarkand, Uzbekistan',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    },
  });

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@example.com',
      passwordHash,
      name: 'Sarah Recruiter',
      role: 'RECRUITER',
      location: 'Acme Corp HQ, USA',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      name: 'System Administrator',
      role: 'ADMIN',
      location: 'Global Ops',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    },
  });

  console.log('Seeding Attribute Categories & Attributes...');
  const catCert = await prisma.attributeCategory.create({ data: { name: 'Certification' } });
  const catPersonal = await prisma.attributeCategory.create({ data: { name: 'Personal Information' } });
  const catSoft = await prisma.attributeCategory.create({ data: { name: 'Soft Skills' } });
  const catTech = await prisma.attributeCategory.create({ data: { name: 'Technical Skills' } });

  const attrIelts = await prisma.attribute.create({
    data: {
      name: 'IELTS Score',
      description: 'Overall band score from 0.0 to 9.0',
      dataType: 'NUMERIC',
      categoryId: catCert.id,
    },
  });

  const attrCap = await prisma.attribute.create({
    data: {
      name: 'CAP Level',
      description: 'Certified Analytics Professional level',
      dataType: 'ONE_OF_MANY',
      optionsJson: JSON.stringify(['None', 'Essentials', 'Pro', 'Expert']),
      categoryId: catCert.id,
    },
  });

  const attrGpa = await prisma.attribute.create({
    data: {
      name: 'GPA',
      description: 'University Grade Point Average (out of 4.0)',
      dataType: 'NUMERIC',
      categoryId: catPersonal.id,
    },
  });

  const attrRemote = await prisma.attribute.create({
    data: {
      name: 'Remote Work Availability',
      description: 'Open for remote or hybrid positions',
      dataType: 'BOOLEAN',
      categoryId: catPersonal.id,
    },
  });

  const attrPresentation = await prisma.attribute.create({
    data: {
      name: 'Presentation Skills',
      description: 'Proficiency in technical presentation and demoing',
      dataType: 'ONE_OF_MANY',
      optionsJson: JSON.stringify(['Basic', 'Intermediate', 'Advanced', 'Expert']),
      categoryId: catSoft.id,
    },
  });

  const attrPython = await prisma.attribute.create({
    data: {
      name: 'Python Proficiency',
      description: 'Hands-on experience with Python backend and data scripts',
      dataType: 'BOOLEAN',
      categoryId: catTech.id,
    },
  });

  const attrExpYears = await prisma.attribute.create({
    data: {
      name: 'Years of Experience',
      description: 'Commercial software development experience in years',
      dataType: 'NUMERIC',
      categoryId: catPersonal.id,
    },
  });

  console.log('Seeding Candidate Attribute Values...');
  // John's values
  await prisma.candidateAttributeValue.createMany({
    data: [
      { candidateId: john.id, attributeId: attrIelts.id, value: '7.5' },
      { candidateId: john.id, attributeId: attrGpa.id, value: '3.8' },
      { candidateId: john.id, attributeId: attrCap.id, value: 'Pro' },
      { candidateId: john.id, attributeId: attrPython.id, value: 'true' },
      { candidateId: john.id, attributeId: attrRemote.id, value: 'true' },
      { candidateId: john.id, attributeId: attrPresentation.id, value: 'Advanced' },
      { candidateId: john.id, attributeId: attrExpYears.id, value: '2.5' },
    ],
  });

  // Mary's values
  await prisma.candidateAttributeValue.createMany({
    data: [
      { candidateId: mary.id, attributeId: attrIelts.id, value: '8.0' },
      { candidateId: mary.id, attributeId: attrGpa.id, value: '3.9' },
      { candidateId: mary.id, attributeId: attrCap.id, value: 'Expert' },
      { candidateId: mary.id, attributeId: attrPython.id, value: 'true' },
      { candidateId: mary.id, attributeId: attrRemote.id, value: 'true' },
      { candidateId: mary.id, attributeId: attrPresentation.id, value: 'Expert' },
      { candidateId: mary.id, attributeId: attrExpYears.id, value: '5.0' },
    ],
  });

  console.log('Seeding Candidate Projects...');
  await prisma.candidateProject.create({
    data: {
      candidateId: john.id,
      name: 'Data Pipeline Automator',
      startDate: '2024-01-15',
      endDate: '2024-11-30',
      description: 'Built a high-throughput ETL pipeline using Python, SQL, and Apache Spark.',
      tagsJson: JSON.stringify(['Python', 'SQL', 'Data Engineering']),
    },
  });

  await prisma.candidateProject.create({
    data: {
      candidateId: john.id,
      name: 'Analytics Dashboard UI',
      startDate: '2023-06-01',
      endDate: '2023-12-20',
      description: 'Created a React TypeScript dashboard for real-time sensor metrics monitoring.',
      tagsJson: JSON.stringify(['React', 'TypeScript', 'Frontend']),
    },
  });

  await prisma.candidateProject.create({
    data: {
      candidateId: mary.id,
      name: 'Enterprise Cloud Data Lake',
      startDate: '2022-03-01',
      endDate: '2024-05-15',
      description: 'Architected distributed data ingestion layer in Python and Kubernetes.',
      tagsJson: JSON.stringify(['Python', 'SQL', 'Data Engineering', 'Cloud']),
    },
  });

  console.log('Seeding Positions...');
  const posJuniorData = await prisma.position.create({
    data: {
      title: 'Junior Data Engineer @ Acme Corp',
      description: 'We are seeking a talented Junior Data Engineer to join our growing data platform team at Acme Corp. You will design, test, and maintain data pipelines.',
      isPublic: true,
      createdById: sarah.id,
      projectTagsJson: JSON.stringify(['Python', 'SQL', 'Data Engineering']),
      maxProjects: 4,
      accessRulesJson: JSON.stringify([
        { attributeId: attrIelts.id, attributeName: 'IELTS Score', operator: 'GTE', value: '7.0' },
        { attributeId: attrPython.id, attributeName: 'Python Proficiency', operator: 'EQ', value: 'true' },
      ]),
    },
  });

  await prisma.positionAttribute.createMany({
    data: [
      { positionId: posJuniorData.id, attributeId: attrIelts.id, isRequired: true, order: 1 },
      { positionId: posJuniorData.id, attributeId: attrGpa.id, isRequired: true, order: 2 },
      { positionId: posJuniorData.id, attributeId: attrPython.id, isRequired: true, order: 3 },
      { positionId: posJuniorData.id, attributeId: attrCap.id, isRequired: false, order: 4 },
    ],
  });

  const posSrFrontend = await prisma.position.create({
    data: {
      title: 'Senior Frontend Engineer',
      description: 'Looking for a Senior Frontend Developer experienced in modern Web architectures, micro-frontends, and performance optimization.',
      isPublic: true,
      createdById: sarah.id,
      projectTagsJson: JSON.stringify(['React', 'TypeScript', 'Frontend']),
      maxProjects: 3,
      accessRulesJson: JSON.stringify([
        { attributeId: attrExpYears.id, attributeName: 'Years of Experience', operator: 'GTE', value: '2' },
        { attributeId: attrRemote.id, attributeName: 'Remote Work Availability', operator: 'EQ', value: 'true' },
      ]),
    },
  });

  await prisma.positionAttribute.createMany({
    data: [
      { positionId: posSrFrontend.id, attributeId: attrExpYears.id, isRequired: true, order: 1 },
      { positionId: posSrFrontend.id, attributeId: attrPresentation.id, isRequired: true, order: 2 },
      { positionId: posSrFrontend.id, attributeId: attrRemote.id, isRequired: true, order: 3 },
    ],
  });

  console.log('Seeding CVs...');
  const cv1 = await prisma.cV.create({
    data: {
      candidateId: john.id,
      positionId: posJuniorData.id,
      isPublished: true,
    },
  });

  const cv2 = await prisma.cV.create({
    data: {
      candidateId: mary.id,
      positionId: posJuniorData.id,
      isPublished: true,
    },
  });

  await prisma.cVLike.create({
    data: {
      cvId: cv1.id,
      recruiterId: sarah.id,
    },
  });

  console.log('Seeding Position Discussions...');
  await prisma.positionDiscussion.createMany({
    data: [
      {
        positionId: posJuniorData.id,
        authorId: sarah.id,
        content: 'Welcome candidates! Please make sure your **IELTS score** and **Python experience** are updated before submitting.',
      },
      {
        positionId: posJuniorData.id,
        authorId: john.id,
        content: 'Hi Sarah, does this role require on-site attendance or is remote work allowed?',
      },
      {
        positionId: posJuniorData.id,
        authorId: sarah.id,
        content: 'Hi John, remote work is available for candidates with strong background!',
      },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
