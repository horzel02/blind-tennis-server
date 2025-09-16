// server/controllers/registrationController.js
import prisma from '../prismaClient.js';
import * as registrationService from '../services/registrationService.js';
import * as tournamentService from '../services/tournamentService.js';
import * as tournamentUserRoleService from '../services/tournamentUserRoleService.js';

// POST /api/tournaments/:id/registrations
export async function createRegistration(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' });
    if (tour.type !== 'open')
      return res.status(400).json({ error: 'Ten turniej jest wyłącznie na zaproszenia' });
    if (!tour.applicationsOpen)
      return res.status(400).json({ error: 'Zgłoszenia są zamknięte' });
    if (tour.registration_deadline && new Date() > new Date(tour.registration_deadline))
      return res.status(400).json({ error: 'Termin rejestracji minął' });

    const existing = await registrationService.findByTournamentAndUser(tournamentId, userId);
    if (existing)
      return res.status(400).json({ error: 'Już wysłałeś zgłoszenie do tego turnieju' });

    const reg = await registrationService.createRegistration(tournamentId, userId);
    return res.status(201).json(reg);
  } catch (err) {
    console.error('💥 [createRegistration]', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/tournaments/:id/invite
export async function inviteUser(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const { userId }   = req.body;
    const callerId     = req.user.id;

    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' });

    const isCreator = tour.organizer_id === callerId;
    const isInvitedOrg = Boolean(
      await prisma.tournamentuserrole.findFirst({
        where: { tournamentId, userId: callerId, role: 'organizer' }
      })
    );
    if (!isCreator && !isInvitedOrg) {
      return res.status(403).json({ error: 'Brak uprawnień (tylko organizator)' });
    }

    const existing = await registrationService.findByTournamentAndUser(tournamentId, userId);
    if (existing) {
      if (existing.status === 'rejected') {
        const updated = await registrationService.updateRegistrationStatus(existing.id, 'invited');
        return res.json(updated);
      }
      return res.status(400).json({ error: 'Ten gracz już jest zgłoszony' });
    }

    // KLUCZ: status = 'invited'
    const reg = await registrationService.createRegistration(
      tournamentId,
      userId,
      'invited',
      { invitedBy: callerId } // opcjonalnie, jeśli masz kolumnę
    );
    return res.status(201).json(reg);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/tournaments/:id/registrations
export async function getAllRegistrationsForOrganizer(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // 1) Pobierz turniej
    const tourn = await tournamentService.findTournamentById(tournamentId);
    if (!tourn) {
      return res.status(404).json({ error: 'Turniej nie istnieje' });
    }

    // 2) Sprawdź czy to twórca turnieju
    if (tourn.organizer_id !== userId) {
      // 3) Jeśli nie – sprawdź czy w tabeli tournamentUserRole ma rolę 'organizer'
      const row = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId, userId, role: 'organizer' }
      });
      if (!row) {
        return res.status(403).json({ error: 'Tylko organizator może przeglądać zgłoszenia' });
      }
    }

    // 4) Jeśli któryś z powyższych warunków przeszedł - zwróć zgłoszenia
    const regs = await registrationService.getRegistrationsByTournament(tournamentId);
    return res.json(regs);

  } catch (err) {
    console.error('💥 [getAllRegistrationsForOrganizer] wyjątek:', err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/tournaments/:id/registrations/me 
export async function getMyRegistration(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour) {
      return res.status(404).json({ error: 'Turniej nie istnieje' });
    }

    const reg = await registrationService.findByTournamentAndUser(tournamentId, userId);
    if (!reg) {
      return res.json(null);
    }

    const regWithUser = await registrationService.findByIdWithUser(reg.id);
    res.json(regWithUser);
  } catch (err) {
    console.error('💥 [getMyRegistration] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/tournaments/:id/registrations/count 
export async function getAcceptedCount(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const tour = await tournamentService.findTournamentById(tournamentId);
    if (!tour) {
      return res.status(404).json({ error: 'Turniej nie istnieje' });
    }
    const count = await registrationService.countAcceptedRegistrations(tournamentId);
    res.json({ acceptedCount: count });
  } catch (err) {
    console.error('💥 [getAcceptedCount] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/registrations/:regId
export async function updateRegistrationStatus(req, res) {
  try {
    const regId = parseInt(req.params.regId, 10);
    const { status } = req.body; // 'accepted' | 'rejected' | 'pending'
    const userId = req.user.id;

    // 1) Pobierz zgłoszenie + turniej
    const reg = await registrationService.findById(regId);
    if (!reg) return res.status(404).json({ error: 'Zgłoszenie nie istnieje' });
    const tourn = await tournamentService.findTournamentById(reg.tournamentId);

    // 2) Dowiedz się, czy to twórca turnieju…
    const isCreator = tourn.organizer_id === userId;
    // …czy zaproszony organizator
    const row = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: tourn.id, userId, role: 'organizer' }
    });
    const isInvitedOrg = Boolean(row);

    // 3) Teraz użyj tych flag w logice uprawnień:

    // a) Cofnięcie zaakceptowanego → tylko org. lub zaproszony org. może do 'pending'
    if (reg.status === 'accepted') {
      if (!(isCreator || isInvitedOrg) || status !== 'pending') {
        return res.status(403).json({ error: 'Tylko organizator może anulować zaakceptowane' });
      }
    }
    // b) Cofnięcie odrzuconego → to samo
    else if (reg.status === 'rejected') {
      if (!(isCreator || isInvitedOrg) || status !== 'pending') {
        return res.status(403).json({ error: 'Tylko organizator może przywrócić odrzucone' });
      }
    }
    // c) Zaproszenie → tylko zaproszony user może przyjąć
    else if (reg.status === 'invited') {
      if (!(status === 'accepted' && reg.userId === userId)) {
        return res.status(403).json({ error: 'Do anulowania zaproszenia użyj DELETE' });
      }
    }
    // d) Self-registration (pending) → org. lub zaproszony org. może accepted/rejected
    else if (reg.status === 'pending') {
      if (!((isCreator || isInvitedOrg) && ['accepted', 'rejected'].includes(status))) {
        return res.status(403).json({ error: 'Tylko organizator może zdecydować o zgłoszeniu' });
      }
    }
    // e) Inne → nie pozwalamy
    else {
      return res.status(400).json({ error: 'Nie można zmienić tego statusu' });
    }

    // 4) Wykonaj update
    const updated = await registrationService.updateRegistrationStatus(regId, status);

    // 5) Jeżeli status zmienił się na "accepted", dodaj rolę "participant"
    if (status === 'accepted') {
      try {
        await tournamentUserRoleService.addRole(tourn.id, reg.userId, 'participant');
      } catch (e) {

      }
    }
   return res.json(updated);

  } catch (err) {
    console.error('💥 [updateRegistrationStatus] wyjątek:', err);
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/registrations/:regId
// Usunięcie zgłoszenia lub anulowanie zaproszenia
export async function deleteRegistration(req, res) {
  try {
    const regId = parseInt(req.params.regId, 10);
    const userId = req.user.id;
    const isAdminOrOrganizer = req.user.roles.includes('admin');

    const reg = await registrationService.findById(regId);
    if (!reg) {
      return res.status(404).json({ error: 'Zgłoszenie nie istnieje' });
    }
    const tour = await tournamentService.findTournamentById(reg.tournamentId);
    const canDelete = (
      reg.userId === userId ||
      tour.organizer_id === userId ||
      isAdminOrOrganizer
    );
    if (!canDelete) {
      return res.status(403).json({ error: 'Brak uprawnień do usunięcia zgłoszenia' });
    }

    await tournamentUserRoleService.removeRole(reg.tournamentId, reg.userId, 'participant');
    await registrationService.deleteRegistration(regId);
    res.json({ message: 'Zgłoszenie usunięte' });
  } catch (err) {
    console.error('💥 [deleteRegistration] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}


export async function getAllMyRegistrations(req, res) {
  try {
    const userId = req.user.id
    // serwis zwróci listę z includem turnieju
    const regs = await registrationService.findAllByUser(userId)
    // dla bezpieczeństwa możesz tutaj przemapować odpowiedź, np.:
    const out = regs.map(r => ({
      registrationId: r.id,
      status:         r.status,
      tournament:     r.tournament   // zawiera cały obiekt turnieju
    }))
    res.json(out)
  } catch (err) {
    console.error('💥 [getAllMyRegistrations]', err)
    res.status(500).json({ error: err.message })
  }
}
