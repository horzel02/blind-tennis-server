// server/controllers/matchController.js
import prisma from '../prismaClient.js';
import * as matchService from '../services/matchService.js';

/**
 * Kontroler do pobierania meczów dla danego turnieju.
 */
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

/**
 * Kontroler do pobierania pojedynczego meczu po ID.
 */
export const getMatchById = async (req, res) => {
  const { matchId } = req.params;
  try {
    const match = await matchService.getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Mecz nie znaleziono.' });
    }
    res.status(200).json(match);
  } catch (error) {
    console.error('Błąd pobierania pojedynczego meczu:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/**
 * Kontroler do aktualizacji wyników meczu.
 */
export const updateMatchScore = async (req, res) => {
  const io = req.app.get('socketio');
  const { matchId } = req.params;
  const { status, winnerId, matchSets } = req.body;

  try {
    const updatedMatch = await matchService.updateMatchScore(matchId, { status, winnerId, matchSets });

    // tylko do pokoju tego meczu (panel sędziego / live widz)
    io.to(`match-${updatedMatch.id}`).emit('match-updated', updatedMatch);
    // oraz do pokoju turnieju – żeby lista przestawiła zakładki
    io.to(`tournament-${updatedMatch.tournamentId}`).emit('match-status-changed', {
      matchId: updatedMatch.id,
      status: updatedMatch.status, // 'finished'
    });

    res.status(200).json(updatedMatch);
  } catch (error) {
    console.error('Błąd aktualizacji wyników meczu:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/**
 * Kontroler do generowania struktury meczów w turnieju.
 */
export const generateTournamentStructure = async (req, res) => {
  const { tournamentId } = req.params;
  try {
    const result = await matchService.generateGroupAndKnockoutMatches(tournamentId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const setMatchReferee = async (req, res) => {
  const io = req.app.get('socketio');
  const { matchId } = req.params;
  const { refereeId } = req.body; // null => usuń sędziego

  try {
    const meta = await prisma.match.findUnique({
      where: { id: Number(matchId) },
      select: { id: true, tournamentId: true, player1Id: true, player2Id: true },
    });
    if (!meta) return res.status(404).json({ error: 'Mecz nie znaleziono' });

    if (refereeId != null) {
      // 1) ochrona: sędzia nie może grać w swoim meczu
      const rid = Number(refereeId);
      if (rid === meta.player1Id || rid === meta.player2Id) {
        return res.status(409).json({ error: 'Wybrany użytkownik jest zawodnikiem w tym meczu' });
      }
      // 2) walidacja roli referee w turnieju
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

    io.to(`tournament-${updated.tournamentId}`).emit('match-referee-changed', payload);
    io.to(`match-${updated.id}`).emit('match-referee-changed', payload);

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Błąd przypisywania sędziego:', error);
    return res.status(500).json({ error: error.message || 'Błąd serwera' });
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

    // autoryzacja (organizator)
    const isOrg = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: tId, userId: req.user.id, role: 'organizer' },
      select: { id: true },
    });
    if (!isOrg) return res.status(403).json({ error: 'Brak uprawnień' });

    const ids = matchIds.map(n => parseInt(n, 10)).filter(Boolean);

    // mecz musi należeć do turnieju
    const matches = await prisma.match.findMany({
      where: { tournamentId: tId, id: { in: ids } },
      select: { id: true, player1Id: true, player2Id: true },
    });
    if (!matches.length) return res.json({ updated: 0, skipped: ids });

    const refId = refereeId == null ? null : parseInt(refereeId, 10);

    // jeśli ustawiamy sędziego, waliduj rolę w turnieju
    if (refId != null) {
      const hasRefRole = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: tId, userId: refId, role: 'referee' },
        select: { id: true },
      });
      if (!hasRefRole) {
        return res.status(400).json({ error: 'Wybrany użytkownik nie ma roli sędziego w tym turnieju' });
      }
    }

    // odfiltruj konflikty: mecze, w których sędzia jest graczem
    const allowed = refId == null
      ? matches.map(m => m.id)
      : matches.filter(m => !(refId === m.player1Id || refId === m.player2Id)).map(m => m.id);

    const skipped = ids.filter(mid => !allowed.includes(mid));

    if (!allowed.length) {
      return res.json({ updated: 0, skipped });
    }

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
      io.to(`tournament-${tId}`).emit('match-referee-changed', payload);
      io.to(`match-${m.id}`).emit('match-referee-changed', payload);
    }

    return res.json({ updated: updatedMatches.length, skipped });
  } catch (e) {
    console.error('assignRefereeBulk error:', e);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
};

