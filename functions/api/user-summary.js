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

async function getCommunityContributionTotal(env, userId, usernameNorm) {
  let total = 0;
  let cursor = undefined;
  const targetId = `user:${userId}`;
  do {
    const page = await env.TYPING_APP.list({ prefix: 'community-contrib:v1:', cursor, limit: 1000 });
    const keys = Array.isArray(page && page.keys) ? page.keys : [];
    for (const entry of keys) {
      const keyName = String(entry && entry.name || '');
      if (!keyName) continue;
      const payload = await getJson(env, keyName, null);
      const rows = payload && payload.entries && typeof payload.entries === 'object' ? payload.entries : {};
      const direct = rows[targetId];
      if (direct && Number.isFinite(Number(direct.damage))) {
        total += Math.max(0, Math.floor(Number(direct.damage) || 0));
        continue;
      }
      if (!usernameNorm) continue;
      for (const row of Object.values(rows)) {
        const rowName = normalizeUsername(row && row.username || '');
        if (!rowName || rowName !== usernameNorm) continue;
        total += Math.max(0, Math.floor(Number(row && row.damage) || 0));
      }
    }
    cursor = page && page.list_complete ? undefined : (page && page.cursor ? page.cursor : undefined);
  } while (cursor);
  return total;
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
  const xp = Math.max(0, parseInt(progress['sampire-xp'] || '0', 10) || 0);
  const level = Math.max(1, Math.floor(xp / 500) + 1);

  const scores = await getJson(env, `scores:user:${userId}`, []);
  const personalBestWpm = Array.isArray(scores) && scores.length
    ? Math.max(0, ...scores.map((row) => Math.max(0, Number(row && row.wpm) || 0)))
    : 0;
  const communityContributionTotal = await getCommunityContributionTotal(env, userId, user.usernameNorm || usernameNorm);

  return json({
    username: user.username,
    badgeIds: badgeUnique,
    lifetimeChallengesCompleted,
    level,
    personalBestWpm,
    communityContributionTotal,
  }, 200);
}
