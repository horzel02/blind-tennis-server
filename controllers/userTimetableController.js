// server/controllers/userTimetableController.js
import prisma from '../prismaClient.js';

function parseIntSafe(v, d = 20) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
}

// GET /api/my/matches?role=player|referee&state=upcoming|live|finished&page=1&limit=20
export async function getMyMatches(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const role  = (req.query.role || 'player').toLowerCase();      // 'player'|'referee'
    const state = (req.query.state || 'upcoming').toLowerCase();    // 'upcoming'|'live'|'finished'
    const page  = parseIntSafe(req.query.page || '1', 1);
    const limit = Math.min(parseIntSafe(req.query.limit || '20', 20), 50);
    const skip  = (page - 1) * limit;

    // scope by role
    const roleWhere =
      role === 'referee'
        ? { refereeId: userId }
        : { OR: [{ player1Id: userId }, { player2Id: userId }] };

    // scope by state
    let stateWhere = {};
    let orderBy = [];
    if (state === 'upcoming') {
      // zaplanowane + oczekujące (bez zwycięzcy)
      stateWhere = {
        winnerId: null,
        status: { in: ['scheduled', 'pending', 'in_progress'] }
      };
      // najpierw te z terminem (ASC), potem bez terminu na końcu
      orderBy = [
        { matchTime: 'asc' },   // nulls last zależy od bazy — ok w MySQL/MariaDB; w razie czego i tak jest ok
        { id: 'asc' }
      ];
    } else if (state === 'live') {
      stateWhere = { status: 'in_progress' };
      orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
    } else {
      // finished
      stateWhere = { status: 'finished' };
      orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
    }

    const where = { ...roleWhere, ...stateWhere };

    const [items, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tournament: true,
          player1: true,
          player2: true,
          winner: true,
          referee: true,
          matchSets: { orderBy: { setNumber: 'asc' } }
        }
      }),
      prisma.match.count({ where })
    ]);

    return res.json({
      page,
      limit,
      total,
      items
    });
  } catch (e) {
    console.error('[getMyMatches]', e);
    res.status(500).json({ error: 'Nie udało się pobrać meczów' });
  }
}
