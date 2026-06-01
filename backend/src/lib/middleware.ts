import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './firebase';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bravocloud_jwt_secret') as any;
    
    // Fetch fresh user data from Firestore
    const userDoc = await db.collection('users').doc(decoded.id).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'User not found in database', id: decoded.id });
    }

    req.user = { id: userDoc.id, ...userDoc.data() };
    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Token verification failed', details: error.message || String(error) });
  }
};
