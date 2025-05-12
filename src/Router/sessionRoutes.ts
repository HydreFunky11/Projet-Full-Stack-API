import express from 'express';
import sessionController from '../controllers/sessionController';
import { isAuthenticated, hasRoleInSession } from '../middleware';

const router = express.Router();

/**
 * Routes pour la gestion des sessions de jeu
 * Toutes les routes nécessitent une authentification
 */

// Créer une session (POST /sessions)
router.post('/', isAuthenticated, sessionController.createSession);

// Récupérer une session par son ID (GET /sessions/:id)
router.get('/:id', isAuthenticated, sessionController.getSessionById);

// Récupérer toutes les sessions ou filtrées (GET /sessions?status=en_cours&gmId=123&title=aventure)
router.get('/', isAuthenticated, sessionController.getSessions);

// Mettre à jour une session (PUT /sessions/:id)
router.put('/:id', isAuthenticated, sessionController.updateSession);

// Supprimer une session (DELETE /sessions/:id)
router.delete('/:id', isAuthenticated, sessionController.deleteSession);

// Ajouter un participant à une session (POST /sessions/:id/participants)
router.post('/:id/participants', isAuthenticated, sessionController.addParticipant);

// Retirer un participant d'une session (DELETE /sessions/:id/participants/:participantId)
router.delete('/:id/participants/:participantId', isAuthenticated, sessionController.removeParticipant);

export default router;