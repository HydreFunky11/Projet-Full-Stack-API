import express, { Request, Response, NextFunction } from 'express';
// Suppression de l'import inutilisé de cors puisque vous avez implémenté votre propre middleware CORS
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
// Garder PrismaClient pour les autres fichiers qui pourraient l'utiliser via l'exportation
import { PrismaClient } from '@prisma/client';
import { extractUserFromToken } from './middleware';
import router from './Router';

// Charger les variables d'environnement
dotenv.config();

// Initialiser Prisma Client et l'exporter pour l'utiliser dans d'autres fichiers
export const prisma = new PrismaClient();

// Initialiser l'application Express
const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  // Récupérer l'origine de la requête
  const origin = req.headers.origin || '';
  
  // Autoriser l'origine spécifique de Vercel et localhost
  if (origin === process.env.FRONT_URL ||
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      // Ajouter l'URL de Vercel qui pose problème
      origin.includes('vercel.app')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  // Autoriser les credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Gérer les requêtes OPTIONS préalables (preflight)
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
});

// Middleware
app.use(express.json());
app.use(cookieParser()); // Ajouter le middleware cookie-parser
app.use(extractUserFromToken);

// Routes
app.get('/', (_req, res) => {
  res.json({ message: 'API REST - Bienvenue!' });
});

// Utiliser le router pour toutes les routes de l'API
app.use('/api', router);

// Démarrer le serveur
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur REST démarré sur http://localhost:${PORT}`);
});