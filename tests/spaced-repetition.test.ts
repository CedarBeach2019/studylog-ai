// ─── Spaced Repetition Tests (Accurate SM-2 Algorithm) ────────────────────
import { describe, it, expect } from 'vitest';
import {
  sm2Review, createSM2Card, type SM2Card, type SM2Rating,
  StudyPhase, createStudySession, transition, STUDY_TRANSITIONS,
} from '../src/orchestrator/session-state.js';

describe('SM-2 Algorithm', () => {
  it('creates a new card with correct defaults', () => {
    const card = createSM2Card('c1', 'deck1');
    expect(card.easeFactor).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(card.lastReview).toBeNull();
  });

  it('first good review sets interval to 1, rep to 1', () => {
    const card = createSM2Card('c1', 'd');
    const result = sm2Review(card, 4); // good
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.5); // 2.5 + 0.1 - (5-4)*(0.08+(5-4)*0.02) = 2.5 + 0.1 - 0.10 = 2.5
  });

  it('second good review sets interval to 6', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 4);
    card = sm2Review(card, 4);
    expect(result_interval(card)).toBe(6);
    expect(card.repetitions).toBe(2);
  });

  it('third good review multiplies by EF (2.5 → 15)', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 4);
    card = sm2Review(card, 4);
    card = sm2Review(card, 4);
    expect(result_interval(card)).toBe(Math.round(6 * 2.5)); // 15
    expect(card.repetitions).toBe(3);
  });

  it('rating 5 (easy) increases ease factor', () => {
    const card = createSM2Card('c1', 'd');
    const result = sm2Review(card, 5);
    // EF = 2.5 + 0.1 - (5-5)*(0.08+(5-5)*0.02) = 2.6
    expect(result.easeFactor).toBe(2.6);
  });

  it('rating 1 (hard) decreases ease factor but above 1.3', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 4);
    card = sm2Review(card, 4);
    const result = sm2Review(card, 1);
    // EF = 2.5 + 0.1 - (5-1)*(0.08+(5-1)*0.02) = 2.6 - 4*0.16 = 2.6 - 0.64 = 1.96
    expect(result.easeFactor).toBeCloseTo(1.96, 2);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('rating 0 (again) resets repetitions to 0', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 4);
    card = sm2Review(card, 4);
    card = sm2Review(card, 4); // rep=3, interval=15
    const result = sm2Review(card, 0);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('rating 0 sets interval to 1 regardless of prior', () => {
    let card = createSM2Card('c1', 'd');
    card.repetitions = 10;
    card.interval = 100;
    const result = sm2Review(card, 0);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it('rating 0 decreases EF', () => {
    const card = createSM2Card('c1', 'd');
    const result = sm2Review(card, 0);
    // EF = 2.5 + 0.1 - (5-0)*(0.08+(5-0)*0.02) = 2.6 - 5*0.18 = 2.6 - 0.9 = 1.7
    expect(result.easeFactor).toBeCloseTo(1.7, 2);
  });

  it('ease factor never drops below 1.3', () => {
    let card = createSM2Card('c1', 'd');
    card.easeFactor = 1.3;
    const result = sm2Review(card, 0);
    // Would be 1.3 + 0.1 - 5*0.18 = 0.5, clamped to 1.3
    expect(result.easeFactor).toBe(1.3);
  });

  it('nextReview is set to now + interval days', () => {
    const card = createSM2Card('c1', 'd');
    const before = Date.now();
    const result = sm2Review(card, 3);
    const after = Date.now();
    // interval=1, so nextReview = now + 86400000
    expect(result.nextReview).toBeGreaterThanOrEqual(before + 86400000);
    expect(result.nextReview).toBeLessThanOrEqual(after + 86400000 + 100);
  });

  it('lastReview is set on review', () => {
    const card = createSM2Card('c1', 'd');
    expect(card.lastReview).toBeNull();
    const result = sm2Review(card, 3);
    expect(result.lastReview).not.toBeNull();
    expect(result.lastReview).toBeGreaterThan(0);
  });

  it('preserves card id and deck', () => {
    const card = createSM2Card('my-card', 'javascript');
    const result = sm2Review(card, 4);
    expect(result.id).toBe('my-card');
    expect(result.deck).toBe('javascript');
  });

  it('sequence of easy reviews increases interval exponentially', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 5); // interval=1, ef=2.6
    card = sm2Review(card, 5); // interval=6, ef=2.7
    card = sm2Review(card, 5); // interval=Math.round(6*2.7)=16
    expect(card.interval).toBe(Math.round(6 * 2.7));
  });

  it('mixed ratings: pass then fail resets properly', () => {
    let card = createSM2Card('c1', 'd');
    card = sm2Review(card, 4); // rep=1, int=1
    card = sm2Review(card, 4); // rep=2, int=6
    card = sm2Review(card, 0); // rep=0, int=1 (reset)
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(1);
    card = sm2Review(card, 4); // rep=1, int=1 (restart)
    expect(card.repetitions).toBe(1);
  });
});

describe('Study Session State', () => {
  it('creates session with SETUP phase', () => {
    const s = createStudySession('s1', 'Math');
    expect(s.phase).toBe(StudyPhase.SETUP);
    expect(s.topic).toBe('Math');
    expect(s.turnNumber).toBe(0);
  });

  it('transitions between valid phases', () => {
    expect(transition(StudyPhase.SETUP, StudyPhase.OBJECTIVE)).toBe(StudyPhase.OBJECTIVE);
    expect(transition(StudyPhase.OBJECTIVE, StudyPhase.LECTURE)).toBe(StudyPhase.LECTURE);
  });

  it('throws on invalid transition', () => {
    expect(() => transition(StudyPhase.SETUP, StudyPhase.LECTURE)).toThrow();
  });

  it('STUDY_TRANSITIONS has all phases', () => {
    const phases = Object.values(StudyPhase);
    for (const p of phases) {
      expect(STUDY_TRANSITIONS[p]).toBeDefined();
    }
  });

  it('SUMMARY has no valid transitions', () => {
    expect(STUDY_TRANSITIONS[StudyPhase.SUMMARY]).toEqual([]);
  });

  it('session has empty progress initially', () => {
    const s = createStudySession('s1', 'Math');
    expect(s.progress.quizResults).toEqual([]);
    expect(s.progress.totalPoints).toBe(0);
    expect(s.progress.streak).toBe(0);
  });
});

// Helper
function result_interval(card: SM2Card): number {
  return card.interval;
}
