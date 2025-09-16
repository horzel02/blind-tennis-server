// server/controllers/tournamentUserRoleController.js
import * as tournamentService from '../services/tournamentService.js';
import * as roleSvc from '../services/tournamentUserRoleService.js';
import prisma from '../prismaClient.js';

async function assertOrganizerPerm(tournamentId, callerId) {
  const tour = await tournamentService.findTournamentById(tournamentId);
  if (!tour) throw new Error('Turniej nie istnieje');

  const isCreator = tour.organizer_id === callerId;
  const isInvitedOrg = Boolean(
    await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId: callerId, role: 'organizer' },
    })
  );
  if (!isCreator && !isInvitedOrg) {
    const err = new Error('Brak uprawnień (tylko organizator)');
    err.status = 403;
    throw err;
  }
}

export async function listRoles(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    await assertOrganizerPerm(tournamentId, req.user.id);
    const roles = await roleSvc.getRolesForTournament(tournamentId);
    res.json(roles);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function addRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    await assertOrganizerPerm(tournamentId, req.user.id);

    const { userId, role } = req.body || {};
    if (!userId || !role) return res.status(400).json({ error: 'Brak userId lub role' });

    // unikaj duplikatów
    const exists = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId, role },
    });
    if (exists) return res.json(exists);

    const created = await roleSvc.addRole(tournamentId, userId, role);
    res.status(201).json(created);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function removeRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const role = req.params.role;
    await assertOrganizerPerm(tournamentId, req.user.id);

    if (!userId || !role) return res.status(400).json({ error: 'Brak userId lub role' });

    const result = await roleSvc.removeRole(tournamentId, userId, role); // deleteMany
    res.json({ deleted: result.count ?? result }); // deleteMany zwraca { count }
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}


export async function removeRoleById(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const roleRecordId = parseInt(req.params.roleId, 10);
    await assertOrganizerPerm(tournamentId, req.user.id);
    if (Number.isNaN(roleRecordId)) {
      return res.status(400).json({ error: 'Nieprawidłowe roleId' });
    }
    const rec = await prisma.tournamentuserrole.findUnique({ where: { id: roleRecordId } });
    if (!rec || rec.tournamentId !== tournamentId) {
      return res.status(404).json({ error: 'Rola nie istnieje w tym turnieju' });
    }
    await roleSvc.removeRoleById(roleRecordId);
    res.json({ deleted: 1 });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}