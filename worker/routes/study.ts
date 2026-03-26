// ─── Study Routes (Hono) ──────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { nanoid } from 'nanoid';
import {
  StudyPhase, createStudySession, transition as phaseTransition,
  sm2Review, createSM2Card, type SM2Card, type SM2Rating,
  type StudySessionState, type QuizResult,
} from '../../src/orchestrator/session-state.js';
import { routeToAgent } from '../../src/orchestrator/director.js';

type Bindings = { DB?: D1Database; KV?: KVNamespace };

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors());

// In-memory session store (replace with D1/KV in production)
const sessions = new Map<string, StudySessionState>();

// ─── POST /api/study/start ────────────────────────────────────────────────
app.post('/api/study/start', async (c) => {
  const body = await c.req.json<{ topic: string; objectives?: Array<{ topic: string; description: string }> }>();
  if (!body.topic) return c.json({ error: 'topic required' }, 400);

  const id = `study_${nanoid(10)}`;
  const session = createStudySession(id, body.topic);

  if (body.objectives) {
    session.objectives = body.objectives.map((o, i) => ({
      id: `obj_${i}`,
      topic: o.topic,
      description: o.description,
      mastery: 0,
      targetMastery: 0.8,
    }));
  }

  session.phase = phaseTransition(session.phase, StudyPhase.OBJECTIVE);
  sessions.set(id, session);

  return c.json({
    sessionId: id,
    phase: session.phase,
    topic: session.topic,
    objectives: session.objectives,
  });
});

// ─── POST /api/study/turn ─────────────────────────────────────────────────
app.post('/api/study/turn', async (c) => {
  const body = await c.req.json<{ sessionId: string; message: string }>();
  const session = sessions.get(body.sessionId);
  if (!session) return c.json({ error: 'session not found' }, 404);

  session.turnNumber++;
  session.updatedAt = Date.now();

  const recentHistory = [{ agentId: 'user' }]; // simplified
  const quizCorrect = session.progress.quizResults.filter(r => r.correct).length;
  const quizTotal = session.progress.quizResults.length;

  const decision = routeToAgent({
    phase: session.phase,
    turnNumber: session.turnNumber,
    lastSpeakerId: null,
    message: body.message,
    quizScore: quizTotal > 0 ? { correct: quizCorrect, total: quizTotal } : undefined,
    turnHistory: recentHistory,
  });

  if (decision.phaseTransition) {
    session.phase = phaseTransition(session.phase, decision.phaseTransition.to);
  }

  sessions.set(body.sessionId, session);

  return c.json({
    turnNumber: session.turnNumber,
    phase: session.phase,
    agentId: decision.agentId,
    instructions: decision.instructions,
    reasoning: decision.reasoning,
  });
});

// ─── GET /api/study/session/:id ──────────────────────────────────────────
app.get('/api/study/session/:id', async (c) => {
  const session = sessions.get(c.req.param('id'));
  if (!session) return c.json({ error: 'session not found' }, 404);
  return c.json(session);
});

// ─── POST /api/study/quiz ────────────────────────────────────────────────
app.post('/api/study/quiz', async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    questionId: string;
    answer: string;
    correct: boolean;
    points: number;
    topicTag: string;
  }>();

  const session = sessions.get(body.sessionId);
  if (!session) return c.json({ error: 'session not found' }, 404);

  const result: QuizResult = {
    questionId: body.questionId,
    correct: body.correct,
    points: body.points,
    topicTag: body.topicTag,
    timestamp: Date.now(),
  };

  session.progress.quizResults.push(result);
  if (body.correct) {
    session.progress.totalPoints += body.points;
    session.progress.streak++;
  } else {
    session.progress.streak = 0;
  }

  sessions.set(body.sessionId, session);

  return c.json({
    result,
    totalPoints: session.progress.totalPoints,
    streak: session.progress.streak,
    accuracy: session.progress.quizResults.length > 0
      ? session.progress.quizResults.filter(r => r.correct).length / session.progress.quizResults.length
      : 0,
  });
});

// ─── POST /api/study/flashcards ──────────────────────────────────────────
app.post('/api/study/flashcards', async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    cards: Array<{ id: string; front: string; back: string; tags?: string[] }>;
  }>();

  const session = sessions.get(body.sessionId);
  if (!session) return c.json({ error: 'session not found' }, 404);

  for (const card of body.cards) {
    session.progress.flashcards[card.id] = createSM2Card(card.id, 'session');
  }

  sessions.set(body.sessionId, session);

  const allCards = Object.values(session.progress.flashcards);
  const dueCards = allCards.filter(c => c.nextReview <= Date.now());

  return c.json({
    total: allCards.length,
    due: dueCards.length,
    new: allCards.filter(c => c.repetitions === 0).length,
  });
});

// ─── POST /api/study/flashcard/review ────────────────────────────────────
app.post('/api/study/flashcard/review', async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    cardId: string;
    rating: SM2Rating;
  }>();

  const session = sessions.get(body.sessionId);
  if (!session) return c.json({ error: 'session not found' }, 404);

  const card = session.progress.flashcards[body.cardId];
  if (!card) return c.json({ error: 'card not found' }, 404);

  const updated = sm2Review(card, body.rating);
  session.progress.flashcards[body.cardId] = updated;
  sessions.set(body.sessionId, session);

  return c.json({
    cardId: updated.id,
    interval: updated.interval,
    easeFactor: updated.easeFactor,
    repetitions: updated.repetitions,
    nextReview: new Date(updated.nextReview).toISOString(),
  });
});

// ─── GET /api/study/stream (SSE) ─────────────────────────────────────────
app.get('/api/study/stream', async (c) => {
  const sessionId = c.req.query('sessionId');
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const session = sessions.get(sessionId);
  if (!session) return c.json({ error: 'session not found' }, 404);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('session_meta', { sessionId, phase: session.phase, turn: session.turnNumber });

      // Simulate a few actions for the stream
      send('action', { type: 'slide', payload: { slide_number: 1, total_slides: 3, title: session.topic, content: `Welcome to your study session on ${session.topic}` } });
      send('action', { type: 'narration', payload: { text: `Let's begin studying **${session.topic}**.` } });
      send('session_end', { done: true });

      // Keep alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(':heartbeat\n\n'));
      }, 15000);

      // Close after 30s if no client disconnect
      setTimeout(() => {
        clearInterval(heartbeat);
        controller.close();
      }, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

export default app;
