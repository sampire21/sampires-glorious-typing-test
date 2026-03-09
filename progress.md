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

## Update 10: Keyboard sound pack compatibility (`config.json` multi/single)
- Added compatibility layer for downloadable keyboard sound pack formats:
  - Supports `key_define_type: "multi"` (per-key filename mapping).
  - Supports `key_define_type: "single"` (audio sprite slicing via `[startMs, durationMs]` from a single sound file).
- Added event-to-keycode mapping to resolve `defines` entries by legacy key code IDs used by pack configs.
- Added lazy pack config loading from `<pack>/config.json` with safe fallback to legacy `*.wav` mapping when config is missing/invalid.
- Added runtime pack switch helper:
  - `window.setKeySoundPack('<folder-name>')`
  - persisted to localStorage key `sampire-key-sound-pack`.
- Boot now restores selected key sound pack from localStorage and preloads its config.
- Updated keypress sound call sites to pass keyboard event context for accurate keycode mapping.

### Validation
- JS parse smoke check passed.
- Browser smoke check passed with `setKeySoundPack('cherrymx-blue-abs')`:
  - no console/page errors
  - keypress dispatch (letter/space/backspace) executed with pack enabled
  - selected pack persisted (`sampire-key-sound-pack=cherrymx-blue-abs`).

## Update 11: GitHub deployment + comprehensive production Playwright audit
- Deployed latest changes to GitHub `main`:
  - remote: `https://github.com/sampire21/sampires-glorious-typing-test.git`
  - commit pushed: `6ea28e5` (`Fix auth/leaderboard reliability and add key sound pack menu`)
- Ran comprehensive Playwright production audit against `https://type.sherathia.com`:
  - script: `output/full_prod_audit_v2.cjs`
  - summary artifact: `output/playwright-full/summary.json`
  - screenshots captured: `output/playwright-full/01-home.png` through `10-account-modal.png` (plus follow-up shots)
- Core functional coverage that passed:
  - page load + top controls
  - key sounds dropdown options and pack switching (`NK Creams`, `Cherry MX Blues`)
  - mode switching (`Quotes`, `Random Words`, `Words 30s`, `Challenges`)
  - typing interaction metrics update
  - leaderboard tabs render distinct layouts (`All Time`/`This Week` score columns vs `Community Goal` damage columns)
  - leaderboard username hover tooltip includes: `Level`, `Achievements`, `Total Community Damage`, `Personal Best WPM`
  - auth bad-credentials message path (`Invalid username or password`)
- Follow-up targeted Playwright checks:
  - `output/full_prod_followup_v3.cjs` validated community hub opens from clean state and account management modal opens.
  - additional isolated auth lifecycle script confirmed signup -> logout -> re-login success (`output/auth_lifecycle_check.cjs` run result pass).
- Notes:
  - Initial failures in the large suite were mostly harness-level modal-overlay click interception (attempting to click background controls while a modal remained open), not functional regressions.
  - One expected network item appears during bad-login scenario: `401 /api/login`.

## Update 12: Targeted re-check for previously ambiguous cases
- Ran focused Playwright follow-up with retries/modal-safe sequencing:
  - script: `output/targeted_summary_final.cjs`
  - summary: `output/playwright-full/targeted-summary-final.json`
- All targeted checks passed:
  - leaderboard hover tooltip includes Level/Achievements/Total Community Damage/Personal Best WPM
  - signup -> logout -> re-login lifecycle
  - account management modal accessibility from profile

## Update 13: Achievement persistence hardening
- Addressed report that achievements were not consistently retained after deploy/reload.
- Added immediate progress flush when a badge is awarded (`awardBadge -> flushProgressSyncNow()`), so unlocks are pushed to `/api/progress` without waiting for debounce.
- Added pre-logout flush (`logoutUser`) to reduce risk of losing queued progress before token/session teardown.
- Added unload/hidden flush hooks:
  - `document.visibilitychange` flushes when tab becomes hidden.
  - `window.pagehide` flushes before page unload/navigation.
- JS parse smoke test passed after patch.

## Update 14: Leaderboard hover achievements freshness fix
- Addressed issue where unlocked achievements did not appear in leaderboard hover consistently.
- Added username-normalized cache helpers for hover summary data:
  - `normalizeSummaryUsername`
  - `invalidateLeaderboardUserSummaryCache`
- On badge unlock (`awardBadge`), now invalidates the current user’s hover-summary cache key before syncing.
- In `fetchLeaderboardUserSummary`, for the currently logged-in user, merges local earned badges into fetched badge IDs so newly unlocked achievements appear immediately in hover (without waiting for cache TTL/cloud readback).
- JS parse smoke test passed.

## Update 15: PWA installability support
- Added PWA manifest file: `manifest.webmanifest`
  - name/short_name, standalone display, theme/background colors, scope/start_url
  - icons configured for 192 and 512 sizes (including maskable entry)
- Generated app icons from existing `Favicon.png`:
  - `icons/icon-192.png`
  - `icons/icon-512.png`
  - `icons/apple-touch-icon.png`
- Added service worker: `sw.js`
  - pre-caches app shell assets
  - network-first for navigations
  - stale-while-revalidate for static same-origin GET assets
  - bypasses cache for `/api/*` requests
- Wired install metadata/registration in `index.html`:
  - `<link rel=\"manifest\" href=\"/manifest.webmanifest\">`
  - theme color + iOS web app meta tags
  - apple touch icon link
  - service worker registration on window `load`

### Validation
- `manifest.webmanifest` JSON parse: pass.
- `sw.js` syntax check: pass.
- Chromium localhost check: service worker registered successfully with scope `http://127.0.0.1:3000/`.

## Update 16: Inventory persistence + top-right music theme selector
- Fixed unlock persistence loss on login by hardening cloud hydration merge:
  - Added `mergeProgressSnapshotsForSameOwner(remote, local)` and use it during `hydrateProgressForCurrentUser()` when owner matches.
  - Merge behavior now preserves same-user unlock state if remote snapshot is stale/partial:
    - skill unlocks (`sampire-skills`) use boolean OR semantics
    - badge list (`sampire-badges`) is unioned by id
    - key unlock-related fields are preserved from local when missing remotely
  - If merge changed state, it now pushes merged progress back to cloud immediately.
- Added immediate progress flushes for inventory/reward changes:
  - `saveSkillsState`, `saveRewardSettings`, `setRewardActive`, and `spendSkillPoint` now flush.
- Added top-right Music menu (click the Music button to open):
  - Theme options:
    - `Dark Main Theme`
    - `Your Own Personal Universe`
  - `Toggle On / Off` mute option in the menu
  - Active theme highlighting
  - Universe theme is disabled/locked unless `soundscapes` reward is unlocked
  - Escape/outside-click closes the music menu

### Validation
- JS parse smoke test passed.
- Playwright localhost checks:
  - Music menu opens and options render with active-state classes.
  - Local storage values for skills/reward settings persist across reload.
  - Merge helper test confirms remote/local union keeps unlocks and badges when remote is stale.

## Update 17: Music cutoff/restart mitigation for long tracks
- Addressed intermittent issue where `Your Own Personal Universe` could restart mid-song.
- Changes:
  - `playThemeSoundtrack()` is now idempotent: if active track is already playing, it does not call `play()` again.
  - `retryThemeMusicAfterGesture()` now exits early (and clears gesture-needed flag) if the active track is already playing.
  - Removed manual `ended` restart handlers for theme tracks and rely on `audio.loop = true` only.
- Goal: prevent redundant play/restart calls from focus/gesture events that can interrupt long playback on some browsers.
- JS parse smoke test passed.

## Update 18: Quotes Bible Mode framework
- Added Bible Mode toggle UI beside WPM in typing stats (`Quotes` mode only).
- Added persistent preference key: `sampire-bible-mode` and included it in progress sync keys.
- Added quote routing helpers:
  - uses `window.BIBLE_VERSES` when Bible Mode is enabled and dataset is present
  - falls back to default `QUOTES` with a one-time info toast if no verses are loaded
- Updated New Test label behavior:
  - quotes mode + bible off: `New Quote`
  - quotes mode + bible on: `New Verse`
  - word modes: `New Words`
- Added placeholder data file:
  - `bible-verses.js` (empty `window.BIBLE_VERSES` array with expected object shape comments)
  - included in HTML before main app script

### Validation
- Inline script parse check passed.
- Local Playwright smoke check passed:
  - words mode hides Bible toggle
  - quotes mode shows Bible toggle
  - toggling Bible mode updates button label to `New Verse`
  - no startup JS errors.

## Update 19: Bible toggle visual adjustment
- Updated Bible Mode control styling per request:
  - removed boxed/stat-card look
  - now renders as a plain inline toggle to the left of WPM
  - retains quote-mode-only visibility and existing behavior
- JS parse smoke test passed after style/markup update.

## Update 16: Community boost game modes (in progress)
- Added community boost mode system scaffolding:
  - `targeted_weakness` and `kinetic_shielding` definitions.
  - runtime state helpers and damage computation helpers.
- Added Community Hub mode cards with start/disable actions.
- `Targeted Weakness` now generates X/Z-heavy passages and emits laser icon effect on X/Z keypress.
- `Kinetic Shielding` runtime now tracks dodge progress while maintaining WPM above baseline.
- Results now submit boosted community damage (`addCommunityWeeklyWords` + `submitCommunityContribution`) instead of raw typed word count when a boost mode is active.
- JS parse smoke check passed.

## Update 17: Community boost mode verification
- Ran local parse smoke check for inline script: pass.
- Ran develop-web-game Playwright client against `http://127.0.0.1:3000` with screenshots to `output/web-game-community/`.
- Added targeted feature Playwright checks (`output/community_modes_check.cjs`) and validated:
  - Community Hub shows both new boost cards.
  - `Targeted Weakness` starts quote test with source label `Community Mode: Targeted Weakness`.
  - X/Z keypress spawns `.xz-laser-icon` effect.
  - Targeted helper damage sample (`3 words`, 2 X/Z matches) returns `7` damage.
  - `Kinetic Shielding` starts words30 with baseline in source label.
  - Shield runtime state initializes and dodge count increments over time while WPM stays above baseline.
- Screenshot inspected: `output/community-hub-modes.png` confirms new mode UI in community modal.

### Remaining TODOs
- Consider adding an explicit in-run HUD indicator for shield dodge progress (e.g., `Dodges: 2/5`) while kinetic mode is active.
- If desired, expose a small post-result line showing exact boosted damage submitted each run.

## Update 16: Music + keyboard volume sliders
- Added volume slider controls inside both top-bar menus:
  - `Music` dropdown now has a `Volume` slider (`#music-volume-slider`) with live percentage label.
  - `Key Sounds` dropdown now has a `Volume` slider (`#keysound-volume-slider`) with live percentage label.
- Implemented persisted volume settings:
  - `sampire-music-volume` (default `0.35`)
  - `sampire-key-sound-volume` (default `1`)
- Wired music volume to all relevant tracks:
  - main theme tracks (`dark`, `universe`)
  - reward preview track (`soundscapePreviewAudio`)
- Wired key sound volume to keypress audio playback:
  - pool creation and runtime playback now respect `keySoundVolume`
  - sprite-segment playback also applies configured key volume
- Added UI sync helpers so slider values and percentage labels stay current when menus open and when values change.
- Added both new volume keys to progress-sync handling so preferences can travel with synced profile data.

### Validation
- `index.html` script parse smoke check passed (`new Function` parse).
- Ran Playwright UI verification against local server:
  - setting music slider to `12` updated label to `12%` and persisted `sampire-music-volume=0.12`
  - setting key sound slider to `67` updated label to `67%` and persisted `sampire-key-sound-volume=0.67`
  - after reload, both labels restored to persisted values
  - no page/console errors during the interaction run
- Ran `develop-web-game` client loop and captured screenshots in `output/web-game-volume/` (`shot-0.png`..`shot-2.png`).

## Update 17: Beta achievement `Founder` (auto-unlock for all accounts)
- Added new achievement definition:
  - id: `founder`
  - name: `Founder`
  - desc: `Created an account during the beta period`
- Added beta gate flag:
  - `const BETA_FOUNDER_ACHIEVEMENT_ENABLED = true;`
  - flip this to `false` later to stop automatic Founder grants.
- Added `ensureFounderBadgeForBeta()` helper and wired it into auth lifecycle:
  - after `hydrateProgressForCurrentUser()` in `signupUser`
  - after `hydrateProgressForCurrentUser()` in `loginUser`
  - after `hydrateProgressForCurrentUser()` in `restoreSession`
- Result: while beta flag is `true`, any authenticated account automatically gets `Founder` once.
- Updated achievement ID lists used by admin set-achievements flows:
  - local fallback admin patch route inside `index.html`
  - cloud route `functions/api/admin/users/[id].js`

### Validation
- `index.html` script parse smoke test passed (`new Function` parse).
- Playwright signup flow check against local server:
  - new account signup succeeded
  - `founder` stored in `sampire-badges`
  - `Founder` appears in profile content
  - `BADGE_DEFS` includes `founder`
- Ran `develop-web-game` client loop and inspected screenshots in `output/web-game-founder/`.

## Update 18: New achievement `The Human Lectionary`
- Added new achievement definition:
  - id: `human_lectionary`
  - name: `The Human Lectionary`
  - desc: `Complete 100 Bible Mode typing tests`
- Added Bible-mode history counting helper:
  - `getBibleModeTestCount()`
  - Counts both:
    - new entries with explicit `bibleMode: true`
    - legacy quote entries whose text matches known Bible verse pool text
- Added new badge unlock rule in `checkBadges(...)`:
  - awards `human_lectionary` when `getBibleModeTestCount() >= 100`
- Enhanced history persistence for future runs:
  - `scoreEntry` now includes `bibleMode: currentMode === 'quotes' && bibleModeEnabled`
- Updated admin achievement lists to include the new badge id:
  - local fallback admin patch route in `index.html`
  - cloud admin route in `functions/api/admin/users/[id].js`

### Validation
- `index.html` parse smoke check passed.
- Playwright validation (local):
  - legacy-style 100 Bible quote entries counted correctly (`countFromLegacy: 100`)
  - new-format `bibleMode: true` entries counted correctly (`countFromFlagged: 100`)
  - `checkBadges` returns `human_lectionary` and badge is stored in `sampire-badges`
  - badge definition present in `BADGE_DEFS`
  - no console/page errors in targeted run
- Ran `develop-web-game` client loop and inspected screenshots in `output/web-game-lectionary/`.

## Update 19: Fix result-race bug (spacebar after final word causing 0-score results)
- Fixed a race condition between completion and global spacebar shortcut handling.
- Root cause:
  - After the final character, `isComplete` is set and `showResults(...)` is queued with a timeout.
  - The same/next immediate spacebar key event reached the global keydown handler before results fully opened.
  - Global handler interpreted it as "start new test", resetting state and resulting in 0-valued result stats.
- Implemented guard state:
  - Added `resultsPendingOpen` boolean in typing state.
  - Set to `true` whenever completion queues `showResults` (timed and non-timed paths).
  - Cleared in `showResults(...)` and in `init(...)`.
  - In global keydown handler: if `resultsPendingOpen && e.key === ' '`, consume event and do nothing.
- Behavior after fix:
  - Space pressed during the completion -> results transition no longer starts a new test.
  - Space still starts a new test normally when results overlay is already open.

### Validation
- `index.html` parse smoke check passed.
- Playwright targeted repro:
  - deterministic short test completed
  - immediate post-completion `Space` no longer reset run
  - results overlay opened with non-zero metrics from completed run
- Playwright behavior check:
  - pressing `Space` after results are open still starts a fresh test as intended.
- Ran `develop-web-game` client loop and inspected screenshots in `output/web-game-space-fix/`.

## Update 20: Profile `Lifetime Stats` button + dedicated stats modal
- Added a new `Lifetime Stats` button to the profile modal header actions.
- Added a new modal:
  - `#lifetime-stats-modal`
  - opens from profile via `openLifetimeStatsModal()`
  - closes via close button, backdrop, and `Esc`
- Added lifetime stats renderer:
  - `renderLifetimeStatsModal()`
  - shows all-time totals for Tests, Words Typed, Time Typed, Best WPM, Bible Tests, Level, Current Streak, Challenges, Achievements, Avg Words/Test.

### Data model improvements for true lifetime tracking
- Added persistent lifetime counters (localStorage + progress sync):
  - `sampire-lifetime-tests-completed`
  - `sampire-lifetime-words-typed`
  - `sampire-lifetime-time-seconds`
  - `sampire-lifetime-best-wpm`
  - `sampire-lifetime-bible-tests-completed`
- Added helpers:
  - `getHistoryDerivedLifetimeStats()`
  - `getLifetimeStatsSummary()`
  - `recordLifetimeRunStats(...)`
  - `formatLifetimeDuration(...)`
- Wired run completion to update lifetime counters in `showResults()`.
- Added the lifetime counter keys to sync and critical storage handling.
- Added merge-preserve behavior for new lifetime keys in `mergeProgressSnapshotsForSameOwner()`.

### Related correction
- Updated `getBibleModeTestCount()` to use lifetime summary counters.
  - This fixes long-run unlock viability for `The Human Lectionary` (100 Bible mode tests), which was previously constrained by capped local history.

### Validation
- `index.html` script parse smoke check passed.
- Targeted Playwright checks:
  - signup -> profile -> click `Lifetime Stats` opens modal successfully
  - modal content renders populated totals
  - `Esc` closes lifetime stats modal
  - lifetime summary increments after completed test
- Ran `develop-web-game` client loop and inspected screenshots in `output/web-game-lifetime-stats/`.

## Update 21: Shop-gated keyboard sound packs + inline typing preview
- Added keyboard sound packs (excluding NK Creams) to the shop at `1 SP` each:
  - Cherry MX Blues (`cherrymx-blue-abs`)
  - Buckling Springs (`Buckling Springs`)
  - Cherry MX Blacks (`Cherry MX Blacks`)
  - Cherry MX Browns (`Cherry MX Browns`)
  - Cherry MX Reds (`Cherry MX Reds`)
- Added a new shop section `Keyboard Sound Packs` in `renderSkillsModal()` with one card per pack.
- Each pack card now includes a `Preview` typing field:
  - users can type directly in the small input box and hear that pack without equipping it.
  - wired via `handleShopKeySoundPreviewKeydown(event, packName)`.

### Unlock / gating behavior
- Added purchasable unlock flow `unlockShopKeySoundPack(packName)`:
  - costs `1 SP`, deducts points, stores unlock in skills state, refreshes shop/menu UI.
- Key sound menu now enforces locked state:
  - locked packs are disabled and shown as locked until purchased.
  - selecting a locked pack shows a message and does nothing.
- NK Creams remains default and always unlocked.

### Data model + sync updates
- Extended `sampire-skills` state with `keySoundPacks` unlock map.
- Updated `getSkillsState()`/`saveSkillsState()` to persist pack unlocks.
- Updated progress merge logic so cloud/local sync preserves key-sound-pack unlocks (`mergeProgressSnapshotsForSameOwner`).

### Audio preview plumbing
- Added pack-specific preview playback path:
  - `getKeySoundBaseForPack(packName)`
  - `loadKeySoundPackConfigByName(packName)` with cache
  - `resolveConfigBasedKeySoundSpecForPack(...)`
  - `playKeypressSoundForPack(...)`
- Preview playback supports both config modes (`multi` and `single`) and uses existing audio pool logic.

### Bugfix discovered during validation
- Fixed boot-time skill cache regression where `getSkillsState()` could cache fallback data before `SKILLS_KEY` const initialization path.
- `getSkillsState()`/`saveSkillsState()` now use literal storage key `'sampire-skills'`, preventing transient false-lock states after reload.

### Validation
- `index.html` parse smoke test passed.
- Targeted Playwright checks:
  - packs are locked/disabled in key-sound menu before purchase
  - buying a pack consumes exactly `1 SP`
  - preview typing field triggers key sound pool activity (sound path exercised)
  - unlocked pack remains unlocked after reload and can be selected from key-sound menu
  - no JS runtime exceptions in targeted flow
- Ran `develop-web-game` client loop and inspected screenshots in `output/web-game-shop-keypacks/`.

## Update 22: Shop visual redesign (game-card style)
- Restyled shop item cards to a bold arcade/mobile-game look inspired by provided reference:
  - stronger panel framing and depth
  - bright orange title plates
  - high-contrast cost chips and accent pricing
  - larger, punchier buy buttons
  - stronger hover lift/shadow treatment
- Updated supporting controls in cards:
  - preview input fields and notes now match the new game-card visual language
  - locked key-sound menu options keep clear visual lock state
- Kept existing behavior/functionality intact while only changing visual treatment.

### Visual validation
- Captured dedicated shop preview screenshot:
  - `output/shop-style-preview.png`
- Ran `develop-web-game` client loop and inspected screenshots in:
  - `output/web-game-shop-style/`
