import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Contrôleur pour la gestion des participants aux sessions
 */
const sessionParticipantsController = {
  /**
   * Ajouter un participant à une session
   * POST /session-participants
   * Corps de la requête: { sessionId, userId, characterId?, role }
   */
  addParticipant: async (req: Request, res: Response) => {
    try {
      const { sessionId, userId, characterId, role } = req.body;

      // Vérifier que les champs requis sont présents
      if (!sessionId || !userId || !role) {
        return res.status(400).json({
          success: false,
          message: "Les champs sessionId, userId et role sont obligatoires"
        });
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
      }

      // Vérifier les permissions (seul le GM, l'utilisateur lui-même ou un admin peut ajouter un participant)
      const isGM = session.gmId === req.user.id;
      const isSelf = userId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = await prisma.sessionParticipants.findFirst({
        where: {
          sessionId,
          userId: req.user.id,
          role: 'admin'
        }
      });
      const isAdmin = !!participantData;

      if (!isGM && !isSelf && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à ajouter ce participant"
        });
      }

      // Vérifier si l'utilisateur existe
      const userExists = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
      }

      // Vérifier si le personnage existe et appartient à l'utilisateur (si fourni)
      if (characterId) {
        const characterExists = await prisma.character.findFirst({
          where: { 
            id: characterId,
            userId
          }
        });

        if (!characterExists) {
          return res.status(404).json({
            success: false,
            message: "Personnage non trouvé ou n'appartient pas à l'utilisateur spécifié"
          });
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
        return res.status(400).json({
          success: false,
          message: "L'utilisateur est déjà participant à cette session"
        });
      }

      // Créer le participant
      const participant = await prisma.sessionParticipants.create({
        data: {
          sessionId,
          userId,
          characterId,
          role
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          character: {
            select: {
              id: true,
              name: true,
              class: true,
              level: true
            }
          },
          session: {
            select: {
              id: true,
              title: true
            }
          }
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
   * Lister les participants d'une session
   * GET /session-participants?sessionId=123
   */
  getParticipants: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Le paramètre sessionId est requis"
        });
      }

      const sessionIdNum = parseInt(sessionId as string);
      
      if (isNaN(sessionIdNum)) {
        return res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
      }

      // Vérifier si la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionIdNum },
        include: {
          participants: true
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
      }

      // Vérifier les permissions (seul le GM, un participant ou un admin peut voir les participants)
      const isGM = session.gmId === req.user.id;
      
      // Vérifier si l'utilisateur est participant
      const participantData = session.participants.find(p => p.userId === req.user.id);
      const isParticipant = !!participantData;
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isParticipant && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à voir les participants de cette session"
        });
      }

      // Récupérer les participants
      const participants = await prisma.sessionParticipants.findMany({
        where: {
          sessionId: sessionIdNum
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          character: {
            select: {
              id: true,
              name: true,
              race: true,
              class: true,
              level: true
            }
          }
        },
        orderBy: {
          id: 'asc'
        }
      });

      res.json({
        success: true,
        count: participants.length,
        participants
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des participants:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des participants",
        error: (error as Error).message
      });
    }
  },

  /**
   * Retirer un participant
   * DELETE /session-participants/:id
   */
  removeParticipant: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const participantId = parseInt(id);

      // Vérifier si l'ID est valide
      if (isNaN(participantId)) {
        return res.status(400).json({
          success: false,
          message: "ID de participant invalide"
        });
      }

      // Récupérer le participant pour vérifier les permissions
      const participant = await prisma.sessionParticipants.findUnique({
        where: { id: participantId },
        include: {
          session: {
            include: {
              participants: true
            }
          }
        }
      });

      if (!participant) {
        return res.status(404).json({
          success: false,
          message: "Participant non trouvé"
        });
      }

      // Vérifier les permissions
      const isGM = participant.session.gmId === req.user.id;
      const isSelf = participant.userId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = participant.session.participants.find(p => p.userId === req.user.id);
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isSelf && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à retirer ce participant"
        });
      }

      // Supprimer le participant
      await prisma.sessionParticipants.delete({
        where: { id: participantId }
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
  },

  /**
   * Mettre à jour un participant (changer le rôle ou associer un personnage)
   * PUT /session-participants/:id
   */
  updateParticipant: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const participantId = parseInt(id);
      const { role, characterId } = req.body;

      // Vérifier si l'ID est valide
      if (isNaN(participantId)) {
        return res.status(400).json({
          success: false,
          message: "ID de participant invalide"
        });
      }

      // Vérifier qu'au moins un champ est fourni
      if (role === undefined && characterId === undefined) {
        return res.status(400).json({
          success: false,
          message: "Au moins un champ à mettre à jour doit être fourni (role ou characterId)"
        });
      }

      // Récupérer le participant pour vérifier les permissions
      const participant = await prisma.sessionParticipants.findUnique({
        where: { id: participantId },
        include: {
          session: {
            include: {
              participants: true
            }
          }
        }
      });

      if (!participant) {
        return res.status(404).json({
          success: false,
          message: "Participant non trouvé"
        });
      }

      // Vérifier les permissions
      const isGM = participant.session.gmId === req.user.id;
      const isSelf = participant.userId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans cette session spécifique
      const participantData = participant.session.participants.find(p => p.userId === req.user.id);
      const isAdmin = participantData?.role === 'admin';

      if (!isGM && !isSelf && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier ce participant"
        });
      }

      // Vérifier que le personnage existe et appartient à l'utilisateur
      if (characterId !== undefined) {
        // Si characterId est null, on veut dissocier le personnage
        if (characterId !== null) {
          const characterExists = await prisma.character.findFirst({
            where: { 
              id: characterId,
              userId: participant.userId
            }
          });

          if (!characterExists) {
            return res.status(404).json({
              success: false,
              message: "Personnage non trouvé ou n'appartient pas à l'utilisateur spécifié"
            });
          }
        }
      }

      // Préparer les données à mettre à jour
      const updateData: any = {};
      if (role !== undefined) updateData.role = role;
      if (characterId !== undefined) updateData.characterId = characterId;

      // Mettre à jour le participant
      const updatedParticipant = await prisma.sessionParticipants.update({
        where: { id: participantId },
        data: updateData,
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
              name: true,
              class: true,
              level: true
            }
          },
          session: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: "Participant mis à jour avec succès",
        participant: updatedParticipant
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du participant:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du participant",
        error: (error as Error).message
      });
    }
  }
};

export default sessionParticipantsController;