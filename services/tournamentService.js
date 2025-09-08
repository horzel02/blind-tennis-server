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

  // NEW — opcjonalne, używamy jeśli przyszły (w DB masz defaulty)
  format,
  groupSize,
  qualifiersPerGroup,
  allowByes,
  koSeedingPolicy,
  avoidSameGroupInR1
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
      registration_deadline: registration_deadline ? parseDate(registration_deadline) : null,
      participant_limit: participant_limit ? Number(participant_limit) : null,
      applicationsOpen,
      organizer_id,
      isGroupPhase,
      setsToWin,
      gamesPerSet,
      tieBreakType,

      // NEW: tylko jeśli podane (w przeciwnym razie zadziałają defaulty z DB)
      ...(format               ? { format } : {}),
      ...(groupSize            ? { groupSize: Number(groupSize) } : {}),
      ...(qualifiersPerGroup   ? { qualifiersPerGroup: Number(qualifiersPerGroup) } : {}),
      ...(typeof allowByes === 'boolean' ? { allowByes } : {}),
      ...(koSeedingPolicy      ? { koSeedingPolicy } : {}),
      ...(typeof avoidSameGroupInR1 === 'boolean' ? { avoidSameGroupInR1 } : {}),

      categories: {
        create: categoriesToCreate,
      },
      tournamentUserRoles: {
        create: { userId: organizer_id, role: 'organizer' }
      }
    },
    include: { categories: true },
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

    // NEW
    format,
    groupSize,
    qualifiersPerGroup,
    allowByes,
    koSeedingPolicy,
    avoidSameGroupInR1
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
      registration_deadline: registration_deadline ? parseDate(registration_deadline) : undefined,
      participant_limit: typeof participant_limit !== 'undefined'
        ? (participant_limit === null ? null : Number(participant_limit))
        : undefined,
      applicationsOpen,
      isGroupPhase,
      setsToWin,
      gamesPerSet,
      tieBreakType,

      // NEW — aktualizuj tylko gdy pole przyszło (unikamy nadpisów null/undefined)
      ...(typeof format !== 'undefined' ? { format } : {}),
      ...(typeof groupSize !== 'undefined' ? { groupSize: groupSize === null ? null : Number(groupSize) } : {}),
      ...(typeof qualifiersPerGroup !== 'undefined' ? { qualifiersPerGroup: qualifiersPerGroup === null ? null : Number(qualifiersPerGroup) } : {}),
      ...(typeof allowByes !== 'undefined' ? { allowByes } : {}),
      ...(typeof koSeedingPolicy !== 'undefined' ? { koSeedingPolicy } : {}),
      ...(typeof avoidSameGroupInR1 !== 'undefined' ? { avoidSameGroupInR1 } : {}),

      categories: {
        deleteMany: {},
        create: categories.map(cat => ({
          categoryName: cat.category,
          gender: cat.gender,
        })),
      },
    },
    include: { categories: true },
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
  return prisma.tournament.delete({ where: { id: Number(id) } });
}

export function findTournamentsByOrganizer(userId) {
  return prisma.tournament.findMany({
    where: {
      OR: [
        { organizer_id: Number(userId) },
        { tournamentUserRoles: { some: { userId: Number(userId), role: 'organizer' } } }
      ]
    },
    include: { categories: true, tournamentUserRoles: true },
    orderBy: { start_date: 'desc' }
  });
}

export async function getTournamentSettings(tournamentId) {
  const id = Number(tournamentId);
  const t = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      // nowe ustawienia
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      allowByes: true,
      koSeedingPolicy: true,
      avoidSameGroupInR1: true,
      // pomocnicze
      participant_limit: true,
      applicationsOpen: true,
      isGroupPhase: true,
    },
  });
  if (!t) throw new Error('Turniej nie istnieje');
  return t;
}

export async function updateTournamentSettings(tournamentId, payload) {
  const id = Number(tournamentId);

  const allowedFormat = new Set(['GROUPS_KO', 'KO_ONLY']);
  const allowedPolicy = new Set(['RANDOM_CROSS', 'STRUCTURED']);

  const data = {};
  if (payload.format != null) {
    if (!allowedFormat.has(payload.format)) throw new Error('Nieprawidłowy format');
    data.format = payload.format;
  }
  if (payload.groupSize != null) {
    const gs = Number(payload.groupSize);
    if (![3, 4].includes(gs)) throw new Error('groupSize musi być 3 lub 4');
    data.groupSize = gs;
  }
  if (payload.qualifiersPerGroup != null) {
    const q = Number(payload.qualifiersPerGroup);
    if (![1, 2].includes(q)) throw new Error('qualifiersPerGroup musi być 1 lub 2');
    data.qualifiersPerGroup = q;
  }
  if (payload.allowByes != null) data.allowByes = !!payload.allowByes;

  if (payload.koSeedingPolicy != null) {
    if (!allowedPolicy.has(payload.koSeedingPolicy)) throw new Error('Nieprawidłowa polityka rozstawiania');
    data.koSeedingPolicy = payload.koSeedingPolicy;
  }
  if (payload.avoidSameGroupInR1 != null) data.avoidSameGroupInR1 = !!payload.avoidSameGroupInR1;

  if (payload.participant_limit !== undefined) {
    data.participant_limit = payload.participant_limit === null ? null : Number(payload.participant_limit);
  }
  if (payload.applicationsOpen !== undefined) {
    data.applicationsOpen = !!payload.applicationsOpen;
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { ...data, updated_at: new Date() },
    select: {
      id: true,
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      allowByes: true,
      koSeedingPolicy: true,
      avoidSameGroupInR1: true,
      participant_limit: true,
      applicationsOpen: true,
    },
  });

  return updated;
}


async function getTournamentBasic(tournamentId) {
  const t = await prisma.tournament.findUnique({
    where: { id: Number(tournamentId) },
    select: {
      id: true,
      participant_limit: true,
      applicationsOpen: true,
      registration_deadline: true,
    },
  });
  if (!t) throw new Error('Turniej nie istnieje');
  return t;
}

async function countAccepted(tournamentId) {
  const n = await prisma.tournamentregistration.count({
    where: { tournamentId: Number(tournamentId), status: 'accepted' },
  });
  return n;
}

function isAfterDeadline(t) {
  return t.registration_deadline && new Date() > new Date(t.registration_deadline);
}

async function assertRegistrationOpenAndCapacity(tournamentId) {
  const t = await getTournamentBasic(tournamentId);
  if (!t.applicationsOpen) throw new Error('Rejestracja na turniej jest zamknięta');
  if (isAfterDeadline(t)) throw new Error('Minął termin rejestracji');

  if (t.participant_limit != null) {
    const accepted = await countAccepted(tournamentId);
    if (accepted >= t.participant_limit) {
      // defensywnie domknij, żeby FE widział aktualny stan
      await prisma.tournament.update({
        where: { id: Number(tournamentId) },
        data: { applicationsOpen: false, updated_at: new Date() },
      });
      throw new Error('Osiągnięto limit uczestników');
    }
  }
}

// >>> Podmiana istniejącej funkcji rejestracji (jeśli masz inną nazwę – zachowaj swoją)
export async function registerForTournament(tournamentId, userId) {
  await assertRegistrationOpenAndCapacity(tournamentId);

  // sprawdź duplikat
  const exists = await prisma.tournamentregistration.findFirst({
    where: { tournamentId: Number(tournamentId), userId: Number(userId) },
  });
  if (exists) throw new Error('Już zgłosiłeś się do tego turnieju');

  return prisma.tournamentregistration.create({
    data: {
      tournamentId: Number(tournamentId),
      userId: Number(userId),
      status: 'pending', // albo 'accepted' – jeśli tak masz w logice; limit i tak broni
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

// >>> Podmiana istniejącej funkcji zmiany statusu
export async function updateRegistrationStatus(registrationId, status) {
  const reg = await prisma.tournamentregistration.findUnique({
    where: { id: Number(registrationId) },
    select: { id: true, tournamentId: true, status: true },
  });
  if (!reg) throw new Error('Zgłoszenie nie istnieje');

  // przy akceptacji pilnuj limitu
  if (status === 'accepted') {
    await assertRegistrationOpenAndCapacity(reg.tournamentId);
  }

  const updated = await prisma.tournamentregistration.update({
    where: { id: reg.id },
    data: { status, updated_at: new Date() },
  });

  // po akceptacji – jeśli właśnie domknęliśmy limit, zamknij zapisy
  if (status === 'accepted') {
    const t = await getTournamentBasic(reg.tournamentId);
    if (t.participant_limit != null) {
      const accepted = await countAccepted(reg.tournamentId);
      if (accepted >= t.participant_limit && t.applicationsOpen) {
        await prisma.tournament.update({
          where: { id: t.id },
          data: { applicationsOpen: false, updated_at: new Date() },
        });
      }
    }
  }

  return updated;
}