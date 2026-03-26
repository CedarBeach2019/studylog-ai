/**
 * JWT validation middleware.
 * Verifies Bearer token from Authorization header, extracts userId.
 */
import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../../src/types.js';
import { verify } from '../../src/crypto/jwt.js';

const SKIP_PATHS = ['/v1/auth/login', '/v1/auth/register', '/v1/health'];

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const path = c.req.path;

    // Skip auth for public endpoints
    if (SKIP_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { error: { type: 'authentication_error', code: 'invalid_token', message: 'Missing or invalid Authorization header' } },
        401,
      );
    }

    const token = authHeader.slice(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      return c.json(
        { error: { type: 'server_error', code: 'internal_error', message: 'JWT_SECRET not configured' } },
        500,
      );
    }

    const payload = await verify(token, secret);
    if (!payload) {
      return c.json(
        { error: { type: 'authentication_error', code: 'token_expired', message: 'Token is invalid or expired' } },
        401,
      );
    }

    c.set('userId', payload.sub);
    await next();
  },
);
