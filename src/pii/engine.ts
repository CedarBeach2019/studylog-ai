import type { PIIType, PIIMatch, DehydrationResult } from '../types';
import { PII_PATTERNS, ENTITY_PREFIX, luhnCheck } from './patterns';

// ─── Entity ID generation ──────────────────────────────────────────────────

/**
 * Generate the next entity ID for a given PII type and count.
 * Person uses A-Z then AA-ZZ; others use numeric suffixes.
 */
function nextEntityId(type: PIIType, count: number): string {
  const prefix = ENTITY_PREFIX[type];

  if (type === 'person') {
    if (count < 26) {
      return `${prefix}_${String.fromCharCode(65 + count)}`;
    }
    const first = String.fromCharCode(65 + Math.floor(count / 26) - 1);
    const second = String.fromCharCode(65 + (count % 26));
    return `${prefix}_${first}${second}`;
  }

  return `${prefix}_${count + 1}`;
}

// ─── Detect ────────────────────────────────────────────────────────────────

/**
 * Find all PII matches in text using regex patterns.
 * Returns matches sorted by position (descending) for safe replacement.
 */
export function detect(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>(); // deduplicate by type+value

  for (const { type, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];

      // Skip 16-digit strings that fail Luhn check
      if (type === 'credit_card' && value.length === 16 && !luhnCheck(value)) {
        continue;
      }

      // For contextual patterns, use the captured group if available
      const displayValue = match[1] && match[1].length < value.length ? match[1] : value;

      // Skip very short contextual captures
      if (match[1] && displayValue.length < 2) continue;

      // Deduplicate
      const key = `${type}:${displayValue}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        type,
        value: displayValue,
        start: match.index,
        end: match.index + displayValue.length,
        entityId: '', // populated during dehydration
      });
    }
  }

  // Sort by start position descending for safe replacement
  matches.sort((a, b) => b.start - a.start);
  return matches;
}

// ─── Dehydrate ─────────────────────────────────────────────────────────────

const PREAMBLE = 'Note: this text contains PII placeholders marked with [TYPE_ID]. They represent real data.';

/**
 * Replace all PII in text with entity tokens, storing mappings in D1.
 */
export async function dehydrate(
  text: string,
  db: D1Database,
  userId: string = '_default',
): Promise<DehydrationResult> {
  const rawMatches = detect(text);

  if (rawMatches.length === 0) {
    return { text, preamble: '', entities: [] };
  }

  // Count existing entities per type for ID generation
  const typeCounts: Record<string, number> = {};
  for (const m of rawMatches) {
    typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
  }

  // Fetch existing counts from DB
  const existingEntities = await db
    .prepare('SELECT entity_type, COUNT(*) as cnt FROM pii_entities WHERE user_id = ? GROUP BY entity_type')
    .bind(userId)
    .all<{ entity_type: string; cnt: number }>();

  const dbCounts: Record<string, number> = {};
  for (const row of existingEntities.results ?? []) {
    dbCounts[row.entity_type] = row.cnt;
  }

  // Sort matches by position ascending for sequential processing
  rawMatches.sort((a, b) => a.start - b.start);

  let result = text;
  const offsetMap: number[] = []; // track cumulative offset shifts
  let offset = 0;

  const finalMatches: PIIMatch[] = [];

  for (const match of rawMatches) {
    const currentCount = dbCounts[match.type] ?? 0;
    const sequentialIndex = typeCounts[match.type] - (Object.entries(typeCounts)
      .filter(([t]) => t === match.type).length > 0 ? 1 : 0);

    // Simple sequential counting per type within this batch
    const idx = finalMatches.filter(m => m.type === match.type).length;
    const entityId = `[${nextEntityId(match.type, currentCount + idx)}]`;

    const adjustedStart = match.start + offset;
    const adjustedEnd = match.end + offset;

    result =
      result.substring(0, adjustedStart) +
      entityId +
      result.substring(adjustedEnd);

    offset += entityId.length - (match.end - match.start);

    finalMatches.push({
      ...match,
      entityId,
    });

    // Upsert entity in D1
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO pii_entities (entity_id, user_id, entity_type, real_value, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_id, user_id) DO UPDATE SET last_used_at = ?`,
      )
      .bind(
        entityId,
        userId,
        match.type,
        match.value,
        now,
        now,
        now,
      )
      .run();
  }

  return {
    text: result,
    preamble: PREAMBLE,
    entities: finalMatches,
  };
}

// ─── Rehydrate ─────────────────────────────────────────────────────────────

/**
 * Replace entity tokens in text with real values from D1.
 */
export async function rehydrate(
  text: string,
  db: D1Database,
  userId: string = '_default',
): Promise<string> {
  // Find all [TYPE_ID] tokens in text
  const tokenPattern = /\[([A-Z0-9_]+(?:_[A-Z0-9]+)?)\]/g;
  let match: RegExpExecArray | null;
  const tokens: string[] = [];

  while ((match = tokenPattern.exec(text)) !== null) {
    tokens.push(match[1]);
  }

  if (tokens.length === 0) return text;

  // Fetch all matching entities from D1
  const uniqueTokens = [...new Set(tokens)];
  const placeholders = uniqueTokens.map(() => '?').join(',');

  const rows = await db
    .prepare(
      `SELECT entity_id, real_value FROM pii_entities WHERE user_id = ? AND entity_id IN (${placeholders})`,
    )
    .bind(userId, ...uniqueTokens)
    .all<{ entity_id: string; real_value: string }>();

  if (!rows.results || rows.results.length === 0) return text;

  // Build replacement map
  const map = new Map<string, string>();
  for (const row of rows.results) {
    map.set(`[${row.entity_id}]`, row.real_value);
  }

  // Replace tokens (sort by length descending to avoid partial replacements)
  const sortedTokens = [...map.keys()].sort((a, b) => b.length - a.length);
  let result = text;
  for (const token of sortedTokens) {
    result = result.split(token).join(map.get(token)!);
  }

  return result;
}

// ─── Extract preamble (for testing) ────────────────────────────────────────

export { PREAMBLE };
