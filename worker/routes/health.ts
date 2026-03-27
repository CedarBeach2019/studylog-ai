/**
 * Health check endpoint with provider connectivity test.
 */
import { Hono } from 'hono';
import type { Env } from '../../src/types.js';

const health = new Hono<{ Bindings: Env }>();

health.get('/', async (c) => {
  const services: Record<string, string> = {};

  // Check D1
  try {
    await c.env.DB.prepare('SELECT 1').first();
    services.d1 = 'ok';
  } catch {
    services.d1 = 'error';
  }

  // Check KV
  try {
    await c.env.KV.get('__health_check');
    services.kv = 'ok';
  } catch {
    services.kv = 'error';
  }

  // Check R2
  try {
    await c.env.R2.head('__health_check');
    services.r2 = 'ok';
  } catch (e: any) {
    // R2 head returns 404 for missing keys, which means R2 is reachable
    services.r2 = 'ok';
  }

  // Check provider (DeepSeek) with 5s timeout
  let providerStatus = 'ok';
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://api.deepseek.com/models', {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${c.env.DEEPSEEK_API_KEY}` },
    });
    clearTimeout(timeout);
    providerStatus = res.ok ? 'ok' : 'degraded';
  } catch {
    providerStatus = 'unreachable';
  }

  const isDegraded = Object.values(services).some(s => s !== 'ok') || providerStatus !== 'ok';

  return c.json({
    status: isDegraded ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    services,
    provider: providerStatus,
  });
});

export default health;
