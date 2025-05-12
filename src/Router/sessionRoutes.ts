import express from 'express';
import sessionController from '../controllers/sessionController';
import { isAuthenticated, extractUserFromToken } from '../middleware';

const router = express.Router();

// Remplacer cette ligne
// router.get('/:id', isAuthenticated, sessionController.getSessionById);

// Par celle-ci (permettre l'accès à la session même si non authentifié)
router.get('/:id', extractUserFromToken, sessionController.getSessionById);

// Même chose pour la liste des sessions
// router.get('/', isAuthenticated, sessionController.getSessions);
router.get('/', extractUserFromToken, sessionController.getSessions);

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