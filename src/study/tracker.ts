// ─── Study Tracker — Session management, spaced repetition, flashcards, knowledge graph, goals
// ─── Part of StudyLog.ai learning vessel

import { sm2Review, createSM2Card, type SM2Card, type SM2Rating } from '../orchestrator/session-state.js';

// ─── StudySession ────────────────────────────────────────────────────────────

export interface StudySessionConfig {
  topic: string;
  objectives?: string[];
  pomodoroMinutes?: number;
  breakMinutes?: number;
}

export interface PomodoroState {
  remaining: number;       // seconds left
  isRunning: boolean;
  isBreak: boolean;
  completed: number;       // pomodoros done
  totalMinutes: number;    // session total
}

export class StudySession {
  readonly id: string;
  readonly topic: string;
  readonly objectives: string[];
  readonly createdAt: number;
  pomodoro: PomodoroState;
  notes: string[] = [];
  private _active = true;

  constructor(id: string, config: StudySessionConfig) {
    this.id = id;
    this.topic = config.topic;
    this.objectives = config.objectives ?? [];
    this.createdAt = Date.now();
    this.pomodoro = {
      remaining: (config.pomodoroMinutes ?? 25) * 60,
      isRunning: false,
      isBreak: false,
      completed: 0,
      totalMinutes: config.pomodoroMinutes ?? 25,
    };
  }

  get active() { return this._active; }

  startPomodoro(): void {
    this.pomodoro.isRunning = true;
  }

  pausePomodoro(): void {
    this.pomodoro.isRunning = false;
  }

  tickPomodoro(): boolean {
    if (!this.pomodoro.isRunning) return false;
    if (this.pomodoro.remaining <= 0) {
      if (this.pomodoro.isBreak) {
        this.pomodoro.isBreak = false;
        this.pomodoro.remaining = this.pomodoro.totalMinutes * 60;
      } else {
        this.pomodoro.completed++;
        this.pomodoro.isBreak = true;
        this.pomodoro.remaining = 5 * 60; // 5-min break
      }
      this.pomodoro.isRunning = false;
      return true; // signal phase change
    }
    this.pomodoro.remaining--;
    return false;
  }

  addNote(note: string): void {
    this.notes.push(note);
  }

  end(): void {
    this._active = false;
    this.pomodoro.isRunning = false;
  }
}

// ─── SpacedRepetition ───────────────────────────────────────────────────────

export interface ReviewResult {
  cardId: string;
  rating: SM2Rating;
  reviewedAt: number;
}

export class SpacedRepetition {
  private cards: Map<string, SM2Card> = new Map();
  private history: ReviewResult[] = [];

  addCard(id: string, deck = 'default'): SM2Card {
    const card = createSM2Card(id, deck);
    this.cards.set(id, card);
    return card;
  }

  getCard(id: string): SM2Card | undefined {
    return this.cards.get(id);
  }

  review(cardId: string, rating: SM2Rating): SM2Card {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    const updated = sm2Review(card, rating);
    this.cards.set(cardId, updated);
    this.history.push({ cardId, rating, reviewedAt: Date.now() });
    return updated;
  }

  getDueCards(now = Date.now()): SM2Card[] {
    return [...this.cards.values()].filter(c => c.nextReview <= now);
  }

  getCardCounts(): { total: number; due: number; new: number; learning: number } {
    const all = [...this.cards.values()];
    return {
      total: all.length,
      due: all.filter(c => c.nextReview <= Date.now()).length,
      new: all.filter(c => c.repetitions === 0).length,
      learning: all.filter(c => c.repetitions > 0 && c.repetitions < 3).length,
    };
  }

  getReviewHistory(): ReviewResult[] {
    return [...this.history];
  }
}

// ─── FlashCardEngine ─────────────────────────────────────────────────────────

export interface FlashCardData {
  id: string;
  front: string;
  back: string;
  tags: string[];
  deck: string;
}

export class FlashCardEngine {
  private cards: Map<string, FlashCardData> = new Map();
  private sr: SpacedRepetition;

  constructor(sr: SpacedRepetition) {
    this.sr = sr;
  }

  createCard(data: Omit<FlashCardData, 'id'>): FlashCardData {
    const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const card: FlashCardData = { ...data, id };
    this.cards.set(id, card);
    this.sr.addCard(id, data.deck);
    return card;
  }

  getCard(id: string): FlashCardData | undefined {
    return this.cards.get(id);
  }

  rateCard(cardId: string, rating: SM2Rating): { card: FlashCardData; sm2: SM2Card } {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    const sm2 = this.sr.review(cardId, rating);
    return { card, sm2 };
  }

  getDueCards(): Array<{ data: FlashCardData; sm2: SM2Card }> {
    const due = this.sr.getDueCards();
    return due
      .map(sm2 => ({ data: this.cards.get(sm2.id)!, sm2 }))
      .filter(c => c.data);
  }

  getByDeck(deck: string): FlashCardData[] {
    return [...this.cards.values()].filter(c => c.deck === deck);
  }

  getByTag(tag: string): FlashCardData[] {
    return [...this.cards.values()].filter(c => c.tags.includes(tag));
  }

  getAllCards(): FlashCardData[] {
    return [...this.cards.values()];
  }
}

// ─── KnowledgeGraph ──────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  mastery: number;     // 0-1
  prerequisites: string[]; // node IDs
  tags: string[];
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related' | 'builds_on';
}

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];

  addNode(node: Omit<KnowledgeNode, 'id'>): KnowledgeNode {
    const id = `kn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const n: KnowledgeNode = { ...node, id };
    this.nodes.set(id, n);
    for (const prereq of node.prerequisites) {
      this.edges.push({ from: prereq, to: id, type: 'prerequisite' });
    }
    return n;
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  updateMastery(id: string, delta: number): KnowledgeNode | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    node.mastery = Math.max(0, Math.min(1, node.mastery + delta));
    return node;
  }

  addEdge(edge: KnowledgeEdge): void {
    this.edges.push(edge);
  }

  getPrerequisites(nodeId: string): KnowledgeNode[] {
    const direct = this.edges
      .filter(e => e.to === nodeId && e.type === 'prerequisite')
      .map(e => this.nodes.get(e.from))
      .filter((n): n is KnowledgeNode => !!n);
    return direct;
  }

  getWeakAreas(threshold = 0.4): KnowledgeNode[] {
    return [...this.nodes.values()].filter(n => n.mastery < threshold);
  }

  getNextToLearn(): KnowledgeNode | undefined {
    // Find nodes where all prerequisites are mastered (>0.7) but node itself isn't
    const candidates = [...this.nodes.values()].filter(n => n.mastery < 0.5);
    candidates.sort((a, b) => {
      const aReady = this.getPrerequisites(a.id).every(p => p.mastery >= 0.7);
      const bReady = this.getPrerequisites(b.id).every(p => p.mastery >= 0.7);
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return b.mastery - a.mastery;
    });
    return candidates[0];
  }

  getAllNodes(): KnowledgeNode[] {
    return [...this.nodes.values()];
  }

  getAllEdges(): KnowledgeEdge[] {
    return [...this.edges];
  }

  getStats(): { total: number; mastered: number; inProgress: number; notStarted: number } {
    const all = [...this.nodes.values()];
    return {
      total: all.length,
      mastered: all.filter(n => n.mastery >= 0.8).length,
      inProgress: all.filter(n => n.mastery > 0 && n.mastery < 0.8).length,
      notStarted: all.filter(n => n.mastery === 0).length,
    };
  }
}

// ─── StudyGoals ──────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  title: string;
  target: number;    // mastery 0-1 or pomodoro count etc.
  current: number;
  deadline: number;  // timestamp
  type: 'mastery' | 'pomodoros' | 'cards_reviewed' | 'quiz_score';
}

export class StudyGoals {
  private goals: Map<string, Goal> = new Map();

  addGoal(goal: Omit<Goal, 'id'>): Goal {
    const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const g: Goal = { ...goal, id };
    this.goals.set(id, g);
    return g;
  }

  updateProgress(goalId: string, current: number): Goal | undefined {
    const g = this.goals.get(goalId);
    if (!g) return undefined;
    g.current = current;
    return g;
  }

  getActive(): Goal[] {
    const now = Date.now();
    return [...this.goals.values()].filter(g => g.current < g.target && g.deadline > now);
  }

  getCompleted(): Goal[] {
    return [...this.goals.values()].filter(g => g.current >= g.target);
  }

  getAll(): Goal[] {
    return [...this.goals.values()];
  }

  getProgress(goalId: string): number {
    const g = this.goals.get(goalId);
    if (!g) return 0;
    return Math.min(1, g.current / g.target);
  }
}
