// server/controllers/authController.js
import * as authService from '../services/authService.js';

export async function register(req, res) {
  try {
    const { name, surname, email, password } = req.body;
    if (!name || !surname || !email || !password) {
      return res.status(400).json({ error: 'Brakuje wymaganych pól' });
    }
    await authService.registerUser(req.body);
    res.status(201).json({ message: 'Zarejestrowano pomyślnie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd przy rejestracji' });
  }
}

export function login(req, res) {
  const { id, name, surname, email, roles } = req.user;
  res.json({ id, name, surname, email, roles });
}

export function logout(req, res, next) {
  req.logout(err => {
    if (err) return next(err);
    res.json({ message: 'Wylogowano' });
  });
}

export function profile(req, res) {
  const { id, name, surname, email, roles } = req.user;
  res.json({ id, name, surname, email, roles });
}
