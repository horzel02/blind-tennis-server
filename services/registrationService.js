// server/services/registrationService.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function createRegistration(tournamentId, userId) {
  return prisma.tournamentRegistration.create({
    data: {
      tournamentId,
      userId,
      status: 'pending',
    },
  });
}

export async function findByTournamentAndUser(tournamentId, userId) {
  return prisma.tournamentRegistration.findFirst({
    where: {
      tournamentId,
      userId,
    },
  });
}

export async function findById(registrationId) {
  return prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
  });
}

export async function findByIdWithUser(registrationId) {
  return prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
    },
  });
}

export async function findByUser(userId) {
  return prisma.tournamentRegistration.findMany({
    where: { userId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getRegistrationsByTournament(tournamentId) {
  return prisma.tournamentRegistration.findMany({
    where: { tournamentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function updateRegistrationStatus(registrationId, status) {
  return prisma.tournamentRegistration.update({
    where: { id: registrationId },
    data: { status },
  });
}

export async function deleteRegistration(registrationId) {
  return prisma.tournamentRegistration.delete({
    where: { id: registrationId },
  });
}

export async function countAcceptedRegistrations(tournamentId) {
  return prisma.tournamentRegistration.count({
    where: {
      tournamentId,
      status: 'accepted',
    },
  });
}

export async function findAllByUser(userId) {
  return prisma.tournamentRegistration.findMany({
    where: { userId },
    include: {
      tournament: true
    },
    orderBy: { createdAt: 'desc' }
  })
}


