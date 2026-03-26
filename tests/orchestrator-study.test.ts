// ─── Orchestrator Study Tests ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { routeToAgent, isValidTransition } from '../src/orchestrator/director.js';
import { StudyPhase } from '../src/orchestrator/session-state.js';
import { ALL_AGENTS, getAgentsForPhase, getSystemPrompt } from '../src/orchestrator/agents.js';

describe('routeToAgent', () => {
  const baseCtx = {
    phase: StudyPhase.LECTURE,
    turnNumber: 1,
    lastSpeakerId: null,
    message: '',
    turnHistory: [],
  };

  it('routes SETUP phase to teacher with OBJECTIVE transition', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.SETUP });
    expect(d.agentId).toBe('teacher');
    expect(d.phaseTransition?.to).toBe(StudyPhase.OBJECTIVE);
  });

  it('routes OBJECTIVE phase to teacher with LECTURE transition', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.OBJECTIVE });
    expect(d.agentId).toBe('teacher');
    expect(d.phaseTransition?.to).toBe(StudyPhase.LECTURE);
  });

  it('routes QUIZ phase to quizMaster', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.QUIZ });
    expect(d.agentId).toBe('quizMaster');
  });

  it('routes REVIEW phase to tutor by default', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.REVIEW, message: 'help me' });
    expect(d.agentId).toBe('tutor');
  });

  it('routes REVIEW to quizMaster when student requests quiz', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.REVIEW, message: 'give me a quiz' });
    expect(d.agentId).toBe('quizMaster');
    expect(d.phaseTransition?.to).toBe(StudyPhase.QUIZ);
  });

  it('routes SUMMARY to progressTracker', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.SUMMARY });
    expect(d.agentId).toBe('progressTracker');
  });

  it('routes SUMMARY shouldEnd after turn 2', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.SUMMARY, turnNumber: 3 });
    expect(d.shouldEnd).toBe(true);
  });

  it('routes LECTURE question to teacher', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.LECTURE, message: 'What is a closure?' });
    expect(d.agentId).toBe('teacher');
  });

  it('routes LECTURE practice signal to teacher with PRACTICE transition', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.LECTURE, message: 'I got it, let me practice' });
    expect(d.agentId).toBe('teacher');
    expect(d.phaseTransition?.to).toBe(StudyPhase.PRACTICE);
  });

  it('routes PRACTICE stuck to tutor', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.PRACTICE, message: "I'm stuck" });
    expect(d.agentId).toBe('tutor');
  });

  it('routes PRACTICE quiz request to quizMaster', () => {
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.PRACTICE, message: 'test me' });
    expect(d.agentId).toBe('quizMaster');
    expect(d.phaseTransition?.to).toBe(StudyPhase.QUIZ);
  });

  it('routes QUIZ low score to tutor', () => {
    const d = routeToAgent({
      ...baseCtx,
      phase: StudyPhase.QUIZ,
      turnNumber: 3,
      quizScore: { correct: 1, total: 5 },
    });
    expect(d.agentId).toBe('tutor');
  });

  it('returns decision with required fields', () => {
    const d = routeToAgent(baseCtx);
    expect(d).toHaveProperty('agentId');
    expect(d).toHaveProperty('instructions');
    expect(d).toHaveProperty('phaseTransition');
    expect(d).toHaveProperty('shouldEnd');
    expect(d).toHaveProperty('priority');
    expect(d).toHaveProperty('reasoning');
  });

  it('fallback returns teacher for unknown phase', () => {
    const d = routeToAgent({ ...baseCtx, phase: 'UNKNOWN' as any });
    expect(d.agentId).toBe('teacher');
  });

  it('alternates between teacher and tutor in PRACTICE', () => {
    const d1 = routeToAgent({ ...baseCtx, phase: StudyPhase.PRACTICE, lastSpeakerId: 'teacher' });
    expect(d1.agentId).toBe('tutor');

    const d2 = routeToAgent({ ...baseCtx, phase: StudyPhase.PRACTICE, lastSpeakerId: 'tutor' });
    expect(d2.agentId).toBe('teacher');
  });

  it('injects classmate after 3 teacher turns in LECTURE', () => {
    const history = Array(3).fill({ agentId: 'teacher' });
    const d = routeToAgent({ ...baseCtx, phase: StudyPhase.LECTURE, message: 'continue', turnHistory: history });
    expect(d.agentId).toBe('classmate');
  });
});

describe('isValidTransition', () => {
  it('allows SETUP → OBJECTIVE', () => {
    expect(isValidTransition(StudyPhase.SETUP, StudyPhase.OBJECTIVE)).toBe(true);
  });

  it('allows OBJECTIVE → LECTURE', () => {
    expect(isValidTransition(StudyPhase.OBJECTIVE, StudyPhase.LECTURE)).toBe(true);
  });

  it('allows LECTURE → PRACTICE', () => {
    expect(isValidTransition(StudyPhase.LECTURE, StudyPhase.PRACTICE)).toBe(true);
  });

  it('allows LECTURE → QUIZ', () => {
    expect(isValidTransition(StudyPhase.LECTURE, StudyPhase.QUIZ)).toBe(true);
  });

  it('disallows SETUP → LECTURE', () => {
    expect(isValidTransition(StudyPhase.SETUP, StudyPhase.LECTURE)).toBe(false);
  });

  it('disallows SUMMARY → LECTURE', () => {
    expect(isValidTransition(StudyPhase.SUMMARY, StudyPhase.LECTURE)).toBe(false);
  });

  it('allows LECTURE → LECTURE (stay)', () => {
    expect(isValidTransition(StudyPhase.LECTURE, StudyPhase.LECTURE)).toBe(true);
  });

  it('allows QUIZ → SUMMARY', () => {
    expect(isValidTransition(StudyPhase.QUIZ, StudyPhase.SUMMARY)).toBe(true);
  });
});

describe('Agents', () => {
  it('has all 5 agents', () => {
    expect(Object.keys(ALL_AGENTS)).toEqual(['teacher', 'classmate', 'quizMaster', 'tutor', 'progressTracker']);
  });

  it('teacher has highest priority', () => {
    expect(ALL_AGENTS.teacher.priority).toBeGreaterThan(ALL_AGENTS.classmate.priority);
  });

  it('getAgentsForPhase returns correct agents for QUIZ', () => {
    const agents = getAgentsForPhase('QUIZ');
    expect(agents.map(a => a.id)).toContain('quizMaster');
  });

  it('getSystemPrompt returns non-empty string for teacher', () => {
    const prompt = getSystemPrompt('teacher');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('getSystemPrompt returns empty for unknown agent', () => {
    expect(getSystemPrompt('nonexistent')).toBe('');
  });
});
