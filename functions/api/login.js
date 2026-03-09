import {
  json,
  readJson,
  normalizeUsername,
  hashPassword,
  getSecret,
  publicUser,
  putJson,
  hasStorage,
  looksLikeEmptyAuthNamespace,
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
  const requestId = context.requestId || request.headers.get('cf-ray') || crypto.randomUUID();
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const body = await readJson(request);
  const usernameNorm = normalizeUsername(body.username);
  const password = String(body.password || '');
  const ip = safeRateKeyPart(getClientIp(request), 'unknown');
  const ipRate = await incrementRateLimit(env, `rate:login:ip:${ip}`, 60 * 10);
  if (ipRate.count > 30) {
    return json({
      error: 'Too many login attempts. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: ipRate.retryAfterSec,
    }, 429);
  }
  const userRate = await incrementRateLimit(env, `rate:login:user:${safeRateKeyPart(usernameNorm, 'unknown')}`, 60 * 10);
  if (userRate.count > 12) {
    return json({
      error: 'Too many login attempts for this account. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: userRate.retryAfterSec,
    }, 429);
  }

  const userId = await env.TYPING_APP.get(`userByName:${usernameNorm}`);
  if (!userId) {
    const kvLikelyEmpty = await looksLikeEmptyAuthNamespace(env);
    if (kvLikelyEmpty) {
      console.error('[auth-kv-misconfig]', {
        requestId,
        method: 'POST',
        path: '/api/login',
        usernameNorm,
      });
      return json({
        error: 'Authentication storage appears empty or misconfigured. Verify KV namespace IDs/binding.',
        code: 'KV_NAMESPACE_EMPTY_OR_MISMATCH',
        requestId,
      }, 503);
    }
    return json({ error: 'Invalid username or password' }, 401);
  }

  const userRaw = await env.TYPING_APP.get(`user:${userId}`);
  if (!userRaw) return json({ error: 'Invalid username or password' }, 401);
  const user = JSON.parse(userRaw);

  const { hash } = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return json({ error: 'Invalid username or password' }, 401);

  const now = Date.now();
  user.lastLoginAt = now;
  user.lastSeenAt = now;
  await putJson(env, `user:${user.id}`, user);
  await markStorageReady(env);

  const tokenSet = await mintSessionTokens(env, user.id, getSecret(env));
  const headers = new Headers();
  headers.append('set-cookie', buildAccessSessionCookie(request, tokenSet.accessToken));
  headers.append('set-cookie', buildRefreshSessionCookie(request, tokenSet.refreshToken));
  return json({ user: publicUser(user) }, 200, headers);
}
