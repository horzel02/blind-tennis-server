// index.js
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

import prisma from './prismaClient.js';

const app = express();

console.log('🛠️ cwd:', process.cwd());
console.log('🛠️ DATABASE_URL:', process.env.DATABASE_URL);

// Konfiguracja CORS 
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
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
    console.error('❌ BŁĄD Z PRISMĄ W INDEX.JS:');
    console.error('Błąd PrismaClientInitializationError:', e.name);
    console.error('Kod błędu (Prisma):', e.errorCode);
    console.error('Wiadomość błędu:', e.message);
    console.error('Stack trace:', e.stack);
    console.error('Pełny obiekt błędu (console.dir):');
    console.dir(e, { depth: null });
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