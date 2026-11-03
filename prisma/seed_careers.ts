import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const careers = [
    { name: 'Technology', slug: 'technology', description: 'Tech related careers', color: '#3B82F6' },
    { name: 'Business', slug: 'business', description: 'Business related careers', color: '#10B981' },
    { name: 'Design', slug: 'design', description: 'Design related careers', color: '#F59E0B' },
    { name: 'Marketing', slug: 'marketing', description: 'Marketing related careers', color: '#EF4444' },
    { name: 'Sales', slug: 'sales', description: 'Sales related careers', color: '#8B5CF6' },
  ];

  console.log('Seeding careers...');
  for (const career of careers) {
    await prisma.career.upsert({
      where: { slug: career.slug },
      update: {},
      create: {
        name: career.name,
        slug: career.slug,
        description: career.description,
        color: career.color,
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
