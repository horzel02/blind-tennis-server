// server/middlewares/auth.js
import prisma from '../prismaClient.js';

export function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Brak autoryzacji' });
}

export function isOrganizer(req, res, next) {
  if (!req.user?.roles?.includes('organizer')) {
    return res.status(403).json({ error: 'Brak uprawnień (tylko organizer)' });
  }
  next();
}

export function hasTournamentRole(requiredRole) {
  return async (req, res, next) => {
    const userId       = req.user?.id;
    const tournamentId = parseInt(req.params.id, 10);
    if (!userId) return res.status(401).json({ error: 'Brak autoryzacji' });

    const exists = await prisma.tournamentUserRole.findFirst({
      where: { userId, tournamentId, role: requiredRole }
    });
    if (!exists) {
      return res.status(403).json({ error: `Potrzebna rola ${requiredRole}` });
    }
    next();
  };
}
