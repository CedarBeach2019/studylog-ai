// ─── Study Tutor — Socratic method, explanations, quizzes, weakness detection
// ─── Part of StudyLog.ai learning vessel

// ─── SocraticMethod ──────────────────────────────────────────────────────────

export interface SocraticQuestion {
  id: string;
  question: string;
  hint?: string;
  targetConcept: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface SocraticExchange {
  question: SocraticQuestion;
  studentAnswer: string;
  followUp: string | null; // null if correct, follow-up guidance if not
}

export class SocraticMethod {
  private questions: SocraticQuestion[] = [];
  private exchanges: SocraticExchange[] = [];

  addQuestion(q: Omit<SocraticQuestion, 'id'>): SocraticQuestion {
    const id = `sq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const question: SocraticQuestion = { ...q, id };
    this.questions.push(question);
    return question;
  }

  getNextQuestion(concept?: string, difficulty?: string): SocraticQuestion | undefined {
    let pool = this.questions;
    if (concept) pool = pool.filter(q => q.targetConcept === concept);
    if (difficulty) pool = pool.filter(q => q.difficulty === difficulty);
    // Pick one not yet answered correctly
    const answeredIds = new Set(
      this.exchanges.filter(e => e.followUp === null).map(e => e.question.id)
    );
    return pool.find(q => !answeredIds.has(q.id));
  }

  answer(questionId: string, studentAnswer: string, evaluate: (q: SocraticQuestion, a: string) => boolean): SocraticExchange {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);

    const correct = evaluate(question, studentAnswer);
    const exchange: SocraticExchange = {
      question,
      studentAnswer,
      followUp: correct ? null : (question.hint ?? `Think about ${question.targetConcept} from a different angle.`),
    };
    this.exchanges.push(exchange);
    return exchange;
  }

  getExchanges(): SocraticExchange[] {
    return [...this.exchanges];
  }

  getAccuracy(): number {
    if (this.exchanges.length === 0) return 0;
    return this.exchanges.filter(e => e.followUp === null).length / this.exchanges.length;
  }
}

// ─── ExplanationGenerator ────────────────────────────────────────────────────

export type ExplainLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Explanation {
  concept: string;
  level: ExplainLevel;
  summary: string;
  analogy?: string;
  examples: string[];
  prerequisites: string[];
}

export class ExplanationGenerator {
  private explanations: Map<string, Explanation> = new Map();

  addExplanation(explanation: Explanation): void {
    this.explanations.set(`${explanation.concept}:${explanation.level}`, explanation);
  }

  getExplanation(concept: string, level: ExplainLevel): Explanation | undefined {
    return this.explanations.get(`${concept}:${level}`);
  }

  generatePrompt(concept: string, level: ExplainLevel): string {
    const existing = this.getExplanation(concept, level);
    if (existing) {
      return `Explain "${concept}" at a ${level} level.\n\nSummary: ${existing.summary}\nAnalogy: ${existing.analogy ?? 'N/A'}\nExamples: ${existing.examples.join(', ')}`;
    }
    const levelInstructions: Record<ExplainLevel, string> = {
      beginner: 'Use simple language, everyday analogies, and step-by-step breakdowns. Avoid jargon.',
      intermediate: 'Build on basic understanding. Include technical terms with definitions. Use real-world examples.',
      advanced: 'Assume strong foundational knowledge. Focus on edge cases, formal definitions, and connections to other concepts.',
    };
    return `Explain "${concept}" at a ${level} level. ${levelInstructions[level]}\n\nStructure: summary, analogy, 2-3 examples, prerequisites.`;
  }

  getAllForConcept(concept: string): Explanation[] {
    return [...this.explanations.values()].filter(e => e.concept === concept);
  }
}

// ─── QuizGenerator ───────────────────────────────────────────────────────────

export type QuizType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  question: string;
  options?: string[];       // for multiple choice
  correctAnswer: string;
  explanation: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  timeLimitSeconds?: number;
}

export interface QuizAttempt {
  quizId: string;
  answers: Map<string, string>; // questionId -> answer
  score: number;
  totalPoints: number;
  startedAt: number;
  completedAt: number;
}

export class QuizGenerator {
  private questionBank: Map<string, QuizQuestion> = new Map();

  addQuestion(q: Omit<QuizQuestion, 'id'>): QuizQuestion {
    const id = `qq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const question: QuizQuestion = { ...q, id };
    this.questionBank.set(id, question);
    return question;
  }

  generateQuiz(
    title: string,
    opts: {
      concepts?: string[];
      difficulty?: string;
      count?: number;
      types?: QuizType[];
      timeLimitSeconds?: number;
    } = {}
  ): Quiz {
    let pool = [...this.questionBank.values()];

    if (opts.concepts?.length) {
      pool = pool.filter(q => opts.concepts!.includes(q.concept));
    }
    if (opts.difficulty) {
      pool = pool.filter(q => q.difficulty === opts.difficulty);
    }
    if (opts.types?.length) {
      pool = pool.filter(q => opts.types!.includes(q.type));
    }

    // Shuffle and take count
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const count = opts.count ?? Math.min(10, shuffled.length);
    const selected = shuffled.slice(0, count);

    return {
      id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      questions: selected,
      timeLimitSeconds: opts.timeLimitSeconds,
    };
  }

  scoreAttempt(quiz: Quiz, answers: Record<string, string>): QuizAttempt {
    const now = Date.now();
    let score = 0;
    let totalPoints = 0;
    const answerMap = new Map(Object.entries(answers));

    for (const q of quiz.questions) {
      totalPoints += q.points;
      const given = answerMap.get(q.id);
      if (given?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
        score += q.points;
      }
    }

    return { quizId: quiz.id, answers: answerMap, score, totalPoints, startedAt: now, completedAt: now };
  }

  getQuestion(id: string): QuizQuestion | undefined {
    return this.questionBank.get(id);
  }

  getQuestionsByConcept(concept: string): QuizQuestion[] {
    return [...this.questionBank.values()].filter(q => q.concept === concept);
  }
}

// ─── WeaknessDetector ────────────────────────────────────────────────────────

export interface Weakness {
  concept: string;
  score: number;        // 0-1, lower = weaker
  attempts: number;
  incorrect: number;
  relatedConcepts: string[];
  suggestedAction: 'review' | 'practice' | 'relearn' | 'quiz';
}

export interface AnswerRecord {
  concept: string;
  correct: boolean;
  timestamp: number;
  difficulty: string;
}

export class WeaknessDetector {
  private records: AnswerRecord[] = [];

  recordAnswer(record: AnswerRecord): void {
    this.records.push(record);
  }

  detectWeaknesses(threshold = 0.6): Weakness[] {
    const byConcept = new Map<string, AnswerRecord[]>();
    for (const r of this.records) {
      const arr = byConcept.get(r.concept) ?? [];
      arr.push(r);
      byConcept.set(r.concept, arr);
    }

    const weaknesses: Weakness[] = [];
    for (const [concept, records] of byConcept) {
      const correct = records.filter(r => r.correct).length;
      const score = correct / records.length;

      if (score < threshold) {
        let suggestedAction: Weakness['suggestedAction'] = 'review';
        if (score < 0.3) suggestedAction = 'relearn';
        else if (score < 0.5) suggestedAction = 'practice';
        else suggestedAction = 'quiz';

        weaknesses.push({
          concept,
          score,
          attempts: records.length,
          incorrect: records.length - correct,
          relatedConcepts: this.findRelated(concept),
          suggestedAction,
        });
      }
    }

    return weaknesses.sort((a, b) => a.score - b.score);
  }

  getStrengths(threshold = 0.8): Array<{ concept: string; score: number }> {
    const byConcept = new Map<string, AnswerRecord[]>();
    for (const r of this.records) {
      const arr = byConcept.get(r.concept) ?? [];
      arr.push(r);
      byConcept.set(r.concept, arr);
    }

    const strengths: Array<{ concept: string; score: number }> = [];
    for (const [concept, records] of byConcept) {
      const score = records.filter(r => r.correct).length / records.length;
      if (score >= threshold) {
        strengths.push({ concept, score });
      }
    }
    return strengths.sort((a, b) => b.score - a.score);
  }

  private findRelated(concept: string): string[] {
    // Simple co-occurrence based on same-session answers
    const concepts = new Set<string>();
    const timestamps = this.records
      .filter(r => r.concept === concept)
      .map(r => r.timestamp);

    for (const r of this.records) {
      if (r.concept !== concept && timestamps.some(t => Math.abs(r.timestamp - t) < 300000)) {
        concepts.add(r.concept);
      }
    }
    return [...concepts].slice(0, 5);
  }

  getRecords(): AnswerRecord[] {
    return [...this.records];
  }
}
