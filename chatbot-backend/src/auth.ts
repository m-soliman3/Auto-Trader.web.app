import { NextFunction, Request, Response } from 'express';
import { auth } from './firebase';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const decoded = await auth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error?.message || 'Unauthorized' });
  }
}
