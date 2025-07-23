// server/routes/auth.js
import { Router } from 'express';
import passport from 'passport';
import { register, logout, profile } from '../controllers/authController.js';
import { ensureAuth } from '../middlewares/auth.js';

const router = Router();
router.post('/register', register);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    // Dodatkowe logi do debugowania
    console.log('DEBUG: --- Rozpoczęcie callbacku passport.authenticate ---');
    console.log('DEBUG: err (z Passport.js):', err);
    console.log('DEBUG: user (z Passport.js):', user); // Sprawdź, czy to jest 'false' lub 'null'
    console.log('DEBUG: info (z Passport.js):', info);

    if (err) {
      console.error("Błąd uwierzytelniania (LocalStrategy callback):", err);
      return next(err);
    }
    if (!user) { // Ten blok powinien być wykonywany dla błędnych haseł
      console.log("Logowanie nieudane (LocalStrategy callback):", info.message);
      return res.status(401).json({ message: info.message || 'Logowanie nieudane.' });
    }

    // Jeśli wykonanie dojdzie do tego miejsca, to 'user' NIE jest 'false'.
    console.log('DEBUG: Uwierzytelnienie Passport.js zakończone sukcesem dla użytkownika:', user.id, user.email);

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
    console.log('DEBUG: --- Zakończenie callbacku passport.authenticate ---');
  })(req, res, next);
});

router.post('/logout', logout);
router.get('/profile', ensureAuth, (req, res) => {
  res.json(req.user);
});

export default router;