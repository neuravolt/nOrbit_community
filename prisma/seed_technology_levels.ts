import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Node.js technology
  const nodejsTech = await prisma.technology.findFirst({
    where: { slug: 'nodejs-nestjs' },
  });

  if (!nodejsTech) {
    console.error('Node.js technology not found. Please run the technologies seed first.');
    process.exit(1);
  }

  const levels = [
    { levelNumber: 1, name: 'Level 1: Foundations', estimatedDurationHours: 40, difficulty: 'beginner' },
    { levelNumber: 2, name: 'Level 2: Core Concepts', estimatedDurationHours: 50, difficulty: 'intermediate' },
    { levelNumber: 3, name: 'Level 3: Advanced', estimatedDurationHours: 60, difficulty: 'intermediate' },
    { levelNumber: 4, name: 'Level 4: Expert', estimatedDurationHours: 70, difficulty: 'advanced' },
  ];

  console.log(`Seeding levels for Node.js technology (ID: ${nodejsTech.id})...`);
  for (const lvl of levels) {
    await prisma.technologyLevel.upsert({
      where: {
        technologyId_levelNumber: {
          technologyId: nodejsTech.id,
          levelNumber: lvl.levelNumber,
        },
      },
      update: {},
      create: {
        technologyId: nodejsTech.id,
        levelNumber: lvl.levelNumber,
        name: lvl.name,
        estimatedDurationHours: lvl.estimatedDurationHours,
        difficulty: lvl.difficulty,
        description: `Description for ${lvl.name}`,
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
