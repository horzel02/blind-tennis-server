// server/auth.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from './db.js';

// LocalStrategy po email i password
passport.use(new LocalStrategy({ usernameField: 'email' },
  async (email, password, done) => {
    try {
      const [[user]] = await db.query(
        'SELECT * FROM users WHERE email = ? AND active = 1',
        [email]
      );
      if (!user) {
        return done(null, false, { message: 'Nieprawidłowy email' });
      }
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return done(null, false, { message: 'Nieprawidłowe hasło' });
      }
      // pobierz role
      const [roles] = await db.query(
        `SELECT r.role_name
         FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ? AND r.active = 1`,
        [user.id]
      );
      user.roles = roles.map(r => r.role_name);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [[user]] = await db.query(
      'SELECT id, name, surname, email FROM users WHERE id = ? AND active = 1',
      [id]
    );
    if (!user) return done(null, false);
    const [roles] = await db.query(
      `SELECT r.role_name
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.active = 1`,
      [user.id]
    );
    user.roles = roles.map(r => r.role_name);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
