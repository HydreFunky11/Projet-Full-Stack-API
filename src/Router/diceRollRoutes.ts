import express from 'express';
import diceRollController from '../controllers/diceRollController';
import { isAuthenticated } from '../middleware';

const router = express.Router();

/**
 * Routes pour la gestion des jets de dés
 * Toutes les routes nécessitent une authentification
 */

// Effectuer un jet de dés (POST /dice-rolls)
router.post('/', isAuthenticated, diceRollController.rollDice);

// Récupérer les jets de dés d'une session (GET /dice-rolls?sessionId=123)
router.get('/', isAuthenticated, diceRollController.getDiceRollsBySession);

// Récupérer un jet de dés spécifique par son ID (GET /dice-rolls/:id)
router.get('/:id', isAuthenticated, diceRollController.getDiceRollById);

export default router;