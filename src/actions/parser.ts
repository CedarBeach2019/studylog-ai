import type { Action, ActionStream, ActionType, ActionMeta } from './types.js';
import { ALL_ACTION_TYPES, isAction } from './types.js';

let idCounter = 0;
function generateId(): string {
  return `act_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

/** Known valid action types set */
const VALID_TYPES = new Set<string>(ALL_ACTION_TYPES);

/** Required payload fields per action type (just `type` and `payload` existence) */
const REQUIRED_PAYLOAD_FIELDS: Record<string, string[]> = {
  narration: ['text'],
  speech: ['character', 'character_id', 'text'],
  question: ['prompt'],
  quiz: ['id', 'question', 'type'],
  highlight: ['target', 'target_type'],
  timer: ['action'],
  progress: ['id', 'value'],
  scene_transition: ['scene_id', 'name', 'description'],
  dice_roll: ['notation', 'rolls', 'modifier', 'total'],
  initiative: ['action'],
  combat_round: ['round', 'turns'],
  map_reveal: ['map_id', 'action'],
  npc_action: ['npc_id', 'action'],
  inventory_change: ['character_id', 'action', 'item'],
  ambient: ['cue_id', 'action'],
  character_update: ['character_id', 'changes'],
  flashback: ['title'],
  slide: ['slide_number', 'total_slides', 'title'],
  whiteboard: ['action'],
  code_block: ['language', 'code'],
  interactive: ['id', 'title', 'widget_type', 'source'],
  flashcard: ['deck', 'card_id', 'front', 'back'],
  spaced_review: ['card_id', 'rating', 'algorithm', 'next_review', 'interval_days'],
  exercise: ['id', 'title', 'difficulty', 'instructions'],
  reference: ['title', 'content'],
};

/**
 * Attempt to repair common JSON errors from LLM output.
 * Handles: trailing commas, unquoted keys, single quotes, control characters.
 */
export function repairJson(raw: string): string {
  let s = raw;
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Quote unquoted keys (simple heuristic)
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  // Replace single quotes with double quotes (naive — won't handle nested)
  // Only do this if we don't already have double-quoted strings
  if (!s.includes('"')) {
    s = s.replace(/'/g, '"');
  }
  // Remove control characters except newline, tab, carriage return
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  return s;
}

/**
 * Validate an action object has the right structure.
 * Returns the action with meta.id filled in if missing, or null if invalid.
 */
export function validateAction(obj: unknown): Action | null {
  if (!isAction(obj)) return null;
  const { type, payload } = obj;
  if (!VALID_TYPES.has(type)) return null;
  if (typeof payload !== 'object' || payload === null) return null;

  // Check required payload fields
  const required = REQUIRED_PAYLOAD_FIELDS[type];
  if (required) {
    for (const field of required) {
      if (!(field in payload)) return null;
    }
  }

  // Auto-fill meta.id
  if (!obj.meta?.id) {
    (obj as Action & { meta: ActionMeta }).meta = {
      ...obj.meta,
      id: generateId(),
    };
  }

  return obj;
}

/**
 * Extract JSON array from interleaved text.
 * LLMs might output:
 *   "Some text. ```json [{...}] ```"
 *   "[{...}]" (bare JSON)
 *   "Text before\n[{...}]\nText after"
 */
export function extractJsonArrays(text: string): { json: string; start: number; end: number }[] {
  const results: { json: string; start: number; end: number }[] = [];

  // Try fenced code block: ```json ... ``` or ``` ... ```
  const fencedRegex = /```(?:json)?\s*\n?(\[[\s\S]*?\])\s*\n?```/g;
  let match;
  while ((match = fencedRegex.exec(text)) !== null) {
    results.push({ json: match[1], start: match.index, end: match.index + match[0].length });
  }

  // Try bare JSON arrays (not inside fenced blocks)
  // Find [{ ... }] spans that aren't inside already-matched regions
  const bareRegex = /\[[\s\S]*?\]/g;
  while ((match = bareRegex.exec(text)) !== null) {
    const isInsideFenced = results.some(
      (r) => match!.index >= r.start && match!.index + match![0].length <= r.end
    );
    if (!isInsideFenced) {
      // Heuristic: must contain "type" to be an action array
      if (match[0].includes('"type"') || match[0].includes("'type'")) {
        results.push({ json: match[0], start: match.index, end: match.index + match[0].length });
      }
    }
  }

  return results;
}

/**
 * Parse raw LLM output into an action stream.
 * Handles: valid JSON, malformed JSON, interleaved text, truncated output.
 */
export function parseActionStream(raw: string): { actions: ActionStream; unparsed: string[] } {
  if (!raw || typeof raw !== 'string') {
    return { actions: [], unparsed: [] };
  }

  const trimmed = raw.trim();
  const actions: ActionStream = [];
  const unparsed: string[] = [];

  // Fast path: entire input is a JSON array
  if (trimmed.startsWith('[')) {
    const result = parseJsonArray(trimmed);
    if (result.actions.length > 0) {
      return { actions: result.actions, unparsed: result.unparsed };
    }
    // Try repair
    const repaired = repairJson(trimmed);
    const repairedResult = parseJsonArray(repaired);
    if (repairedResult.actions.length > 0) {
      return { actions: repairedResult.actions, unparsed: repairedResult.unparsed };
    }
    // Truncated: try to close brackets
    const closed = attemptCloseBrackets(trimmed);
    const closedResult = parseJsonArray(closed);
    if (closedResult.actions.length > 0) {
      return { actions: closedResult.actions, unparsed: closedResult.unparsed };
    }
    unparsed.push(trimmed);
    return { actions: [], unparsed };
  }

  // Extract JSON arrays from interleaved text
  const extracted = extractJsonArrays(trimmed);
  if (extracted.length > 0) {
    for (const { json, start, end } of extracted) {
      // Collect text before this JSON block
      const before = trimmed.slice(extracted.length === 1 ? 0 : 0, start).trim();
      if (before && !before.startsWith('[') && !before.includes('"type"')) {
        unparsed.push(before);
      }

      const result = parseJsonArray(json);
      if (result.actions.length > 0) {
        actions.push(...result.actions);
      } else {
        // Try repair
        const repaired = repairJson(json);
        const repairedResult = parseJsonArray(repaired);
        actions.push(...repairedResult.actions);
        if (repairedResult.unparsed.length > 0) {
          unparsed.push(json);
        }
      }
    }

    // Collect remaining text after last JSON block
    const lastEnd = extracted[extracted.length - 1].end;
    const after = trimmed.slice(lastEnd).trim();
    if (after) {
      unparsed.push(after);
    }

    return { actions, unparsed };
  }

  // No JSON found — try to parse as a single action object
  if (trimmed.startsWith('{') && trimmed.includes('"type"')) {
    const repaired = repairJson(trimmed);
    try {
      const obj = JSON.parse(repaired);
      const action = validateAction(obj);
      if (action) {
        return { actions: [action], unparsed: [] };
      }
    } catch {
      // Try closing the object
      const closed = attemptCloseBrackets(trimmed);
      const closedRepaired = repairJson(closed);
      try {
        const obj = JSON.parse(closedRepaired);
        const action = validateAction(obj);
        if (action) {
          return { actions: [action], unparsed: [] };
        }
      } catch {
        // Give up
      }
    }
  }

  // Nothing parseable
  unparsed.push(trimmed);
  return { actions: [], unparsed };
}

function parseJsonArray(json: string): { actions: ActionStream; unparsed: string[] } {
  const actions: ActionStream = [];
  const unparsed: string[] = [];

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return { actions: [], unparsed: [json] };
    }

    for (const item of parsed) {
      const action = validateAction(item);
      if (action) {
        actions.push(action);
      } else {
        // Try to salvage as narration
        const narration = salvageAsNarration(item);
        if (narration) {
          actions.push(narration);
        } else {
          unparsed.push(typeof item === 'string' ? item : JSON.stringify(item));
        }
      }
    }
  } catch {
    unparsed.push(json);
  }

  return { actions, unparsed };
}

/**
 * Try to close unclosed brackets/braces for truncated JSON.
 */
function attemptCloseBrackets(json: string): string {
  let s = json;
  // Remove trailing partial entries (e.g., trailing comma and partial object)
  s = s.replace(/,\s*\{[^}]*$/, '');
  s = s.replace(/,\s*\[[^\]]*$/, '');
  // Remove trailing comma before EOF (but not inside strings — heuristic)
  s = s.replace(/,\s*$/, '');

  // Count open brackets
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;

  // Close braces first (inner), then brackets (outer)
  s += '}'.repeat(Math.max(0, openBraces - closeBraces));
  s += ']'.repeat(Math.max(0, openBrackets - closeBrackets));

  return s;
}

/**
 * Salvage unrecognized items as narration actions.
 */
function salvageAsNarration(item: unknown): Action | null {
  if (typeof item === 'string' && item.length > 0) {
    return validateAction({
      type: 'narration',
      payload: { text: item },
    });
  }
  if (typeof item === 'object' && item !== null && 'text' in item && typeof (item as any).text === 'string') {
    return validateAction({
      type: 'narration',
      payload: { text: (item as any).text },
    });
  }
  return null;
}
