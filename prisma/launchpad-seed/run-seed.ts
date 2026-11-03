import { PrismaClient } from '@prisma/client';
import { seedRole } from './mapper';
import { frontendDeveloper } from './roles/frontend-developer';
import { backendDeveloper } from './roles/backend-developer';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Frontend Developer...');
  await seedRole(prisma, frontendDeveloper);
  console.log('Seeding Backend Developer...');
  await seedRole(prisma, backendDeveloper);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
