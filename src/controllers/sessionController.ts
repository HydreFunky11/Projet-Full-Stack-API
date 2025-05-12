import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Contrôleur pour la gestion des sessions de jeu
 */
const sessionController = {
  /**
   * Créer une nouvelle session
   * POST /sessions
   */
  createSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, description, scheduledAt, status } = req.body;
      const userId = req.user.id; // L'ID de l'utilisateur connecté

      // Vérifier que les champs requis sont présents
      if (!title) {
        res.status(400).json({
          success: false,
          message: "Le titre de la session est obligatoire"
        });
        return;
      }

      // Créer la session
      const session = await prisma.session.create({
        data: {
          title,
          description,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          status: status || 'planifiée', // Valeur par défaut si non spécifiée
          gmId: userId
        },
        include: {
          gm: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Ajouter automatiquement l'utilisateur créateur comme MJ (participant avec le rôle "mj")
      await prisma.sessionParticipants.create({
        data: {
          sessionId: session.id,
          userId: userId,
          role: 'mj'
        }
      });

      res.status(201).json({
        success: true,
        message: "Session créée avec succès",
        session
      });
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la session",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer une session par son ID
   * GET /sessions/:id
   */
    getSessionById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sessionId = parseInt(id);
      const userId = req.user?.id; // Ajout de ? car l'utilisateur pourrait ne pas être connecté

      // Vérifier si l'ID est valide
      if (isNaN(sessionId)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }

      // Récupérer la session avec ses relations
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          gm: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              },
              character: true
            }
          },
          characters: true,
          diceRolls: {
            take: 20,
            orderBy: {
              timestamp: 'desc'
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              },
              character: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }

      // SUPPRIMEZ CETTE VÉRIFICATION - N'importe quel utilisateur connecté peut voir les sessions
      /*
      // Vérifier si l'utilisateur a le droit de voir cette session
      // (GM, participant, ou admin)
      const isGM = session.gmId === userId;
      const isParticipant = session.participants.some(p => p.userId === userId);
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = session.participants.find(p => p.userId === userId);
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isParticipant && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à cette session"
        });
        return;
      }
      */

      res.json({
        success: true,
        session
      });
    } catch (error) {
      console.error("Erreur lors de la récupération de la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération de la session",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer toutes les sessions (ou filtrées)
   * GET /sessions?status=en cours&gmId=123
   */
  // Dans Projet-Full-Stack-API/src/controllers/sessionController.ts
  getSessions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, gmId, title } = req.query;
      const userId = req.user?.id; // userId peut être undefined si l'utilisateur n'est pas connecté
      
      // Construire les filtres
      const where: any = {};
      
      if (status) {
        where.status = status as string;
      }
      
      if (gmId) {
        const gmIdParam = parseInt(gmId as string);
        if (isNaN(gmIdParam)) {
          res.status(400).json({
            success: false,
            message: "ID de GM invalide"
          });
          return;
        }
        where.gmId = gmIdParam;
      }
      
      if (title) {
        where.title = {
          contains: title as string,
          mode: 'insensitive' // Recherche insensible à la casse
        };
      }
      
      // Récupérer toutes les sessions (pas de filtrage par userId)
      const sessions = await prisma.session.findMany({
        where,
        include: {
          gm: {
            select: {
              id: true,
              username: true
            }
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: {
                select: {
                  username: true
                }
              }
            }
          },
          _count: {
            select: {
              characters: true,
              diceRolls: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        }
      });
  
      res.json({
        success: true,
        count: sessions.length,
        sessions
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des sessions:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des sessions",
        error: (error as Error).message
      });
    }
  },

  /**
   * Mettre à jour une session
   * PUT /sessions/:id
   */
  updateSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sessionId = parseInt(id);
      const { title, description, scheduledAt, status } = req.body;
      const userId = req.user.id;

      // Vérifier si l'ID est valide
      if (isNaN(sessionId)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: true
        }
      });

      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }

      // Vérifier les permissions (seul le GM ou un admin peut modifier)
      const isGM = session.gmId === userId;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = session.participants.find(p => p.userId === userId);
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier cette session"
        });
        return;
      }

      // Préparer les données à mettre à jour
      const updateData: any = {};
      
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (status) updateData.status = status;

      // Mettre à jour la session
      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: updateData,
        include: {
          gm: {
            select: {
              id: true,
              username: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        message: "Session mise à jour avec succès",
        session: updatedSession
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour de la session",
        error: (error as Error).message
      });
    }
  },

  /**
   * Ajouter un participant à une session
   * POST /sessions/:id/participants
   */
    /**
   * Ajouter un participant à une session
   * POST /sessions/:id/participants
   */
  addParticipant: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sessionId = parseInt(id);
      const { userId, characterId, role } = req.body;
      const currentUserId = req.user.id;

      // Vérifier si l'ID est valide
      if (isNaN(sessionId)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }

      // Vérifier les données nécessaires
      if (!userId || !role) {
        res.status(400).json({
          success: false,
          message: "userId et role sont obligatoires"
        });
        return;
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: true
        }
      });

      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }

      // Vérifier les permissions
      const isGM = session.gmId === currentUserId;
      const isSelf = userId === currentUserId; // L'utilisateur veut s'ajouter lui-même
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = session.participants.find(p => p.userId === currentUserId);
      const isAdmin = participantData?.role === 'admin';

      // Si ce n'est pas soi-même qui s'ajoute (auto-inscription), alors vérifier les permissions d'admin/GM
      if (!isSelf && !isGM && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à ajouter ce participant"
        });
        return;
      }

      // Vérifier si l'utilisateur existe
      const userExists = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!userExists) {
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }

      // Vérifier si le personnage existe (si fourni)
      if (characterId) {
        const characterExists = await prisma.character.findUnique({
          where: { 
            id: characterId,
            userId // Vérifier que le personnage appartient à l'utilisateur
          }
        });

        if (!characterExists) {
          res.status(404).json({
            success: false,
            message: "Personnage non trouvé ou n'appartient pas à l'utilisateur spécifié"
          });
          return;
        }
      }

      // Vérifier si l'utilisateur est déjà participant
      const existingParticipant = await prisma.sessionParticipants.findFirst({
        where: {
          sessionId,
          userId
        }
      });

      if (existingParticipant) {
        res.status(400).json({
          success: false,
          message: "L'utilisateur est déjà participant à cette session"
        });
        return;
      }

      // Ajouter le participant
      const participant = await prisma.sessionParticipants.create({
        data: {
          sessionId,
          userId,
          characterId,
          role: isSelf && !isGM ? 'joueur' : role // Si c'est une auto-inscription et pas le GM, le rôle est joueur par défaut
        },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          },
          character: true
        }
      });

      res.status(201).json({
        success: true,
        message: "Participant ajouté avec succès",
        participant
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout du participant:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'ajout du participant",
        error: (error as Error).message
      });
    }
  },

  /**
   * Supprimer une session
   * DELETE /sessions/:id
   */
  deleteSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sessionId = parseInt(id);
      const userId = req.user.id;

      // Vérifier si l'ID est valide
      if (isNaN(sessionId)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: true
        }
      });

      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }

      // Vérifier les permissions (seul le GM ou un admin peut supprimer)
      const isGM = session.gmId === userId;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = session.participants.find(p => p.userId === userId);
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à supprimer cette session"
        });
        return;
      }

      // Supprimer d'abord les relations
      await prisma.sessionParticipants.deleteMany({
        where: { sessionId }
      });
      
      await prisma.diceRoll.deleteMany({
        where: { sessionId }
      });
      
      // Mettre à jour les personnages pour les détacher de la session
      await prisma.character.updateMany({
        where: { sessionId },
        data: { sessionId: null }
      });

      // Supprimer la session
      await prisma.session.delete({
        where: { id: sessionId }
      });

      res.json({
        success: true,
        message: "Session supprimée avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression de la session",
        error: (error as Error).message
      });
    }
  },

  /**
   * Retirer un participant d'une session
   * DELETE /sessions/:id/participants/:participantId
   */
  removeParticipant: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, participantId } = req.params;
      const sessionId = parseInt(id);
      const participantIdNum = parseInt(participantId);
      const userId = req.user.id;

      // Vérifier si les IDs sont valides
      if (isNaN(sessionId) || isNaN(participantIdNum)) {
        res.status(400).json({
          success: false,
          message: "IDs invalides"
        });
        return;
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: true
        }
      });

      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }

      // Récupérer le participant pour vérifier les permissions
      const participant = await prisma.sessionParticipants.findUnique({
        where: { id: participantIdNum }
      });

      if (!participant || participant.sessionId !== sessionId) {
        res.status(404).json({
          success: false,
          message: "Participant non trouvé dans cette session"
        });
        return;
      }

      // Vérifier les permissions
      const isGM = session.gmId === userId;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = session.participants.find(p => p.userId === userId);
      const isAdmin = participantData?.role === 'admin';
      
      const isSelf = participant.userId === userId;

      if (!isGM && !isAdmin && !isSelf) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à retirer ce participant"
        });
        return;
      }

      // Supprimer le participant
      await prisma.sessionParticipants.delete({
        where: { id: participantIdNum }
      });

      res.json({
        success: true,
        message: "Participant retiré avec succès"
      });
    } catch (error) {
      console.error("Erreur lors du retrait du participant:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors du retrait du participant",
        error: (error as Error).message
      });
    }
  }
};

export default sessionController;