// ─── Study Director: Routes input to the right agent based on phase + content ─────────

import { StudyPhase } from './session-state.js';
import { ALL_AGENTS, type AgentDef } from './agents.js';

export interface DirectorDecision {
  agentId: string;
  instructions: string;
  phaseTransition: { to: StudyPhase; reason: string } | null;
  shouldEnd: boolean;
  priority: 'high' | 'normal' | 'low';
  reasoning: string;
}

interface RoutingContext {
  phase: StudyPhase;
  turnNumber: number;
  lastSpeakerId: string | null;
  message: string;
  quizScore?: { correct: number; total: number };
  turnHistory: Array<{ agentId: string }>;
}

export function routeToAgent(ctx: RoutingContext): DirectorDecision {
  const { phase, message, turnNumber, lastSpeakerId, quizScore, turnHistory } = ctx;

  // ─── Rule-based routing ───────────────────────────────────────────────

  // Setup phase: always teacher to set objectives
  if (phase === StudyPhase.SETUP) {
    return {
      agentId: 'teacher',
      instructions: 'Set learning objectives and create a roadmap for this topic.',
      phaseTransition: { to: StudyPhase.OBJECTIVE, reason: 'Topic selected, set objectives' },
      shouldEnd: false,
      priority: 'high',
      reasoning: 'Setup phase requires teacher to define learning goals',
    };
  }

  // Objective phase: teacher presents the plan
  if (phase === StudyPhase.OBJECTIVE) {
    return {
      agentId: 'teacher',
      instructions: 'Present the learning objectives and session outline.',
      phaseTransition: { to: StudyPhase.LECTURE, reason: 'Objectives set, begin lecture' },
      shouldEnd: false,
      priority: 'high',
      reasoning: 'Teacher presents learning objectives',
    };
  }

  // Quiz phase: quiz master generates questions, or scores answers
  if (phase === StudyPhase.QUIZ) {
    if (turnNumber > 0 && turnNumber % 2 === 0 && quizScore && quizScore.correct < quizScore.total * 0.5) {
      return {
        agentId: 'tutor',
        instructions: 'The student is struggling. Offer hints and review the concepts they missed.',
        phaseTransition: null,
        shouldEnd: false,
        priority: 'high',
        reasoning: 'Low quiz score triggers tutor intervention',
      };
    }
    return {
      agentId: 'quizMaster',
      instructions: 'Generate the next quiz question or score the student answer.',
      phaseTransition: null,
      shouldEnd: false,
      priority: 'high',
      reasoning: 'Quiz phase handled by quiz master',
    };
  }

  // Review phase: tutor helps with weak areas
  if (phase === StudyPhase.REVIEW) {
    if (message.toLowerCase().includes('quiz') || message.toLowerCase().includes('test')) {
      return {
        agentId: 'quizMaster',
        instructions: 'Student wants to test themselves. Generate a quick review quiz.',
        phaseTransition: { to: StudyPhase.QUIZ, reason: 'Student requested quiz' },
        shouldEnd: false,
        priority: 'normal',
        reasoning: 'Student explicitly requested quiz/test',
      };
    }
    return {
      agentId: 'tutor',
      instructions: 'Help the student review. Ask what they want to focus on. Use Socratic method.',
      phaseTransition: null,
      shouldEnd: false,
      priority: 'high',
      reasoning: 'Review phase: tutor provides personalized help',
    };
  }

  // Summary phase: teacher wraps up
  if (phase === StudyPhase.SUMMARY) {
    return {
      agentId: 'progressTracker',
      instructions: 'Summarize session achievements, calculate final mastery, schedule spaced repetition reviews.',
      phaseTransition: null,
      shouldEnd: turnNumber > 2,
      priority: 'high',
      reasoning: 'Summary phase: report progress',
    };
  }

  // Lecture phase: teacher or classmate
  if (phase === StudyPhase.LECTURE) {
    // Student asks a question → teacher answers
    if (message.includes('?') || message.toLowerCase().match(/^(what|why|how|when|where|explain|tell me)/)) {
      return {
        agentId: 'teacher',
        instructions: 'The student asked a question. Answer it clearly with examples.',
        phaseTransition: null,
        shouldEnd: false,
        priority: 'high',
        reasoning: 'Student asked a question during lecture',
      };
    }

    // Every 4th turn, classmate asks a confused question
    const recentTeacherTurns = turnHistory.slice(-3).filter(t => t.agentId === 'teacher').length;
    if (recentTeacherTurns >= 3 && lastSpeakerId !== 'classmate') {
      return {
        agentId: 'classmate',
        instructions: 'You are confused about something the teacher just explained. Ask for clarification.',
        phaseTransition: null,
        shouldEnd: false,
        priority: 'normal',
        reasoning: 'Inject classmate question for engagement',
      };
    }

    // Student says they understand or are ready for practice
    if (message.toLowerCase().match(/(got it|understand|practice|try|exercise|quiz)/)) {
      return {
        agentId: 'teacher',
        instructions: 'Student indicates readiness. Transition to practice or quiz.',
        phaseTransition: { to: StudyPhase.PRACTICE, reason: 'Student ready for practice' },
        shouldEnd: false,
        priority: 'high',
        reasoning: 'Student signals readiness for practice',
      };
    }

    // Default: continue teaching
    return {
      agentId: 'teacher',
      instructions: 'Continue the lecture. Present the next concept with a slide action.',
      phaseTransition: null,
      shouldEnd: false,
      priority: 'high',
      reasoning: 'Continue lecture content delivery',
    };
  }

  // Practice phase: tutor helps, teacher demonstrates
  if (phase === StudyPhase.PRACTICE) {
    if (message.toLowerCase().match(/(stuck|help|hint|don't know|confused|lost)/)) {
      return {
        agentId: 'tutor',
        instructions: 'Student is stuck. Provide a progressive hint. Do not give the answer directly.',
        phaseTransition: null,
        shouldEnd: false,
        priority: 'high',
        reasoning: 'Student needs help during practice',
      };
    }

    if (message.toLowerCase().match(/(quiz|test|check)/)) {
      return {
        agentId: 'quizMaster',
        instructions: 'Student wants to test their knowledge. Generate a quiz.',
        phaseTransition: { to: StudyPhase.QUIZ, reason: 'Student ready for assessment' },
        shouldEnd: false,
        priority: 'high',
        reasoning: 'Student requested quiz during practice',
      };
    }

    // Alternate between teacher (demonstrating) and tutor (guiding)
    if (lastSpeakerId === 'teacher') {
      return {
        agentId: 'tutor',
        instructions: 'Guide the student through the next practice step. Ask them to try.',
        phaseTransition: null,
        shouldEnd: false,
        priority: 'normal',
        reasoning: 'Alternate: tutor guides practice',
      };
    }

    return {
      agentId: 'teacher',
      instructions: 'Demonstrate the next concept or provide worked example.',
      phaseTransition: null,
      shouldEnd: false,
      priority: 'normal',
      reasoning: 'Alternate: teacher demonstrates during practice',
    };
  }

  // Fallback: teacher
  return {
    agentId: 'teacher',
    instructions: message || 'Continue the session.',
    phaseTransition: null,
    shouldEnd: false,
    priority: 'normal',
    reasoning: 'Fallback to teacher',
  };
}

// Validate that a transition is allowed
export function isValidTransition(from: StudyPhase, to: StudyPhase): boolean {
  const transitions: Record<StudyPhase, StudyPhase[]> = {
    [StudyPhase.SETUP]: [StudyPhase.OBJECTIVE],
    [StudyPhase.OBJECTIVE]: [StudyPhase.LECTURE],
    [StudyPhase.LECTURE]: [StudyPhase.LECTURE, StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.REVIEW],
    [StudyPhase.PRACTICE]: [StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.LECTURE, StudyPhase.REVIEW],
    [StudyPhase.QUIZ]: [StudyPhase.QUIZ, StudyPhase.REVIEW, StudyPhase.LECTURE, StudyPhase.SUMMARY],
    [StudyPhase.REVIEW]: [StudyPhase.LECTURE, StudyPhase.PRACTICE, StudyPhase.QUIZ, StudyPhase.SUMMARY],
    [StudyPhase.SUMMARY]: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
