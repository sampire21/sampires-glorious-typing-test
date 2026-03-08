import {
  json,
  readJson,
  validateUsername,
  normalizeUsername,
  hashPassword,
  createToken,
  createSessionPayload,
  getSecret,
  publicUser,
  hasStorage,
  markStorageReady,
} from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const body = await readJson(request);
  const usernameCheck = validateUsername(body.username);
  if (!usernameCheck.ok) return json({ error: usernameCheck.error }, 400);

  const password = String(body.password || '');
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const usernameNorm = normalizeUsername(usernameCheck.username);
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

  const token = await createToken(createSessionPayload(id), getSecret(env));
  return json({ user: publicUser(user), token }, 201);
}
