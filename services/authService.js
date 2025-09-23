// server/services/authService.js
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';

export async function registerUser({ name, surname, email, password, gender, preferredCategory }) {
  const hash = await bcrypt.hash(password, 10);

  // normalizacja i sanity-checki (bardzo lekkie – żadnych twardych blokad)
  const g = String(gender || '').toLowerCase();
  const safeGender = ['male', 'female'].includes(g) ? g : null;

  const pc = String(preferredCategory || '').toUpperCase();
  const safePrefCat = ['B1', 'B2', 'B3', 'OPEN'].includes(pc) ? pc : null;

  // 1) utwórz użytkownika
  const user = await prisma.users.create({
    data: {
      name,
      surname,
      email,
      password_hash: hash,
      gender: safeGender,
      preferredCategory: safePrefCat,
    }
  });

  // 2) pobierz rolę "player"
  const role = await prisma.roles.findFirst({
    where: { role_name: 'player', active: true }
  });

  // 3) przypisz rolę
  if (role) {
    await prisma.user_roles.create({
      data: { user_id: user.id, role_id: role.id }
    });
  }

  return user;
}
