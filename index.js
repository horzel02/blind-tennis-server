// index.js

// Globalne handlery błędów - muszą być na samym początku, aby przechwycić jak najwięcej błędów
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION: Aplikacja zakończyła działanie z nieprzechwyconym wyjątkiem!');
  console.error('Błąd:', err);
  console.error('Wiadomość błędu:', err.message);
  console.error('Stack trace:', err.stack);
  process.exit(1); // Ważne: Wyjście z procesem po nieprzechwyconym błędzie
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION: Aplikacja zakończyła działanie z nieobsłużonym odrzuceniem obietnicy!');
  console.error('Przyczyna:', reason);
  if (reason && reason.message) console.error('Wiadomość przyczyny:', reason.message);
  if (reason && reason.stack) console.error('Stack trace przyczyny:', reason.stack);
  console.error('Obietnica:', promise);
  process.exit(1); // Ważne: Wyjście z procesem po nieobsłużonym odrzuceniu
});

// --- Poniżej rozpoczyna się reszta Twojego kodu ---

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

// Tymczasowe wyłączenie weryfikacji certyfikatów TLS dla Node.js
// Pamiętaj: NIEBEZPIECZNE w środowisku produkcyjnym bez odpowiedniego zabezpieczenia!
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
    console.error('❌ Błąd połączenia z bazą danych. Szczegóły:');
    console.error('Pełna struktura błędu (z catch):', e);
    if (e.message) console.error('Wiadomość błędu (z catch):', e.message);
    if (e.stack) console.error('Stack trace (z catch):', e.stack);
    process.exit(1); // Zakończ proces w przypadku błędu połączenia
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