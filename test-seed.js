const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({});

async function test() {
  try {
    console.log('Testing Prisma connection...');
    await prisma.$connect();
    console.log('Connected successfully!');
    
    // Test a simple query
    const count = await prisma.signal.count();
    console.log('Signal count:', count);
    
    await prisma.$disconnect();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();