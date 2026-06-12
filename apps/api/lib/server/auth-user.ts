import type { NextRequest } from 'next/server';

import { verifyJwt } from './auth-jwt';
import { HttpError } from './api-primitives';

export interface AuthUser {
  id: string;
  openid: string;
}

export async function getCurrentUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  try {
    const payload = await verifyJwt(token);
    return { id: payload.sub, openid: payload.openid };
  } catch (err) {
    if (err instanceof Error && err.message === 'APP_JWT_SECRET is not set') {
      throw new HttpError(500, 'server_config_error', 'JWT signing secret is not configured');
    }
    return null;
  }
}

export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    throw new HttpError(401, 'unauthorized', 'Authentication required');
  }

  const token = auth.slice(7);
  try {
    const payload = await verifyJwt(token);
    return { id: payload.sub, openid: payload.openid };
  } catch (err) {
    if (err instanceof Error && err.message === 'APP_JWT_SECRET is not set') {
      throw new HttpError(500, 'server_config_error', 'JWT signing secret is not configured');
    }
    if (err instanceof Error && err.message === 'token_expired') {
      throw new HttpError(401, 'token_expired', 'Token has expired, please log in again');
    }
    throw new HttpError(401, 'unauthorized', 'Invalid authentication token');
  }
}
