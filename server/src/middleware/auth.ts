import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';

const JWT_SECRET: string = process.env.JWT_SECRET || '';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Please set it in your .env file.');
}

// Fallback for development if env is not loaded yet
const EFFECTIVE_JWT_SECRET: string = JWT_SECRET || 'dev_secret_only_for_local_tests_32chars_min';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as { id: string; email: string; role: string };
    req.user = decoded;

    // Immediately enforce account block or deactivation even if token is mathematically valid
    if (decoded.id) {
      try {
        const userCheck = await query('SELECT is_blocked, is_active FROM users WHERE id = $1', [decoded.id]);
        if (userCheck.rows.length > 0) {
          const u = userCheck.rows[0];
          if (u.is_blocked) {
            return res.status(403).json({
              error: 'Your account has been suspended by administration. Please contact support.',
              code: 'ACCOUNT_BLOCKED',
            });
          }
          if (u.is_active === false) {
            return res.status(403).json({
              error: 'Your account is deactivated. Please contact support to reactivate.',
              code: 'ACCOUNT_DEACTIVATED',
            });
          }
        }
      } catch (dbErr) {
        // Fallback gracefully if database lookup has transient failure
      }
    }

    next();
  } catch (err) {
    console.warn('[AUTH FAILURE] Invalid or expired JWT token:', (err as Error).message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

