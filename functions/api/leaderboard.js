import {
  json,
  getJson,
  leaderboardKey,
  normalizeMode,
  hasStorage,
  getWeekKeyUtc,
  communityContributionKey,
} from './_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 20)));
  const community = url.searchParams.get('community') === '1' || (url.searchParams.get('tab') || '').trim() === 'community';
  const modeParam = (url.searchParams.get('mode') || '').trim();
  const mode = modeParam ? normalizeMode(modeParam) : '';

  if (community) {
    const weekKey = getWeekKeyUtc();
    const contribKey = communityContributionKey(weekKey);
    const state = await getJson(env, contribKey, { week: weekKey, entries: {} });
    const entries = (state && typeof state.entries === 'object' && !Array.isArray(state.entries))
      ? state.entries
      : {};
    const contributions = Object.values(entries)
      .map((row) => ({
        id: String(row.id || ''),
        username: String(row.username || 'Unknown'),
        damage: Math.max(0, Math.floor(Number(row.damage) || 0)),
      }))
      .filter((row) => row.damage > 0)
      .sort((a, b) => b.damage - a.damage || a.username.localeCompare(b.username))
      .slice(0, limit);
    return json({ week: weekKey, contributions }, 200);
  }

  const allRows = await getJson(env, leaderboardKey(), []);
  const bestByUserMode = new Map();
  for (const row of allRows) {
    if (mode && row.mode !== mode) continue;
    const key = `${row.userId || row.username}::${row.mode}`;
    const prev = bestByUserMode.get(key);
    const better =
      !prev ||
      (row.wpm || 0) > (prev.wpm || 0) ||
      ((row.wpm || 0) === (prev.wpm || 0) && (row.accuracy || 0) > (prev.accuracy || 0)) ||
      ((row.wpm || 0) === (prev.wpm || 0) && (row.accuracy || 0) === (prev.accuracy || 0) && (row.date || 0) > (prev.date || 0));
    if (better) bestByUserMode.set(key, row);
  }
  const leaderboard = [...bestByUserMode.values()]
    .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || b.date - a.date)
    .slice(0, limit)
    .map((row) => ({
      username: row.username,
      mode: row.mode,
      wpm: row.wpm,
      accuracy: row.accuracy,
      rawWpm: row.rawWpm,
      time: row.time,
      date: row.date,
    }));

  return json({ leaderboard }, 200);
}
