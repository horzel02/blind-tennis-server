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
