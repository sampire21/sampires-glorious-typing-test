import { json, readJson, getAuthUser, getJson, putJson, hasStorage } from './_lib.js';

function progressKey(userId) {
  return `progress:user:${userId}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const payload = await getJson(env, progressKey(user.id), { progress: {}, updatedAt: 0 });
  return json({
    progress: (payload && payload.progress && typeof payload.progress === 'object') ? payload.progress : {},
    updatedAt: Number(payload && payload.updatedAt) || 0,
  }, 200);
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  const existing = await getJson(env, progressKey(user.id), { progress: {}, updatedAt: 0 });
  const existingUpdatedAt = Number(existing && existing.updatedAt) || 0;
  const baseUpdatedAtRaw = Number(body && body.baseUpdatedAt);
  const baseUpdatedAt = Number.isFinite(baseUpdatedAtRaw) ? Math.max(0, Math.floor(baseUpdatedAtRaw)) : 0;
  if (baseUpdatedAt < existingUpdatedAt) {
    return json({
      error: 'Progress conflict: newer progress exists on another session.',
      progress: (existing && existing.progress && typeof existing.progress === 'object') ? existing.progress : {},
      updatedAt: existingUpdatedAt,
    }, 409);
  }

  const progress = (body && body.progress && typeof body.progress === 'object' && !Array.isArray(body.progress))
    ? body.progress
    : {};
  const updatedAt = Date.now();
  await putJson(env, progressKey(user.id), { progress, updatedAt });
  user.lastSeenAt = updatedAt;
  await putJson(env, `user:${user.id}`, user);
  return json({ ok: true, updatedAt }, 200);
}
