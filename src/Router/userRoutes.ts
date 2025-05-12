import express from 'express';
import userController from "../controllers/userController";
import { isAuthenticated } from '../middleware';

const router = express.Router();

/**
 * Routes publiques (ne nécessitent pas d'authentification)
 */
// Inscription d'un nouvel utilisateur
router.post('/register', userController.register);

// Connexion
router.post('/login', userController.login);

/**
 * Routes protégées (nécessitent une authentification)
 */
// Obtenir les détails d'un utilisateur
router.get('/:id', isAuthenticated, userController.getUserById);

// Mettre à jour un utilisateur (seul l'utilisateur lui-même ou un admin peut le faire)
router.put('/:id', isAuthenticated, userController.updateUser);

// Supprimer un utilisateur (seul l'utilisateur lui-même ou un admin peut le faire)
router.delete('/:id', isAuthenticated, userController.deleteUser);

// Récupérer tous les utilisateurs (pour les admins)
router.get('/', isAuthenticated, userController.getAllUsers);

export default router;