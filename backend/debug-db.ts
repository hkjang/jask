const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully.');
    
    console.log('Checking EmbeddingConfig table...');
    const count = await prisma.embeddingConfig.count();
    console.log(`EmbeddingConfig count: ${count}`);
    
    console.log('Listing first 5 configs...');
    const configs = await prisma.embeddingConfig.findMany({ take: 5 });
    console.log(JSON.stringify(configs, null, 2));

  } catch (e) {
    console.error('Database Connection/Query Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
