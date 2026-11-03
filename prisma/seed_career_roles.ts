import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Technology career
  const techCareer = await prisma.career.findUnique({
    where: { slug: 'technology' },
  });

  if (!techCareer) {
    console.error('Technology career not found. Please run the careers seed first.');
    process.exit(1);
  }

  const roles = [
    { name: 'Backend Engineer', slug: 'backend-engineer' },
    { name: 'Frontend Engineer', slug: 'frontend-engineer' },
    { name: 'AI Engineer', slug: 'ai-engineer' },
    { name: 'DevOps', slug: 'devops' },
    { name: 'QA', slug: 'qa' },
    { name: 'Mobile', slug: 'mobile' },
    { name: 'Data Engineer', slug: 'data-engineer' },
  ];

  console.log(`Seeding roles for Technology career (ID: ${techCareer.id})...`);
  for (const role of roles) {
    await prisma.careerRole.upsert({
      where: {
        careerId_slug: {
          careerId: techCareer.id,
          slug: role.slug,
        },
      },
      update: {},
      create: {
        careerId: techCareer.id,
        name: role.name,
        slug: role.slug,
        description: `${role.name} track role.`,
      },
    });
  }
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
