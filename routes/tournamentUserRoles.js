// server/routes/tournamentUserRoles.js
import { Router } from 'express';
import {
  listRoles,
  assignRole,
  unassignRoleById
} from '../controllers/tournamentUserRoleController.js';
import { ensureAuth, hasTournamentRole } from '../middlewares/auth.js';

const router = Router({ mergeParams: true });

// GET  /api/tournaments/:id/roles
router.get('/', ensureAuth, hasTournamentRole('organizer'), listRoles);
// POST /api/tournaments/:id/roles   body: { userId, role }
router.post('/', ensureAuth, hasTournamentRole('organizer'), assignRole);
// DELETE /api/tournaments/:id/roles body: { userId, role }
router.delete('/:roleId', ensureAuth, hasTournamentRole('organizer'), unassignRoleById);

export default router;
