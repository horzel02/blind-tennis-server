import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

async function main() {
  console.log('🔗 RAW DATABASE_URL:', process.env.DATABASE_URL);
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('🟢 Raw MySQL2 connect OK');
    await conn.end();
  } catch (err) {
    console.error('🔴 Raw MySQL2 connect ERROR:', err);
  }
}

main();
