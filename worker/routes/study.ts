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
import {
  StudySession, SpacedRepetition, FlashCardEngine, KnowledgeGraph, StudyGoals,
  type FlashCardData, type PomodoroState,
} from '../../src/study/tracker.js';
import {
  SocraticMethod, QuizGenerator, WeaknessDetector,
  type QuizQuestion, type AnswerRecord,
} from '../../src/study/tutor.js';

type Bindings = { DB?: D1Database; KV?: KVNamespace };

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors());

// In-memory session store (replace with D1/KV in production)
const sessions = new Map<string, StudySessionState>();

// Study engine instances (per-user in production, global for demo)
const spacedRepetition = new SpacedRepetition();
const flashCardEngine = new FlashCardEngine(spacedRepetition);
const knowledgeGraph = new KnowledgeGraph();
const studyGoals = new StudyGoals();
const quizGenerator = new QuizGenerator();
const weaknessDetector = new WeaknessDetector();

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

// ─── GET /api/flashcards ──────────────────────────────────────────────────
app.get('/api/flashcards', async (c) => {
  const due = flashCardEngine.getDueCards();
  const counts = spacedRepetition.getCardCounts();
  return c.json({
    due: due.map(d => ({ id: d.data.id, front: d.data.front, back: d.data.back, tags: d.data.tags, deck: d.data.deck, nextReview: d.sm2.nextReview, easeFactor: d.sm2.easeFactor, repetitions: d.sm2.repetitions })),
    counts,
  });
});

// ─── POST /api/flashcards/create ──────────────────────────────────────────
app.post('/api/flashcards/create', async (c) => {
  const body = await c.req.json<{ front: string; back: string; tags?: string[]; deck?: string }>();
  if (!body.front || !body.back) return c.json({ error: 'front and back required' }, 400);
  const card = flashCardEngine.createCard({ front: body.front, back: body.back, tags: body.tags ?? [], deck: body.deck ?? 'default' });
  return c.json(card);
});

// ─── GET /api/progress ────────────────────────────────────────────────────
app.get('/api/progress', async (c) => {
  const kmStats = knowledgeGraph.getStats();
  const srCounts = spacedRepetition.getCardCounts();
  const weaknesses = weaknessDetector.detectWeaknesses();
  const strengths = weaknessDetector.getStrengths();
  const activeGoals = studyGoals.getActive();
  const completedGoals = studyGoals.getCompleted();

  // Aggregate from all sessions
  let totalPoints = 0;
  let streak = 0;
  let totalQuizResults = 0;
  let correctQuizResults = 0;
  for (const session of sessions.values()) {
    totalPoints += session.progress.totalPoints;
    streak = Math.max(streak, session.progress.streak);
    totalQuizResults += session.progress.quizResults.length;
    correctQuizResults += session.progress.quizResults.filter(r => r.correct).length;
  }

  return c.json({
    points: totalPoints,
    streak,
    accuracy: totalQuizResults > 0 ? correctQuizResults / totalQuizResults : 0,
    flashcardCounts: srCounts,
    knowledgeMap: kmStats,
    weaknesses: weaknesses.slice(0, 5),
    strengths: strengths.slice(0, 5),
    goals: { active: activeGoals.length, completed: completedGoals.length },
  });
});

// ─── GET /api/quiz ────────────────────────────────────────────────────────
app.get('/api/quiz', async (c) => {
  const concepts = c.req.query('concepts')?.split(',').filter(Boolean);
  const difficulty = c.req.query('difficulty') ?? undefined;
  const count = c.req.query('count') ? parseInt(c.req.query('count')!) : undefined;
  const quiz = quizGenerator.generateQuiz('Study Quiz', { concepts, difficulty, count });
  return c.json(quiz);
});

// ─── POST /api/quiz/submit ────────────────────────────────────────────────
app.post('/api/quiz/submit', async (c) => {
  const body = await c.req.json<{ quizId: string; answers: Record<string, string> }>();
  const quiz = quizGenerator.generateQuiz('temp'); // In production, retrieve stored quiz
  const attempt = quizGenerator.scoreAttempt(quiz, body.answers);

  // Record each answer for weakness detection
  for (const q of quiz.questions) {
    const given = body.answers[q.id];
    weaknessDetector.recordAnswer({
      concept: q.concept,
      correct: given?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim(),
      timestamp: Date.now(),
      difficulty: q.difficulty,
    });
  }

  return c.json({
    score: attempt.score,
    totalPoints: attempt.totalPoints,
    percentage: attempt.totalPoints > 0 ? attempt.score / attempt.totalPoints : 0,
  });
});

// ─── GET /api/study/knowledge-map ─────────────────────────────────────────
app.get('/api/study/knowledge-map', async (c) => {
  const nodes = knowledgeGraph.getAllNodes();
  const edges = knowledgeGraph.getAllEdges();
  const weakAreas = knowledgeGraph.getWeakAreas();
  const nextToLearn = knowledgeGraph.getNextToLearn();
  return c.json({ nodes, edges, weakAreas, nextToLearn: nextToLearn ?? null });
});

// ─── POST /api/study/knowledge-map/node ───────────────────────────────────
app.post('/api/study/knowledge-map/node', async (c) => {
  const body = await c.req.json<{ label: string; mastery?: number; prerequisites?: string[]; tags?: string[] }>();
  if (!body.label) return c.json({ error: 'label required' }, 400);
  const node = knowledgeGraph.addNode({
    label: body.label,
    mastery: body.mastery ?? 0,
    prerequisites: body.prerequisites ?? [],
    tags: body.tags ?? [],
  });
  return c.json(node);
});

// ─── GET /api/study/goals ─────────────────────────────────────────────────
app.get('/api/study/goals', async (c) => {
  return c.json({
    active: studyGoals.getActive(),
    completed: studyGoals.getCompleted(),
  });
});

// ─── POST /api/study/goals ────────────────────────────────────────────────
app.post('/api/study/goals', async (c) => {
  const body = await c.req.json<{ title: string; target: number; type: 'mastery' | 'pomodoros' | 'cards_reviewed' | 'quiz_score'; deadline?: number }>();
  if (!body.title || !body.target) return c.json({ error: 'title and target required' }, 400);
  const goal = studyGoals.addGoal({
    title: body.title,
    target: body.target,
    current: 0,
    deadline: body.deadline ?? Date.now() + 7 * 24 * 60 * 60 * 1000, // default 1 week
    type: body.type,
  });
  return c.json(goal);
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
