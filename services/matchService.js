// server/services/matchService.js
import prisma from '../prismaClient.js';

/**
 * Pobiera mecze dla danego turnieju, z opcjonalnym filtrowaniem po statusie.
 */
export async function getMatchesByTournamentId(tournamentId, status) {
  const whereClause = {
    tournamentId: parseInt(tournamentId, 10),
  };
  if (status) {
    whereClause.status = status;
  }
  return prisma.match.findMany({
    where: whereClause,
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      category: { select: { categoryName: true, gender: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      matchSets: true,
    },
    orderBy: { round: 'asc' },
  });
}

/**
 * Pobiera jeden mecz po ID.
 */
export async function getMatchById(matchId) {
  return prisma.match.findUnique({
    where: { id: parseInt(matchId, 10) },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      winner:  { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      category: true,
      tournament: true,
      matchSets: { orderBy: { setNumber: 'asc' } } // <- TO BYŁO BRAK
    },
  });
};

/**
 * Generuje mecze w grupach i pustą drabinkę turniejową.
 */
export async function generateGroupAndKnockoutMatches(tournamentId) {
  const tId = parseInt(tournamentId, 10);
  const playersPerGroup = 4; // Zmieniono: stała liczba graczy w grupie

  const acceptedPlayers = await prisma.tournamentregistration.findMany({
    where: {
      tournamentId: tId,
      status: 'accepted',
    },
    select: {
      userId: true,
    },
  });

  const playerIds = acceptedPlayers.map(p => p.userId);
  
  if (playerIds.length < 4 || playerIds.length % playersPerGroup !== 0) {
    throw new Error(`Aby utworzyć grupy, potrzeba wielokrotności ${playersPerGroup} graczy (min. 4).`);
  }

  const numberOfGroups = playerIds.length / playersPerGroup;

  playerIds.sort(() => Math.random() - 0.5);

  let category = await prisma.tournamentCategory.findFirst({ where: { tournamentId: tId } });
  if (!category) {
    category = await prisma.tournamentCategory.create({
      data: { tournamentId: tId, categoryName: 'Open', gender: 'male' },
    });
  }

  await prisma.match.deleteMany({ where: { tournamentId: tId } });

  const matchesToCreate = [];

  for (let g = 0; g < numberOfGroups; g++) {
    const groupName = `Grupa ${String.fromCharCode(65 + g)}`;
    
    matchesToCreate.push({
      tournamentId: tId,
      player1Id: null,
      player2Id: null,
      tournamentCategoryId: category.id,
      round: groupName,
      status: 'header',
    });
    
    const groupPlayers = playerIds.slice(g * playersPerGroup, (g + 1) * playersPerGroup);
    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        matchesToCreate.push({
          tournamentId: tId,
          player1Id: groupPlayers[i],
          player2Id: groupPlayers[j],
          tournamentCategoryId: category.id,
          round: groupName,
          status: 'scheduled',
        });
      }
    }
  }
  
  if (playerIds.length >= 8) {
    const knockoutMatchesToCreate = [
        { tournamentId: tId, tournamentCategoryId: category.id, round: 'Ćwierćfinał 1', status: 'scheduled' },
        { tournamentId: tId, tournamentCategoryId: category.id, round: 'Ćwierćfinał 2', status: 'scheduled' },
        { tournamentId: tId, tournamentCategoryId: category.id, round: 'Półfinał 1', status: 'scheduled' },
        { tournamentId: tId, tournamentCategoryId: category.id, round: 'Półfinał 2', status: 'scheduled' },
        { tournamentId: tId, tournamentCategoryId: category.id, round: 'Finał', status: 'scheduled' },
    ];
    matchesToCreate.push(...knockoutMatchesToCreate);
  }

  if (matchesToCreate.length > 0) {
    await prisma.$transaction(async (tx) => {
        await tx.match.createMany({ data: matchesToCreate });
    });
    return { count: matchesToCreate.length };
  }
  
  return { count: 0 };
}

/**
 * Aktualizuje wyniki meczu, wstawiając wyniki setów i wyłaniając zwycięzcę.
 * @param {string} matchId ID meczu do zaktualizowania.
 * @param {Object} updateData Obiekt z danymi do aktualizacji, w tym tablica sets.
 * @returns {Promise<Object>} Zaktualizowany obiekt meczu.
 */
export async function updateMatchScore(matchId, { status, winnerId, matchSets }) {
  try {
    const result = await prisma.$transaction(async (prisma) => {
      const match = await prisma.match.findUnique({
        where: { id: parseInt(matchId) },
      });

      if (!match) {
        throw new Error('Match not found');
      }

      // Usuń stare wyniki setów, jeśli istnieją, aby uniknąć duplikatów
      await prisma.matchSet.deleteMany({
        where: { matchId: parseInt(matchId) },
      });

      // Wstaw nowe wyniki setów
      await prisma.matchSet.createMany({
        data: matchSets.map((set, index) => ({
          matchId: parseInt(matchId),
          setNumber: index + 1,
          player1Score: set.player1Score,
          player2Score: set.player2Score,
        })),
      });

      const updatedMatch = await prisma.match.update({
        where: { id: parseInt(matchId) },
        data: {
          status: status,
          winnerId: winnerId,
          updatedAt: new Date(),
        },
        include: {
          matchSets: true,
          player1: { select: { id: true, name: true, surname: true } },
          player2: { select: { id: true, name: true, surname: true } },
          winner: { select: { id: true, name: true, surname: true } },
        },
      });

      return updatedMatch;
    });

    return result;
  } catch (error) {
    console.error('Error updating match score:', error);
    throw error;
  }
}

export async function setMatchReferee(matchId, refereeId) {
  const id = parseInt(matchId, 10);
  const refId = refereeId !== null && refereeId !== undefined ? parseInt(refereeId, 10) : null;

  if (refId) {
    const exists = await prisma.users.findUnique({ where: { id: refId }, select: { id: true } });
    if (!exists) throw new Error('Użytkownik (sędzia) nie istnieje');
  }

  const updated = await prisma.match.update({
    where: { id },
    data: { refereeId: refId, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner:  { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });

  return updated;
}
