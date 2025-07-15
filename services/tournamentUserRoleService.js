// server/services/tournamentUserRoleService.js
import prisma from '../prismaClient.js';

export async function addRole(tournamentId, userId, role) {
  return prisma.tournamentUserRole.create({
    data: { tournamentId, userId, role }
  });
}

export async function removeRoleById(roleRecordId) {
  return prisma.tournamentUserRole.delete({
    where: { id: roleRecordId }
  });
}

export async function getRolesForTournament(tournamentId) {
  return prisma.tournamentUserRole.findMany({
    where: { tournamentId },
    include: {
      user: { select: { id: true, name: true, surname: true, email: true } }
    }
  });
}

export async function getRolesForUser(userId) {
  return prisma.tournamentUserRole.findMany({
    where: { userId },
    include: {
      tournament: { select: { id: true, name: true } }
    }
  });
}
