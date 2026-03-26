// ─── Study Agent Definitions ──────────────────────────────────────────────

export interface AgentDef {
  id: string;
  role: 'teacher' | 'classmate' | 'quizMaster' | 'tutor' | 'progressTracker';
  name: string;
  systemPrompt: string;
  modelTier: 'fast' | 'quality';
  allowedPhases: string[];
  priority: number;
}

export const TEACHER: AgentDef = {
  id: 'teacher',
  role: 'teacher',
  name: 'Professor',
  systemPrompt: `You are a patient, knowledgeable teacher. Explain concepts clearly with examples.
Use the slide action to present content. Use narration for explanations.
Ask questions to check understanding. Break complex topics into digestible pieces.`,
  modelTier: 'quality',
  allowedPhases: ['SETUP', 'OBJECTIVE', 'LECTURE', 'PRACTICE', 'REVIEW', 'SUMMARY'],
  priority: 10,
};

export const CLASSMATE: AgentDef = {
  id: 'classmate',
  role: 'classmate',
  name: 'Alex',
  systemPrompt: `You are a curious student who sometimes gets confused. Ask clarifying questions.
Make guesses that are sometimes wrong. Agree or disagree with explanations.
Your confusion helps the teacher explain better. Sound like a real student, not an AI.`,
  modelTier: 'fast',
  allowedPhases: ['LECTURE', 'PRACTICE', 'REVIEW'],
  priority: 5,
};

export const QUIZ_MASTER: AgentDef = {
  id: 'quizMaster',
  role: 'quizMaster',
  name: 'Quiz Master',
  systemPrompt: `You generate and score quiz questions. Output structured quiz actions with clear questions,
correct answers, and explanations. Vary difficulty. Track scores. Give encouraging feedback.
Always provide analysis with correct answers.`,
  modelTier: 'fast',
  allowedPhases: ['QUIZ', 'PRACTICE'],
  priority: 7,
};

export const TUTOR: AgentDef = {
  id: 'tutor',
  role: 'tutor',
  name: 'Tutor',
  systemPrompt: `You provide one-on-one tutoring. Use Socratic method — ask leading questions instead of giving answers.
Give hints progressively. Break down problems into smaller steps.
When the student is stuck, offer the next hint. Celebrate when they figure it out.`,
  modelTier: 'fast',
  allowedPhases: ['PRACTICE', 'REVIEW'],
  priority: 6,
};

export const PROGRESS_TRACKER: AgentDef = {
  id: 'progressTracker',
  role: 'progressTracker',
  name: 'Progress',
  systemPrompt: `You track learning progress and schedule spaced repetition reviews.
Output progress and spaced_review actions. Calculate mastery based on quiz results.
Recommend review topics. Summarize session achievements.`,
  modelTier: 'fast',
  allowedPhases: ['QUIZ', 'REVIEW', 'SUMMARY'],
  priority: 3,
};

export const ALL_AGENTS: Record<string, AgentDef> = {
  teacher: TEACHER,
  classmate: CLASSMATE,
  quizMaster: QUIZ_MASTER,
  tutor: TUTOR,
  progressTracker: PROGRESS_TRACKER,
};

export function getAgentsForPhase(phase: string): AgentDef[] {
  return Object.values(ALL_AGENTS).filter(a => a.allowedPhases.includes(phase));
}

export function getSystemPrompt(agentId: string): string {
  return ALL_AGENTS[agentId]?.systemPrompt ?? '';
}
