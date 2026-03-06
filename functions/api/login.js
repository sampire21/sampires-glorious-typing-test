import {
  json,
  readJson,
  normalizeUsername,
  hashPassword,
  createToken,
  createSessionPayload,
  getSecret,
  publicUser,
  hasStorage,
} from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const body = await readJson(request);
  const usernameNorm = normalizeUsername(body.username);
  const password = String(body.password || '');

  const userId = await env.TYPING_APP.get(`userByName:${usernameNorm}`);
  if (!userId) return json({ error: 'Invalid username or password' }, 401);

  const userRaw = await env.TYPING_APP.get(`user:${userId}`);
  if (!userRaw) return json({ error: 'Invalid username or password' }, 401);
  const user = JSON.parse(userRaw);

  const { hash } = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return json({ error: 'Invalid username or password' }, 401);

  const token = await createToken(createSessionPayload(user.id), getSecret(env));
  return json({ user: publicUser(user), token }, 200);
}
