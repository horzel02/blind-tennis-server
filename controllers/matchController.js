// server/controllers/matchController.js
import prisma from '../prismaClient.js';
import * as matchService from '../services/matchService.js';

/* ------------------------------ LISTA / POJEDYNCZY ------------------------------ */

export const getMatchesByTournamentId = async (req, res) => {
  const { tournamentId } = req.params;
  const { status } = req.query;
  try {
    const matches = await matchService.getMatchesByTournamentId(tournamentId, status);
    res.status(200).json(matches);
  } catch (error) {
    console.error('Błąd pobierania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const getMatchById = async (req, res) => {
  try {
    const match = await matchService.getMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Mecz nie znaleziono.' });
    res.status(200).json(match);
  } catch (error) {
    console.error('Błąd pobierania pojedynczego meczu:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/* ----------------------------------- WYNIK ----------------------------------- */

export const updateMatchScore = async (req, res) => {
  const io = req.app.get('socketio');
  const { matchId } = req.params;
  const { status, winnerId, matchSets } = req.body;

  try {
    const updatedMatch = await matchService.updateMatchScore(matchId, { status, winnerId, matchSets });

    io?.to(`match-${updatedMatch.id}`).emit('match-updated', updatedMatch);
    io?.to(`tournament-${updatedMatch.tournamentId}`).emit('match-status-changed', {
      matchId: updatedMatch.id,
      status: updatedMatch.status,
    });

    io?.to(`tournament-${updatedMatch.tournamentId}`)
      .emit('matches-invalidate', { reason: 'cascade' });

    res.status(200).json(updatedMatch);
  } catch (error) {
    console.error('Błąd aktualizacji wyników meczu:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/* --------------------------------- GENERATOR --------------------------------- */

export const generateTournamentStructure = async (req, res) => {
  const { tournamentId } = req.params;
  const io = req.app.get('socketio');

  try {
    const t = await prisma.tournament.findUnique({
      where: { id: Number(tournamentId) },
      select: { id: true, format: true }
    });
    if (!t) return res.status(404).json({ error: 'Turniej nie znaleziono' });

    const result = (t.format === 'KO_ONLY')
      ? await matchService.generateKnockoutOnly(tournamentId)
      : await matchService.generateGroupAndKnockoutMatches(tournamentId);

    io?.to(`tournament-${Number(tournamentId)}`).emit('matches-invalidate', { reason: 'generate' });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/* --------------------------------- SĘDZIOWIE --------------------------------- */

export const setMatchReferee = async (req, res) => {
  const io = req.app.get('socketio');
  const { matchId } = req.params;
  const { refereeId } = req.body;

  try {
    const meta = await prisma.match.findUnique({
      where: { id: Number(matchId) },
      select: { id: true, tournamentId: true, player1Id: true, player2Id: true },
    });
    if (!meta) return res.status(404).json({ error: 'Mecz nie znaleziono' });

    if (refereeId != null) {
      const rid = Number(refereeId);
      if (rid === meta.player1Id || rid === meta.player2Id) {
        return res.status(409).json({ error: 'Wybrany użytkownik jest zawodnikiem w tym meczu' });
      }
      const hasRefRole = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: meta.tournamentId, userId: rid, role: 'referee' },
        select: { id: true },
      });
      if (!hasRefRole) {
        return res.status(400).json({ error: 'Wybrany użytkownik nie ma roli sędziego w tym turnieju' });
      }
    }

    const updated = await matchService.setMatchReferee(matchId, refereeId);
    const payload = updated.referee
      ? { matchId: updated.id, referee: { id: updated.referee.id, name: updated.referee.name, surname: updated.referee.surname } }
      : { matchId: updated.id, referee: null };

    io?.to(`tournament-${updated.tournamentId}`).emit('match-referee-changed', payload);
    io?.to(`match-${updated.id}`).emit('match-referee-changed', payload);

    res.status(200).json(updated);
  } catch (error) {
    console.error('Błąd przypisywania sędziego:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const assignRefereeBulk = async (req, res) => {
  const io = req.app.get('socketio');
  const { tournamentId, matchIds, refereeId } = req.body;

  try {
    const tId = parseInt(tournamentId, 10);
    if (!tId || !Array.isArray(matchIds) || matchIds.length === 0) {
      return res.status(400).json({ error: 'Brak danych: tournamentId i matchIds są wymagane' });
    }

    const isOrg = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: tId, userId: req.user.id, role: 'organizer' },
      select: { id: true },
    });
    if (!isOrg) return res.status(403).json({ error: 'Brak uprawnień' });

    const ids = matchIds.map(n => parseInt(n, 10)).filter(Boolean);

    const matches = await prisma.match.findMany({
      where: { tournamentId: tId, id: { in: ids } },
      select: { id: true, player1Id: true, player2Id: true },
    });
    if (!matches.length) return res.json({ updated: 0, skipped: ids });

    const refId = refereeId == null ? null : parseInt(refereeId, 10);

    if (refId != null) {
      const hasRefRole = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: tId, userId: refId, role: 'referee' },
        select: { id: true },
      });
      if (!hasRefRole) {
        return res.status(400).json({ error: 'Wybrany użytkownik nie ma roli sędziego w tym turnieju' });
      }
    }

    const allowed = refId == null
      ? matches.map(m => m.id)
      : matches.filter(m => !(refId === m.player1Id || refId === m.player2Id)).map(m => m.id);

    const skipped = ids.filter(mid => !allowed.includes(mid));
    if (!allowed.length) return res.json({ updated: 0, skipped });

    const updatedMatches = await prisma.$transaction(
      allowed.map(mid =>
        prisma.match.update({
          where: { id: mid },
          data: { refereeId: refId, updatedAt: new Date() },
          include: { referee: { select: { id: true, name: true, surname: true } }, tournament: { select: { id: true } } },
        })
      )
    );

    for (const m of updatedMatches) {
      const payload = m.referee
        ? { matchId: m.id, referee: { id: m.referee.id, name: m.referee.name, surname: m.referee.surname } }
        : { matchId: m.id, referee: null };
      io?.to(`tournament-${tId}`).emit('match-referee-changed', payload);
      io?.to(`match-${m.id}`).emit('match-referee-changed', payload);
    }

    res.json({ updated: updatedMatches.length, skipped });
  } catch (e) {
    console.error('assignRefereeBulk error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

/* --------------------------------- GRUPY/KO --------------------------------- */

export const getGroupStandings = async (req, res) => {
  try {
    const rows = await matchService.getGroupStandings(req.params.tournamentId);
    res.json(rows);
  } catch (e) {
    console.error('getGroupStandings error:', e);
    res.status(500).json({ error: e.message || 'Błąd serwera' });
  }
};

// SEED KO z grup (top2), wspiera opcje w body: { overwrite, skipLocked, fromRound }
export const seedKnockout = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    const out = await matchService.seedKnockout(req.params.tournamentId, req.body || {});

    // doślij świeże mecze z tej rundy, żeby FE się odświeżył
    const matches = await prisma.match.findMany({
      where: {
        tournamentId: Number(req.params.tournamentId),
        round: { startsWith: out.baseRound },
      },
      include: {
        player1: { select: { id: true, name: true, surname: true } },
        player2: { select: { id: true, name: true, surname: true } },
        category: true,
        referee: { select: { id: true, name: true, surname: true } },
        winner: { select: { id: true, name: true, surname: true } },
        matchSets: { orderBy: { setNumber: 'asc' } },
      },
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
    });

    for (const m of matches) {
      io?.to(`tournament-${m.tournamentId}`).emit('match-updated', m);
    }

    io?.to(`tournament-${Number(req.params.tournamentId)}`).emit('matches-invalidate', { reason: 'seed' });
    res.json(out);
  } catch (e) {
    console.error('seedKnockout error:', e);
    res.status(400).json({ error: e.message || 'Błąd zasiewania drabinki' });
  }
};


// Reset KO od wskazanej rundy (nowy + legacy alias)
// === DODAJ: reset KO od podanej rundy ===
export const resetKnockoutFromRound = async (req, res) => {
  const io = req.app.get('socketio');
  try {
    const { from } = req.body || {};
    const out = await matchService.resetKnockoutFromRound(req.params.tournamentId, from);
    io?.to(`tournament-${Number(req.params.tournamentId)}`)
      .emit('matches-invalidate', { reason: 'reset-from', from: out.from });
    res.json(out);
  } catch (e) {
    console.error('resetKnockoutFromRound error:', e);
    res.status(400).json({ error: e.message || 'Błąd resetu od etapu' });
  }
};




/* ------------------------------- PAIRING/LOCK ------------------------------- */

export const setPairing = async (req, res) => {
  try {
    const { player1Id = null, player2Id = null } = req.body || {};
    const io = req.app.get('socketio');
    const updated = await matchService.setPairing(req.params.matchId, { player1Id, player2Id });

    io?.to(`match-${updated.id}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('match-updated', updated);
    res.json(updated);
  } catch (e) {
    console.error('setPairing error:', e);
    res.status(400).json({ error: e.message || 'Błąd ustawiania pary' });
  }
};

export const setLocked = async (req, res) => {
  try {
    const { locked = true } = req.body || {};
    const io = req.app.get('socketio');
    const updated = await matchService.setLocked(req.params.matchId, !!locked);

    io?.to(`match-${updated.id}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('match-updated', updated);
    res.json(updated);
  } catch (e) {
    console.error('setLocked error:', e);
    res.status(400).json({ error: e.message || 'Błąd blokowania meczu' });
  }
};

/* ------------------------------- ELIGIBLE LIST ------------------------------ */

export const getEligiblePlayersForMatch = async (req, res) => {
  try {
    const list = await matchService.getEligiblePlayersForMatch(req.params.matchId);
    res.json(list);
  } catch (e) {
    console.error('getEligiblePlayersForMatch error:', e);
    res.status(400).json({ error: e.message || 'Błąd pobierania dopuszczonych' });
  }
};
