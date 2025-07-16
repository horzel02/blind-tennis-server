import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config(); // Wczytaj zmienne środowiskowe, jeśli uruchamiasz lokalnie

console.log('Rozpoczynam test połączenia z bazą danych...');
console.log('DATABASE_URL (z env):', process.env.DATABASE_URL);

const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    console.log('✔️ Pomyślnie połączono z bazą danych!');
    return prisma.$disconnect(); // Rozłącz po pomyślnym połączeniu
  })
  .then(() => {
    console.log('✔️ Połączenie z bazą danych rozłączone.');
    process.exit(0); // Wyjdź z sukcesem
  })
  .catch(e => {
    console.error('❌ Błąd połączenia z bazą danych podczas testu:');
    console.error('Pełna struktura błędu:', e);
    if (e.message) console.error('Wiadomość błędu:', e.message);
    if (e.stack) console.error('Stack trace:', e.stack);
    process.exit(1); // Wyjdź z błędem
  });