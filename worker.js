import { onRequestPost as handleSignup } from './functions/api/signup.js';
import { onRequestPost as handleLogin } from './functions/api/login.js';
import { onRequestGet as handleMe } from './functions/api/me.js';
import { onRequestPost as handleScores } from './functions/api/scores/index.js';
import { onRequestGet as handleScoresMe } from './functions/api/scores/me.js';
import { onRequestGet as handleLeaderboard } from './functions/api/leaderboard.js';
import { onRequestGet as handleProgressGet, onRequestPut as handleProgressPut } from './functions/api/progress.js';
import { onRequestPost as handleCommunityContribute } from './functions/api/community/contribute.js';
import { onRequestPatch as handleAccountPatch, onRequestDelete as handleAccountDelete } from './functions/api/account.js';
import { onRequestGet as handleUserSummary } from './functions/api/user-summary.js';
import { onRequestGet as handleAdminUsers } from './functions/api/admin/users.js';
import { onRequestGet as handleAdminUserGet, onRequestPatch as handleAdminUserPatch } from './functions/api/admin/users/[id].js';

const routes = [
  { method: 'POST', path: '/api/signup', handler: handleSignup },
  { method: 'POST', path: '/api/login', handler: handleLogin },
  { method: 'GET', path: '/api/me', handler: handleMe },
  { method: 'POST', path: '/api/scores', handler: handleScores },
  { method: 'GET', path: '/api/scores/me', handler: handleScoresMe },
  { method: 'GET', path: '/api/leaderboard', handler: handleLeaderboard },
  { method: 'GET', path: '/api/progress', handler: handleProgressGet },
  { method: 'PUT', path: '/api/progress', handler: handleProgressPut },
  { method: 'POST', path: '/api/community/contribute', handler: handleCommunityContribute },
  { method: 'PATCH', path: '/api/account', handler: handleAccountPatch },
  { method: 'DELETE', path: '/api/account', handler: handleAccountDelete },
  { method: 'GET', path: '/api/user-summary', handler: handleUserSummary },
  { method: 'GET', path: '/api/admin/users', handler: handleAdminUsers },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();

    // Handle dynamic route: /api/admin/users/:id
    const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch) {
      const id = decodeURIComponent(adminUserMatch[1]);
      const handler = request.method === 'GET' ? handleAdminUserGet
        : request.method === 'PATCH' ? handleAdminUserPatch
        : null;
      if (handler) {
        try {
          return await handler({ request, env, params: { id }, requestId });
        } catch (err) {
          console.error('[api-error]', {
            requestId,
            method: request.method,
            path: url.pathname,
            error: err && err.message ? err.message : 'Internal server error',
            stack: err && err.stack ? err.stack : null,
          });
          return new Response(JSON.stringify({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            requestId,
          }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
      }
    }

    const match = routes.find(r => r.method === request.method && r.path === url.pathname);
    if (match) {
      try {
        return await match.handler({ request, env, requestId });
      } catch (err) {
        console.error('[api-error]', {
          requestId,
          method: request.method,
          path: url.pathname,
          error: err && err.message ? err.message : 'Internal server error',
          stack: err && err.stack ? err.stack : null,
        });
        return new Response(JSON.stringify({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          requestId,
        }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
