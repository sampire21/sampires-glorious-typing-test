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

## Update 3: Challenge Tab behavior fix
- Fixed `Tab` handling in `handleTypingKeydown` so active challenges restart the current run instead of abandoning to the challenge menu.
- Updated challenge hint text from "Tab to abandon" to "Tab to restart" for all active challenge variants.
- Re-ran script parse smoke check for `index.html`: pass.

## Update 4: Ghost cursor toggle
- Added a new control button beside `New Quote` and `Restart`: `Ghost Cursor: On/Off`.
- Added persisted preference key: `sampire-ghost-cursor-enabled`.
- Implemented toggle wiring:
  - `loadGhostCursorPreference()`
  - `updateGhostToggleButton()`
  - `toggleGhostCursor()`
- Ghost rendering now respects the toggle in all key paths:
  - initial ghost replay cursor on `init()`
  - per-character ghost classes (`makeCharSpan`, `updateCharSpan`)
  - ghost replay stepping in `startTimer()`
- Toggle state is applied on startup before `newTest()` runs.
- JS parse smoke check passed after edits.
- Attempted Playwright validation after ghost toggle change; still blocked because `playwright` package is unavailable in this environment (`ERR_MODULE_NOT_FOUND`).

## Update 5: Admin panel profile merge + reset/delete controls
- Fixed admin grant behavior to *add* to existing profile values instead of replacing key fields:
  - `setLevel` now adds equivalent XP (`(level-1)*500`) to existing XP.
  - `setXp` and `setSkillPoints` now add to current XP/SP.
- Added admin account reset capabilities (cloud + local fallback):
  - Reset username (`resetUsername`) with validation + uniqueness checks.
  - Reset password (`resetPassword`) with minimum length checks.
  - Username changes now propagate to saved score rows and leaderboard usernames.
- Added admin account deletion capability (cloud + local fallback):
  - `DELETE /api/admin/users/:id` in cloud worker route + handler.
  - Local fallback supports `DELETE` on same route and removes user/profile/scores.
- Updated admin panel UI:
  - Added fields: `Reset Username`, `Reset Password`.
  - Changed action button to `Apply Changes`.
  - Added `Delete User` button with confirmation.
- If admin changes/deletes the currently logged-in account, UI now refreshes identity (or logs out after delete).

## Update 6: Modal return flow + profile streak status
- Implemented modal stacking so closing sub-menus returns to the previous menu/modal instead of dropping back to the main screen.
  - Added `modalStack` and updated `openModal`/`closeModal` behavior.
  - Works for profile submenus (Account Management, Delete Confirm, Shop, Inventory, Admin), and preserves focus restoration only when the final modal closes.
- Added profile header streak status next to username:
  - Shows `${N}-day streak` always.
  - Shows `· Xx XP boost` only when active multiplier > 1.
  - Uses existing `getStreakData()` and `getXPMultiplier()` logic.
- JS parse smoke check passed.

## Update 7: Top-level login flow refactor
- Removed bottom account login section from main page layout.
- Top right button now routes by auth state:
  - logged in -> `Profile`
  - logged out -> `Login`
- Added new `login-modal` with existing auth fields and CTA text:
  - "Don't have an account? Create one for free to track your scores, level up and unlock rewards!"
- Added modal handlers:
  - `openLoginModal`, `closeLoginModal`, `handleLoginModalBackdrop`, `openProfileOrLogin`
- Updated auth flows:
  - successful login/signup closes login modal
  - Escape now closes login modal
- Kept logout available in profile header actions.
- JS parse smoke check passed.

## Update 8: Auth fallback + leaderboard reliability hardening
- Tightened cloud/local fallback behavior to stop intermittent cloud outages from presenting as local auth failures:
  - `apiFetch` no longer auto-switches the entire session to local mode on network timeout/abort.
  - Added `shouldAllowAuthLocalFallback()` and used it for signup/login so auth only falls back to local on API-route missing (`404`) instead of `5xx`/network issues.
- Improved login flow resilience:
  - Login button is now disabled while request is in-flight to prevent duplicate concurrent submissions/races.
- Leaderboard tab correctness + stale-view fix:
  - `setLbTab()` now always calls `refreshLeaderboard()` so Weekly/All Time don't reuse stale cached rows.
  - Added explicit loading state while leaderboard requests are in-flight.
  - Added request-id guard in `openCommunityHub()` catch path to avoid race-based stale overwrite.
- Community week alignment fix:
  - Added `getWeekKeyUtc()` and switched community-only week keys/state to UTC to match cloud API week bucketing.
  - Local community leaderboard response now returns UTC week key.
- Reduced perceived hangs:
  - `fetchWithTimeout` lowered from 15s to 8s.
- Local fallback usage in leaderboard refresh is now explicit (`localApiFetch`) rather than re-entering cloud fetch paths.

### Validation
- `index.html` script parse smoke test passed (`new Function` parse).
- Playwright loop still blocked in this environment because `playwright` package is missing.

### Remaining TODOs / next agent
- Install `playwright` and run `develop-web-game` loop to visually verify:
  - login failure messaging under cloud 5xx/network faults
  - leaderboard tab switching (All Time / This Week / Community) with no stale carryover
  - community contribution visibility across UTC week boundary scenarios

## Update 9: Chromium Playwright validation run (post-install)
- Installed Playwright in project and validated Chromium launch.
- Because the skill client script resolves modules from its own directory, ran it from a copied local path (`tmp_web_game_playwright_client.mjs`) so project `node_modules/playwright` is used.
- Ran action-loop screenshots at `output/web-game/shot-0.png..shot-2.png` and manually inspected them.
- Ran direct Playwright Chromium validation script for auth + leaderboard behavior:
  - Signup/login success path: pass
  - Bad password path returns `Invalid username or password`: pass
  - Simulated `/api/login` 503 displays server error (`Server Down`) instead of silent local fallback: pass
  - Leaderboard tabs render distinct data/layouts (Community vs Weekly): pass
  - Weekly leaderboard row rendering after score submission: pass
  - Community contributions render in community tab when present: pass
- Noted expected local-dev caveat with `server.js`: several cloud worker routes are absent, so local mode may show `Cloud API routes not found...` message in this environment. This is environment-specific and not from Chromium/Playwright failure.
