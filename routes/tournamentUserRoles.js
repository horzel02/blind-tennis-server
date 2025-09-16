// server/routes/tournamentUserRoles.js
import { Router } from 'express';
import {
  listRoles,
  addRole,
  removeRole,
  removeRoleById
} from '../controllers/tournamentUserRoleController.js';
import { ensureAuth, hasTournamentRole } from '../middlewares/auth.js';
import { ensureTournyOrg } from './tournaments.js';

const router = Router({ mergeParams: true });

// GET  /api/tournaments/:id/roles
router.get('/', ensureAuth, hasTournamentRole('organizer'), listRoles);
// POST /api/tournaments/:id/roles   body: { userId, role }
router.post('/', ensureAuth, hasTournamentRole('organizer'), addRole);
// DELETE /api/tournaments/:id/roles body: { userId, role }
router.delete('/:id/roles/:role/:userId', ensureAuth, ensureTournyOrg, removeRole);
router.delete('/:id/roles/:roleId',       ensureAuth, ensureTournyOrg, removeRoleById);

export default router;
