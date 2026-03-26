/**
 * Static routing rules ported from Python routing_script.py.
 * 14 rules covering command prefixes, escalation heuristics, cheap patterns.
 * @see docs/routing/INTELLIGENCE-DESIGN.md Appendix B
 */

export interface StaticRule {
  name: string;
  pattern: RegExp;
  action: string;
  confidence: number;
  isCommand: boolean;
}

/**
 * All 14 static routing rules, evaluated in order.
 * Command prefixes (isCommand=true) are checked first with confidence=1.0.
 */
export const STATIC_RULES: StaticRule[] = [
  // --- Command prefixes (highest priority, confidence=1.0) ---
  {
    name: 'draft_mode',
    pattern: /^\/draft\b/i,
    action: 'draft',
    confidence: 1.0,
    isCommand: true,
  },
  {
    name: 'local_mode',
    pattern: /^\/local\b/i,
    action: 'local',
    confidence: 1.0,
    isCommand: true,
  },
  {
    name: 'manual_override',
    pattern: /^\/(deepseek|gpt|claude|local|cheap|escalate)\b/i,
    action: 'manual',
    confidence: 1.0,
    isCommand: true,
  },

  // --- Heuristic signals ---
  {
    name: 'code_block',
    pattern: /```/s,
    action: 'escalation',
    confidence: 0.8,
    isCommand: false,
  },
  {
    name: 'long_message',
    pattern: /.{500,}/s,
    action: 'escalation',
    confidence: 0.6,
    isCommand: false,
  },

  // --- Escalation patterns (complex tasks) ---
  {
    name: 'debug',
    pattern: /\b(debug|traceback|error|fix|broken|bug)\b/i,
    action: 'escalation',
    confidence: 0.7,
    isCommand: false,
  },
  {
    name: 'write_code',
    pattern:
      /\b(write|implement|create|build|code)\s+(a |the )?(function|class|module|script|program|app|service|api|endpoint)/i,
    action: 'escalation',
    confidence: 0.7,
    isCommand: false,
  },
  {
    name: 'explain_complex',
    pattern: /\b(explain|describe)\b.*\b(in detail|thoroughly|step\.?by\.?step|comprehensive)\b/i,
    action: 'escalation',
    confidence: 0.6,
    isCommand: false,
  },
  {
    name: 'plan',
    pattern: /\b(plan|strategy|architecture|roadmap|migration)\b/i,
    action: 'escalation',
    confidence: 0.7,
    isCommand: false,
  },
  {
    name: 'review',
    pattern: /\b(review|audit|critique|analyze|evaluate|improve|optimize)\b/i,
    action: 'escalation',
    confidence: 0.7,
    isCommand: false,
  },
  {
    name: 'design',
    pattern: /\b(design|architect|structure|schema)\b/i,
    action: 'escalation',
    confidence: 0.7,
    isCommand: false,
  },

  // --- Comparison (dual-model) ---
  {
    name: 'comparison',
    pattern: /\b(compare|vs|versus|difference)\b/i,
    action: 'compare',
    confidence: 0.5,
    isCommand: false,
  },

  // --- Cheap patterns (simple queries) ---
  {
    name: 'factual_question',
    pattern: /^(what|how|who|when|where|which|count|convert|define|calculate)\b/i,
    action: 'cheap',
    confidence: 0.7,
    isCommand: false,
  },
  {
    name: 'acknowledgment',
    pattern: /^(ok|thanks|thank you|got it|sure|great|nice|cool)\b/i,
    action: 'cheap',
    confidence: 0.9,
    isCommand: false,
  },
  {
    name: 'help',
    pattern: /^help$/i,
    action: 'cheap',
    confidence: 0.8,
    isCommand: false,
  },
];

/**
 * Classify a message using static rules.
 * 1. Check command prefixes first (isCommand=true).
 * 2. Check all heuristic rules, pick highest confidence match.
 * 3. Fallback to cheap at 0.3 confidence.
 */
export function classifyStatic(
  message: string,
  _length = 0,
  _hasCode = false,
): { action: string; confidence: number; reason: string } {
  // 1. Command prefixes
  for (const rule of STATIC_RULES) {
    if (rule.isCommand && rule.pattern.test(message)) {
      return { action: rule.action, confidence: rule.confidence, reason: `[static] ${rule.name}` };
    }
  }

  // 2. Heuristic rules — highest confidence wins
  let bestMatch: { action: string; confidence: number; reason: string } | null = null;
  for (const rule of STATIC_RULES) {
    if (!rule.isCommand && rule.pattern.test(message)) {
      if (!bestMatch || rule.confidence > bestMatch.confidence) {
        bestMatch = { action: rule.action, confidence: rule.confidence, reason: `[static] ${rule.name}` };
      }
    }
  }

  if (bestMatch) return bestMatch;

  // 3. Fallback
  return { action: 'cheap', confidence: 0.3, reason: '[static] no pattern matched' };
}

/**
 * Normalize action names (Python compat).
 * e.g. "cheap_only" → "cheap", "escalate" → "escalation"
 */
export function normalizeAction(action: string): string {
  const map: Record<string, string> = {
    cheap_only: 'cheap',
    cheap: 'cheap',
    escalate: 'escalation',
    escalation: 'escalation',
    compare: 'compare',
    draft: 'draft',
    local: 'local',
    manual_override: 'manual',
    manual: 'manual',
  };
  return map[action.toLowerCase()] || 'cheap';
}

/**
 * Resolve an action to provider type and model hint.
 */
export function resolveAction(
  action: string,
  cheapModel: string,
  escalationModel: string,
): { type: string; model: string } {
  const mapping: Record<string, { type: string; model: string }> = {
    cheap: { type: 'cheap', model: cheapModel },
    escalation: { type: 'escalation', model: escalationModel },
    compare: { type: 'compare', model: cheapModel },
    draft: { type: 'draft', model: cheapModel },
    local: { type: 'local', model: 'local' },
    manual: { type: 'cheap', model: cheapModel },
  };
  return mapping[action] || mapping.cheap;
}
