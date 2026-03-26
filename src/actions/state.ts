import type {
  Action,
  ActionPayloadMap,
  InventoryItem,
  SpacedReviewPayload,
} from './types.js';

// ─── Session State ────────────────────────────────────────────────────────

export interface CharacterState {
  id: string;
  name?: string;
  hp?: number;
  max_hp?: number;
  conditions: string[];
  inventory: InventoryItem[];
}

export interface InitiativeState {
  order: Array<{
    id: string;
    name: string;
    initiative: number;
    hp: number;
    max_hp: number;
  }>;
  round: number;
  currentTurn: number;
  surprise: string[];
}

export interface CombatState {
  active: boolean;
  round: number;
  summary: string;
}

export interface TimerState {
  label: string;
  action: string;
  duration_ms: number;
}

export interface QuizResult {
  id: string;
  question: string;
  points: number;
  correct: boolean;
}

export interface FlashcardState {
  deck: string;
  card_id: string;
  front: string;
  back: string;
  difficulty: number;
  tags: string[];
  last_reviewed?: string;
}

export interface SessionState {
  // TTRPG
  currentScene: string | null;
  sceneName: string | null;
  characters: Record<string, CharacterState>;
  initiative: InitiativeState | null;
  combat: CombatState | null;
  timers: Record<string, TimerState>;

  // Study
  currentSlide: number;
  totalSlides: number;
  quizScores: Record<string, QuizResult>;
  flashcardStates: Record<string, FlashcardState>;
  exercisesCompleted: string[];
  reviewSchedule: Record<string, SpacedReviewPayload>;

  // Shared
  progress: Record<string, number>;
}

export function createEmptySessionState(): SessionState {
  return {
    currentScene: null,
    sceneName: null,
    characters: {},
    initiative: null,
    combat: null,
    timers: {},
    currentSlide: 0,
    totalSlides: 0,
    quizScores: {},
    flashcardStates: {},
    exercisesCompleted: [],
    reviewSchedule: {},
    progress: {},
  };
}

/**
 * Extract session state from a sequence of actions.
 * Processes all actions in order, building up the state.
 */
export function extractSessionState(actions: Action[]): SessionState {
  let state = createEmptySessionState();
  for (const action of actions) {
    state = applyAction(state, action);
  }
  return state;
}

/**
 * Apply a single action to the session state, returning a new state.
 */
export function applyAction(state: SessionState, action: Action): SessionState {
  const next = structuredClone(state);

  switch (action.type) {
    case 'scene_transition': {
      const p = action.payload as ActionPayloadMap['scene_transition'];
      next.currentScene = p.scene_id;
      next.sceneName = p.name;
      break;
    }

    case 'character_update': {
      const p = action.payload as ActionPayloadMap['character_update'];
      const char = ensureCharacter(next, p.character_id);
      for (const change of p.changes) {
        if (change.stat === 'hp') {
          if (typeof change.value === 'number') {
            char.hp = (char.hp ?? 0) + change.value;
          }
          if (change.new_value !== undefined && typeof change.new_value === 'number') {
            char.hp = change.new_value;
          }
        } else if (change.stat === 'max_hp' && typeof change.value === 'number') {
          char.max_hp = change.value;
        } else if (change.stat === 'condition' && typeof change.value === 'string') {
          if (!change.duration || change.duration === 'until treated') {
            if (!char.conditions.includes(change.value)) {
              char.conditions.push(change.value);
            }
          }
        } else if (change.stat === 'name' && typeof change.value === 'string') {
          char.name = change.value;
        }
      }
      next.characters[p.character_id] = char;
      break;
    }

    case 'initiative': {
      const p = action.payload as ActionPayloadMap['initiative'];
      if (p.action === 'set' && p.order) {
        next.initiative = {
          order: p.order.map((e) => ({
            id: e.id,
            name: e.name,
            initiative: e.initiative,
            hp: e.hp,
            max_hp: e.max_hp,
          })),
          round: p.round ?? 1,
          currentTurn: p.current_turn ?? 0,
          surprise: p.surprise ?? [],
        };
        // Also update character states from initiative
        for (const entry of p.order) {
          const char = ensureCharacter(next, entry.id);
          char.name = char.name ?? entry.name;
          char.hp = entry.hp;
          char.max_hp = entry.max_hp;
          next.characters[entry.id] = char;
        }
        next.combat = { active: true, round: p.round ?? 1, summary: '' };
      } else if (p.action === 'end_combat') {
        next.initiative = null;
        next.combat = null;
      } else if (p.action === 'next' && next.initiative) {
        next.initiative.currentTurn = (next.initiative.currentTurn + 1) % next.initiative.order.length;
        if (next.initiative.currentTurn === 0) {
          next.initiative.round++;
          if (next.combat) next.combat.round = next.initiative.round;
        }
      }
      break;
    }

    case 'combat_round': {
      const p = action.payload as ActionPayloadMap['combat_round'];
      if (next.combat) {
        next.combat.round = p.round;
        next.combat.summary = p.summary ?? next.combat.summary;
      } else {
        next.combat = { active: true, round: p.round, summary: p.summary ?? '' };
      }
      break;
    }

    case 'inventory_change': {
      const p = action.payload as ActionPayloadMap['inventory_change'];
      const char = ensureCharacter(next, p.character_id);
      if (p.action === 'add' || p.action === 'equip') {
        const existing = char.inventory.findIndex((i) => i.id === p.item.id);
        if (existing >= 0) {
          char.inventory[existing] = {
            ...char.inventory[existing],
            ...p.item,
          } as InventoryItem;
        } else {
          char.inventory.push({
            id: p.item.id ?? 'unknown',
            name: p.item.name ?? 'Unknown Item',
            type: p.item.type ?? 'misc',
            quantity: p.item.quantity ?? 1,
            ...(p.item.rarity !== undefined ? { rarity: p.item.rarity } : {}),
            ...(p.item.description !== undefined ? { description: p.item.description } : {}),
            ...(p.item.weight !== undefined ? { weight: p.item.weight } : {}),
          });
        }
      } else if (p.action === 'remove') {
        char.inventory = char.inventory.filter((i) => i.id !== p.item.id);
      }
      next.characters[p.character_id] = char;
      break;
    }

    case 'timer': {
      const p = action.payload as ActionPayloadMap['timer'];
      if (p.action === 'start' && p.label && p.duration_ms) {
        next.timers[p.label] = {
          label: p.label,
          action: p.action,
          duration_ms: p.duration_ms,
        };
      } else if (p.action === 'cancel' && p.label) {
        delete next.timers[p.label];
      }
      break;
    }

    case 'slide': {
      const p = action.payload as ActionPayloadMap['slide'];
      next.currentSlide = p.slide_number;
      next.totalSlides = p.total_slides;
      break;
    }

    case 'quiz': {
      const p = action.payload as ActionPayloadMap['quiz'];
      // Just record the quiz — results come from user response
      next.quizScores[p.id] = {
        id: p.id,
        question: p.question,
        points: 0,
        correct: false,
      };
      break;
    }

    case 'flashcard': {
      const p = action.payload as ActionPayloadMap['flashcard'];
      next.flashcardStates[p.card_id] = {
        deck: p.deck,
        card_id: p.card_id,
        front: p.front,
        back: p.back,
        difficulty: p.difficulty ?? 3,
        tags: p.tags ?? [],
      };
      break;
    }

    case 'spaced_review': {
      const p = action.payload as ActionPayloadMap['spaced_review'];
      next.reviewSchedule[p.card_id] = p;
      break;
    }

    case 'exercise': {
      const p = action.payload as ActionPayloadMap['exercise'];
      if (!next.exercisesCompleted.includes(p.id)) {
        next.exercisesCompleted.push(p.id);
      }
      break;
    }

    case 'progress': {
      const p = action.payload as ActionPayloadMap['progress'];
      next.progress[p.id] = p.value;
      break;
    }

    // narration, speech, question, dice_roll, map_reveal, npc_action,
    // ambient, flashback, highlight, whiteboard, code_block, interactive, reference
    // — no state changes (or state managed elsewhere)
    default:
      break;
  }

  return next;
}

function ensureCharacter(state: SessionState, id: string): CharacterState {
  if (!state.characters[id]) {
    state.characters[id] = {
      id,
      conditions: [],
      inventory: [],
    };
  }
  return state.characters[id];
}
