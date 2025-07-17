import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Połączenie z bazą danych PostgreSQL (Prisma) pomyślne!');
  } catch (error) {
    console.error('❌ BLĄĄĄD połączenia z bazą danych:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();