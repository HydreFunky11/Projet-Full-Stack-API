import express from 'express';
import characterController from '../controllers/charactereController';
import { isAuthenticated } from '../middleware';

const router = express.Router();

/**
 * Routes pour la gestion des personnages
 * Toutes les routes nécessitent une authentification
 */

// Créer un nouveau personnage (POST /characters)
router.post('/', isAuthenticated, characterController.createCharacter);

// Récupérer un personnage par son ID (GET /characters/:id)
router.get('/:id', isAuthenticated, characterController.getCharacterById);

// Récupérer les personnages d'un utilisateur (GET /characters) ou (GET /characters?userId=123)
router.get('/', isAuthenticated, characterController.getCharacters);

// Mettre à jour un personnage (PUT /characters/:id)
router.put('/:id', isAuthenticated, characterController.updateCharacter);

// Supprimer un personnage (DELETE /characters/:id)
router.delete('/:id', isAuthenticated, characterController.deleteCharacter);

// Personnages d'une session spécifique (GET /characters/session/:sessionId)
router.get('/session/:sessionId', isAuthenticated, characterController.getCharactersBySession);

// Associer un personnage à une session (PUT /characters/:id/assign-session)
router.put('/:id/assign-session', isAuthenticated, characterController.associateWithSession);

export default router;