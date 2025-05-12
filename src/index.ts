import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { extractUserFromToken } from './middleware';
import router from './Router';

// Charger les variables d'environnement
dotenv.config();

// Initialiser Prisma Client
const prisma = new PrismaClient();

// Initialiser l'application Express
const app = express();

// Configuration CORS avec support pour les cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(cookieParser()); // Ajouter le middleware cookie-parser
app.use(extractUserFromToken);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API REST - Bienvenue!' });
});

// Utiliser le router pour toutes les routes de l'API
app.use('/api', router);

// Démarrer le serveur
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur REST démarré sur http://localhost:${PORT}`);
});