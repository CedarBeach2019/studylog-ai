/**
 * Cloudflare Worker entry point (Hono app).
 * Serves API routes.
 * @see docs/api/API-DESIGN.md
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, Variables } from '../src/types.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import draftRoutes from './routes/drafts.js';
import sessionRoutes from './routes/sessions.js';
import providerRoutes from './routes/providers.js';
import preferenceRoutes from './routes/preferences.js';
import healthRoutes from './routes/health.js';
import metricsRoutes from './routes/metrics.js';
import configRoutes from './routes/config.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:8787', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-LogOrigin-Mode'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// Public routes
app.route('/v1/auth', authRoutes);
app.route('/v1/health', healthRoutes);

// Protected routes
const protectedApi = new Hono<{ Bindings: Env; Variables: Variables }>();
protectedApi.use('*', authMiddleware);
protectedApi.route('/chat', chatRoutes);
protectedApi.route('/drafts', draftRoutes);
protectedApi.route('/sessions', sessionRoutes);
protectedApi.route('/providers', providerRoutes);
protectedApi.route('/preferences', preferenceRoutes);
protectedApi.route('/metrics', metricsRoutes);
protectedApi.route('/config', configRoutes);
app.route('/v1', protectedApi);

app.get('/', (c) => c.json({ name: 'log-origin', version: '0.1.0' }));

export default app;
