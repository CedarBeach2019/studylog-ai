/**
 * Authentication routes (login/register, JWT issuance).
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../../src/types.js';
import { sign } from '../../src/crypto/jwt.js';
import { createGuestToken, checkGuestLimit, isGuest } from '../../src/middleware/guest.js';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const SALT_LEN = 16;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8,
  );
  return new Uint8Array(bits);
}

function bufToHex(buf: Uint8Array): string {
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function hashPassphrase(passphrase: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt ? hexToBuf(existingSalt) : crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(passphrase, salt);
  return { hash: bufToHex(key), salt: bufToHex(salt) };
}

// POST /register
auth.post('/register', async (c) => {
  const { passphrase } = await c.req.json<{ passphrase?: string }>().catch(() => ({ passphrase: undefined }));
  if (!passphrase || passphrase.length < 8) {
    return c.json({ error: { type: 'validation_error', code: 'invalid_passphrase', message: 'Passphrase must be at least 8 characters' } }, 400);
  }

  // Check if any user exists (single-tenant for now)
  const existing = await c.env.KV.get('auth:salt');
  if (existing) {
    return c.json({ error: { type: 'conflict', code: 'already_registered', message: 'Already registered. Use /login.' } }, 409);
  }

  const { hash, salt } = await hashPassphrase(passphrase);
  const userId = crypto.randomUUID();

  // Store auth info in KV (not D1, to keep it separate from logs)
  await c.env.KV.put('auth:salt', salt);
  await c.env.KV.put('auth:hash', hash);
  await c.env.KV.put('auth:userId', userId);

  // Create default preferences
  await c.env.DB.prepare("INSERT OR IGNORE INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)").bind(userId, '_initialized', 'true').run();

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: { type: 'server_error', code: 'config_error', message: 'JWT_SECRET not set' } }, 500);

  const token = await sign({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 90 }, jwtSecret);
  return c.json({ userId, token });
});

// POST /login
auth.post('/login', async (c) => {
  const { passphrase } = await c.req.json<{ passphrase?: string }>().catch(() => ({ passphrase: undefined }));
  if (!passphrase) {
    return c.json({ error: { type: 'validation_error', code: 'missing_passphrase', message: 'Passphrase required' } }, 400);
  }

  const [salt, storedHash, userId] = await Promise.all([
    c.env.KV.get('auth:salt'),
    c.env.KV.get('auth:hash'),
    c.env.KV.get('auth:userId'),
  ]);

  if (!salt || !storedHash || !userId) {
    return c.json({ error: { type: 'not_found', code: 'not_registered', message: 'No account found. Use /register.' } }, 404);
  }

  const { hash } = await hashPassphrase(passphrase, salt);
  if (hash !== storedHash) {
    return c.json({ error: { type: 'authentication_error', code: 'invalid_passphrase', message: 'Invalid passphrase' } }, 401);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: { type: 'server_error', code: 'config_error', message: 'JWT_SECRET not set' } }, 500);

  const token = await sign({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 90 }, jwtSecret);
  return c.json({ userId, token });
});

// POST /logout
auth.post('/logout', (c) => c.json({ message: 'Logged out' }));

// POST /guest — get a temporary guest token (no signup required)
auth.post('/guest', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) return c.json({ error: { type: 'server_error', code: 'config_error', message: 'JWT_SECRET not set' } }, 500);

  const { token, state } = await createGuestToken(c.env.KV, ip, jwtSecret);
  return c.json({
    token,
    guest: true,
    messagesRemaining: state.maxMessages - state.messagesUsed,
  });
});

export default auth;
export { isGuest, checkGuestLimit };
