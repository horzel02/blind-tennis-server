// index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import './auth.js';
import pg from 'pg';
import connectPgSession from 'pg-session-store';

import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournaments.js';
import registrationRoutes from './routes/registrations.js';
import participantsRouter from './routes/participants.js';
import tournamentUserRolesRouter from './routes/tournamentUserRoles.js';
import usersRouter from './routes/users.js';

import prisma from './prismaClient.js';

const app = express();
app.set('trust proxy', 1);

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
      const msg = `The CORS policy for this site has been blocked by the server: ${origin}.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const PgSessionStore = connectPgSession(session);

// KONFIGURACJA sesji z pg-session-store
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? false : true
  }
});

const sessionStore = new PgSessionStore({
  pool: pgPool, // <-- Tutaj pgPool jest już zdefiniowane
  tableName: 'session'
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'none'
  }
}));

app.use((req, res, next) => {
  console.log('DEBUG: Stan req.session PRZED Passport.js:');
  console.log('DEBUG:   req.sessionID:', req.sessionID);
  console.log('DEBUG:   req.session (cały obiekt):', JSON.stringify(req.session, null, 2));
  console.log('DEBUG:   req.session.passport istnieje (PRZED Passport.js):', !!req.session.passport);
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  console.log('DEBUG: Stan req.session PO Passport.js:');
  console.log('DEBUG:   req.sessionID:', req.sessionID);
  console.log('DEBUG:   req.session (cały obiekt - PO Passport.js):', JSON.stringify(req.session, null, 2));
  console.log('DEBUG:   req.user (PO Passport.js):', JSON.stringify(req.user, null, 2));
  console.log('DEBUG:   req.isAuthenticated() (PO Passport.js):', req.isAuthenticated());
  next();
});

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