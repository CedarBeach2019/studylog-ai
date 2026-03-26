/**
 * Runtime configuration endpoint.
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';

const configRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

configRoutes.get('/', (c) => {
  return c.json({
    environment: c.env.ENVIRONMENT ?? 'development',
    maxTokensPerRequest: 4096,
    supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
    features: { streaming: true, draftComparison: true, piiDehydration: true, sessionManagement: true },
  });
});

export default configRoutes;
