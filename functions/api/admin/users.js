import {
  json,
  getJson,
  hasStorage,
  requireAdmin,
  userScoreKey,
} from '../_lib.js';

const XP_PER_LEVEL = 500;
const ACTIVE_MS = 15 * 60 * 1000;

function parseJsonSafe(raw, fallback) {
  try {
    const parsed = JSON.parse(raw || '');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function dailyCompletionCount(dailyObj) {
  if (!dailyObj || typeof dailyObj !== 'object') return 0;
  if (Array.isArray(dailyObj.completions)) return dailyObj.completions.length;
  const days = dailyObj.days && typeof dailyObj.days === 'object' ? dailyObj.days : {};
  const keys = Object.keys(days);
  if (!keys.length) return 0;
  keys.sort();
  const latest = days[keys[keys.length - 1]] || {};
  return Array.isArray(latest.completions) ? latest.completions.length : 0;
}

function summarizeUser(user, progressPayload, scores) {
  const progress = (progressPayload && typeof progressPayload.progress === 'object' && progressPayload.progress)
    ? progressPayload.progress
    : {};
  const xp = Math.max(0, parseInt(progress['sampire-xp'] || '0', 10) || 0);
  const skillPoints = Math.max(0, parseInt(progress['sampire-skill-points'] || '0', 10) || 0);
  const badges = parseJsonSafe(progress['sampire-badges'] || '[]', []);
  const daily = parseJsonSafe(progress['sampire-daily-v2'] || '{}', {});
  const weekly = parseJsonSafe(progress['sampire-weekly'] || '{}', {});
  const streak = parseJsonSafe(progress['sampire-streak'] || '{}', {});
  const skills = parseJsonSafe(progress['sampire-skills'] || '{}', {});
  const testsSaved = Array.isArray(scores) ? scores.length : 0;
  const bestWpm = testsSaved > 0 ? Math.max(...scores.map((s) => Number(s.wpm) || 0)) : 0;

  const lastSeenAt = Math.max(
    Number(user.lastSeenAt) || 0,
    Number(progressPayload && progressPayload.updatedAt) || 0
  );

  return {
    id: user.id,
    username: user.username,
    createdAt: Number(user.createdAt) || 0,
    lastLoginAt: Number(user.lastLoginAt) || 0,
    lastSeenAt,
    isActive: lastSeenAt > 0 && (Date.now() - lastSeenAt) <= ACTIVE_MS,
    level: Math.min(100, Math.floor(xp / XP_PER_LEVEL) + 1),
    xp,
    skillPoints,
    badges: Array.isArray(badges) ? badges.length : 0,
    dailyCompleted: dailyCompletionCount(daily),
    weeklyCompleted: Array.isArray(weekly.completions) ? weekly.completions.length : 0,
    streakDays: Math.max(0, Number(streak.streak) || 0),
    testsSaved,
    bestWpm,
    skillsUnlocked: ['aura', 'soundscapes', 'nebulaTrail'].filter((id) => !!skills[id]),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const adminCheck = await requireAdmin(request, env);
  if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);

  const users = [];
  let cursor;
  do {
    const listed = await env.TYPING_APP.list({ prefix: 'user:', cursor, limit: 100 });
    cursor = listed.list_complete ? undefined : listed.cursor;
    for (const keyEntry of listed.keys || []) {
      const key = String(keyEntry && keyEntry.name || '');
      if (!key.startsWith('user:')) continue;
      const user = await getJson(env, key, null);
      if (!user || !user.id) continue;
      users.push(user);
    }
  } while (cursor);

  const out = [];
  for (const user of users) {
    const progress = await getJson(env, `progress:user:${user.id}`, { progress: {}, updatedAt: 0 });
    const scores = await getJson(env, userScoreKey(user.id), []);
    out.push(summarizeUser(user, progress, Array.isArray(scores) ? scores : []));
  }
  out.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || (a.username || '').localeCompare(b.username || ''));
  return json({ users: out }, 200);
}
