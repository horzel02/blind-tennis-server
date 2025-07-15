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
  category,
  gender,
  street,
  postalCode,
  city,
  country,
  start_date,
  end_date,
  registration_deadline,
  participant_limit,
  applicationsOpen,
  organizer_id
}) {
  return prisma.tournament.create({
    data: {
      name,
      description,
      category,
      gender,
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
      organizer_id
    }
  });
}

export function updateTournament(
  id,
  {
    name,
    description,
    category,
    gender,
    street,
    postalCode,
    city,
    country,
    start_date,
    end_date,
    registration_deadline,
    participant_limit,
    applicationsOpen
  }
) {
  return prisma.tournament.update({
    where: { id: Number(id) },
    data: {
      name,
      description,
      category,
      gender,
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
      applicationsOpen
    }
  });
}

export function findAllTournaments() {
  return prisma.tournament.findMany({
    orderBy: { start_date: 'desc' }
  });
}

export function findTournamentById(id) {
  return prisma.tournament.findUnique({
    where: { id: Number(id) }
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
              userId:     Number(userId),
              role:       'organizer'
            }
          }
        }
      ]
    },
    orderBy: { start_date: 'desc' }
  });
}

