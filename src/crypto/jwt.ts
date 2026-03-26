/**
 * JWT utility using Web Crypto API (HMAC-SHA256).
 * No external dependencies — Workers compatible.
 */

const HEADER = { alg: 'HS256', typ: 'JWT' };
const HEADER_B64 = btoa(JSON.stringify(HEADER)).replace(/=/g, '');

export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Import HMAC-SHA256 key from raw bytes.
 */
async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Base64url encode.
 */
function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode to Uint8Array.
 */
function decodeBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Create a JWT token.
 */
export async function sign(payload: JWTPayload, secret: string): Promise<string> {
  const key = await importKey(secret);
  const encoder = new TextEncoder();
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = `${HEADER_B64}.${payloadB64}`;
  const dataBytes = encoder.encode(data);
  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);
  return `${data}.${base64url(signature)}`;
}

/**
 * Verify and decode a JWT token. Returns payload or null if invalid.
 */
export async function verify(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const key = await importKey(secret);
  const encoder = new TextEncoder();
  const data = `${headerB64}.${payloadB64}`;
  const dataBytes = encoder.encode(data);

  try {
    const signatureBytes = decodeBase64url(signatureB64);
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes as BufferSource, dataBytes as BufferSource);
    if (!valid) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
