import {
  json,
  getAuthUser,
  getJson,
  userScoreKey,
  normalizeMode,
  hasStorage,
} from '../_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
  const modeParam = (url.searchParams.get('mode') || '').trim();
  const mode = modeParam ? normalizeMode(modeParam) : '';

  const allScores = await getJson(env, userScoreKey(user.id), []);
  const scores = allScores
    .filter((score) => !mode || score.mode === mode)
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);

  return json({ scores }, 200);
}
