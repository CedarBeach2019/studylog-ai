/**
 * User preferences endpoints.
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';

const preferenceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

preferenceRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare('SELECT key, value, updated_at FROM user_preferences WHERE user_id = ? ORDER BY key')
    .bind(userId).all<{ key: string; value: string; updated_at: string }>();
  const prefs: Record<string, string> = {};
  for (const row of result.results ?? []) prefs[row.key] = row.value;
  return c.json({ preferences: prefs });
});

preferenceRoutes.put('/:key', async (c) => {
  const userId = c.get('userId');
  const key = c.req.param('key');
  const body = (await c.req.json<{ value: string }>().catch(() => ({ value: '' as string }))) as { value: string };
  if (typeof body.value !== 'string') return c.json({ error: { type: 'validation_error', code: 'missing_field', message: 'value (string) is required' } }, 422);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO user_preferences (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?, updated_at = ?`
  ).bind(userId, key, body.value, now, body.value, now).run();
  return c.json({ key, value: body.value, updated_at: now });
});

preferenceRoutes.delete('/:key', async (c) => {
  const userId = c.get('userId');
  const key = c.req.param('key');
  await c.env.DB.prepare('DELETE FROM user_preferences WHERE user_id = ? AND key = ?').bind(userId, key).run();
  return c.json({ deleted: key });
});

export default preferenceRoutes;
