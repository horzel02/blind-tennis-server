// server/index.js
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import './auth.js';
import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournaments.js';
import registrationRoutes from './routes/registrations.js';
import participantsRouter from './routes/participants.js';
import tournamentUserRolesRouter from './routes/tournamentUserRoles.js';
import usersRouter from './routes/users.js';
import prisma from './prismaClient.js';

dotenv.config();

const app = express();

// 1) CORS globalnie, przed wszystkimi middleware
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'zmień_to',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'          // <- zezwala na cookie przy CORS
    // secure: true           // <- odkomentuj w prod (HTTPS)
  }
}));

app.use(passport.initialize());
app.use(passport.session());

console.log('🔗 DATABASE_URL =', process.env.DATABASE_URL?.slice(0, 30) + '…');

// test połączenia
prisma.$connect()
  .then(() => console.log('✔️ Połączono z DB'))
  .catch(e => {
    console.error('❌ Błąd DB:', e.message);
    process.exit(1);
  });

// 2) Mount tras już pod CORS-em
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/tournaments', participantsRouter);
app.use('/api/users', usersRouter);

app.use('/api/tournaments/:id/roles', tournamentUserRolesRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on port ${port}`));


vvv
