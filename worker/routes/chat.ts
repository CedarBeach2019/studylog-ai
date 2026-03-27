/**
 * Chat completions endpoint (OpenAI-compatible).
 * Handles routing classification, PII dehydration/rehydration, provider calls, interaction logging, feedback.
 */
import { Hono } from 'hono';
import type { Env, Variables, ChatRequest, ProviderMessage } from '../../src/types.js';
import { dehydrate, rehydrate } from '../../src/pii/engine.js';
import { classify } from '../../src/routing/router.js';
import { chatStream, chat, ProviderError } from '../../src/providers/openai-compatible.js';
import { sign, verify } from '../../src/crypto/jwt.js';
import { isGuest, checkGuestLimit } from '../../src/middleware/guest.js';
import { getSystemPrompt } from '../dmlog-config.js';

const chatApp = new Hono<{ Bindings: Env; Variables: Variables }>();

chatApp.post('/completions', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<ChatRequest>().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: { type: 'validation_error', code: 'invalid_request', message: 'messages array required' } }, 400);
  }

  const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) {
    return c.json({ error: { type: 'validation_error', code: 'no_user_message', message: 'At least one user message required' } }, 400);
  }

  // Classify intent via routing rules
  const { classification, message: classifiedMsg } = classify(lastUserMsg.content);
  const routeAction = classification.action;
  const routeReason = classification.reason;
  const routeConfidence = classification.confidence;

  // Create or reuse session
  const sessionId = body.messages[0].content.startsWith('session:') ? body.messages[0].content.slice(8) : crypto.randomUUID();

  // Ensure session exists
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO sessions (id, user_id, summary, message_count, last_message_at)
     VALUES (?, ?, '', 0, datetime('now'))`
  ).bind(sessionId, userId).run();

  const interactionId = crypto.randomUUID();
  const startTime = Date.now();

  // Get DeepSeek config
  const apiKey = c.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return c.json({ error: { type: 'server_error', code: 'config_error', message: 'DEEPSEEK_API_KEY not set' } }, 500);
  }

  // Determine model/tokens based on route action
  const model = body.model ?? 'deepseek-chat';
  const maxTokens = routeAction === 'cheap' ? (body.max_tokens ?? 2048) : (body.max_tokens ?? 4096);

  // PII dehydrate user messages
  const systemMsg = body.messages.find(m => m.role === 'system');
  const nonSystemMessages = body.messages.filter(m => m.role !== 'system');
  
  // Inject DMlog.ai system prompt if no system message provided
  let dmSystemPrompt = null;
  if (!systemMsg) {
    dmSystemPrompt = await getSystemPrompt(c.env);
  }

  let dehydratedMessages: ProviderMessage[] = [];
  let preamble = '';

  for (const msg of nonSystemMessages) {
    if (msg.role === 'user') {
      const result = await dehydrate(msg.content, c.env.DB, userId);
      if (result.preamble && !preamble) preamble = result.preamble;
      dehydratedMessages.push({ role: 'user', content: result.text });
    } else {
      dehydratedMessages.push(msg);
    }
  }

  // Build full message list
  const allMessages: ProviderMessage[] = [];
  if (systemMsg) allMessages.push(systemMsg);
  else if (dmSystemPrompt) allMessages.push({ role: 'system', content: dmSystemPrompt });
  if (preamble) allMessages.push({ role: 'system', content: preamble });
  allMessages.push(...dehydratedMessages);

  // Store user messages
  for (const msg of nonSystemMessages) {
    if (msg.role === 'user') {
      await c.env.DB.prepare(
        `INSERT INTO messages (id, session_id, user_id, role, content, model, route)
         VALUES (?, ?, ?, 'user', ?, ?, ?)`
      ).bind(crypto.randomUUID(), sessionId, userId, msg.content, model, routeAction).run();
    }
  }

  const isStream = body.stream === true;

  // Enforce guest message limit
  if (isGuest(userId) && c.env.KV) {
    const ip = userId.replace('guest:', '');
    const { allowed, state } = await checkGuestLimit(c.env.KV, ip);
    if (!allowed) {
      return c.json({
        error: { type: 'rate_limit', code: 'guest_limit', message: `Guest limit reached (${state.maxMessages} messages). Create a free account to continue.` }
      }, 429);
    }
  }

  if (isStream) {
    // Streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullContent = '';

        try {
          for await (const chunk of chatStream(allMessages, undefined, c.env, {
            baseUrl: 'https://api.deepseek.com',
            model,
            apiKey,
            maxTokens,
            temperature: body.temperature ?? 0.7,
          })) {
            if (chunk.content) {
              const rehydrated = await rehydrate(chunk.content, c.env.DB, userId);
              fullContent += chunk.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                id: `chatcmpl-${interactionId}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: chunk.model ?? model,
                choices: [{ index: 0, delta: { content: rehydrated }, finish_reason: chunk.done ? 'stop' : null }],
              })}\n\n`));
            }
          }

          // Send [DONE]
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          // Rehydrate and store
          const rehydratedContent = await rehydrate(fullContent, c.env.DB, userId);
          const latencyMs = Date.now() - startTime;

          await c.env.DB.prepare(
            `INSERT INTO messages (id, session_id, user_id, role, content, model, route)
             VALUES (?, ?, ?, 'assistant', ?, ?, ?)`
          ).bind(crypto.randomUUID(), sessionId, userId, rehydratedContent, model, routeAction).run();

          await c.env.DB.prepare(
            `INSERT INTO interactions (id, session_id, user_id, user_input, rewritten_input, route_action, route_reason, target_model, response, response_latency_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(interactionId, sessionId, userId, lastUserMsg.content, dehydratedMessages.find(m => m.role === 'user')?.content ?? '', routeAction, routeReason, model, rehydratedContent, latencyMs).run();

          // Update session
          await c.env.DB.prepare(
            `UPDATE sessions SET message_count = message_count + 2, last_message_at = datetime('now') WHERE id = ?`
          ).bind(sessionId).run();
        } catch (err) {
          const msg = err instanceof ProviderError ? err.message : 'Internal error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Non-streaming with error boundary
  let result;
  try {
    result = await chat(allMessages, undefined, c.env, {
      baseUrl: 'https://api.deepseek.com',
      model,
      apiKey,
      maxTokens,
      temperature: body.temperature ?? 0.7,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      return c.json({ error: { type: 'provider_error', code: err.type, message: err.message } }, err.statusCode === 429 ? 429 : 502);
    }
    // Timeout or unknown errors
    return c.json(
      { error: { type: 'provider_error', message: 'AI provider unavailable. Please try again.' } },
      502,
    );
  }

  // Rehydrate PII in response
  const rehydratedContent = await rehydrate(result.content, c.env.DB, userId);
  const latencyMs = result.latencyMs;

  // Store assistant message
  await c.env.DB.prepare(
    `INSERT INTO messages (id, session_id, user_id, role, content, model, route)
     VALUES (?, ?, ?, 'assistant', ?, ?, ?)`
  ).bind(crypto.randomUUID(), sessionId, userId, rehydratedContent, result.model, routeAction).run();

  // Store interaction with route_action and route_reason
  await c.env.DB.prepare(
    `INSERT INTO interactions (id, session_id, user_id, user_input, rewritten_input, route_action, route_reason, target_model, response, response_latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(interactionId, sessionId, userId, lastUserMsg.content, dehydratedMessages.find(m => m.role === 'user')?.content ?? '', routeAction, routeReason, result.model, rehydratedContent, latencyMs).run();

  // Update session
  await c.env.DB.prepare(
    `UPDATE sessions SET message_count = message_count + 2, last_message_at = datetime('now') WHERE id = ?`
  ).bind(sessionId).run();

  return c.json({
    id: `chatcmpl-${interactionId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [{ index: 0, message: { role: 'assistant', content: rehydratedContent }, finish_reason: 'stop' }],
    usage: { prompt_tokens: result.usage?.promptTokens ?? 0, completion_tokens: result.usage?.completionTokens ?? 0, total_tokens: (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0) },
    _meta: { route: routeAction, cached: false, interactionId, classification },
  });
});

// Feedback endpoint
chatApp.patch('/interactions/:id/feedback', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ feedback: 'up' | 'down'; critique?: string }>().catch(() => null);

  if (!body || (body.feedback !== 'up' && body.feedback !== 'down')) {
    return c.json({ error: { type: 'validation_error', message: 'feedback must be "up" or "down"' } }, 400);
  }

  const result = await c.env.DB.prepare(
    `UPDATE interactions SET feedback = ?, critique = ? WHERE id = ? AND user_id = ?`
  ).bind(body.feedback, body.critique ?? null, id, userId).run();

  if (result.meta.changes === 0) {
    return c.json({ error: { type: 'not_found', message: 'Interaction not found' } }, 404);
  }

  return c.json({ updated: id, feedback: body.feedback });
});

export default chatApp;
