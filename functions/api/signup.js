import {
  json,
  readJson,
  validateUsername,
  normalizeUsername,
  hashPassword,
  getSecret,
  publicUser,
  hasStorage,
  markStorageReady,
  getClientIp,
  safeRateKeyPart,
  incrementRateLimit,
  mintSessionTokens,
  buildAccessSessionCookie,
  buildRefreshSessionCookie,
} from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const body = await readJson(request);
  const ip = safeRateKeyPart(getClientIp(request), 'unknown');
  const ipRate = await incrementRateLimit(env, `rate:signup:ip:${ip}`, 60 * 60);
  if (ipRate.count > 12) {
    return json({
      error: 'Too many signup attempts. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: ipRate.retryAfterSec,
    }, 429);
  }
  const usernameCheck = validateUsername(body.username);
  if (!usernameCheck.ok) return json({ error: usernameCheck.error }, 400);

  const password = String(body.password || '');
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const usernameNorm = normalizeUsername(usernameCheck.username);
  const usernameRate = await incrementRateLimit(env, `rate:signup:user:${safeRateKeyPart(usernameNorm, 'unknown')}`, 60 * 60);
  if (usernameRate.count > 6) {
    return json({
      error: 'Too many signup attempts for this username. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: usernameRate.retryAfterSec,
    }, 429);
  }
  const existingUserId = await env.TYPING_APP.get(`userByName:${usernameNorm}`);
  if (existingUserId) return json({ error: 'Username already exists' }, 409);

  const id = crypto.randomUUID();
  const { salt, hash } = await hashPassword(password);
  const now = Date.now();
  const user = {
    id,
    username: usernameCheck.username,
    usernameNorm,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now,
    lastLoginAt: now,
    lastSeenAt: now,
  };

  await env.TYPING_APP.put(`user:${id}`, JSON.stringify(user));
  await env.TYPING_APP.put(`userByName:${usernameNorm}`, id);
  await markStorageReady(env);

  const tokenSet = await mintSessionTokens(env, id, getSecret(env));
  const headers = new Headers();
  headers.append('set-cookie', buildAccessSessionCookie(request, tokenSet.accessToken));
  headers.append('set-cookie', buildRefreshSessionCookie(request, tokenSet.refreshToken));
  return json({ user: publicUser(user) }, 201, headers);
}
