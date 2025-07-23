// server/services/tournamentUserRoleService.js
import prisma from '../prismaClient.js';

export async function addRole(tournamentId, userId, role) {
  return prisma.tournamentuserrole.create({
    data: { tournamentId, userId, role }
  });
}

export async function removeRoleById(roleRecordId) {
  return prisma.tournamentuserrole.delete({
    where: { id: roleRecordId }
  });
}

export async function getRolesForTournament(tournamentId) {
  return prisma.tournamentuserrole.findMany({
    where: { tournamentId },
    include: {
      user: { select: { id: true, name: true, surname: true, email: true } }
    }
  });
}

export async function getRolesForUser(userId) {
  return prisma.tournamentuserrole.findMany({
    where: { userId },
    include: {
      tournament: { select: { id: true, name: true } }
    }
  });
}
