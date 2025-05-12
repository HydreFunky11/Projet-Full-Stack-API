import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Contrôleur de personnage qui regroupe toutes les fonctions liées aux personnages
 */
const characterController = {
  /**
   * Créer un nouveau personnage
   * POST /characters
   */
  createCharacter: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, race, class: characterClass, level, background, inventory, stats } = req.body;
      const userId = req.user.id; // L'ID de l'utilisateur connecté

      // Vérifier que les champs requis sont présents
      if (!name || !race || !characterClass || !level) {
        res.status(400).json({
          success: false,
          message: "Les champs name, race, class et level sont obligatoires"
        });
        return;
      }

      // Créer le personnage
      const character = await prisma.character.create({
        data: {
          name,
          race,
          class: characterClass,
          level,
          background,
          inventory,
          stats,
          userId
        }
      });

      res.status(201).json({
        success: true,
        message: "Personnage créé avec succès",
        character
      });
    } catch (error) {
      console.error("Erreur lors de la création du personnage:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du personnage",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer un personnage par son ID
   * GET /characters/:id
   */
  getCharacterById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const characterId = parseInt(id);

      // Vérifier si l'ID est valide
      if (isNaN(characterId)) {
        res.status(400).json({
          success: false,
          message: "ID de personnage invalide"
        });
        return;
      }

      // Récupérer le personnage avec ses relations
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          session: true,
          diceRolls: true,
          sessionParticipants: true
        }
      });

      if (!character) {
        res.status(404).json({
          success: false,
          message: "Personnage non trouvé"
        });
        return;
      }

      // Vérifier si l'utilisateur a le droit de voir ce personnage
      // (propriétaire ou MJ de la session ou admin)
      const isOwner = character.userId === req.user.id;
      const isGM = character.session && character.session.gmId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans cette session
      let isAdmin = false;
      if (character.session) {
        const participantData = await prisma.sessionParticipants.findFirst({
          where: {
            sessionId: character.session.id,
            userId: req.user.id,
            role: 'admin'
          }
        });
        isAdmin = !!participantData;
      }

      if (!isOwner && !isGM && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à ce personnage"
        });
        return;
      }

      res.json({
        success: true,
        character
      });
    } catch (error) {
      console.error("Erreur lors de la récupération du personnage:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du personnage",
        error: (error as Error).message
      });
    }
  },

  /**
   * Récupérer les personnages d'un utilisateur
   * GET /characters?userId=123
   */
  getCharacters: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.query;
      let userIdParam: number | undefined;
      
      if (userId) {
        userIdParam = parseInt(userId as string);
        if (isNaN(userIdParam)) {
          res.status(400).json({
            success: false,
            message: "ID d'utilisateur invalide"
          });
          return;
        }
      }

      // Si un userId est spécifié et n'est pas celui de l'utilisateur connecté
      // Vérifier si l'utilisateur a des droits d'administration
      if (userIdParam && userIdParam !== req.user.id) {
        // Vérifier si l'utilisateur est admin dans au moins une session
        const adminStatus = await prisma.sessionParticipants.findFirst({
          where: {
            userId: req.user.id,
            role: 'admin'
          }
        });
        
        if (!adminStatus) {
          res.status(403).json({
            success: false,
            message: "Vous n'êtes pas autorisé à voir les personnages de cet utilisateur"
          });
          return;
        }
      }

      // Si aucun userId n'est spécifié, on récupère les personnages de l'utilisateur connecté
      const targetUserId = userIdParam || req.user.id;

      const characters = await prisma.character.findMany({
        where: { userId: targetUserId },
        include: {
          session: {
            select: {
              id: true,
              title: true,
              status: true
            }
          }
        }
      });

      res.json({
        success: true,
        characters
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des personnages:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des personnages",
        error: (error as Error).message
      });
    }
  },

  /**
   * Mettre à jour un personnage
   * PUT /characters/:id
   */
  updateCharacter: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const characterId = parseInt(id);
      const { name, race, class: characterClass, level, background, inventory, stats, isAlive, sessionId } = req.body;

      // Vérifier si l'ID est valide
      if (isNaN(characterId)) {
        res.status(400).json({
          success: false,
          message: "ID de personnage invalide"
        });
        return;
      }

      // Vérifier si le personnage existe
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          session: true
        }
      });

      if (!character) {
        res.status(404).json({
          success: false,
          message: "Personnage non trouvé"
        });
        return;
      }

      // Vérifier les permissions
      const isOwner = character.userId === req.user.id;
      const isGM = character.session && character.session.gmId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans cette session
      let isAdmin = false;
      if (character.session) {
        const participantData = await prisma.sessionParticipants.findFirst({
          where: {
            sessionId: character.session.id,
            userId: req.user.id,
            role: 'admin'
          }
        });
        isAdmin = !!participantData;
      }

      if (!isOwner && !isGM && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier ce personnage"
        });
        return;
      }

      // Certaines modifications ne peuvent être faites que par le propriétaire ou un admin
      // (changement de nom, race, classe, etc.)
      if (!isOwner && !isAdmin && (name || race || characterClass)) {
        res.status(403).json({
          success: false,
          message: "Seul le propriétaire ou un administrateur peut modifier ces attributs du personnage"
        });
        return;
      }

      // Préparer les données à mettre à jour
      const updateData: any = {};
      
      if (name) updateData.name = name;
      if (race) updateData.race = race;
      if (characterClass) updateData.class = characterClass;
      if (level !== undefined) updateData.level = level;
      if (background !== undefined) updateData.background = background;
      if (inventory !== undefined) updateData.inventory = inventory;
      if (stats !== undefined) updateData.stats = stats;
      if (isAlive !== undefined) updateData.isAlive = isAlive;
      if (sessionId !== undefined) updateData.sessionId = sessionId || null;

      // Mettre à jour le personnage
      const updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          },
          session: true
        }
      });

      res.json({
        success: true,
        message: "Personnage mis à jour avec succès",
        character: updatedCharacter
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du personnage:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du personnage",
        error: (error as Error).message
      });
    }
  },

  /**
   * Supprimer un personnage
   * DELETE /characters/:id
   */
  deleteCharacter: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const characterId = parseInt(id);

      // Vérifier si l'ID est valide
      if (isNaN(characterId)) {
        res.status(400).json({
          success: false,
          message: "ID de personnage invalide"
        });
        return;
      }

      // Vérifier si le personnage existe
      const character = await prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        res.status(404).json({
          success: false,
          message: "Personnage non trouvé"
        });
        return;
      }

      // Vérifier les permissions (seul le propriétaire ou un admin peut supprimer)
      const isOwner = character.userId === req.user.id;
      
      // Vérifier si l'utilisateur est admin dans au moins une session
      const adminStatus = await prisma.sessionParticipants.findFirst({
        where: {
          userId: req.user.id,
          role: 'admin'
        }
      });
      
      const isAdmin = !!adminStatus;

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à supprimer ce personnage"
        });
        return;
      }

      // Supprimer d'abord les relations
      await prisma.sessionParticipants.deleteMany({
        where: { characterId }
      });
      
      await prisma.diceRoll.deleteMany({
        where: { characterId }
      });

      // Puis supprimer le personnage
      await prisma.character.delete({
        where: { id: characterId }
      });

      res.json({
        success: true,
        message: "Personnage supprimé avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de la suppression du personnage:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la suppression du personnage",
        error: (error as Error).message
      });
    }
  },
  
  /**
   * Récupérer les personnages d'une session spécifique
   * GET /characters/session/:sessionId
   */
  getCharactersBySession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const sessionIdNum = parseInt(sessionId);
      const userId = req.user.id;
      
      if (isNaN(sessionIdNum)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }
      
      // Vérifier que la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionIdNum },
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
      
      // Vérifier que l'utilisateur peut accéder à cette session
      const isGM = session.gmId === userId;
      const participant = session.participants.find(p => p.userId === userId);
      const isParticipant = !!participant;
      const isAdmin = participant?.role === 'admin';
      
      if (!isGM && !isParticipant && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à voir les personnages de cette session"
        });
        return;
      }
      
      // Récupérer tous les personnages de la session
      const characters = await prisma.character.findMany({
        where: { sessionId: sessionIdNum },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
      
      res.json({
        success: true,
        count: characters.length,
        characters
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des personnages de la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des personnages",
        error: (error as Error).message
      });
    }
  },
  
  /**
   * Associer un personnage à une session
   * PUT /characters/:id/assign-session
   */
  associateWithSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const characterId = parseInt(id);
      const { sessionId } = req.body;
      const userId = req.user.id;
      
      if (isNaN(characterId)) {
        res.status(400).json({
          success: false,
          message: "ID de personnage invalide"
        });
        return;
      }
      
      if (sessionId === undefined) {
        res.status(400).json({
          success: false,
          message: "Le paramètre sessionId est requis dans le corps de la requête"
        });
        return;
      }
      
      const sessionIdNum = sessionId ? parseInt(sessionId) : null;
      if (sessionId && (sessionIdNum === null || isNaN(sessionIdNum as number))) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }
      
      // Vérifier que le personnage existe et appartient à l'utilisateur
      const character = await prisma.character.findFirst({
        where: { 
          id: characterId,
          userId
        }
      });
      
      if (!character) {
        res.status(404).json({
          success: false,
          message: "Personnage non trouvé ou n'appartient pas à l'utilisateur"
        });
        return;
      }
      
      // Si on souhaite associer à une session, vérifier l'existence de la session
      if (sessionIdNum) {
        const session = await prisma.session.findUnique({
          where: { id: sessionIdNum },
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
        
        // Vérifier que l'utilisateur est participant à cette session
        const isParticipant = session.participants.some(p => p.userId === userId);
        
        if (!isParticipant && session.gmId !== userId) {
          res.status(403).json({
            success: false,
            message: "Vous devez être participant ou GM de cette session pour y associer un personnage"
          });
          return;
        }
      }
      
      // Associer le personnage à la session (ou le dissocier si sessionId est null)
      const updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: { sessionId: sessionIdNum },
        include: {
          session: true
        }
      });
      
      // Si le personnage est associé à une session, créer ou mettre à jour l'entrée dans SessionParticipants
      if (sessionIdNum) {
        // Vérifier si une entrée existe déjà
        const existingParticipant = await prisma.sessionParticipants.findFirst({
          where: {
            userId,
            sessionId: sessionIdNum
          }
        });
        
        if (existingParticipant) {
          // Mise à jour de l'entrée existante
          await prisma.sessionParticipants.update({
            where: { id: existingParticipant.id },
            data: { characterId }
          });
        } else {
          // Création d'une nouvelle entrée
          await prisma.sessionParticipants.create({
            data: {
              userId,
              sessionId: sessionIdNum,
              characterId,
              role: 'joueur' // Rôle par défaut
            }
          });
        }
      }
      
      res.json({
        success: true,
        message: sessionIdNum 
          ? "Personnage associé à la session avec succès" 
          : "Personnage dissocié de la session avec succès",
        character: updatedCharacter
      });
    } catch (error) {
      console.error("Erreur lors de l'association du personnage à la session:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'opération",
        error: (error as Error).message
      });
    }
  }
};

export default characterController;