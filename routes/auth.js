// server/routes/auth.js
import prisma from '../prismaClient.js';

import { Router } from 'express';
import passport from 'passport';
import {
  register,
  login,
  logout,
  profile,
} from '../controllers/authController.js';
import { ensureAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login',
  passport.authenticate('local'),
  login
);
router.post('/logout', logout);
router.get('/profile', ensureAuth, (req, res) => {
  res.json(req.user);
});

export default router;
