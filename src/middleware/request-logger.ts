/**
 * Request ID + structured logging middleware for Hono.
 */
import type { MiddlewareHandler } from 'hono';
import type { Variables } from '../types.js';

interface LogEnv {
  ENVIRONMENT?: string;
}

type AppType = { Bindings: LogEnv; Variables: Variables & { requestId: string; startTime: number } };

export const requestLogger: MiddlewareHandler<AppType> = async (c, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  c.set('requestId', requestId);
  c.set('startTime', startTime);

  await next();

  const duration = Date.now() - startTime;
  const userId = c.get('userId') ?? 'anon';
  const status = c.res.status;

  if (c.env.ENVIRONMENT === 'production' || c.env.ENVIRONMENT === 'development') {
    console.log(JSON.stringify({
      requestId,
      method: c.req.method,
      path: c.req.path,
      userId,
      status,
      duration,
      ts: new Date().toISOString(),
    }));
  }
};
