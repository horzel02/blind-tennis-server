// server/routes/matchRoutes.js
import { Router } from 'express';
import * as matchController from '../controllers/matchController.js';
import { ensureAuth } from '../middlewares/auth.js';
import { ensureMatchRefereeOrOrganizer, ensureMatchOrganizer, ensureTournamentOrganizerFromBody } from '../middlewares/matchAuth.js';
import { ensureTournyOrg } from './tournaments.js';

const router = Router();

router.post('/:tournamentId/generate-matches', ensureAuth, ensureTournyOrg, matchController.generateTournamentStructure);
router.get('/:tournamentId/matches', matchController.getMatchesByTournamentId);
router.get('/:matchId', matchController.getMatchById);
router.put('/:matchId/score', ensureAuth, ensureMatchRefereeOrOrganizer, matchController.updateMatchScore);

// pojedynczy – tylko organizator meczu/turnieju
router.put('/:matchId/referee', ensureAuth, ensureMatchOrganizer, matchController.setMatchReferee);

// BULK – organizator turnieju na podstawie tournamentId w body
router.put('/referee/bulk', ensureAuth, ensureTournamentOrganizerFromBody, matchController.assignRefereeBulk);

export default router;
