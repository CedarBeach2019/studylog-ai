import type { Action } from './types.js';

/**
 * Maps an action type to its Preact component name.
 * Convention: PascalCase of type, with underscores removed.
 */
export function actionTypeToComponent(action: Action): string {
  const map: Record<string, string> = {
    narration: 'NarrationView',
    speech: 'SpeechBubble',
    question: 'QuestionPrompt',
    quiz: 'QuizCard',
    highlight: 'HighlightOverlay',
    timer: 'TimerWidget',
    progress: 'ProgressBar',
    scene_transition: 'SceneTransitionView',
    dice_roll: 'DiceRollView',
    initiative: 'InitiativeTracker',
    combat_round: 'CombatLog',
    map_reveal: 'MapCanvas',
    npc_action: 'NpcActionView',
    inventory_change: 'InventoryUpdate',
    ambient: 'AmbientController',
    character_update: 'CharacterSheet',
    flashback: 'FlashbackOverlay',
    slide: 'SlideView',
    whiteboard: 'WhiteboardCanvas',
    code_block: 'CodeView',
    interactive: 'InteractiveWidget',
    flashcard: 'FlashcardView',
    spaced_review: 'SpacedReviewCard',
    exercise: 'ExerciseView',
    reference: 'ReferenceCard',
  };
  return map[action.type] ?? 'UnknownAction';
}

/**
 * Priority for queue ordering. Higher = rendered first.
 * Uses meta.priority if set, otherwise falls back to type defaults.
 */
export function actionPriority(action: Action): number {
  if (action.meta?.priority !== undefined) return action.meta.priority;

  const defaults: Record<string, number> = {
    // High priority: scene setting, timers, combat
    scene_transition: 9,
    combat_round: 8,
    timer: 8,
    initiative: 7,
    character_update: 7,
    dice_roll: 6,
    // Medium priority: content
    narration: 5,
    speech: 5,
    quiz: 5,
    question: 5,
    exercise: 5,
    whiteboard: 5,
    code_block: 4,
    // Lower priority: atmospheric, supplementary
    highlight: 3,
    progress: 3,
    map_reveal: 3,
    npc_action: 3,
    ambient: 2,
    inventory_change: 2,
    flashback: 2,
    slide: 2,
    flashcard: 2,
    spaced_review: 2,
    interactive: 2,
    reference: 1,
  };

  return defaults[action.type] ?? 5;
}

/**
 * Whether this action pauses the queue until completed.
 * Respects meta.blocking override, then falls back to type defaults.
 */
export function isBlocking(action: Action): boolean {
  if (action.meta?.blocking !== undefined) return action.meta.blocking;

  const blockingTypes = new Set([
    'speech', 'question', 'quiz', 'combat_round', 'exercise',
    'scene_transition', 'flashback', 'whiteboard',
  ]);
  return blockingTypes.has(action.type);
}

/**
 * Stable sort key combining priority (descending) and order (ascending).
 */
export function actionSortKey(action: Action, index: number): string {
  const priority = actionPriority(action);
  const paddedPriority = String(10 - priority).padStart(2, '0');
  const paddedIndex = String(index).padStart(8, '0');
  return `${paddedPriority}_${paddedIndex}`;
}
