/**
 * Guest mode — anonymous access without signup.
 * Generates a temporary guest JWT with 5 message limit.
 */
import { sign } from '../crypto/jwt.js';
import type { Context } from 'hono';

export interface GuestState {
  messagesUsed: number;
  maxMessages: number;
  createdAt: number;
}

const GUEST_LIMIT = 5;

/**
 * Create a guest token. Stores state in KV.
 */
export async function createGuestToken(kv: KVNamespace, ip: string, jwtSecret: string): Promise<{ token: string; state: GuestState }> {
  const key = `guest:${ip}`;
  const existing = await kv.get<GuestState>(key, 'json');
  
  const state: GuestState = existing ?? {
    messagesUsed: 0,
    maxMessages: GUEST_LIMIT,
    createdAt: Date.now(),
  };

  const token = await sign({ sub: `guest:${ip}`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }, jwtSecret);
  
  return { token, state };
}

/**
 * Check and increment guest usage. Returns true if allowed.
 */
export async function checkGuestLimit(kv: KVNamespace, ip: string): Promise<{ allowed: boolean; state: GuestState }> {
  const key = `guest:${ip}`;
  const state = await kv.get<GuestState>(key, 'json');
  
  if (!state) return { allowed: false, state: { messagesUsed: 0, maxMessages: GUEST_LIMIT, createdAt: Date.now() } };
  
  if (state.messagesUsed >= state.maxMessages) {
    return { allowed: false, state };
  }

  const updated = { ...state, messagesUsed: state.messagesUsed + 1 };
  await kv.put(key, JSON.stringify(updated), { expirationTtl: 86400 }); // 24h TTL
  
  return { allowed: true, state: updated };
}

/**
 * Is this a guest session?
 */
export function isGuest(userId: string): boolean {
  return userId.startsWith('guest:');
}

/**
 * Get remaining guest messages.
 */
export async function getGuestRemaining(kv: KVNamespace, ip: string): Promise<number> {
  const key = `guest:${ip}`;
  const state = await kv.get<GuestState>(key, 'json');
  if (!state) return GUEST_LIMIT;
  return Math.max(0, state.maxMessages - state.messagesUsed);
}
