// ─── Action System Types ──────────────────────────────────────────────────

/** All action type discriminators */
export type ActionType =
  // Shared
  | 'narration'
  | 'speech'
  | 'question'
  | 'quiz'
  | 'highlight'
  | 'timer'
  | 'progress'
  // TTRPG
  | 'scene_transition'
  | 'dice_roll'
  | 'initiative'
  | 'combat_round'
  | 'map_reveal'
  | 'npc_action'
  | 'inventory_change'
  | 'ambient'
  | 'character_update'
  | 'flashback'
  // Study
  | 'slide'
  | 'whiteboard'
  | 'code_block'
  | 'interactive'
  | 'flashcard'
  | 'spaced_review'
  | 'exercise'
  | 'reference';

// ─── Metadata ─────────────────────────────────────────────────────────────

export interface ActionMeta {
  id?: string;
  agent_id?: string;
  priority?: number;       // 0-10, default 5
  blocking?: boolean;      // default false
  delay_ms?: number;       // default 0
  timestamp?: number;
  expires_at?: number;
  group?: string;
}

// ─── Base Action ──────────────────────────────────────────────────────────

export interface BaseAction<T extends ActionType> {
  type: T;
  meta?: ActionMeta;
}

// ─── Shared Payloads ──────────────────────────────────────────────────────

export interface NarrationPayload {
  text: string;
  style?: 'prose' | 'dramatic' | 'technical' | 'casual';
  duration_hint_ms?: number;
}

export interface SpeechPayload {
  character: string;
  character_id: string;
  text: string;
  voice_id?: string;
  emotion?: string;
  avatar_url?: string;
  direction?: string;
}

export interface QuestionPayload {
  prompt: string;
  context?: string;
  valid_answers?: string[];
  timeout_ms?: number | null;
  impact?: 'narrative_branch' | 'skill_check' | 'roleplay' | 'knowledge_check';
}

export interface QuizOption {
  label: string;
  text: string;
}

export interface QuizPayload {
  id: string;
  question: string;
  type: 'single' | 'multiple' | 'short_answer';
  options?: QuizOption[];
  correct_answer?: string[];
  points?: number;
  analysis?: string;
  time_limit_ms?: number;
}

export interface HighlightPayload {
  target: string;
  target_type: 'character' | 'element' | 'region' | 'text';
  style?: 'glow' | 'border' | 'pulse' | 'underline' | 'spotlight';
  duration_ms?: number;
  pulse?: boolean;
  label?: string;
}

export interface TimerPayload {
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'expire';
  duration_ms?: number;
  label?: string;
  on_expire?: 'auto_resolve' | 'alert' | 'extend' | 'custom';
  warning_at_ms?: number;
  visible?: boolean;
}

export interface ProgressPayload {
  id: string;
  value: number;
  label?: string;
  total?: number;
  current?: number;
  milestone?: string;
}

// ─── TTRPG Payloads ───────────────────────────────────────────────────────

export interface SceneTransitionPayload {
  scene_id: string;
  name: string;
  description: string;
  atmosphere?: string;
  map_url?: string;
  transition?: 'fade' | 'dissolve' | 'cut' | 'wipe';
  duration_ms?: number;
  npcs_present?: string[];
  ambient_cue?: string;
}

export interface DiceRollPayload {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  reason?: string;
  difficulty_class?: number;
  success?: boolean | null;
  character_id?: string;
  rolled_by?: 'player' | 'dm' | 'npc';
  critical?: 'success' | 'failure' | null;
  animation?: '3d_bounce' | 'flat' | 'none';
  color?: string;
}

export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  max_hp: number;
}

export interface InitiativePayload {
  action: 'set' | 'add' | 'remove' | 'next' | 'end_combat';
  order?: InitiativeEntry[];
  round?: number;
  current_turn?: number;
  surprise?: string[];
}

export interface CombatTurn {
  actor_id: string;
  action_type: 'attack' | 'save' | 'spell' | 'move' | 'bonus' | 'free';
  target_id?: string;
  attack_roll?: number;
  hit?: boolean;
  damage?: Array<{ dice: string; amount: number; type: string }>;
  save_type?: string;
  dc?: number;
  roll?: number;
  success?: boolean;
  description?: string;
}

export interface CombatRoundPayload {
  round: number;
  turns: CombatTurn[];
  summary?: string;
}

export interface MapRegion {
  id: string;
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
}

export interface MapMarker {
  id: string;
  type: string;
  x: number;
  y: number;
  icon?: string;
  visible?: boolean;
  state?: string;
}

export interface MapPosition {
  character_id: string;
  x: number;
  y: number;
  icon?: string;
}

export interface MapRevealPayload {
  map_id: string;
  action: 'show' | 'reveal_region' | 'hide_region' | 'annotate' | 'clear';
  regions?: MapRegion[];
  markers?: MapMarker[];
  player_positions?: MapPosition[];
  fog_of_war?: boolean;
}

export interface NpcActionPayload {
  npc_id: string;
  action: string;
  description?: string;
  visible_to?: string[];
  consequence?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  rarity?: string;
  description?: string;
  quantity: number;
  weight?: number;
}

export interface InventoryChangePayload {
  character_id: string;
  action: 'add' | 'remove' | 'equip' | 'unequip' | 'update';
  item: Partial<InventoryItem>;
  reason?: string;
}

export interface AmbientPayload {
  cue_id: string;
  action: 'play' | 'stop' | 'crossfade' | 'set_volume';
  description?: string;
  volume?: number;
  fade_ms?: number;
  loop?: boolean;
  category?: 'atmosphere' | 'music' | 'sfx' | 'weather' | 'crowd';
  crossfade_to?: string;
}

export interface StatChange {
  stat: string;
  value: string | number | boolean;
  reason?: string;
  new_value?: string | number | boolean;
  duration?: string;
}

export interface CharacterUpdatePayload {
  character_id: string;
  changes: StatChange[];
  temporary?: boolean;
}

export interface FlashbackPayload {
  title: string;
  description?: string;
  narration?: string;
  duration_ms?: number;
  atmosphere?: string;
  return_context?: string;
}

// ─── Study Payloads ───────────────────────────────────────────────────────

export interface SlideElement {
  id: string;
  type: 'image' | 'text' | 'shape';
  src?: string;
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface SlidePayload {
  slide_number: number;
  total_slides: number;
  title: string;
  layout?: 'title_only' | 'title_content' | 'two_column' | 'blank' | 'image_full';
  content?: string;
  elements?: SlideElement[];
  notes?: string;
  transition?: 'slide_left' | 'fade' | 'none';
}

export interface WhiteboardItem {
  type: 'text' | 'shape' | 'latex' | 'line' | 'arrow' | 'freehand';
  text?: string;
  latex?: string;
  shape?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  font_size?: number;
  color?: string;
  points?: Array<{ x: number; y: number }>;
}

export interface WhiteboardPayload {
  action: 'draw' | 'clear' | 'undo' | 'animate';
  items?: WhiteboardItem[];
  clear?: boolean;
}

export interface CodeAnnotation {
  line: number;
  type: 'info' | 'warning' | 'error' | 'success';
  text: string;
}

export interface CodeBlockPayload {
  language: string;
  code: string;
  filename?: string;
  line_highlight?: number[];
  executable?: boolean;
  output?: string | null;
  annotations?: CodeAnnotation[];
}

export interface InteractivePayload {
  id: string;
  title: string;
  widget_type: 'html' | 'svg' | 'canvas' | 'mermaid';
  source: string;
  sandbox?: boolean;
  height_px?: number;
  instructions?: string;
}

export interface FlashcardPayload {
  deck: string;
  card_id: string;
  front: string;
  back: string;
  difficulty?: number;
  tags?: string[];
}

export interface ReviewStats {
  reviews: number;
  correct: number;
  streak: number;
}

export interface SpacedReviewPayload {
  card_id: string;
  rating: number;
  algorithm: 'sm2' | 'leitner';
  next_review: string;
  interval_days: number;
  ease_factor?: number;
  stats?: ReviewStats;
}

export interface TestCase {
  input: string;
  expected: string;
}

export interface ExercisePayload {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  instructions: string;
  starter_code?: string;
  language?: string;
  test_cases?: TestCase[];
  hints?: string[];
  solution?: string;
}

export interface ReferencePayload {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  pinnable?: boolean;
}

// ─── Payload Map ──────────────────────────────────────────────────────────

export interface ActionPayloadMap {
  narration: NarrationPayload;
  speech: SpeechPayload;
  question: QuestionPayload;
  quiz: QuizPayload;
  highlight: HighlightPayload;
  timer: TimerPayload;
  progress: ProgressPayload;
  scene_transition: SceneTransitionPayload;
  dice_roll: DiceRollPayload;
  initiative: InitiativePayload;
  combat_round: CombatRoundPayload;
  map_reveal: MapRevealPayload;
  npc_action: NpcActionPayload;
  inventory_change: InventoryChangePayload;
  ambient: AmbientPayload;
  character_update: CharacterUpdatePayload;
  flashback: FlashbackPayload;
  slide: SlidePayload;
  whiteboard: WhiteboardPayload;
  code_block: CodeBlockPayload;
  interactive: InteractivePayload;
  flashcard: FlashcardPayload;
  spaced_review: SpacedReviewPayload;
  exercise: ExercisePayload;
  reference: ReferencePayload;
}

// ─── Typed Action Union ───────────────────────────────────────────────────

export type Action = {
  [K in ActionType]: BaseAction<K> & { payload: ActionPayloadMap[K] };
}[ActionType];

// ─── Stream & Agent Output ────────────────────────────────────────────────

export type ActionStream = Action[];

export interface AgentOutput {
  actions: ActionStream;
  session?: {
    session_id: string;
    domain: 'ttrpg' | 'study';
    turn_number: number;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _debug?: {
    model: string;
    latency_ms: number;
    raw_output_length: number;
  };
}

// ─── SSE Event Types ─────────────────────────────────────────────────────

export interface SSEActionStartData {
  id: string;
  type: ActionType;
  payload?: Record<string, unknown>;
}

export interface SSEActionDeltaData {
  id: string;
  path: string;
  value: string;
}

export interface SSEActionCompleteData {
  id: string;
}

export interface SSEActionErrorData {
  id: string;
  type?: ActionType;
  error: string;
  field?: string;
  recovery?: 'skip' | 'retry' | 'fallback' | 'abort';
}

export interface SSESessionMeta {
  session_id: string;
  domain?: 'ttrpg' | 'study';
  turn_number?: number;
}

export interface SSESessionEnd {
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  done: boolean;
}

export type SSEEventType =
  | 'action_start'
  | 'action_delta'
  | 'action_complete'
  | 'action_error'
  | 'session_meta'
  | 'session_end';

export interface SSEEvent {
  type: SSEEventType;
  data: SSEActionStartData | SSEActionDeltaData | SSEActionCompleteData | SSEActionErrorData | SSESessionMeta | SSESessionEnd;
}

export interface JsonPatch {
  path: string;
  value: string;
}

// ─── Domain Tags ──────────────────────────────────────────────────────────

export type ActionDomain = 'shared' | 'ttrpg' | 'study';

export const ACTION_DOMAINS: Record<ActionType, ActionDomain> = {
  narration: 'shared',
  speech: 'shared',
  question: 'shared',
  quiz: 'shared',
  highlight: 'shared',
  timer: 'shared',
  progress: 'shared',
  scene_transition: 'ttrpg',
  dice_roll: 'ttrpg',
  initiative: 'ttrpg',
  combat_round: 'ttrpg',
  map_reveal: 'ttrpg',
  npc_action: 'ttrpg',
  inventory_change: 'ttrpg',
  ambient: 'ttrpg',
  character_update: 'ttrpg',
  flashback: 'ttrpg',
  slide: 'study',
  whiteboard: 'study',
  code_block: 'study',
  interactive: 'study',
  flashcard: 'study',
  spaced_review: 'study',
  exercise: 'study',
  reference: 'study',
};

export const BLOCKING_ACTIONS: ReadonlySet<ActionType> = new Set([
  'speech', 'question', 'quiz', 'combat_round', 'exercise',
]);

// ─── Type Guards ──────────────────────────────────────────────────────────

export const ALL_ACTION_TYPES: ActionType[] = [
  'narration', 'speech', 'question', 'quiz', 'highlight', 'timer', 'progress',
  'scene_transition', 'dice_roll', 'initiative', 'combat_round', 'map_reveal',
  'npc_action', 'inventory_change', 'ambient', 'character_update', 'flashback',
  'slide', 'whiteboard', 'code_block', 'interactive', 'flashcard',
  'spaced_review', 'exercise', 'reference',
];

export function isAction(value: unknown): value is Action {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'payload' in value &&
    typeof (value as Action).type === 'string'
  );
}

export function isNarration(action: Action): action is Action & { type: 'narration' } {
  return action.type === 'narration';
}

export function isSpeech(action: Action): action is Action & { type: 'speech' } {
  return action.type === 'speech';
}

export function isQuestion(action: Action): action is Action & { type: 'question' } {
  return action.type === 'question';
}

export function isQuiz(action: Action): action is Action & { type: 'quiz' } {
  return action.type === 'quiz';
}

export function isHighlight(action: Action): action is Action & { type: 'highlight' } {
  return action.type === 'highlight';
}

export function isTimer(action: Action): action is Action & { type: 'timer' } {
  return action.type === 'timer';
}

export function isProgress(action: Action): action is Action & { type: 'progress' } {
  return action.type === 'progress';
}

export function isSceneTransition(action: Action): action is Action & { type: 'scene_transition' } {
  return action.type === 'scene_transition';
}

export function isDiceRoll(action: Action): action is Action & { type: 'dice_roll' } {
  return action.type === 'dice_roll';
}

export function isInitiative(action: Action): action is Action & { type: 'initiative' } {
  return action.type === 'initiative';
}

export function isCombat(action: Action): action is Action & { type: 'combat_round' } {
  return action.type === 'combat_round';
}

export function isMapReveal(action: Action): action is Action & { type: 'map_reveal' } {
  return action.type === 'map_reveal';
}

export function isNpcAction(action: Action): action is Action & { type: 'npc_action' } {
  return action.type === 'npc_action';
}

export function isInventoryChange(action: Action): action is Action & { type: 'inventory_change' } {
  return action.type === 'inventory_change';
}

export function isAmbient(action: Action): action is Action & { type: 'ambient' } {
  return action.type === 'ambient';
}

export function isCharacterUpdate(action: Action): action is Action & { type: 'character_update' } {
  return action.type === 'character_update';
}

export function isFlashback(action: Action): action is Action & { type: 'flashback' } {
  return action.type === 'flashback';
}

export function isSlide(action: Action): action is Action & { type: 'slide' } {
  return action.type === 'slide';
}

export function isWhiteboard(action: Action): action is Action & { type: 'whiteboard' } {
  return action.type === 'whiteboard';
}

export function isCodeBlock(action: Action): action is Action & { type: 'code_block' } {
  return action.type === 'code_block';
}

export function isInteractive(action: Action): action is Action & { type: 'interactive' } {
  return action.type === 'interactive';
}

export function isFlashcard(action: Action): action is Action & { type: 'flashcard' } {
  return action.type === 'flashcard';
}

export function isSpacedReview(action: Action): action is Action & { type: 'spaced_review' } {
  return action.type === 'spaced_review';
}

export function isExercise(action: Action): action is Action & { type: 'exercise' } {
  return action.type === 'exercise';
}

export function isReference(action: Action): action is Action & { type: 'reference' } {
  return action.type === 'reference';
}

export function isBlocking(action: Action): boolean {
  return action.meta?.blocking ?? BLOCKING_ACTIONS.has(action.type);
}

export function getDomain(action: Action): ActionDomain {
  return ACTION_DOMAINS[action.type];
}

export function filterByDomain(actions: Action[], domain: ActionDomain): Action[] {
  return actions.filter((a) => ACTION_DOMAINS[a.type] === domain || ACTION_DOMAINS[a.type] === 'shared');
}

/** Filter to only TTRPG-specific actions (shared + ttrpg) */
export function ttrpgActions(actions: Action[]): Action[] {
  return filterByDomain(actions, 'ttrpg');
}

/** Filter to only Study-specific actions (shared + study) */
export function studyActions(actions: Action[]): Action[] {
  return filterByDomain(actions, 'study');
}
