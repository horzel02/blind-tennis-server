import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error('UNCAUGHT EXCEPTION MESSAGE:', err.message);
  console.error('UNCAUGHT EXCEPTION STACK:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  if (reason && reason.message) console.error('UNHANDLED REJECTION MESSAGE:', reason.message);
  if (reason && reason.stack) console.error('UNHANDLED REJECTION STACK:', reason.stack);
  process.exit(1);
});

console.log('Rozpoczynam test połączenia z bazą danych (node-postgres)...');
console.log('DATABASE_URL (z env):', process.env.DATABASE_URL);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Może być potrzebne, jeśli Render ma niestandardowy certyfikat
  }
});

client.connect()
  .then(() => {
    console.log('✔️ Pomyślnie połączono z bazą danych za pomocą node-postgres!');
    return client.query('SELECT NOW()'); // Proste zapytanie testowe
  })
  .then(res => {
    console.log('Wynik zapytania testowego:', res.rows[0]);
    return client.end();
  })
  .then(() => {
    console.log('✔️ Połączenie z bazą danych rozłączone.');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Błąd połączenia z bazą danych (node-postgres):');
    console.error('Pełna struktura błędu:', e);
    if (e.message) console.error('Wiadomość błędu:', e.message);
    if (e.stack) console.error('Stack trace:', e.stack);
    process.exit(1);
  });