// server/controllers/tournamentController.js
import prisma from '../prismaClient.js';
import * as tournamentService from '../services/tournamentService.js';

export async function getAll(req, res) {
  try {
    // zamiast findAll() — wywołaj właściwy serwis:
    const tours = await tournamentService.findAllTournaments();
    res.json(tours);
  } catch (err) {
    console.error('💥 [getAll] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const tour = await tournamentService.findTournamentById(req.params.id);
    if (!tour) {
      return res.status(404).json({ error: 'Nie znaleziono turnieju' });
    }
    res.json(tour);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const tour = await tournamentService.createTournament({...req.body, organizer_id: req.user.id});
    res.status(201).json(tour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getByOrganizer(req, res) {
  try {
    const tours = await tournamentService.findTournamentsByOrganizer(req.user.id);
    res.json(tours);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const tour = await tournamentService.updateTournament(
      req.params.id,
      req.body
    );
    res.json(tour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    await tournamentService.deleteTournament(req.params.id);
    res.json({ message: 'Turniej usunięty' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


export const generateTournamentStructure = async (req, res) => {
  const { tournamentId } = req.params;
  try {
    const result = await matchService.generateGroupAndKnockoutMatches(tournamentId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const getTournamentSettings = async (req, res) => {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        // to, z czego korzystamy w generatorach/seedingu:
        format: true,
        groupSize: true,
        qualifiersPerGroup: true,
        allowByes: true,
        koSeedingPolicy: true,
        avoidSameGroupInR1: true,
        // możesz dorzucić to, co chcesz pokazać w UI:
        applicationsOpen: true,
        participant_limit: true,
      },
    });
    if (!t) return res.status(404).json({ error: 'Turniej nie znaleziony' });
    res.json(t);
  } catch (e) {
    console.error('getTournamentSettings error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

export const updateTournamentSettings = async (req, res) => {
  try {
    const {
      format,
      groupSize,
      qualifiersPerGroup,
      allowByes,
      koSeedingPolicy,
      avoidSameGroupInR1,
    } = req.body || {};

    const data = {};
    if (typeof format !== 'undefined') data.format = format;
    if (typeof groupSize !== 'undefined') data.groupSize = groupSize === null ? null : Number(groupSize);
    if (typeof qualifiersPerGroup !== 'undefined') data.qualifiersPerGroup = qualifiersPerGroup === null ? null : Number(qualifiersPerGroup);
    if (typeof allowByes !== 'undefined') data.allowByes = !!allowByes;
    if (typeof koSeedingPolicy !== 'undefined') data.koSeedingPolicy = koSeedingPolicy;
    if (typeof avoidSameGroupInR1 !== 'undefined') data.avoidSameGroupInR1 = !!avoidSameGroupInR1;

    const updated = await prisma.tournament.update({
      where: { id: Number(req.params.id) },
      data,
      select: {
        id: true,
        format: true,
        groupSize: true,
        qualifiersPerGroup: true,
        allowByes: true,
        koSeedingPolicy: true,
        avoidSameGroupInR1: true,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error('updateTournamentSettings error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

export async function createRegistration(req, res) {
  try {
    const reg = await tournamentService.registerForTournament(req.params.id, req.user.id);
    res.json(reg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function changeRegistrationStatus(req, res) {
  try {
    const upd = await tournamentService.updateRegistrationStatus(req.params.registrationId, req.body.status);
    res.json(upd);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}