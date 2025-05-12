import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/';

const prisma = new PrismaClient();

/**
 * Contrôleur utilisateur qui regroupe toutes les fonctions liées aux utilisateurs
 */
const userController = {
  /**
   * Inscription d'un nouvel utilisateur
   * POST /register
   */
  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = req.body;

      // Vérifier si les informations nécessaires sont fournies
      if (!username || !email || !password) {
        res.status(400).json({
          success: false,
          message: "Tous les champs sont obligatoires (username, email, password)"
        });
        return;
      }

      // Vérifier si l'email ou le nom d'utilisateur existe déjà
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { username }
          ]
        }
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: "Un utilisateur avec cet email ou ce nom d'utilisateur existe déjà"
        });
        return;
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });

      // Générer un token JWT
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès",
        token,
        user
      });
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de l'utilisateur",
        error: (error as Error).message
      });
    }
  },

  /**
   * Connexion d'un utilisateur
   * POST /login
   */
  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Vérifier si email et mot de passe sont fournis
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: "Email et mot de passe requis"
        });
        return;
      }

      // Trouver l'utilisateur par email
      const user = await prisma.user.findUnique({
        where: { email }
      });

      // Vérifier si l'utilisateur existe et si le mot de passe est correct
      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({
          success: false,
          message: "Email ou mot de passe incorrect"
        });
        return;
      }

      // Générer un token JWT
      const token = generateToken(user);

      // Renvoyer le token et les informations de l'utilisateur (sans le mot de passe)
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        message: "Connexion réussie",
        token,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la connexion",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer les détails d'un utilisateur par ID
   * GET /:id
   */
  getUserById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      // Vérifier si l'ID est un nombre valide
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: "ID d'utilisateur invalide"
        });
        return;
      }

      // Récupérer l'utilisateur sans le mot de passe
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          characters: true,
          sessionsAsGM: true,
          participations: {
            include: {
              session: true
            }
          }
        }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération de l'utilisateur",
        error: (error as Error).message
      });
    }
  },

  /**
   * Mettre à jour un utilisateur
   * PUT /:id
   */
  updateUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const { username, email, password } = req.body;

      // Vérifier si l'ID est un nombre valide
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: "ID d'utilisateur invalide"
        });
        return;
      }

      // Vérifier si l'utilisateur existe
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }

      // Vérifier si l'utilisateur connecté a le droit de modifier cet utilisateur
      if (req.user.id !== userId) {
        // Vérifier si l'utilisateur est admin dans le système
        const isSystemAdmin = await prisma.sessionParticipants.findFirst({
          where: {
            userId: req.user.id,
            role: 'admin'
          }
        });

        if (!isSystemAdmin) {
          res.status(403).json({
            success: false,
            message: "Vous n'êtes pas autorisé à modifier cet utilisateur"
          });
          return;
        }
      }

      // Préparer les données à mettre à jour
      const updateData: any = {};
      
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (password) updateData.password = await bcrypt.hash(password, 10);

      // Mettre à jour l'utilisateur
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true
        }
      });

      res.json({
        success: true,
        message: "Utilisateur mis à jour avec succès",
        user: updatedUser
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour de l'utilisateur",
        error: (error as Error).message
      });
    }
  },

  /**
   * Supprimer un utilisateur
   * DELETE /:id
   */
  deleteUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      // Vérifier si l'ID est un nombre valide
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: "ID d'utilisateur invalide"
        });
        return;
      }

      // Vérifier si l'utilisateur existe
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }

      // Vérifier si l'utilisateur connecté a le droit de supprimer cet utilisateur
      if (req.user.id !== userId) {
        // Vérifier si l'utilisateur est admin dans le système
        const isSystemAdmin = await prisma.sessionParticipants.findFirst({
          where: {
            userId: req.user.id,
            role: 'admin'
          }
        });

        if (!isSystemAdmin) {
          res.status(403).json({
            success: false,
            message: "Vous n'êtes pas autorisé à supprimer cet utilisateur"
          });
          return;
        }
      }

      // Supprimer d'abord les relations
      await prisma.sessionParticipants.deleteMany({
        where: { userId }
      });
      
      await prisma.diceRoll.deleteMany({
        where: { userId }
      });
      
      await prisma.character.deleteMany({
        where: { userId }
      });
      
      // Mettre à jour les sessions dont cet utilisateur est le GM
      await prisma.session.deleteMany({
        where: { gmId: userId }
      });

      // Supprimer l'utilisateur
      await prisma.user.delete({
        where: { id: userId }
      });

      res.json({
        success: true,
        message: "Utilisateur supprimé avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression de l'utilisateur",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer tous les utilisateurs (admin only)
   * GET /users
   */
  getAllUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      // Vérifier si l'utilisateur est admin dans le système
      const isSystemAdmin = await prisma.sessionParticipants.findFirst({
        where: {
          userId: req.user.id,
          role: 'admin'
        }
      });

      if (!isSystemAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à cette ressource"
        });
        return;
      }

      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              characters: true,
              sessionsAsGM: true,
              participations: true
            }
          }
        }
      });

      res.json({
        success: true,
        count: users.length,
        users
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des utilisateurs",
        error: (error as Error).message
      });
    }
  }
};

export default userController;