// server/routes/auth.js
import { Router } from 'express';
import passport from 'passport';
import { register, logout, profile } from '../controllers/authController.js';
import { ensureAuth } from '../middlewares/auth.js';

const router = Router();
router.post('/register', register);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error("Błąd uwierzytelniania (LocalStrategy callback):", err);
      return next(err);
    }
    if (!user) {
      console.log("Logowanie nieudane (LocalStrategy callback):", info.message);
      return res.status(401).json({ message: info.message || 'Logowanie nieudane.' });
    }

    req.login(user, (err) => {
      if (err) {
        console.error("Błąd podczas req.login:", err);
        return next(err);
      }
      const { password_hash, ...userData } = user;
      console.log('DEBUG: Użytkownik pomyślnie zalogowany poprzez req.login, ID:', userData.id, 'Email:', userData.email);
      return res.status(200).json({
        message: 'Zalogowano pomyślnie!',
        user: userData
      });
    });
  })(req, res, next);
});

router.post('/logout', logout);
router.get('/profile', ensureAuth, (req, res) => {
  res.json(req.user);
});

export default router;