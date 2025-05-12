import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Utilitaire pour calculer le résultat d'un jet de dés
 * Prend en charge les expressions comme "2d6+3", "1d20-2", "3d8", etc.
 */
const calculateDiceRoll = (expression: string): { result: number, details: any } => {
  // Expression régulière pour capturer les parties du jet de dés
  const diceRegex = /(\d+)d(\d+)([+-]\d+)?/;
  const match = expression.match(diceRegex);
  
  if (!match) {
    throw new Error(`Expression de dés invalide: ${expression}`);
  }
  
  const numberOfDice = parseInt(match[1]);
  const diceSides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  if (numberOfDice <= 0 || diceSides <= 0) {
    throw new Error(`Paramètres de dés invalides: ${numberOfDice}d${diceSides}`);
  }
  
  // Lancer les dés
  const rolls = [];
  let sum = 0;
  
  for (let i = 0; i < numberOfDice; i++) {
    const roll = Math.floor(Math.random() * diceSides) + 1;
    rolls.push(roll);
    sum += roll;
  }
  
  // Ajouter le modificateur
  const total = sum + modifier;
  
  return {
    result: total,
    details: {
      expression,
      rolls,
      modifier,
      total
    }
  };
};

/**
 * Contrôleur pour la gestion des jets de dés
 */
const diceRollController = {
  /**
   * Lancer un dé et enregistrer le résultat
   * POST /dice-rolls
   * Corps: { expression, sessionId, characterId? }
   */
  rollDice: async (req: Request, res: Response): Promise<void> => {
    try {
      const { expression, sessionId, characterId } = req.body;
      const userId = req.user.id;
      
      // Validation des entrées
      if (!expression || !sessionId) {
        res.status(400).json({
          success: false,
          message: "L'expression de dés et l'ID de session sont requis"
        });
        return;
      }
      
      // Valider que l'expression est bien formatée
      if (!/^\d+d\d+([+-]\d+)?$/.test(expression)) {
        res.status(400).json({
          success: false,
          message: "Format d'expression invalide. Utilisez le format XdY+Z (ex: 2d6+3)"
        });
        return;
      }
      
      // Vérifier que la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });
      
      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }
      
      // Vérifier que l'utilisateur est participant ou GM de la session
      const isGM = session.gmId === userId;
      const isParticipant = await prisma.sessionParticipants.findFirst({
        where: {
          sessionId,
          userId
        }
      });
      
      if (!isGM && !isParticipant) {
        res.status(403).json({
          success: false,
          message: "Vous devez être GM de cette session pour lancer les dés"
        });
        return;
      }
      
      // Si un characterId est fourni, vérifier qu'il appartient à l'utilisateur
      if (characterId) {
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
      }
      

      // Calculer le résultat du jet de dés
      const { result, details } = calculateDiceRoll(expression);
      
      // Enregistrer le jet de dés
      const diceRoll = await prisma.diceRoll.create({
        data: {
          rollExpression: expression,
          result,
          userId,
          sessionId,
          characterId,
          metadata: details // Stocke les détails du jet comme metadata
        },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          },
          character: characterId ? {
            select: {
              id: true,
              name: true,
              class: true
            }
          } : undefined,
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
        message: "Jet de dés effectué avec succès",
        diceRoll
      });
    } catch (error) {
      console.error("Erreur lors du jet de dés:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors du jet de dés",
        error: (error as Error).message
      });
    }
  },

  /**
   * Voir l'historique des jets d'une session
   * GET /dice-rolls?sessionId=5
   */
  getDiceRollsBySession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: "Le paramètre sessionId est requis"
        });
        return;
      }
      
      const sessionIdNum = parseInt(sessionId as string);
      
      if (isNaN(sessionIdNum)) {
        res.status(400).json({
          success: false,
          message: "ID de session invalide"
        });
        return;
      }
      
      // Vérifier que la session existe
      const session = await prisma.session.findUnique({
        where: { id: sessionIdNum }
      });
      
      if (!session) {
        res.status(404).json({
          success: false,
          message: "Session non trouvée"
        });
        return;
      }
      
      // Vérifier que l'utilisateur est participant ou GM de la session
      const userId = req.user.id;
      const isGM = session.gmId === userId;
      
      // Vérifier si l'utilisateur est admin dans cette session
      const isParticipantWithRole = await prisma.sessionParticipants.findFirst({
        where: {
          sessionId: sessionIdNum,
          userId
        }
      });
      
      const isAdmin = isParticipantWithRole?.role === 'admin';
      const isParticipant = !!isParticipantWithRole;
      
      if (!isGM && !isParticipant && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "Vous devez être GM de cette session pour voir les jets de dés"
        });
        return;
      }
      
      // Récupérer l'historique des jets de dés
      const diceRolls = await prisma.diceRoll.findMany({
        where: {
          sessionId: sessionIdNum
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
              name: true,
              class: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });
      
      res.json({
        success: true,
        count: diceRolls.length,
        diceRolls
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des jets de dés:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des jets de dés",
        error: (error as Error).message
      });
    }
  },

  /**
   * Voir un jet précis
   * GET /dice-rolls/:id
   */
  getDiceRollById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const diceRollId = parseInt(id);
      
      if (isNaN(diceRollId)) {
        res.status(400).json({
          success: false,
          message: "ID de jet de dés invalide"
        });
        return;
      }
      
      // Récupérer le jet de dés
      const diceRoll = await prisma.diceRoll.findUnique({
        where: { id: diceRollId },
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
              title: true,
              gmId: true
            }
          }
        }
      });
      
      if (!diceRoll) {
        res.status(404).json({
          success: false,
          message: "Jet de dés non trouvé"
        });
        return;
      }
      
      // Vérifier que l'utilisateur est participant ou GM de la session
      const userId = req.user.id;
      const isGM = diceRoll.session.gmId === userId;
      
      // Vérifier si l'utilisateur est un rôle spécial dans la session
      const participantInfo = await prisma.sessionParticipants.findFirst({
        where: {
          sessionId: diceRoll.sessionId,
          userId
        }
      });
      
      const isAdmin = participantInfo?.role === 'admin';
      const isParticipant = !!participantInfo;
      const isRoller = diceRoll.userId === userId;
      
      if (!isGM && !isParticipant && !isAdmin && !isRoller) {
        res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à voir ce jet de dés"
        });
        return;
      }
      
      res.json({
        success: true,
        diceRoll
      });
    } catch (error) {
      console.error("Erreur lors de la récupération du jet de dés:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du jet de dés",
        error: (error as Error).message
      });
    }
  }
};

export default diceRollController;