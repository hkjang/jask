
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log(`User count: ${count}`);
  if (count > 0) {
    const user = await prisma.user.findFirst();
    console.log(`First User: ${user?.email}, Role: ${user?.role}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
