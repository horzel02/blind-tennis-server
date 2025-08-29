// server/routes/auth.js
import { Router } from 'express';
import passport from 'passport';
import { register, logout } from '../controllers/authController.js';
import { ensureAuth } from '../middlewares/auth.js';
import prisma from '../prismaClient.js';

const router = Router();
router.post('/register', register);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: true }, async (err, user, info) => {
    // Sprawdzenie, czy wystąpił błąd serwera
    if (err) {
      console.error("Błąd serwera podczas uwierzytelniania:", err);
      return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera podczas logowania.' });
    }

    // Sprawdzenie, czy użytkownik został znaleziony i uwierzytelniony
    if (!user) {
      // Logowanie nieudane, zwróć 401 z komunikatem JSON
      console.log("Nieudane logowanie:", info.message);
      return res.status(401).json({ success: false, message: info.message || 'Niepoprawny e-mail lub hasło.' });
    }

    // Jeśli uwierzytelnienie się udało, zaloguj użytkownika
    req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error("Błąd podczas req.login:", loginErr);
        return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera podczas tworzenia sesji.' });
      }

      try {
        // Uwierzytelnienie powiodło się, zwróć dane użytkownika w formacie JSON
        const userWithRoles = await prisma.users.findUnique({
          where: { id: user.id },
          include: {
            tournamentUserRoles: true,
          }
        });

        // Tworzymy uproszczony obiekt użytkownika do wysłania na front
        const simplifiedUser = {
          id: userWithRoles.id,
          name: userWithRoles.name,
          surname: userWithRoles.surname,
          email: userWithRoles.email,
          roles: userWithRoles.tournamentUserRoles.map(role => role.role),
        };
        
        console.log('Pomyślnie zalogowano użytkownika:', simplifiedUser.email);
        return res.status(200).json({ success: true, user: simplifiedUser });
      } catch (dbErr) {
        console.error("Błąd pobierania danych użytkownika po logowaniu:", dbErr);
        return res.status(500).json({ success: false, message: 'Nie udało się pobrać danych użytkownika.' });
      }
    });
  })(req, res, next);
});

router.post('/logout', logout);

router.get('/profile', ensureAuth, async (req, res) => {
    try {
        const userWithRoles = await prisma.users.findUnique({
            where: { id: req.user.id },
            include: {
                tournamentUserRoles: true,
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ message: 'Użytkownik nie znaleziony.' });
        }

        const simplifiedUser = {
            id: userWithRoles.id,
            name: userWithRoles.name,
            surname: userWithRoles.surname,
            email: userWithRoles.email,
            roles: userWithRoles.tournamentUserRoles.map(role => role.role),
        };

        res.json(simplifiedUser);
    } catch (error) {
        console.error("Błąd podczas pobierania profilu użytkownika:", error);
        res.status(500).json({ message: 'Błąd podczas pobierania profilu użytkownika.' });
    }
});

export default router;