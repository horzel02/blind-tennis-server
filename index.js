import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import './auth.js';

import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournaments.js';
import registrationRoutes from './routes/registrations.js';
import participantsRouter from './routes/participants.js';
import tournamentUserRolesRouter from './routes/tournamentUserRoles.js';
import usersRouter from './routes/users.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import prisma from './prismaClient.js';

const app = express();

console.log('🛠️ cwd:', process.cwd());
console.log('🛠️ DATABASE_URL:', process.env.DATABASE_URL);

// CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'zmień_to',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use(passport.initialize());
app.use(passport.session());

// Wyświetl URL z .env (wersja skrócona i pełna dla logów)
console.log('🔗 DATABASE_URL =', process.env.DATABASE_URL?.slice(0, 30) + '…');
console.log('FULL DB URL:', process.env.DATABASE_URL);

// Test połączenia z bazą danych
prisma.$connect()
  .then(() => console.log('✔️ Połączono z DB'))
   .catch(e => {
  console.error('❌ Pełny błąd połączenia z bazą:');
  try {
    console.error('Szczegóły błędu (JSON):', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
  } catch (jsonError) {
    console.error('Szczegóły błędu (String):', String(e));
  }
  if (e.message) console.error('Message:', e.message);
  process.exit(1);
});

// Ścieżki API
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/tournaments', participantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/tournaments/:id/roles', tournamentUserRolesRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on port ${port}`));
