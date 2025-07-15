// server/controllers/tournamentUserRoleController.js
import * as roleService from '../services/tournamentUserRoleService.js';
import * as tournamentService from '../services/tournamentService.js';

export async function listRoles(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const roles = await roleService.getRolesForTournament(tournamentId);
    res.json(roles);
  } catch (err) {
    console.error('💥 [listRoles] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function assignRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const organizerId = req.user.id;
    const { userId, role } = req.body;

    // 1) walidacja turnieju i uprawnień
    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour || tour.organizer_id !== organizerId) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    // 2) dozwolone role
    if (!['organizer','participant','referee'].includes(role)) {
      return res.status(400).json({ error: 'Nieprawidłowa rola' });
    }

    // 3) dodajemy
    const assignment = await roleService.addRole(tournamentId, userId, role);
    res.status(201).json(assignment);
  } catch (err) {
    console.error('💥 [assignRole] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function unassignRoleById(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const roleRecordId = parseInt(req.params.roleId, 10);
    await roleService.removeRoleById(roleRecordId);
    res.json({ message: 'Rola usunięta' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
