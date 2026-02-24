import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

export interface AuthReq extends Request {
  userId?: string;
}

function getSecret() {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

/**
 * Require Authorization: Bearer <JWT>.
 * Verifies HS256 token and sets req.userId from JWT sub (users.id UUID).
 */
export async function requireAuth(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
