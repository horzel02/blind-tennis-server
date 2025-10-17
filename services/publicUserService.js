import prisma from '../prismaClient.js';

function todayISODate() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

export async function getPublicProfile(userId) {
  // 1) podstawowe dane użytkownika (bez maila itp.)
  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      name: true,
      surname: true,
      gender: true,
      preferredCategory: true,
    },
  });
  if (!user) return null;

  // 2) statystyki (zakończone mecze jako zawodnik)
  const matchesFinished = await prisma.match.count({
    where: {
      status: 'finished',
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
  });

  const wins = await prisma.match.count({
    where: {
      status: 'finished',
      winnerId: userId,
    },
  });

  const losses = Math.max(0, matchesFinished - wins);
  const winRate = matchesFinished > 0 ? Number(((wins / matchesFinished) * 100).toFixed(1)) : 0;

  // 3) sędziowane mecze (weźmy wszystkie zaplanowane/finished)
  const matchesAsReferee = await prisma.match.count({
    where: { refereeId: userId },
  });

  // 4) nadchodzące: jako zawodnik (zaakceptowane/pending) + start_date >= dziś
  const upcomingAsPlayer = await prisma.tournamentregistration.findMany({
    where: {
      userId: userId,
      status: { in: ['accepted', 'pending'] },
      tournament: { start_date: { gte: todayISODate() } },
    },
    select: {
      tournament: {
        select: {
          id: true, name: true, start_date: true, city: true,
          // jeśli masz slug w schemacie turnieju → dorzuć
        },
      },
    },
    orderBy: [{ tournament: { start_date: 'asc' } }],
    take: 5,
  });

  // 5) nadchodzące: jako sędzia (matchTime >= teraz)
  const upcomingAsReferee = await prisma.match.findMany({
    where: {
      refereeId: userId,
      matchTime: { gte: new Date() },
    },
    select: {
      id: true,
      matchTime: true,
      round: true,
      tournament: { select: { id: true, name: true } },
    },
    orderBy: { matchTime: 'asc' },
    take: 5,
  });

  // 6) timeline (ostatnie 12 zdarzeń: mecze jako zawodnik finished, mecze jako sędzia finished lub scheduled)
  const recentPlayerMatches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      // pokażmy głównie zakończone; jak chcesz, możesz dodać scheduled z przeszłości
      status: 'finished',
    },
    select: {
      id: true,
      matchTime: true,
      round: true,
      status: true,
      winnerId: true,
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      tournament: { select: { id: true, name: true } },
      matchSets: { select: { setNumber: true, player1Score: true, player2Score: true } },
    },
    orderBy: { matchTime: 'desc' },
    take: 12,
  });

  const recentRefMatches = await prisma.match.findMany({
    where: { refereeId: userId },
    select: {
      id: true,
      matchTime: true,
      round: true,
      status: true,
      tournament: { select: { id: true, name: true } },
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      matchSets: { select: { setNumber: true, player1Score: true, player2Score: true } },
    },
    orderBy: { matchTime: 'desc' },
    take: 12,
  });

  // zlep timeline
  const timelineRaw = [
    ...recentPlayerMatches.map(m => ({
      date: m.matchTime || null,
      role: 'player',
      type: 'match',
      tournament: m.tournament,
      round: m.round,
      status: m.status,
      players: [m.player1, m.player2],
      winnerId: m.winnerId,
      score: formatScore(m.matchSets),
    })),
    ...recentRefMatches.map(m => ({
      date: m.matchTime || null,
      role: 'referee',
      type: 'match',
      tournament: m.tournament,
      round: m.round,
      status: m.status,
      players: [m.player1, m.player2],
      score: formatScore(m.matchSets),
    })),
  ]
  .filter(x => x.date)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 12);

  // 7) ile turniejów łącznie (rola dowolna)
  // bierzemy distinct tournamentId z rejestracji, meczów (jako player/ref), oraz ról w turnieju (organizer)
  const [regs, playerMatches, refMatches, roles] = await Promise.all([
    prisma.tournamentregistration.findMany({
      where: { userId: userId },
      select: { tournamentId: true },
    }),
    prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }] },
      select: { tournamentId: true },
    }),
    prisma.match.findMany({
      where: { refereeId: userId },
      select: { tournamentId: true },
    }),
    prisma.tournamentuserrole.findMany({
      where: { userId: userId },
      select: { tournamentId: true },
    }),
  ]);
  const tSet = new Set([
    ...regs.map(x => x.tournamentId),
    ...playerMatches.map(x => x.tournamentId),
    ...refMatches.map(x => x.tournamentId),
    ...roles.map(x => x.tournamentId),
  ].filter(Boolean));
  const tournamentsTotal = tSet.size;

  // ===== out =====
  return {
    user: {
      id: user.id,
      name: user.name,
      surname: user.surname,
      preferredCategory: user.preferredCategory,
      gender: user.gender,
    },
    summary: {
      tournamentsTotal,
      matchesAsPlayer: matchesFinished,
      wins,
      losses,
      winRate,
      matchesAsReferee,
    },
    upcoming: {
      asPlayer: upcomingAsPlayer.map(x => ({
        id: x.tournament.id,
        name: x.tournament.name,
        start_date: x.tournament.start_date,
        city: x.tournament.city,
      })),
      asReferee: upcomingAsReferee.map(m => ({
        id: m.id,
        tournamentId: m.tournament.id,
        tournamentName: m.tournament.name,
        matchTime: m.matchTime,
        round: m.round,
      })),
    },
    timeline: timelineRaw,
  };
}

function formatScore(sets = []) {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  // posortuj po numerze seta
  const s = [...sets].sort((a,b) => a.setNumber - b.setNumber);
  return s.map(x => `${x.player1Score}:${x.player2Score}`).join(' ');
}
