import express, { Request, Response, NextFunction } from 'express';
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

app.use(cors({
  origin: '*',  // Autorise toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware pour s'assurer que tous les en-têtes CORS sont bien présents
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
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