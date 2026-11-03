import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Backend Engineer role
  const backendRole = await prisma.careerRole.findFirst({
    where: { slug: 'backend-engineer' },
  });

  if (!backendRole) {
    console.error('Backend Engineer role not found. Please run the career roles seed first.');
    process.exit(1);
  }

  const technologies = [
    { name: 'Node.js + NestJS', slug: 'nodejs-nestjs', defaultStack: true },
    { name: 'FastAPI', slug: 'fastapi', defaultStack: false },
    { name: 'Spring Boot', slug: 'spring-boot', defaultStack: false },
    { name: 'Laravel', slug: 'laravel', defaultStack: false },
    { name: 'Go', slug: 'go', defaultStack: false },
    { name: '.NET', slug: 'dotnet', defaultStack: false },
  ];

  console.log(`Seeding technologies for Backend Engineer role (ID: ${backendRole.id})...`);
  for (const tech of technologies) {
    await prisma.technology.upsert({
      where: {
        careerRoleId_slug: {
          careerRoleId: backendRole.id,
          slug: tech.slug,
        },
      },
      update: {},
      create: {
        careerRoleId: backendRole.id,
        name: tech.name,
        slug: tech.slug,
        defaultStack: tech.defaultStack,
        description: `${tech.name} framework stack.`,
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
