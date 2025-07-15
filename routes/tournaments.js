// server/routes/tournaments.js
import { Router } from 'express'
import * as tournamentController from '../controllers/tournamentController.js'
import * as registrationController from '../controllers/registrationController.js'
import * as rolesController from '../controllers/rolesController.js'
import { ensureAuth } from '../middlewares/auth.js'
import prisma from '../prismaClient.js'
import * as tournamentService from '../services/tournamentService.js'

const router = Router()

// middleware: tylko creator lub zaproszony organizer
async function ensureTournyOrg(req, res, next) {
  const tournamentId = parseInt(req.params.id, 10)
  const userId = req.user.id
  const tour = await tournamentService.findTournamentById(tournamentId)
  if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' })
  if (tour.organizer_id === userId) return next()
  const hasRole = await prisma.tournamentUserRole.findFirst({
    where: { tournamentId, userId, role: 'organizer' }
  })
  if (hasRole) return next()
  return res.status(403).json({ error: 'Potrzebna rola organizatora turnieju' })
}

// „moje turnieje” dla organizatora
router.get('/mine', ensureAuth, tournamentController.getByOrganizer)

// publiczne
router.get('/', tournamentController.getAll)
router.get('/:id', tournamentController.getById)

// self-registration
router.post('/:id/registrations', ensureAuth, registrationController.createRegistration)

// panel zgłoszeń (tylko org)
router.get('/:id/registrations', ensureAuth, ensureTournyOrg, registrationController.getAllRegistrationsForOrganizer)
router.get('/:id/registrations/me', ensureAuth, registrationController.getMyRegistration)
router.get('/:id/registrations/count', registrationController.getAcceptedCount)

// CRUD turniejów
router.post('/',     ensureAuth, tournamentController.create)
router.put('/:id',   ensureAuth, ensureTournyOrg, tournamentController.update)
router.delete('/:id',ensureAuth, ensureTournyOrg, tournamentController.remove)

// zapraszanie zawodnika
router.post('/:id/invite',       ensureAuth, ensureTournyOrg, registrationController.inviteUser)
router.post('/:id/participants', ensureAuth, ensureTournyOrg, registrationController.inviteUser)

// role per-turniej
router.get('/:id/roles',    ensureAuth, ensureTournyOrg, rolesController.listRoles)
router.post('/:id/roles',   ensureAuth, ensureTournyOrg, rolesController.addRole)
router.delete('/:id/roles', ensureAuth, ensureTournyOrg, rolesController.removeRole)

export default router
