// index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import './auth.js';
import pg from 'pg';
import connectPgSession from 'pg-session-store';

import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournaments.js';
import registrationRoutes from './routes/registrations.js';
import participantsRouter from './routes/participants.js';
import tournamentUserRolesRouter from './routes/tournamentUserRoles.js';
import usersRouter from './routes/users.js';
import matchRoutes from './routes/matchRoutes.js';
import matchScheduleRoutes from './routes/matchScheduleRoutes.js';
import userTimetableRoutes from './routes/userTimetableRoutes.js';
import publicUsersRouter from './routes/publicUsers.js';
import guardianRoutes from './routes/guardianRoutes.js';
import notificationsRouter, { registerNotificationSockets } from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

import prisma from './prismaClient.js';

const app = express();
const httpServer = createServer(app);
app.set('trust proxy', 1);

console.log('🛠️ cwd:', process.cwd());
console.log('🛠️ DATABASE_URL:', process.env.DATABASE_URL);

// CORS
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'].filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site has been blocked by the server: ${origin}.`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// === SESJA (wspólna dla Express i Socket.io) ===
const PgSessionStore = connectPgSession(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }),
});
const sessionStore = new PgSessionStore({ pool: pgPool, tableName: 'session' });

// >>> WYCIĄGAMY MIDDLEWARE DO ZMIENNEJ
const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Log DB
console.log('🔗 DATABASE_URL =', process.env.DATABASE_URL?.slice(0, 30) + '…');
console.log('FULL DB URL:', process.env.DATABASE_URL);

// Prisma connect
prisma
  .$connect()
  .then(() => console.log('✔️ Połączono z DB'))
  .catch((e) => {
    console.error('❌ BŁĄD Z PRISMĄ W INDEX.JS:');
    console.error('Błąd PrismaClientInitializationError:', e.name);
    console.error('Kod błędu (Prisma):', e.errorCode);
    console.error('Wiadomość błędu:', e.message);
    console.error('Stack trace:', e.stack);
  });

// === Socket.io ===
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.CLIENT_URL, 'http://localhost:5173'].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
global.__io = io;

// >>> PODPINAMY SESJĘ I PASSPORT DO SOCKET.IO
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
io.use((socket, next) =>
  passport.initialize()(socket.request, {}, () =>
    passport.session()(socket.request, {}, next)
  )
);

app.set('socketio', io);
app.set('io', io);

// === ROUTES ===
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/tournaments', participantsRouter);
app.use('/api/users', usersRouter);
app.use('/api/tournaments/:id/roles', tournamentUserRolesRouter);
app.use('/api/matches', matchRoutes);
app.use('/api', matchScheduleRoutes);
app.use('/api', userTimetableRoutes);
app.use('/api/public', publicUsersRouter);
app.use('/api/guardians', guardianRoutes);
app.use('/api/notifications', notificationsRouter)
app.use('/api/admin', adminRoutes);

registerNotificationSockets(io);

// === SOCKET HANDLERS ===
io.on('connection', (socket) => {
  const authedUser = socket.request.user || null;
  console.log('🔌 Socket connected user:', authedUser ? authedUser.id : 'anon');

  socket.on('join-match', (matchId) => {
    socket.join(`match-${parseInt(matchId, 10)}`);
  });
  socket.on('leave-match', (matchId) => {
    socket.leave(`match-${parseInt(matchId, 10)}`);
  });

  socket.on('join-tournament', (tournamentId) => {
    socket.join(`tournament-${parseInt(tournamentId, 10)}`);
  });
  socket.on('leave-tournament', (tournamentId) => {
    socket.leave(`tournament-${parseInt(tournamentId, 10)}`);
  });

  // LIVE punkty z autoryzacją
  socket.on('real-time-score-update', async (data) => {
    try {
      const userId = socket.request?.user?.id;
      if (!userId) {
        return socket.emit('error', { error: 'Nieautoryzowany' });
      }

      const matchId = parseInt(data.matchId, 10);
      if (Number.isNaN(matchId)) {
        return socket.emit('error', { error: 'Błędne matchId' });
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, refereeId: true, tournamentId: true, status: true },
      });
      if (!match) {
        return socket.emit('error', { error: 'Mecz nie znaleziono' });
      }

      // czy sędzia tego meczu?
      const isReferee = match.refereeId === userId;
      // albo organizer turnieju?
      const isOrganizer = !!(await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: match.tournamentId, userId, role: 'organizer' },
        select: { id: true },
      }));

      if (!isReferee && !isOrganizer) {
        return socket.emit('error', { error: 'Brak uprawnień do live wyniku' });
      }

      // autoryzowany → emit aktualizacji do pokoju meczu
      io.to(`match-${matchId}`).emit('real-time-score-update', data);

      // podniesienie statusu do in_progress (pierwsza akcja)
      if (match.status === 'scheduled') {
        await prisma.match.update({
          where: { id: matchId },
          data: { status: 'in_progress', updatedAt: new Date() },
        });
        io.to(`tournament-${match.tournamentId}`).emit('match-status-changed', {
          matchId,
          status: 'in_progress',
        });
      }
    } catch (e) {
      console.error('real-time-score-update error:', e);
      socket.emit('error', { error: 'Błąd serwera' });
    }
  });
});

const port = process.env.PORT || 5000;
httpServer.listen(port, () => console.log(`Server on port ${port}`));
