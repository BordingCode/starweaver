# Starweaver — project guide for Claude

A vanilla **ES-module** PWA: a **roguelite bullet-hell spell-shooter** (Space Invaders ×
Archero × Wizard of Legend) rendered to `<canvas>`. No build step. Repo:
`BordingCode/starweaver` (branch **master**), GitHub Pages (`bordingcode.github.io/starweaver`).

## Before working
Read the shared game-dev knowledge base: **`~/cc/gamedev-kb/INDEX.md`** (lowercase `cc`).
Especially `patterns/canvas-engine-games.md`, `patterns/game-loop-and-timing.md`,
`patterns/mobile-ios-safari.md`, and `checklists/new-canvas-game.md` + `ship-checklist.md`.

## Deploy convention — every change MUST
- **Bump the SW `CACHE` string** in `sw.js` (e.g. `starweaver-v49`→`v50`) and add any new
  file to the `SHELL` array. **No `?v=` query scheme here** — the cache bump is the only
  busting mechanism, so it is mandatory on any css/js edit or stale code is served.
- Be **committed and pushed** to `master`.

## Test hooks (in `js/main.js`)
- `window.Game` — the live game object/state.
- `window.__startRun` — start a run programmatically.
- `window.__gameState`, `window.__errors` (assert empty), `window.__view`,
  `window.__toScreen`, `window.__haptics`.
Verify in a real browser (local `python3 -m http.server` + Playwright): drive a run via the
hooks, assert on `window.__gameState`, gate on `window.__errors` being empty. No test/ dir.

## Notes
- Phone-first: pointer input, safe areas, audio unlocked on first gesture.
