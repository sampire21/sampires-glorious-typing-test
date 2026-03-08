import { json, normalizeUsername, getJson, hasStorage } from './_lib.js';

function parseJsonSafe(raw, fallback) {
  try {
    const parsed = JSON.parse(raw || '');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function dailyCompletionsTotal(dailyObj) {
  if (!dailyObj || typeof dailyObj !== 'object') return 0;
  if (Array.isArray(dailyObj.completions)) return dailyObj.completions.length;
  const days = dailyObj.days && typeof dailyObj.days === 'object' ? dailyObj.days : {};
  return Object.values(days).reduce((sum, row) => {
    const completions = Array.isArray(row)
      ? row
      : (row && Array.isArray(row.completions) ? row.completions : []);
    return sum + completions.length;
  }, 0);
}

function weeklyCompletionsCount(weeklyObj) {
  if (!weeklyObj || typeof weeklyObj !== 'object') return 0;
  const completions = Array.isArray(weeklyObj.completions) ? weeklyObj.completions : [];
  return completions.length;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);

  const url = new URL(request.url);
  const usernameRaw = String(url.searchParams.get('username') || '').trim();
  const usernameNorm = normalizeUsername(usernameRaw);
  if (!usernameNorm) return json({ error: 'username is required' }, 400);

  const userId = await env.TYPING_APP.get(`userByName:${usernameNorm}`);
  if (!userId) return json({ error: 'User not found' }, 404);
  const user = await getJson(env, `user:${userId}`, null);
  if (!user) return json({ error: 'User not found' }, 404);

  const progressPayload = await getJson(env, `progress:user:${userId}`, { progress: {} });
  const progress = (progressPayload && progressPayload.progress && typeof progressPayload.progress === 'object')
    ? progressPayload.progress
    : {};
  const badgesRaw = parseJsonSafe(progress['sampire-badges'] || '[]', []);
  const badgeIds = (Array.isArray(badgesRaw) ? badgesRaw : [])
    .map((b) => (typeof b === 'string' ? b : String(b && b.id || '')))
    .filter(Boolean);
  const badgeUnique = [...new Set(badgeIds)];

  const lifetimeStored = Math.max(0, parseInt(progress['sampire-lifetime-challenges-completed'] || '0', 10) || 0);
  const dailyTotal = dailyCompletionsTotal(parseJsonSafe(progress['sampire-daily-v2'] || '{}', {}));
  const weeklyCount = weeklyCompletionsCount(parseJsonSafe(progress['sampire-weekly'] || '{}', {}));
  const lifetimeChallengesCompleted = Math.max(lifetimeStored, dailyTotal + weeklyCount);

  return json({
    username: user.username,
    badgeIds: badgeUnique,
    lifetimeChallengesCompleted,
  }, 200);
}
