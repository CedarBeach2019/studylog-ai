// ─── Study Phase & Session State ──────────────────────────────────────────

export enum StudyPhase {
  SETUP = 'SETUP',
  OBJECTIVE = 'OBJECTIVE',
  LECTURE = 'LECTURE',
  PRACTICE = 'PRACTICE',
  QUIZ = 'QUIZ',
  REVIEW = 'REVIEW',
  SUMMARY = 'SUMMARY',
}

export const STUDY_TRANSITIONS: Record<StudyPhase, StudyPhase[]> = {
  [StudyPhase.SETUP]: [StudyPhase.OBJECTIVE],
  [StudyPhase.OBJECTIVE]: [StudyPhase.LECTURE],
  [StudyPhase.LECTURE]: [StudyPhase.LECTURE, StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.REVIEW],
  [StudyPhase.PRACTICE]: [StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.LECTURE, StudyPhase.REVIEW],
  [StudyPhase.QUIZ]: [StudyPhase.QUIZ, StudyPhase.REVIEW, StudyPhase.LECTURE, StudyPhase.SUMMARY],
  [StudyPhase.REVIEW]: [StudyPhase.LECTURE, StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.SUMMARY],
  [StudyPhase.SUMMARY]: [],
};

// ─── SM-2 Spaced Repetition (Accurate Anki Algorithm) ─────────────────────

export interface SM2Card {
  id: string;
  easeFactor: number;     // starts at 2.5
  interval: number;       // days until next review
  repetitions: number;    // consecutive correct reps
  nextReview: number;     // ms timestamp
  lastReview: number | null;
  deck: string;
}

export type SM2Rating = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = again, 1 = hard, 2 = hard, 3 = good, 4 = easy, 5 = easy

export function sm2Review(card: SM2Card, rating: SM2Rating): SM2Card {
  // Response quality: 0-5
  // 0 = complete blackout, 1 = incorrect but remembered upon seeing answer,
  // 2 = incorrect but answer seemed easy to recall, 3 = correct with serious difficulty,
  // 4 = correct after hesitation, 5 = perfect response

  const q = rating;
  const now = Date.now();

  if (q < 3) {
    // Reset on failure
    return {
      ...card,
      repetitions: 0,
      interval: 1,
      easeFactor: Math.max(1.3, card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
      lastReview: now,
      nextReview: now + 1 * 24 * 60 * 60 * 1000, // 1 minute in practice, 1 day for real
    };
  }

  // Success
  let newEF = card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  newEF = Math.max(1.3, newEF);

  let newInterval: number;
  if (card.repetitions === 0) {
    newInterval = 1;
  } else if (card.repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(card.interval * newEF);
  }

  return {
    ...card,
    repetitions: card.repetitions + 1,
    interval: newInterval,
    easeFactor: newEF,
    lastReview: now,
    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
  };
}

export function createSM2Card(id: string, deck: string): SM2Card {
  return {
    id,
    deck,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: Date.now(), // due immediately
    lastReview: null,
  };
}

// ─── Study Session State ──────────────────────────────────────────────────

export interface LearningObjective {
  id: string;
  topic: string;
  description: string;
  mastery: number; // 0-1
  targetMastery: number;
}

export interface QuizResult {
  questionId: string;
  correct: boolean;
  points: number;
  topicTag: string;
  timestamp: number;
}

export interface StudentProgress {
  objectives: Record<string, number>; // objectiveId -> mastery
  quizResults: QuizResult[];
  flashcards: Record<string, SM2Card>;
  totalPoints: number;
  streak: number;
  sessionStart: number;
}

export interface StudySessionState {
  id: string;
  phase: StudyPhase;
  topic: string;
  objectives: LearningObjective[];
  progress: StudentProgress;
  turnNumber: number;
  createdAt: number;
  updatedAt: number;
}

export function transition(current: StudyPhase, target: StudyPhase): StudyPhase {
  const valid = STUDY_TRANSITIONS[current];
  if (!valid || !valid.includes(target)) {
    throw new Error(`Invalid transition: ${current} → ${target}`);
  }
  return target;
}

export function createStudySession(id: string, topic: string): StudySessionState {
  return {
    id,
    phase: StudyPhase.SETUP,
    topic,
    objectives: [],
    progress: {
      objectives: {},
      quizResults: [],
      flashcards: {},
      totalPoints: 0,
      streak: 0,
      sessionStart: Date.now(),
    },
    turnNumber: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
