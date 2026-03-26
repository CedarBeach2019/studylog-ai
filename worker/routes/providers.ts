/**
 * Provider CRUD endpoints.
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';

const providerRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

providerRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    "SELECT id, name, provider_type, base_url, model, temperature, max_tokens, capabilities, enabled, created_at FROM providers WHERE user_id = ? ORDER BY priority DESC, name"
  ).bind(userId).all<{
    id: string; name: string; provider_type: string; base_url: string; model: string;
    temperature: number; max_tokens: number; capabilities: string; enabled: number; created_at: string;
  }>();
  return c.json({ providers: (result.results ?? []).map((r) => ({ ...r, enabled: !!r.enabled, capabilities: JSON.parse(r.capabilities ?? '[]') })) });
});

providerRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: { type?: string; name: string; base_url: string; api_key?: string; model: string; max_tokens?: number; temperature?: number; capabilities?: string[] };
  try { body = await c.req.json(); } catch { body = { name: '', base_url: '', model: '' }; }
  if (!body.name || !body.base_url || !body.model) return c.json({ error: { type: 'validation_error', code: 'missing_field', message: 'name, base_url, and model are required' } }, 422);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO providers (id, user_id, name, provider_type, base_url, model, api_key_encrypted, temperature, max_tokens, capabilities, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, body.name, body.type ?? 'openai-compatible', body.base_url, body.model, body.api_key ?? null, body.temperature ?? 0.7, body.max_tokens ?? 4096, JSON.stringify(body.capabilities ?? []), now).run();
  return c.json({ id, type: body.type ?? 'openai-compatible', name: body.name, base_url: body.base_url, model: body.model, enabled: true, created_at: now }, 201);
});

providerRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM providers WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!existing) return c.json({ error: { type: 'not_found', code: 'provider_not_found', message: 'Provider not found' } }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    const col = k === 'api_key' ? 'api_key_encrypted' : k === 'capabilities' ? 'capabilities' : k;
    if (['name', 'base_url', 'model', 'api_key_encrypted', 'temperature', 'max_tokens', 'capabilities'].includes(col)) {
      sets.push(`${col} = ?`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v === true ? 1 : v === false ? 0 : v);
    }
  }
  if (!sets.length) return c.json({ error: { type: 'validation_error', code: 'invalid_request', message: 'No fields to update' } }, 422);
  vals.push(id, userId);
  await c.env.DB.prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).bind(...vals).run();
  return c.json({ updated: id });
});

providerRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM providers WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ deleted: id });
});

export default providerRoutes;
