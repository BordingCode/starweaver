# Starweaver

A roguelite bullet-hell spell-shooter for mobile. **Space Invaders** backbone × **Archero**
run-structure × **Wizard of Legend** spell-weaving.

- **Drag to fly** — your ship floats above your finger so you can always see it.
- **You only shoot while standing still** — so dodge, then plant and unload.
- **Weave arcana** — Blink (dash with i-frames), Arc Nova, Chain Bolt, Starfall.
- **Clear a wave → pick a power.** Stack synergies (multishot, pierce, ricochet, homing,
  burn/freeze/chain, orbiting blades, crit, lifesteal…) into a build, then face the boss.

Vanilla HTML/CSS/JS canvas, no build step, installable PWA. Portrait, phone-first.

## Run locally
```
python3 -m http.server 8123
# open http://localhost:8123
```

## Structure
- `js/engine/` — fixed-timestep loop, DPR canvas, input, object pool, particle/FX, vec math
- `js/game/` — `world.js` (simulation), `render.js` (drawing), `content.js` (data), `player.js`
- `js/main.js` — boot, screen router, HUD, run flow
- `js/audio.js` — procedural Web Audio (no files)

Built by Claude with Mathias.
