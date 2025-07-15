// server/controllers/rolesController.js
import * as roleService from '../services/tournamentUserRoleService.js';
import * as tournamentService from '../services/tournamentService.js';

export async function listRoles(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    // upewniamy się, że turniej istnieje i że to organizator/creator
    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' });
    // lista samych rekordów z userami
    const roles = await roleService.getRolesForTournament(tournamentId);
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function addRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const { userId, role } = req.body;
    // sprawdźmy uprawnienia organizatora (middleware)
    // utwórz wpis
    const added = await roleService.addRole(tournamentId, userId, role);
    res.status(201).json(added);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function removeRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const { userId, role } = req.body;
    await roleService.removeRole(tournamentId, userId, role);
    res.json({ message: 'Rola usunięta' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
