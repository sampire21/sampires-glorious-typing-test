Original prompt: Please look through my game and ensure that it is solid from top to bottom. I have been experiencing login issues, and leaderboard sync issues.

- Initialized by agent using develop-web-game skill.
- Next: audit login + leaderboard flow (frontend + API), reproduce issues with Playwright loop, then patch and re-test.

## Update 1: Auth/fallback and leaderboard sync hardening
- Patched `index.html` auth/network logic to avoid cloud sessions silently dropping into local auth mode.
- Added helpers:
  - `isLocalAuthToken(token)`
  - `isNetworkLikeError(error)`
  - `shouldAllowLocalFallback(error)`
  - `apiFetchCloudThenLocal(url, options, fallbackMessage)`
- Updated signup/login to use cloud-first with controlled fallback to local storage only for outage/misconfig classes (network/404/5xx).
- Updated `restoreSession` to avoid deleting a valid cloud token on transient cloud failures.
- Updated score/stat sync:
  - cloud token uses cloud endpoint directly (`apiFetchCloudFirst`) for score submit and stats fetch
  - local token continues to use local API path
- Updated all-time leaderboard fetch to be cloud-first and only fall back when cloud is unavailable.

## Update 2: Validation
- JS parse check passed for `index.html` script block (`new Function` parse smoke test).
- Could not run `develop-web-game` Playwright client yet because `playwright` package is missing and install failed due network DNS error (`EAI_AGAIN` to registry.npmjs.org).
- Ran local server API smoke test on `server.js` (localhost:3000):
  - signup: pass
  - login: pass
  - save score: pass
  - leaderboard fetch: pass
  - me endpoint with bearer token: pass

## Remaining TODOs / next agent
- Re-run web game Playwright loop once network/package install is available:
  - `npm install playwright`
  - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file "$WEB_GAME_ACTIONS" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game`
- Validate UI-side auth/leaderboard flows in-browser for:
  - cloud available
  - cloud temporarily unavailable then restored (ensure session not dropped and leaderboard recovers)
