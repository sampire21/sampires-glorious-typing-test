import {
  json,
  clearAccessSessionCookie,
  clearRefreshSessionCookie,
  verifyAccessTokenFromRequest,
  verifyRefreshTokenFromRequest,
  revokeAuthSession,
  hasStorage,
} from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let sessionId = '';
  try {
    const access = await verifyAccessTokenFromRequest(request, env);
    if (access && access.sid) sessionId = String(access.sid);
  } catch {}
  if (!sessionId) {
    try {
      const refresh = await verifyRefreshTokenFromRequest(request, env);
      if (refresh && refresh.sid) sessionId = String(refresh.sid);
    } catch {}
  }
  if (sessionId && hasStorage(env)) {
    await revokeAuthSession(env, sessionId);
  }
  const headers = new Headers();
  headers.append('set-cookie', clearAccessSessionCookie(request));
  headers.append('set-cookie', clearRefreshSessionCookie(request));
  return json({ ok: true }, 200, headers);
}
