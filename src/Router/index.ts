import express from 'express';
import userRoutes from './userRoutes';
import characterRoutes from './charactereRoutes';
import sessionRoutes from './sessionRoutes';
import diceRollRoutes from './diceRollRoutes';

const router = express.Router();

// Monter les routes
router.use('/users', userRoutes);
router.use('/characters', characterRoutes);
router.use('/sessions', sessionRoutes);
router.use('/dice-rolls', diceRollRoutes);

export default router;