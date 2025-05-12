import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Augmentation du type Request d'Express
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Configuration des cookies
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Secure en production seulement
  sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
  path: '/'
};


/**
 * Middleware pour extraire et vérifier le token JWT
 */
export const extractUserFromToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Récupérer le token depuis les cookies ou l'en-tête Authorization
    const tokenFromCookie = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];
    
    const token = tokenFromCookie || tokenFromHeader;
    
    if (!token) {
      next();
      return;
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });
    
    if (!user) {
      next();
      return;
    }
    
    // Stocker l'utilisateur dans l'objet request
    req.user = user;
    next();
  } catch (error) {
    // Si le token est expiré, supprimer le cookie
    if ((error as Error).name === 'TokenExpiredError') {
      res.clearCookie('token');
    }
    // Token invalide, continue sans req.user
    next();
  }
};

/**
 * Middleware pour protéger les routes privées
 */
export const isAuthenticated = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      message: "Accès non autorisé. Veuillez vous connecter." 
    });
    return;
  }
  next();
};

/**
 * Middleware pour vérifier le rôle d'un utilisateur dans une session spécifique
 */
export const hasRoleInSession = (sessionParam: string, roles: string[]) => {
  return async (
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: "Accès non autorisé. Veuillez vous connecter." 
      });
      return;
    }
    
    // Extraire l'ID de session du paramètre d'URL ou du corps de la requête
    let sessionId: number;
    
    if (req.params[sessionParam]) {
      sessionId = parseInt(req.params[sessionParam]);
    } else if (req.body.sessionId) {
      sessionId = parseInt(req.body.sessionId);
    } else {
      res.status(400).json({ 
        success: false, 
        message: "ID de session manquant" 
      });
      return;
    }
    
    if (isNaN(sessionId)) {
      res.status(400).json({ 
        success: false, 
        message: "ID de session invalide" 
      });
      return;
    }
    
    // Vérifier si l'utilisateur est le GM de la session
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
    
    const isGM = session.gmId === req.user.id;
    
    // Vérifier si l'utilisateur a le rôle requis dans la session
    const participant = await prisma.sessionParticipants.findFirst({
      where: {
        sessionId,
        userId: req.user.id,
        role: {
          in: roles
        }
      }
    });
    
    if (!isGM && !participant) {
      res.status(403).json({ 
        success: false, 
        message: "Vous n'avez pas les permissions nécessaires pour cette session." 
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier si un utilisateur est admin dans n'importe quelle session
 */
export const isAdminAnywhere = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      message: "Accès non autorisé. Veuillez vous connecter." 
    });
    return;
  }
  
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
      message: "Vous n'avez pas les permissions administratives nécessaires." 
    });
    return;
  }
  
  next();
};

export const generateTokenAndSetCookie = (user: any, res: Response): string => {
  const token = generateToken(user);
  
  // Définir le cookie HTTP-only
  res.cookie('token', token, cookieOptions);
  
  return token;
};

/**
 * Fonction pour générer un token JWT
 */
export const generateToken = (user: any): string => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email
  };
  
  const options: SignOptions = { 
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions["expiresIn"]
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    options
  );
};

/**
 * Fonction pour effacer le cookie de token (déconnexion)
 */
export const clearTokenCookie = (res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
};