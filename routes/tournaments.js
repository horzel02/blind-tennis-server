// server/routes/tournaments.js
import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController.js';
import * as registrationController from '../controllers/registrationController.js';
import * as rolesController from '../controllers/rolesController.js';
import * as matchController from '../controllers/matchController.js'; // Dodano
import { ensureAuth } from '../middlewares/auth.js';
import prisma from '../prismaClient.js';

const router = Router();

// Middleware: tylko creator lub zaproszony organizer
// Ta wersja jest poprawiona i działa poprawnie z :id oraz :tournamentId
export async function ensureTournyOrg(req, res, next) {
  const tournamentId = parseInt(req.params.id || req.params.tournamentId, 10);
  const userId = req.user.id;

  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID turnieju' });
  }

  // Użycie Prisma Client do znalezienia turnieju
  const tour = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      tournamentUserRoles: true,
    }
  });

  if (!tour) {
    return res.status(404).json({ error: 'Turniej nie istnieje' });
  }

  // Sprawdzamy czy użytkownik jest twórcą lub ma rolę organizatora
  const isCreator = tour.organizer_id === userId;
  const hasRole = tour.tournamentUserRoles.some(
    role => role.userId === userId && role.role === 'organizer'
  );

  if (isCreator || hasRole) {
    // Możesz przypisać turniej do req, aby nie musieć go ponownie pobierać w kontrolerze
    req.tournament = tour;
    return next();
  }

  return res.status(403).json({ error: 'Potrzebna rola organizatora turnieju' });
}


// „moje turnieje” dla organizatora
router.get('/mine', ensureAuth, tournamentController.getByOrganizer);

// publiczne
router.get('/', tournamentController.getAll);
router.get('/:id', tournamentController.getById);
router.get('/:id/registrations/count', registrationController.getAcceptedCount);
router.get('/:id/registrations/me', ensureAuth, registrationController.getMyRegistration);

// self-registration
router.post('/:id/registrations', ensureAuth, registrationController.createRegistration);

// panel zgłoszeń (tylko org)
router.get('/:id/registrations', ensureAuth, ensureTournyOrg, registrationController.getAllRegistrationsForOrganizer);

// CRUD turniejów
router.post('/', ensureAuth, tournamentController.create);
router.put('/:id', ensureAuth, ensureTournyOrg, tournamentController.update);
router.delete('/:id', ensureAuth, ensureTournyOrg, tournamentController.remove);

// zapraszanie zawodnika
router.post('/:id/invite', ensureAuth, ensureTournyOrg, registrationController.inviteUser);
router.post('/:id/participants', ensureAuth, ensureTournyOrg, registrationController.inviteUser);

// role per-turniej
router.get('/:id/roles', ensureAuth, ensureTournyOrg, rolesController.listRoles);
router.post('/:id/roles', ensureAuth, ensureTournyOrg, rolesController.addRole);
router.delete('/:id/roles/:roleId', ensureAuth, ensureTournyOrg, rolesController.removeRole);

// Mecze
router.post('/:tournamentId/generate-matches', ensureAuth, ensureTournyOrg, matchController.generateTournamentStructure);
router.get('/:tournamentId/matches', matchController.getMatchesByTournamentId);

// Ustawienia turnieju
router.get('/:id/settings', ensureAuth, tournamentController.getTournamentSettings);
router.put('/:id/settings', ensureAuth, tournamentController.updateTournamentSettings);

export default router;