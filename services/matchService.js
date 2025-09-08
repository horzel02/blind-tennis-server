// server/services/matchService.js
import prisma from '../prismaClient.js';

/* --------------------------------- HELPERY -------------------------------- */

// ranking kluczy rund KO
const KEY_RANK = { F: 1, SF: 2, QF: 3, R16: 4, R32: 5, R64: 6, R128: 7 };
function keyToRank(key) { return key ? KEY_RANK[key] ?? null : null; }

// round string -> klucz (F/SF/QF/R16/...)
function roundToKey(round) {
  if (!round) return null;
  const r = String(round).toLowerCase();
  if (r === 'finał' || r === 'final') return 'F';
  if (r.startsWith('półfina')) return 'SF';
  if (r.startsWith('ćwierćfina')) return 'QF';
  const m = r.match(/1\/(\d+)/);
  if (m) {
    const denom = parseInt(m[1], 10);
    if (denom === 8) return 'R16';
    if (denom === 16) return 'R32';
    if (denom === 32) return 'R64';
    if (denom === 64) return 'R128';
  }
  return null; // np. "Grupa A"
}

function roundToRank(round) {
  const k = roundToKey(round);
  return keyToRank(k);
}

// Kanoniczne etykiety rund
function canonicalRoundLabelByKey(key, idx) {
  if (key === 'F') return 'Finał';
  if (key === 'SF') return `Półfinał – Mecz ${idx}`;
  if (key === 'QF') return `Ćwierćfinał – Mecz ${idx}`;
  if (key === 'R16') return `1/8 finału – Mecz ${idx}`;
  if (key === 'R32') return `1/16 finału – Mecz ${idx}`;
  if (key === 'R64') return `1/32 finału – Mecz ${idx}`;
  if (key === 'R128') return `1/64 finału – Mecz ${idx}`;
  return `KO – Mecz ${idx}`;
}

// query dopasowujące różne zapisy danej rundy
function queryForKey(key) {
  if (key === 'F') return { round: { contains: 'finał', mode: 'insensitive' } };
  if (key === 'SF') return { round: { contains: 'półfina', mode: 'insensitive' } };
  if (key === 'QF') return { round: { contains: 'ćwierćfina', mode: 'insensitive' } };
  if (key === 'R16') return { round: { contains: '1/8', mode: 'insensitive' } };
  if (key === 'R32') return { round: { contains: '1/16', mode: 'insensitive' } };
  if (key === 'R64') return { round: { contains: '1/32', mode: 'insensitive' } };
  if (key === 'R128') return { round: { contains: '1/64', mode: 'insensitive' } };
  return { round: { contains: 'finał', mode: 'insensitive' } };
}

// roundOrder do sortowania
const ROUND_ORDER_MAP = { R128: 1, R64: 2, R32: 3, R16: 4, QF: 5, SF: 6, F: 7 };
function roundOrderForKey(key) { return ROUND_ORDER_MAP[key] ?? 99; }

function getRegModel() {
  if (prisma.tournamentRegistration?.findMany) return prisma.tournamentRegistration;
  if (prisma.tournamentregistration?.findMany) return prisma.tournamentregistration;
  throw new Error('Model TournamentRegistration nie znaleziony w Prisma Client.');
}

function getCategoryModel() {
  if (prisma.tournamentCategory?.findFirst) return prisma.tournamentCategory;
  if (prisma.tournamentcategory?.findFirst) return prisma.tournamentcategory;
  throw new Error('Model TournamentCategory nie znaleziony w Prisma Client.');
}

// KO etykiety (prefiksy) w kolejności od NAJWCZEŚNIEJSZEJ rundy do finału
const KO_ROUNDS = ['1/64', '1/32', '1/16', '1/8', 'Ćwierćfinał', 'Półfinał', 'Finał'];
const isKnockoutRound = (r = '') => KO_ROUNDS.some(lbl => (r || '').startsWith(lbl));
const roundRank = (r = '') => KO_ROUNDS.findIndex(lbl => (r || '').startsWith(lbl));

// (pozostawione – luźne helpery, nie używane szeroko)
const labelForSize = (n) => {
  if (n <= 2) return 'Finał';
  if (n <= 4) return 'Półfinał';
  if (n <= 8) return 'Ćwierćfinał';
  if (n <= 16) return '1/8';
  if (n <= 32) return '1/16';
  if (n <= 64) return '1/32';
  return '1/64';
};
const roundDisplayName = (base, i) => {
  if (base === 'Finał') return 'Finał';
  if (base === 'Półfinał') return `Półfinał ${i}`;
  if (base === 'Ćwierćfinał') return `Ćwierćfinał ${i}`;
  return `${base} ${i}`; // np. "1/8 3"
};

// === NOWE, MAŁE HELPERY RNG (do trybu losowego seedowania) ===
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRNG(randomSeed) {
  if (Number.isFinite(randomSeed)) return mulberry32(Number(randomSeed));
  return Math.random; // fallback
}
function shuffledIndices(n, rand = Math.random) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function derangedIndices(n, rand = Math.random) {
  if (n <= 1) return null;
  const a = shuffledIndices(n, rand);
  for (let i = 0; i < n; i++) {
    if (a[i] === i) {
      const j = (i + 1) % n;
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  for (let i = 0; i < n; i++) if (a[i] === i) return null;
  return a;
}
function buildRandomPairs(firsts, seconds, { avoidSameGroup = true, rand = Math.random } = {}) {
  const n = Math.min(firsts.length, seconds.length);
  if (n === 0) return [];
  let perm = avoidSameGroup ? derangedIndices(n, rand) : shuffledIndices(n, rand);
  if (!perm) perm = shuffledIndices(n, rand);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const p1 = firsts[i] ?? null;
    const p2 = seconds[perm[i]] ?? null;
    if (p1 && p2) pairs.push([p1, p2]);
  }
  return pairs;
}

function extractRoundIndex(round) {
  const m = /Mecz\s+(\d+)/i.exec(round || '');
  return m ? parseInt(m[1], 10) : 1;
}
function nextKeyOf(key) {
  if (key === 'R16') return 'QF';
  if (key === 'QF') return 'SF';
  if (key === 'SF') return 'F';
  return null;
}

async function readTournamentSettings(tId) {
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: {
      format: true,                 // 'GROUPS_KO' | 'KO_ONLY'
      groupSize: true,              // 3 | 4 (domyślnie 4)
      qualifiersPerGroup: true,     // 1 | 2 (domyślnie 2)
      allowByes: true,              // true/false (domyślnie true)
      koSeedingPolicy: true,        // 'RANDOM_CROSS' | 'STRUCTURED'
      avoidSameGroupInR1: true,     // true/false
    },
  });

  return {
    format: t?.format || 'GROUPS_KO',
    groupSize: t?.groupSize || 4,
    qualifiersPerGroup: t?.qualifiersPerGroup || 2,
    allowByes: t?.allowByes ?? true,
    koSeedingPolicy: t?.koSeedingPolicy || 'RANDOM_CROSS',
    avoidSameGroupInR1: t?.avoidSameGroupInR1 ?? true,
  };
}

function smallestPowerOfTwoGE(n) {
  const POWS = [2,4,8,16,32,64,128];
  for (const p of POWS) if (p >= n) return p;
  return 128;
}

function smallestPow2GE(n) { let p = 1; while (p < n) p <<= 1; return p; }

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function baseKeyForSize(size) {
  if (size >= 128) return 'R128';
  if (size >=  64) return 'R64';
  if (size >=  32) return 'R32';
  if (size >=  16) return 'R16';
  if (size ===  8) return 'QF';
  if (size ===  4) return 'SF';
  return 'F';
}
function chainFrom(baseKey) {
  const order = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
  const i = order.indexOf(baseKey);
  return i >= 0 ? order.slice(i) : ['F'];
}
function pairsCountForKey(key) {
  return key === 'R128' ? 64
       : key === 'R64'  ? 32
       : key === 'R32'  ? 16
       : key === 'R16'  ?  8
       : key === 'QF'   ?  4
       : key === 'SF'   ?  2
       :                   1;
}

// Upewnia się, że runda ma dokładnie N meczów (bez duplikatów, ładne etykiety)
async function ensureRoundPlaceholders(tId, roundKey, neededCount, categoryId) {
  const existing = await prisma.match.findMany({
    where: { tournamentId: tId, ...queryForKey(roundKey) },
    orderBy: { id: 'asc' },
    select: { id: true, round: true, player1Id: true, player2Id: true, locked: true, status: true }
  });

  const tx = [];

  // normalizacja etykiet istniejących (spójność UI)
  for (let i = 0; i < Math.min(neededCount, existing.length); i++) {
    const desired = canonicalRoundLabelByKey(roundKey, roundKey === 'F' ? null : (i + 1));
    if (existing[i].round !== desired) {
      tx.push(prisma.match.update({
        where: { id: existing[i].id },
        data: { round: desired, roundOrder: roundOrderForKey(roundKey) }
      }));
    }
  }

  // dobij brakujące sztuki
  for (let i = existing.length + 1; i <= neededCount; i++) {
    tx.push(prisma.match.create({
      data: {
        tournamentId: tId,
        tournamentCategoryId: categoryId,
        round: canonicalRoundLabelByKey(roundKey, roundKey === 'F' ? null : i),
        status: 'scheduled',
        stage: 'knockout',
        roundOrder: roundOrderForKey(roundKey),
      }
    }));
  }

  if (tx.length) await prisma.$transaction(tx);

  return prisma.match.findMany({
    where: { tournamentId: tId, ...queryForKey(roundKey) },
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
  });
}

// CHANGED/NEW helper w matchService.js — wstaw blisko innych helperów
async function getTournamentSettings(tId) {
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: {
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      allowByes: true,
      koSeedingPolicy: true,
      avoidSameGroupInR1: true,
    }
  });
  // sensowne defaulty jeśli coś null
  return {
    format: t?.format || 'KO_ONLY',
    groupSize: t?.groupSize ?? 4,
    qualifiersPerGroup: t?.qualifiersPerGroup ?? 2,
    allowByes: t?.allowByes ?? true,
    koSeedingPolicy: t?.koSeedingPolicy || 'RANDOM_CROSS',
    avoidSameGroupInR1: t?.avoidSameGroupInR1 ?? true,
  };
}

// czyści WSZYSTKIE mecze turnieju (używane w generatorze grup)
async function wipeTournamentMatches(tId) {
  const existing = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true },
  });
  const ids = existing.map(m => m.id);
  if (!ids.length) return 0;

  const txs = [];
  if (prisma.matchSet?.deleteMany) {
    txs.push(prisma.matchSet.deleteMany({ where: { matchId: { in: ids } } }));
  }
  if (prisma.matchLink?.deleteMany) {
    txs.push(
      prisma.matchLink.deleteMany({
        where: { OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
      })
    );
  }
  txs.push(prisma.match.deleteMany({ where: { id: { in: ids } } }));

  await prisma.$transaction(txs);
  return ids.length;
}

// „Grupa X” → litera X
function parseGroupLetter(round) {
  const m = /^Grupa\s+([A-Z])$/i.exec(round || '');
  return m ? m[1].toUpperCase() : null;
}

/* ------------------------------ LISTA / POJEDYNCZY ------------------------------ */

export async function getMatchesByTournamentId(tournamentId, status) {
  const whereClause = { tournamentId: parseInt(tournamentId, 10) };
  const allowed = new Set(['scheduled', 'in_progress', 'finished', 'header']);
  if (status && allowed.has(status)) whereClause.status = status;

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
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
  });
}

export async function getMatchById(matchId) {
  return prisma.match.findUnique({
    where: { id: parseInt(matchId, 10) },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      category: true,
      tournament: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

/* --------------------------- GENERATOR: TYLKO GRUPY --------------------------- */

export async function generateGroupAndKnockoutMatches(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  const Reg = getRegModel();
  const Category = getCategoryModel();
  const {
    format, groupSize, qualifiersPerGroup
  } = await readTournamentSettings(tId);

  // zaakceptowani
  const accepted = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    select: { userId: true },
  });
  const playerIds = accepted.map(p => p.userId);

  const category = await Category.findFirst({
    where: { tournamentId: tId },
    select: { id: true },
  });
  if (!category) throw new Error('Brak kategorii w tym turnieju. Utwórz najpierw kategorię.');

  // wyczyść WSZYSTKO
  await wipeTournamentMatches(tId);

  // KO_ONLY → bez grup, tylko szkielet KO (bazowy), pary ustawi później seedKnockout
  if (format === 'KO_ONLY') {
    const entrants = playerIds.length;
    if (entrants < 2) return { count: 0 };

    const bracketSize = smallestPowerOfTwoGE(entrants); // np. 12 → 16
    // wybór bazowego klucza (obsługujemy do R128)
    const key = bracketSize >= 128 ? 'R128'
              : bracketSize === 64 ? 'R64'
              : bracketSize === 32 ? 'R32'
              : bracketSize === 16 ? 'R16'
              : bracketSize === 8  ? 'QF'
              : bracketSize === 4  ? 'SF'
              : 'F';

    // utwórz placeholdery bazowej rundy
    await ensureRoundPlaceholders(tId, key, bracketSize / 2, category.id);
    // wyższe rundy i tak będą tworzone on-demand w seedKnockout() przez cascade()
    return { count: bracketSize / 2 };
  }

  // GROUPS_KO
  if (playerIds.length < groupSize || (playerIds.length % groupSize !== 0)) {
    throw new Error(`Aby utworzyć grupy, liczba graczy musi być wielokrotnością ${groupSize} (min. ${groupSize}).`);
  }

  // grupy
  playerIds.sort(() => Math.random() - 0.5);
  const numberOfGroups = playerIds.length / groupSize;
  const groupName = (idx) => `Grupa ${String.fromCharCode(65 + idx)}`;

  const data = [];

  // FAZA GRUPOWA
  for (let g = 0; g < numberOfGroups; g++) {
    const name = groupName(g);
    data.push({
      tournamentId: tId,
      tournamentCategoryId: category.id,
      player1Id: null,
      player2Id: null,
      round: name,
      status: 'header',
      stage: 'group',
    });

    const ids = playerIds.slice(g * groupSize, (g + 1) * groupSize);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        data.push({
          tournamentId: tId,
          tournamentCategoryId: category.id,
          player1Id: ids[i],
          player2Id: ids[j],
          round: name,
          status: 'scheduled',
          stage: 'group',
        });
      }
    }
  }

  // KO – tylko bazowa runda na podstawie liczby awansujących (1 lub 2 z grup)
  const entrants = numberOfGroups * (qualifiersPerGroup || 2);
  const baseKey = entrants >= 64 ? 'R64'
                : entrants >= 32 ? 'R32'
                : entrants >= 16 ? 'R16'
                : entrants === 8 ? 'QF'
                : entrants === 4 ? 'SF'
                : 'F';
  const baseCount = baseKey === 'R64' ? 32
                   : baseKey === 'R32' ? 16
                   : baseKey === 'R16' ? 8
                   : baseKey === 'QF'  ? 4
                   : baseKey === 'SF'  ? 2
                   : 1;

  for (let i = 1; i <= baseCount; i++) {
    data.push({
      tournamentId: tId,
      tournamentCategoryId: category.id,
      player1Id: null,
      player2Id: null,
      round: canonicalRoundLabelByKey(baseKey, baseKey === 'F' ? null : i),
      status: 'scheduled',
      stage: 'knockout',
      roundOrder: roundOrderForKey(baseKey),
    });
  }

  if (data.length) await prisma.match.createMany({ data });
  return { count: data.length };
}

/* ------------------------------- TABELA GRUP ------------------------------- */

export async function getGroupStandings(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  const groupMatches = await prisma.match.findMany({
    where: { tournamentId: tId, stage: 'group', status: 'finished' },
    include: {
      matchSets: true,
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
    },
  });

  const scheduledGroupMatches = await prisma.match.findMany({
    where: { tournamentId: tId, stage: 'group', status: { in: ['scheduled', 'in_progress', 'finished', 'header'] } },
    select: { round: true, player1Id: true, player2Id: true },
  });

  const groups = new Map();
  const ensurePlayerRow = (letter, user) => {
    if (!groups.has(letter)) groups.set(letter, new Map());
    const mp = groups.get(letter);
    if (!mp.has(user.id)) {
      mp.set(user.id, {
        userId: user.id, name: user.name, surname: user.surname,
        played: 0, wins: 0, losses: 0,
        setsWon: 0, setsLost: 0,
        gamesWon: 0, gamesLost: 0,
        points: 0,
      });
    }
    return mp.get(user.id);
  };

  // preload zawodników, żeby puste grupy też się pokazały
  for (const m of scheduledGroupMatches) {
    const letter = parseGroupLetter(m.round);
    if (!letter) continue;
    if (m.player1Id) {
      const u = await prisma.users.findUnique({ where: { id: m.player1Id }, select: { id: true, name: true, surname: true } });
      if (u) ensurePlayerRow(letter, u);
    }
    if (m.player2Id) {
      const u = await prisma.users.findUnique({ where: { id: m.player2Id }, select: { id: true, name: true, surname: true } });
      if (u) ensurePlayerRow(letter, u);
    }
  }

  // policz ze skończonych
  for (const m of groupMatches) {
    const letter = parseGroupLetter(m.round);
    if (!letter || !m.player1 || !m.player2) continue;

    const p1 = ensurePlayerRow(letter, m.player1);
    const p2 = ensurePlayerRow(letter, m.player2);

    let sets1 = 0, sets2 = 0, games1 = 0, games2 = 0;
    for (const s of m.matchSets) {
      games1 += s.player1Score || 0;
      games2 += s.player2Score || 0;
      if ((s.player1Score || 0) > (s.player2Score || 0)) sets1++;
      else if ((s.player2Score || 0) > (s.player1Score || 0)) sets2++;
    }

    p1.played++; p2.played++;
    p1.setsWon += sets1; p1.setsLost += sets2; p1.gamesWon += games1; p1.gamesLost += games2;
    p2.setsWon += sets2; p2.setsLost += sets1; p2.gamesWon += games2; p2.gamesLost += games1;

    if (m.winnerId === m.player1.id) { p1.wins++; p2.losses++; }
    else if (m.winnerId === m.player2.id) { p2.wins++; p1.losses++; }
    p1.points = p1.wins;
    p2.points = p2.wins;
  }

  const out = [];
  for (const [letter, mp] of groups) {
    const rows = Array.from(mp.values());
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const setDiffA = a.setsWon - a.setsLost;
      const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      return a.userId - b.userId;
    });

    // H2H przy ścisłym remisie 1v1
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i], b = rows[i + 1];
      if (
        a.points === b.points &&
        (a.setsWon - a.setsLost) === (b.setsWon - b.setsLost) &&
        (a.gamesWon - a.gamesLost) === (b.gamesWon - b.gamesLost)
      ) {
        const h2h = groupMatches.find(m =>
          parseGroupLetter(m.round) === letter &&
          ((m.player1?.id === a.userId && m.player2?.id === b.userId) ||
            (m.player1?.id === b.userId && m.player2?.id === a.userId))
        );
        if (h2h && h2h.winnerId && h2h.winnerId === b.userId) {
          rows[i] = b; rows[i + 1] = a;
        }
      }
    }

    out.push({ group: `Grupa ${letter}`, standings: rows });
  }

  out.sort((g1, g2) => g1.group.localeCompare(g2.group));
  return out;
}

// kwalifikanci TOP2 z grup
async function computeQualifiersDynamic(tId) {
  const { qualifiersPerGroup = 2 } = await readTournamentSettings(tId);
  const tables = await getGroupStandings(tId);
  const byGroup = {};
  for (const g of tables) {
    const top = g.standings?.slice(0, qualifiersPerGroup) || [];
    byGroup[g.group] = top.map(x => x.userId).filter(Boolean);
  }
  const groups = Object.keys(byGroup).sort(); // 'Grupa A', 'Grupa B', ...
  const winners = groups.map(g => byGroup[g][0]).filter(Boolean);
  const runners = qualifiersPerGroup >= 2 ? groups.map(g => byGroup[g][1]).filter(Boolean) : [];
  const entrants = winners.length + runners.length;
  return { groups, winners, runners, entrants, qualifiersPerGroup };
}

/* ------------------------------ SEED KNOCKOUT ------------------------------ */
/**
 * Uzupełnia pierwszą rundę KO na podstawie TOP2 z grup.
 * Wspiera:
 *  - mode: 'preset' (domyślnie) lub 'random'
 *  - avoidSameGroup (dla 'random'): true/false (domyślnie true)
 *  - randomSeed: opcjonalne ziarno (string/number) dla powtarzalności losowania
 *  - overwrite/skipLocked/fromRound – jak wcześniej
 */
// CHANGED: seedKnockout — respektuje ustawienia turnieju
export async function seedKnockout(tournamentId, opts = {}) {
  const {
    overwrite = false,
    skipLocked = true,
    fromRound = null
  } = opts;

  const tId = parseInt(tournamentId, 10);
  const {
    format, koSeedingPolicy, avoidSameGroupInR1, allowByes
  } = await readTournamentSettings(tId);

  const Category = prisma.tournamentCategory || prisma.tournamentcategory;
  const cat = await Category.findFirst({ where: { tournamentId: tId }, select: { id: true }});
  if (!cat) throw new Error('Brak kategorii w turnieju');

  const includeFull = {
    player1: { select: { id: true, name: true, surname: true } },
    player2: { select: { id: true, name: true, surname: true } },
    referee: { select: { id: true, name: true, surname: true } },
    winner:  { select: { id: true, name: true, surname: true } },
    category: true,
    matchSets: { orderBy: { setNumber: 'asc' } },
  };

  const setPairIfNeeded = (match, p1, p2) => {
    if (!match) return null;
    if (skipLocked && match.locked) return null;
    const empty = !match.player1Id && !match.player2Id;
    if (!overwrite && !empty) return null;
    return prisma.match.update({
      where: { id: match.id },
      data: { player1Id: p1 ?? null, player2Id: p2 ?? null, updatedAt: new Date() },
      include: includeFull,
    });
  };

  const changed = [];

  // --- KO_ONLY: parujemy bez grup, z BYE jeśli trzeba ---
  if (format === 'KO_ONLY') {
    const Reg = getRegModel();
    const regs = await Reg.findMany({
      where: { tournamentId: tId, status: 'accepted' },
      select: { userId: true },
    });
    const entrantsIds = regs.map(r => r.userId);
    if (entrantsIds.length < 2) throw new Error('Za mało uczestników do KO');

    const bracketSize = smallestPowerOfTwoGE(entrantsIds.length);
    if (bracketSize !== 2 && bracketSize !== 4 && bracketSize !== 8 && bracketSize !== 16 && bracketSize !== 32 && bracketSize !== 64 && bracketSize !== 128) {
      throw new Error('Nieobsługiwany rozmiar drabinki');
    }

    const baseKey = bracketSize >= 128 ? 'R128'
                  : bracketSize === 64 ? 'R64'
                  : bracketSize === 32 ? 'R32'
                  : bracketSize === 16 ? 'R16'
                  : bracketSize === 8  ? 'QF'
                  : bracketSize === 4  ? 'SF'
                  : 'F';

    const baseMatches = await ensureRoundPlaceholders(tId, baseKey, bracketSize/2, cat.id);

    const ids = shuffleInPlace([...entrantsIds]);
    while (ids.length < bracketSize) {
      if (!allowByes) throw new Error(`Brakuje ${bracketSize - ids.length} uczestników, a BYE są wyłączone.`);
      ids.push(null);
    }

    // pary idami
    const pairs = [];
    for (let i = 0; i < bracketSize; i += 2) {
      pairs.push([ids[i] || null, ids[i+1] || null]);
    }

    const tx = [];
    for (let i = 0; i < baseMatches.length; i++) {
      tx.push(setPairIfNeeded(baseMatches[i], pairs[i][0], pairs[i][1]));
    }
    const updates = await prisma.$transaction(tx.filter(Boolean));
    changed.push(...updates);

    // auto-advance BYE
    if (allowByes) {
      const byeTx = [];
      for (let i = 0; i < baseMatches.length; i++) {
        const m = baseMatches[i];
        const [a,b] = pairs[i];
        if ((a && !b) || (!a && b)) {
          const winnerId = a || b;
          byeTx.push(prisma.match.update({
            where: { id: m.id },
            data: { winnerId, status: 'finished', updatedAt: new Date() },
            include: includeFull,
          }));
        }
      }
      if (byeTx.length) {
        const byeUps = await prisma.$transaction(byeTx);
        changed.push(...byeUps);
      }
    }

    // kaskada
    async function cascade(fromKey, toKey, pairsIdx) {
      const from = await prisma.match.findMany({
        where: { tournamentId: tId, ...queryForKey(fromKey) },
        orderBy: [{ round: 'asc' }, { id: 'asc' }],
        select: { id:true, winnerId:true, locked:true, player1Id:true, player2Id:true }
      });
      const to = await ensureRoundPlaceholders(tId, toKey, toKey==='QF'?4:toKey==='SF'?2:1, cat.id);
      const tx2 = [];
      for (let i = 0; i < pairsIdx.length; i++) {
        const [a, b] = pairsIdx[i]; // 1-indeksowane
        const w1 = from[a-1]?.winnerId || null;
        const w2 = from[b-1]?.winnerId || null;
        if (!w1 || !w2) continue;
        const target = to[i];
        if (!target) continue;
        if (skipLocked && target.locked) continue;
        const empty = !target.player1Id && !target.player2Id;
        if (!overwrite && !empty) continue;

        tx2.push(prisma.match.update({
          where: { id: target.id },
          data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
          include: includeFull,
        }));
      }
      const ups = await prisma.$transaction(tx2);
      changed.push(...ups);
    }

    if (baseKey === 'R16') {
      await cascade('R16', 'QF', [[1,2],[3,4],[5,6],[7,8]]);
      await cascade('QF',  'SF', [[1,2],[3,4]]);
      await cascade('SF',  'F',  [[1,2]]);
    } else if (baseKey === 'R32') {
      await cascade('R32','R16', [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16]]);
      await cascade('R16','QF',  [[1,2],[3,4],[5,6],[7,8]]);
      await cascade('QF','SF',   [[1,2],[3,4]]);
      await cascade('SF','F',    [[1,2]]);
    } else if (baseKey === 'QF') {
      await cascade('QF','SF', [[1,2],[3,4]]);
      await cascade('SF','F',  [[1,2]]);
    } else if (baseKey === 'SF') {
      await cascade('SF','F', [[1,2]]);
    }

    return { updated: changed.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
  }

  // --- GROUPS_KO: liczymy standingi i parujemy wg polityki ---
  const groups = await getGroupStandings(tId);
  if (!groups?.length) throw new Error('Brak danych fazy grupowej');

  const sorted = [...groups].sort((a, b) => a.group.localeCompare(b.group, 'pl'));
  const groupLabels = sorted.map(g => g.group); // 'Grupa A', 'Grupa B', ...

  const { winners: firsts, runners: seconds, entrants, qualifiersPerGroup } = await computeQualifiersDynamic(tId);

  // walidacja: liczba awansujących musi być potęgą 2
  const okSet = new Set([2,4,8,16,32,64,128]);
  if (!okSet.has(entrants)) {
    throw new Error(`Liczba awansujących (${entrants}) nie jest potęgą 2. Zmień ustawienia (liczba grup / awansujących).`);
  }

  const baseKey = entrants >= 128 ? 'R128'
                : entrants === 64 ? 'R64'
                : entrants === 32 ? 'R32'
                : entrants === 16 ? 'R16'
                : entrants === 8  ? 'QF'
                : entrants === 4  ? 'SF'
                : 'F';

  const needed = baseKey === 'R128' ? 64
               : baseKey === 'R64'  ? 32
               : baseKey === 'R32'  ? 16
               : baseKey === 'R16'  ? 8
               : baseKey === 'QF'   ? 4
               : baseKey === 'SF'   ? 2
               : 1;

  const baseMatches = await ensureRoundPlaceholders(tId, baseKey, needed, cat.id);

  // budowa par wg polityki
  function randomCrossPairs() {
    // K=2: winner vs runner-up (unikamy tej samej grupy jeśli da się)
    const W = firsts.map((id, idx) => ({ id, g: idx })).filter(x => x.id);
    const R = seconds.map((id, idx) => ({ id, g: idx })).filter(x => x.id);
    shuffleInPlace(W);
    shuffleInPlace(R);

    const pairs = [];
    for (const w of W) {
      let pick = R.findIndex(r => !avoidSameGroupInR1 || r.g !== w.g);
      if (pick === -1) pick = 0; // nie udało się uniknąć – bierz pierwszy
      const r = R.splice(pick, 1)[0] || { id: null };
      pairs.push([w.id, r.id]);
    }
    return pairs;
  }

  function randomPairsSingleList(ids) {
    const X = shuffleInPlace(ids.filter(Boolean));
    const pairs = [];
    for (let i = 0; i < X.length; i += 2) {
      pairs.push([X[i] || null, X[i+1] || null]);
    }
    return pairs;
  }

  let pairs;
  if (koSeedingPolicy === 'STRUCTURED' && qualifiersPerGroup >= 2) {
    // stara logika A1-H2, B1-G2, ... (zależnie od wielkości)
    if (baseKey === 'R16' || baseKey === 'QF') {
      const A1=firsts[0], B1=firsts[1], C1=firsts[2], D1=firsts[3], E1=firsts[4], F1=firsts[5], G1=firsts[6], H1=firsts[7];
      const A2=seconds[0],B2=seconds[1],C2=seconds[2],D2=seconds[3],E2=seconds[4],F2=seconds[5],G2=seconds[6],H2=seconds[7];
      pairs = baseKey === 'R16'
        ? [[A1,H2],[E1,D2],[C1,F2],[G1,B2],[B1,G2],[F1,C2],[D1,E2],[H1,A2]]
        : [[A1,H2],[B1,G2],[C1,F2],[D1,E2]];
    } else if (baseKey === 'SF') {
      const A1=firsts[0], B1=firsts[1];
      const A2=seconds[0],B2=seconds[1];
      pairs = [[A1,B2],[B1,A2]];
    } else { // F
      pairs = [[firsts[0] || null, seconds[0] || null]];
    }
  } else {
    // RANDOM_CROSS
    if (qualifiersPerGroup >= 2) {
      pairs = randomCrossPairs();
    } else {
      // K=1 → losowe pary samych zwycięzców
      pairs = randomPairsSingleList(firsts);
    }
  }

  // wstaw pary w bazową rundę
  const tx = [];
  for (let i = 0; i < needed; i++) {
    const [p1, p2] = pairs[i] || [null, null];
    tx.push(setPairIfNeeded(baseMatches[i], p1, p2));
  }
  const updates = await prisma.$transaction(tx.filter(Boolean));
  changed.push(...updates);

  // kaskady bez zmian
  async function cascade(fromKey, toKey, pairsIdx) {
    const from = await prisma.match.findMany({
      where: { tournamentId: tId, ...queryForKey(fromKey) },
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
      select: { id:true, winnerId:true }
    });
    const to = await ensureRoundPlaceholders(tId, toKey, toKey==='QF'?4:toKey==='SF'?2:1, cat.id);

    const tx2 = [];
    for (let i = 0; i < pairsIdx.length; i++) {
      const [a, b] = pairsIdx[i]; // 1-indeksowane
      const w1 = from[a-1]?.winnerId || null;
      const w2 = from[b-1]?.winnerId || null;
      if (!w1 || !w2) continue;

      const target = to[i];
      if (!target) continue;
      if (skipLocked && target.locked) continue;
      const empty = !target.player1Id && !target.player2Id;
      if (!overwrite && !empty) continue;

      tx2.push(prisma.match.update({
        where: { id: target.id },
        data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
        include: includeFull,
      }));
    }
    const ups = await prisma.$transaction(tx2);
    changed.push(...ups);
  }

  if (baseKey === 'R16') {
    await cascade('R16', 'QF', [[1,2],[3,4],[5,6],[7,8]]);
    await cascade('QF',  'SF', [[1,2],[3,4]]);
    await cascade('SF',  'F',  [[1,2]]);
  } else if (baseKey === 'R32') {
    await cascade('R32','R16', [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16]]);
    await cascade('R16','QF',  [[1,2],[3,4],[5,6],[7,8]]);
    await cascade('QF','SF',   [[1,2],[3,4]]);
    await cascade('SF','F',    [[1,2]]);
  } else if (baseKey === 'QF') {
    await cascade('QF',  'SF', [[1,2],[3,4]]);
    await cascade('SF',  'F',  [[1,2]]);
  } else if (baseKey === 'SF') {
    await cascade('SF',  'F',  [[1,2]]);
  }

  return { updated: changed.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
}



/* ---------------------------- RESET KO OD RUNDY ---------------------------- */
/**
 * Czyści KO od wskazanej rundy (np. '1/8', 'Ćwierćfinał', 'Półfinał', 'Finał').
 * Nie dotyka meczów locked/finished/in_progress tylko jeśli tak chcesz (tu czyścimy wszystkie).
 */
export async function resetKnockoutFromRound(tournamentId, fromLabel) {
  const tId = parseInt(tournamentId, 10);

  const base = normalizeRoundLabel(fromLabel);
  if (!base) throw new Error('Nieznana runda: ' + JSON.stringify(fromLabel));

  const key = roundToKey(base);
  const threshold = keyToRank(key);
  if (!threshold) throw new Error('Nieznany etap (fromRound): ' + base);

  const all = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true, round: true, status: true }
  });

  const toClearIds = all
    .filter(m => {
      const rk = roundToRank(m.round);
      return rk !== null && rk <= threshold;
    })
    .map(m => m.id);

  if (!toClearIds.length) return { cleared: 0 };

  await prisma.$transaction([
    prisma.matchSet.deleteMany({ where: { matchId: { in: toClearIds } } }),
    prisma.match.updateMany({
      where: { id: { in: toClearIds } },
      data: { player1Id: null, player2Id: null, winnerId: null, status: 'scheduled', updatedAt: new Date() }
    })
  ]);

  return { cleared: toClearIds.length, from: fromLabel };
}

/* ------------------------------- WYNIK / SĘDZIA ------------------------------ */

export async function updateMatchScore(matchId, { status, winnerId, matchSets }) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) wczytaj mecz z dodatkowymi polami
      const match = await tx.match.findUnique({
        where: { id: parseInt(matchId, 10) },
        select: {
          id: true, tournamentId: true, tournamentCategoryId: true,
          round: true, status: true,
        }
      });
      if (!match) throw new Error('Match not found');

      // 2) nadpisz sety + status + zwycięzcę
      await tx.matchSet.deleteMany({ where: { matchId: match.id } });
      if (Array.isArray(matchSets) && matchSets.length) {
        await tx.matchSet.createMany({
          data: matchSets.map((set, i) => ({
            matchId: match.id,
            setNumber: i + 1,
            player1Score: set.player1Score,
            player2Score: set.player2Score,
          })),
        });
      }

      const updated = await tx.match.update({
        where: { id: match.id },
        data: { status, winnerId, updatedAt: new Date() },
        include: {
          matchSets: true,
          player1: { select: { id: true, name: true, surname: true } },
          player2: { select: { id: true, name: true, surname: true } },
          winner: { select: { id: true, name: true, surname: true } },
        },
      });

      // 3) próba awansu do następnej rundy (działa dla R16/QF/SF)
      const key = (roundToKey(match.round) || '');
      const nextKey = nextKeyOf(key);
      if (nextKey) {
        // znajdź indeks meczu w swojej rundzie
        const myIdx = extractRoundIndex(match.round); // 1..N
        // znajdź oba mecze pary (np. [1,2], [3,4]...)
        const pairStart = myIdx % 2 === 1 ? myIdx : myIdx - 1;
        const pairOther = pairStart + 1;

        // pobierz zwycięzców całej rundy (uporządkowane po round asc, id asc)
        const from = await tx.match.findMany({
          where: { tournamentId: match.tournamentId, ...queryForKey(key) },
          orderBy: [{ round: 'asc' }, { id: 'asc' }],
          select: { id: true, round: true, winnerId: true }
        });

        const w1 = from[pairStart - 1]?.winnerId || null;
        const w2 = from[pairOther - 1]?.winnerId || null;

        if (w1 && w2) {
          // zapewnij placeholdery następnej rundy
          const needed = nextKey === 'QF' ? 4 : nextKey === 'SF' ? 2 : 1;
          const to = await ensureRoundPlaceholders(
            match.tournamentId, nextKey, needed, match.tournamentCategoryId
          );

          // docelowy mecz to ceil(myIdx/2)
          const target = to[Math.ceil(myIdx / 2) - 1];
          if (target && !target.locked) {
            await tx.match.update({
              where: { id: target.id },
              data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
            });
          }
        }
      }

      return updated;
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

  return prisma.match.update({
    where: { id },
    data: { refereeId: refId, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

export async function setLocked(matchId, locked) {
  const id = parseInt(matchId, 10);
  const m = await prisma.match.findUnique({ where: { id } });
  if (!m) throw new Error('Mecz nie istnieje');

  return prisma.match.update({
    where: { id },
    data: { locked: !!locked, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

/* ------------------ DOPUSZCZENI DO MECZU + TWARDY BACKEND ------------------ */

export async function getEligiblePlayersForMatch(matchId) {
  const id = parseInt(matchId, 10);
  const m = await prisma.match.findUnique({
    where: { id },
    select: { id: true, tournamentId: true, round: true },
  });
  if (!m) throw new Error('Mecz nie istnieje');

  const tId = m.tournamentId;
  const r = m.round || '';

  // Runda grupowa → wszyscy zaakceptowani
  if (!isKnockoutRound(r)) {
    const Reg = getRegModel();
    const regs = await Reg.findMany({
      where: { tournamentId: tId, status: 'accepted' },
      include: { user: { select: { id: true, name: true, surname: true, email: true } } },
    });
    return regs.map(r => r.user);
  }

  // KO: zwycięzcy poprzedniej rundy
  const myIdx = roundRank(r);
  const prevIdx = myIdx + 1; // KO_ROUNDS rosną od wczesnych do finału
  const prevLbl = KO_ROUNDS[prevIdx];

  if (prevLbl) {
    const prev = await prisma.match.findMany({
      where: { tournamentId: tId, round: { startsWith: prevLbl }, status: 'finished' },
      select: { winnerId: true },
    });
    const ids = [...new Set(prev.map(x => x.winnerId).filter(Boolean))];
    if (ids.length) {
      return prisma.users.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, surname: true, email: true },
      });
    }
  }

  // Pierwsza runda KO → TOP2 z grup
  const settings = await getTournamentSettings(tId);
  const { qualifiersPerGroup } = settings;
  const { qualifiers } = await computeQualifiersTop2(tId, qualifiersPerGroup ?? 2);
  if (!qualifiers.length) return [];
  const users = await prisma.users.findMany({
    where: { id: { in: qualifiers } },
    select: { id: true, name: true, surname: true, email: true },
  });
  const map = new Map(users.map(u => [u.id, u]));
  return qualifiers.map(i => map.get(i)).filter(Boolean);
}

export async function setPairing(matchId, { player1Id, player2Id }) {
  const id = parseInt(matchId, 10);

  const m = await prisma.match.findUnique({ where: { id } });
  if (!m) throw new Error('Mecz nie istnieje');
  if (m.locked) throw new Error('Mecz zablokowany');
  if (m.status === 'in_progress' || m.status === 'finished') {
    throw new Error('Nie można zmienić pary dla meczu, który już trwa lub się zakończył');
  }

  const p1 = player1Id == null || player1Id === '' ? null : parseInt(player1Id, 10);
  const p2 = player2Id == null || player2Id === '' ? null : parseInt(player2Id, 10);
  if (p1 && p2 && p1 === p2) throw new Error('Ten sam zawodnik po obu stronach');

  // tylko dopuszczeni w KO
  const myKey = roundToKey(m.round);
  if (myKey) {
    const allowed = await getEligiblePlayersForMatch(id);
    const allowedIds = new Set(allowed.map(u => u.id));
    if (p1 && !allowedIds.has(p1)) throw new Error('Zawodnik A nie jest dopuszczony do tej rundy');
    if (p2 && !allowedIds.has(p2)) throw new Error('Zawodnik B nie jest dopuszczony do tej rundy');
  }

  const updated = await prisma.match.update({
    where: { id },
    data: { player1Id: p1, player2Id: p2, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });

  return updated;
}

// === NORMALIZACJA ETYKIET RUND (EKSPORT) ===
export function normalizeRoundLabel(input) {
  // przyjmij wszystko: string, {from:'...'}, {label:'...'}, itp.
  let s = input;
  if (typeof s === 'object' && s !== null) {
    s = s.from ?? s.label ?? s.value ?? s.round ?? '';
  }
  s = String(s || '').trim().toLowerCase();

  if (!s) return null;

  if (s === 'f' || s === 'final' || s.startsWith('finał')) return 'Finał';
  if (s === 'sf' || s.includes('1/2') || s.startsWith('pół')) return 'Półfinał';
  if (s === 'qf' || s.includes('1/4') || s.startsWith('ćwierć')) return 'Ćwierćfinał';
  if (s === 'r16' || /^1\/8\b/.test(s)) return '1/8 finału';
  if (s === 'r32' || /^1\/16\b/.test(s)) return '1/16 finału';
  if (s === 'r64' || /^1\/32\b/.test(s)) return '1/32 finału';
  if (s === 'r128' || /^1\/64\b/.test(s)) return '1/64 finału';

  return null;
}

export async function generateKnockoutOnly(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  // 1) pobierz ustawienia + uczestników zaakceptowanych
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: { allowByes: true }
  });
  if (!t) throw new Error('Turniej nie istnieje');

  const Reg = getRegModel();
  const Category = getCategoryModel();

  const accepted = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    select: { userId: true }
  });
  const entrants = accepted.map(a => a.userId);
  if (entrants.length < 2) {
    throw new Error('Za mało uczestników do stworzenia drabinki KO (min. 2).');
  }

  const cat = await Category.findFirst({
    where: { tournamentId: tId },
    select: { id: true }
  });
  if (!cat) throw new Error('Brak kategorii w turnieju');

  // 2) wyczyść dotychczasowe mecze
  await wipeTournamentMatches(tId);

  // 3) ustal rozmiar drabinki i bazową rundę
  const size = smallestPow2GE(entrants.length);
  if (size !== entrants.length && !t.allowByes) {
    throw new Error('Liczba uczestników nie jest potęgą 2 – włącz BYE w ustawieniach lub zmień limit.');
  }
  const baseKey = baseKeyForSize(size);

  // 4) przygotuj placeholdery wszystkich potrzebnych rund
  //    (zaczynamy od bazowej, a potem niższe: QF/SF/F)
  const chain = chainFrom(baseKey);
let createdBase = null;
for (const key of chain) {
  const cnt = pairsCountForKey(key);
  const out = await ensureRoundPlaceholders(tId, key, cnt, cat.id);
  if (!createdBase && key === baseKey) createdBase = out; // zapamiętaj listę bazowej rundy
}

  // 5) losowo rozstaw 1. rundę (dopaduj BYE = null)
  const pool = shuffleInPlace([...entrants]);
while (pool.length < size) pool.push(null);

const includeFull = {
  player1: { select: { id: true, name: true, surname: true } },
  player2: { select: { id: true, name: true, surname: true } },
  referee: { select: { id: true, name: true, surname: true } },
  winner:  { select: { id: true, name: true, surname: true } },
  category: true,
  matchSets: { orderBy: { setNumber: 'asc' } },
};

const baseCount = pairsCountForKey(baseKey);
const tx = [];
for (let i = 0; i < baseCount; i++) {
  const p1 = pool[2*i]   ?? null;
  const p2 = pool[2*i+1] ?? null;
  tx.push(prisma.match.update({
    where: { id: createdBase[i].id },
    data: { player1Id: p1, player2Id: p2, status: 'scheduled', updatedAt: new Date() },
    include: includeFull
  }));
}
const seeded = await prisma.$transaction(tx);

  return { created: seeded.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
}