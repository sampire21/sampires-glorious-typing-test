import {
  json,
  readJson,
  getAuthUser,
  getJson,
  putJson,
  hasStorage,
  getWeekKeyUtc,
  communityContributionKey,
} from '../_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);

  const body = await readJson(request);
  const words = Math.max(0, Math.floor(Number(body.words) || 0));
  if (words <= 0) return json({ ok: true }, 200);

  const authUser = await getAuthUser(request, env);
  const guestIdRaw = String(body.guestId || '').trim();
  const guestNameRaw = String(body.guestName || '').trim();
  const fallbackGuestName = guestIdRaw ? `Guest-${guestIdRaw.slice(0, 4)}` : 'Guest';

  const contributorId = authUser
    ? `user:${authUser.id}`
    : `guest:${guestIdRaw || crypto.randomUUID()}`;
  const username = authUser
    ? authUser.username
    : (guestNameRaw || fallbackGuestName);

  const weekKey = getWeekKeyUtc(Number(body.date) || Date.now());
  const contribKey = communityContributionKey(weekKey);
  const contribState = await getJson(env, contribKey, { week: weekKey, entries: {} });
  const entries = (contribState && typeof contribState.entries === 'object' && !Array.isArray(contribState.entries))
    ? contribState.entries
    : {};

  const prev = entries[contributorId] || { id: contributorId, username, damage: 0 };
  entries[contributorId] = {
    id: contributorId,
    username,
    damage: Math.max(0, Math.floor(Number(prev.damage) || 0) + words),
  };

  await putJson(env, contribKey, { week: weekKey, entries });
  return json({ ok: true }, 201);
}

