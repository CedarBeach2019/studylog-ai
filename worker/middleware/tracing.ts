/**
 * Request tracing middleware.
 */
import { createMiddleware } from 'hono/factory';
import type { Env } from '../../src/types.js';

export const tracingMiddleware = createMiddleware<{ Bindings: Env; Variables: { traceId: string; startTime: number } }>(async (c, next) => {
  const start = Date.now();
  const traceId = crypto.randomUUID();
  c.set('traceId', traceId);
  c.set('startTime', start);

  // TODO: Log request start
  await next();

  const elapsed = Date.now() - start;
  // TODO: Log request completion with status code and elapsed time
  void elapsed;
});
