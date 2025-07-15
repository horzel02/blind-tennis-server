// server/services/authService.js
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';

export async function registerUser({ name, surname, email, password }) {
  const hash = await bcrypt.hash(password, 10);

  // 1) utwórz użytkownika
  const user = await prisma.users.create({
    data: { name, surname, email, password_hash: hash }
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
