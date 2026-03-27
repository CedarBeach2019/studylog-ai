/**
 * Session management endpoints.
 * @see docs/database/SCHEMA-DESIGN.md §1.1
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';

const sessions = new Hono<{ Bindings: Env; Variables: Variables }>();

sessions.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    `SELECT s.id, s.summary, s.message_count, s.last_message_at as lastMessageAt,
       (SELECT m.content FROM messages m WHERE m.session_id = s.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as first_message,
       (SELECT m.content FROM messages m WHERE m.session_id = s.id AND m.role = 'user' ORDER BY m.created_at DESC LIMIT 1) as last_message
     FROM sessions s WHERE s.user_id = ? ORDER BY s.last_message_at DESC LIMIT 50`
  ).bind(userId).all();

  return c.json({ sessions: result.results ?? [] });
});

sessions.post('/', async (c) => {
  const userId = c.get('userId');
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, summary, message_count, last_message_at)
     VALUES (?, ?, '', 0, datetime('now'))`
  ).bind(id, userId).run();

  return c.json({ id });
});

sessions.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT id, summary, message_count, last_message_at as lastMessageAt
     FROM sessions WHERE id = ? AND user_id = ?`
  ).bind(id, userId).first();

  if (!session) {
    return c.json({ error: { type: 'not_found', message: 'Session not found' } }, 404);
  }

  const messages = await c.env.DB.prepare(
    `SELECT id, role, content, created_at as createdAt
     FROM messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC`
  ).bind(id, userId).all();

  return c.json({ ...session, messages: messages.results ?? [] });
});

sessions.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body: { summary?: string } = await c.req.json().catch(() => ({}));

  if (body.summary !== undefined) {
    await c.env.DB.prepare(
      `UPDATE sessions SET summary = ? WHERE id = ? AND user_id = ?`
    ).bind(body.summary, id, userId).run();
  }

  return c.json({ updated: id });
});

sessions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  await c.env.DB.prepare(
    `UPDATE sessions SET status = 'deleted' WHERE id = ? AND user_id = ?`
  ).bind(id, userId).run();

  return c.json({ deleted: id });
});

// GET /:id/recap — AI-generated session summary from real messages
sessions.get('/:id/recap', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const messages = await c.env.DB.prepare(
    `SELECT role, content FROM messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC`
  ).bind(id, userId).all<{ role: string; content: string }>();

  if (!messages.results?.length) {
    return c.json({ recap: 'No messages in this session yet.' });
  }

  // Build a condensed transcript for the AI (limit to last 50 messages to stay in budget)
  const recent = messages.results.slice(-50);
  const transcript = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Summarize this conversation session in 2-3 sentences. Focus on: what happened, what was decided, and what\'s pending. Be specific — use names, numbers, and details from the conversation. Do NOT add information that isn\'t in the transcript.' },
          { role: 'user', content: transcript },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    const data: any = await res.json();
    const recap = data.choices?.[0]?.message?.content || 'Could not generate recap.';
    return c.json({ recap, messageCount: messages.results.length });
  } catch {
    // Fallback: return first/last messages as a simple recap
    const first = recent[0]?.content?.slice(0, 100) ?? '';
    const last = recent[recent.length - 1]?.content?.slice(0, 100) ?? '';
    return c.json({ recap: `Started: "${first}..."\nLast: "${last}..."`, messageCount: messages.results.length, fallback: true });
  }
});

export default sessions;
