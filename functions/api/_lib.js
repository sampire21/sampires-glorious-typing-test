const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function validateUsername(usernameRaw) {
  const username = String(usernameRaw || '').trim();
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3 || normalized.length > 24 || !/^[a-z0-9_]+$/.test(normalized)) {
    return { ok: false, error: 'Username must be 3-24 chars: a-z, 0-9, _' };
  }
  return { ok: true, username, normalized };
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64Url(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 0) return base64;
  return base64 + '='.repeat(4 - pad);
}

function bytesToBase64Url(bytes) {
  return toBase64Url(bytesToBase64(bytes));
}

function stringToBase64Url(value) {
  return bytesToBase64Url(utf8Bytes(value));
}

function base64UrlToString(value) {
  const bytes = base64ToBytes(fromBase64Url(value));
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function getSecret(env) {
  return env.TOKEN_SECRET || 'change-me-cloudflare-secret';
}

export function hasStorage(env) {
  return !!(env && env.TYPING_APP);
}

export async function hashPassword(password, saltBase64 = null) {
  const salt = saltBase64
    ? base64ToBytes(saltBase64)
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', utf8Bytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256',
    },
    key,
    256
  );
  return {
    salt: bytesToBase64(salt),
    hash: bytesToBase64(new Uint8Array(bits)),
  };
}

async function hmacSign(input, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, utf8Bytes(input));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createToken(payloadObj, secret) {
  const payload = stringToBase64Url(JSON.stringify(payloadObj));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = await hmacSign(payload, secret);
  if (!constantTimeEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(base64UrlToString(payload));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function publicUser(user) {
  return { id: user.id, username: user.username };
}

export async function getAuthUser(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = await verifyToken(token, getSecret(env));
  if (!payload || !payload.uid) return null;
  const user = await getJson(env, `user:${payload.uid}`);
  return user || null;
}

export async function getJson(env, key, fallback = null) {
  if (!hasStorage(env)) return fallback;
  const raw = await env.TYPING_APP.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function putJson(env, key, value) {
  if (!hasStorage(env)) return;
  await env.TYPING_APP.put(key, JSON.stringify(value));
}

export function userScoreKey(userId) {
  return `scores:user:${userId}`;
}

export function leaderboardKey() {
  return 'leaderboard:v1';
}

export function createSessionPayload(userId) {
  return { uid: userId, exp: Date.now() + SESSION_TTL_MS };
}

export function normalizeMode(mode) {
  const value = String(mode || 'quotes').trim().toLowerCase();
  if (value === 'words' || value === 'words30' || value === 'quotes') return value;
  return 'quotes';
}
