import { json, getAuthUser, publicUser, hasStorage } from './_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!hasStorage(env)) return json({ error: 'Server storage not configured (TYPING_APP KV binding missing).' }, 500);
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  return json({ user: publicUser(user) }, 200);
}
