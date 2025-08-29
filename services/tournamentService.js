// server/services/tournamentService.js
import prisma from '../prismaClient.js';

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Nieprawidłowa data: ${dateStr}`);
  }
  return d;
}

export function createTournament({
  name,
  description,
  street,
  postalCode,
  city,
  country,
  start_date,
  end_date,
  registration_deadline,
  participant_limit,
  applicationsOpen,
  isGroupPhase,
  setsToWin,
  gamesPerSet,
  tieBreakType,
  organizer_id,
  categories,
}) {
  const categoriesToCreate = categories.map(cat => ({
    categoryName: cat.category,
    gender: cat.gender,
  }));

  return prisma.tournament.create({
    data: {
      name,
      description,
      street,
      postalCode,
      city,
      country,
      start_date: parseDate(start_date),
      end_date: parseDate(end_date),
      registration_deadline: registration_deadline
        ? parseDate(registration_deadline)
        : null,
      participant_limit: participant_limit
        ? Number(participant_limit)
        : null,
      applicationsOpen,
      organizer_id,
      isGroupPhase,
      setsToWin,
      gamesPerSet,
      tieBreakType,
      categories: {
        create: categoriesToCreate,
      },
      tournamentUserRoles: {
        create: {
          userId: organizer_id,
          role: 'organizer'
        }
      }
    },
    include: {
      categories: true,
    }
  });
}

export function updateTournament(
  id,
  {
    name,
    description,
    street,
    postalCode,
    city,
    country,
    start_date,
    end_date,
    registration_deadline,
    participant_limit,
    applicationsOpen,
    isGroupPhase,
    setsToWin,
    gamesPerSet,
    tieBreakType,
    categories,
  }
) {
  return prisma.tournament.update({
    where: { id: Number(id) },
    data: {
      name,
      description,
      street,
      postalCode,
      city,
      country,
      start_date: start_date ? parseDate(start_date) : undefined,
      end_date: end_date ? parseDate(end_date) : undefined,
      registration_deadline: registration_deadline
        ? parseDate(registration_deadline)
        : undefined,
      participant_limit: participant_limit
        ? Number(participant_limit)
        : undefined,
      applicationsOpen: applicationsOpen,
      isGroupPhase,
      setsToWin,
      gamesPerSet,
      tieBreakType,
      categories: {
        deleteMany: {},
        create: categories.map(cat => ({
          categoryName: cat.category,
          gender: cat.gender,
        })),
      },
    },
    include: {
      categories: true,
    },
  });
}

export function findAllTournaments() {
  return prisma.tournament.findMany({
    orderBy: { start_date: 'desc' },
    include: { categories: true }
  });
}

export function findTournamentById(id) {
  return prisma.tournament.findUnique({
    where: { id: Number(id) },
    include: { categories: true }
  });
}

export function deleteTournament(id) {
  return prisma.tournament.delete({
    where: { id: Number(id) }
  });
}

export function findTournamentsByOrganizer(userId) {
  return prisma.tournament.findMany({
    where: {
      OR: [
        { organizer_id: Number(userId) },
        {
          tournamentUserRoles: {
            some: {
              userId: Number(userId),
              role: 'organizer'
            }
          }
        }
      ]
    },
    include: {
      categories: true,
      tournamentUserRoles: true,
    },
    orderBy: { start_date: 'desc' }
  });
}