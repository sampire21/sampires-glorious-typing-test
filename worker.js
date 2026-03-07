import { onRequestPost as handleSignup } from './functions/api/signup.js';
import { onRequestPost as handleLogin } from './functions/api/login.js';
import { onRequestGet as handleMe } from './functions/api/me.js';
import { onRequestPost as handleScores } from './functions/api/scores/index.js';
import { onRequestGet as handleScoresMe } from './functions/api/scores/me.js';
import { onRequestGet as handleLeaderboard } from './functions/api/leaderboard.js';

const routes = [
  { method: 'POST', path: '/api/signup', handler: handleSignup },
  { method: 'POST', path: '/api/login', handler: handleLogin },
  { method: 'GET', path: '/api/me', handler: handleMe },
  { method: 'POST', path: '/api/scores', handler: handleScores },
  { method: 'GET', path: '/api/scores/me', handler: handleScoresMe },
  { method: 'GET', path: '/api/leaderboard', handler: handleLeaderboard },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const match = routes.find(r => r.method === request.method && r.path === url.pathname);
    if (match) return match.handler({ request, env });

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
