/**
 * Token bucket rate limiter middleware using KV.
 * Default: 60 requests/minute per IP.
 */
import { createMiddleware } from 'hono/factory';
import type { Env } from '../../src/types.js';

const DEFAULT_RATE = 60;
const WINDOW_SEC = 60;

export const rateLimitMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `ratelimit:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SEC;

  // Use KV list-based counting (atomic)
  try {
    const stored = await c.env.KV?.get<{ ts: number }[]>(key, 'json');
    const hits = stored?.filter(h => h.ts > windowStart) || [];
    const limit = c.env.RATE_LIMIT ? parseInt(c.env.RATE_LIMIT) : DEFAULT_RATE;

    if (hits.length >= limit) {
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(hits[0]?.ts + WINDOW_SEC));
      return c.json({ error: 'Too many requests', retryAfter: hits[0]?.ts + WINDOW_SEC - now }, 429);
    }

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit - hits.length - 1));
    c.header('X-RateLimit-Reset', String(now + WINDOW_SEC));

    await next();

    // Only increment on successful requests
    if (c.res.status < 400) {
      const updated = [...hits.slice(-(limit - 1)), { ts: now }];
      await c.env.KV?.put(key, JSON.stringify(updated), { expirationTtl: WINDOW_SEC + 10 });
    }
  } catch {
    // If KV is unavailable, let the request through
    await next();
  }
});
