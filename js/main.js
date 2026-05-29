import { Game, saveMeta, syncDebug } from './state.js';
import { CanvasView } from './engine/canvas.js';
import { GameLoop } from './engine/loop.js';
import { Input } from './engine/input.js';
import { FX, updateFX, clearFX } from './engine/fx.js';
import { World } from './game/world.js';
import { drawWorld } from './game/render.js';
import { UPGRADES, SPELLS, RARITY_WEIGHT } from './game/content.js';
import { initAudio, resumeAudio, setMuted, isMuted, sfx, startMusic, stopMusic, setMusicIntensity } from './audio.js';
import { iconSVG } from './icons.js';

const canvas = document.getElementById('game');
const app = document.getElementById('app');
const view = new CanvasView(canvas);
const input = new Input(canvas, view);
window.addEventListener('resize', () => view.resize());

FX.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loop = new GameLoop({
  update: (dt) => { if (Game.world && Game.screen === 'playing') { Game.world.update(dt, input); syncDebug(); } updateFX(dt); },
  render: (alpha) => { view.begin(); drawWorld(view.ctx, Game.world, view, alpha); if (Game.world && Game.screen === 'playing') drawHUD(); },
});

// ---------------- DOM helpers ----------------
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
function clearApp() { app.replaceChildren(); }

// ---------------- HUD ----------------
let hud = null, hpFill = null, shFill = null, scoreEl = null, comboEl = null, waveEl = null, dock = null, spellBtns = [], muteBtn = null, pauseBtn = null, toastEl = null;
function buildHUD() {
  removeHUD();
  hud = el('div', 'hud');
  const top = el('div', 'hud-top');
  const hpWrap = el('div', 'hp-wrap');
  const bar = el('div', 'hp-bar');
  hpFill = el('div', 'hp-fill');
  shFill = el('div', 'shield-fill'); shFill.style.position = 'absolute'; shFill.style.top = '0'; shFill.style.left = '0';
  bar.style.position = 'relative'; bar.append(hpFill);
  hpWrap.append(bar);
  waveEl = el('div', 'hud-wave', '');
  top.append(hpWrap, waveEl);
  scoreEl = el('div', 'hud-score', '0');
  comboEl = el('div', 'hud-combo', '');
  hud.append(top, scoreEl, comboEl);
  document.body.append(hud);

  toastEl = el('div', 'toast');
  document.body.append(toastEl);

  muteBtn = el('button', 'mute-btn', isMuted() ? '🔇' : '🔊');
  muteBtn.addEventListener('click', () => { muteBtn.textContent = setMuted(!isMuted()) ? '🔇' : '🔊'; Game.meta.muted = isMuted(); saveMeta(); });
  document.body.append(muteBtn);

  pauseBtn = el('button', 'mute-btn pause-btn', '❚❚');
  pauseBtn.addEventListener('click', () => pauseGame());
  document.body.append(pauseBtn);

  // spell dock
  dock = el('div', 'spell-dock'); spellBtns = [];
  const p = Game.world.player;
  p.spells.forEach((id, slot) => {
    const def = SPELLS[id];
    const b = el('button', 'spell-btn' + (def.dash ? ' dash' : ''), `<div class="cd"></div>${iconSVG(id) || `<span>${def.icon}</span>`}<span class="spell-key">${def.key}</span>`);
    const cast = (ev) => { ev.preventDefault(); if (Game.screen !== 'playing') return; resumeAudio(); Game.world.castSpell(slot); };
    b.addEventListener('pointerdown', cast, { passive: false });
    dock.append(b); spellBtns.push(b);
  });
  document.body.append(dock);
}
function removeHUD() { [hud, dock, muteBtn, pauseBtn, toastEl].forEach((n) => n && n.remove()); hud = dock = muteBtn = pauseBtn = toastEl = null; spellBtns = []; }

function pauseGame() {
  if (Game.screen !== 'playing') return;
  Game.screen = 'paused';
  const s = el('div', 'screen');
  s.append(el('div', 'title-tag', 'paused'));
  s.append(el('div', 'pick-title', 'STARWEAVER'));
  const resume = el('button', 'btn', '▶ Resume');
  resume.addEventListener('click', () => { app.replaceChildren(); Game.screen = 'playing'; });
  const quit = el('button', 'btn ghost', 'Abandon Run');
  quit.addEventListener('click', () => { stopMusic(); removeHUD(); showTitle(); });
  const row = el('div', 'row'); row.append(resume, quit);
  s.append(row);
  app.append(s);
}

function drawHUD() {
  const w = Game.world, p = w.player;
  const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
  hpFill.style.width = hpPct + '%';
  hpFill.classList.toggle('low', hpPct < 35);
  scoreEl.textContent = String(w.score);
  if (w.combo >= 2) { comboEl.classList.add('on'); comboEl.textContent = `COMBO ×${w.combo}  ·  ${w.mult.toFixed(1)}×`; }
  else comboEl.classList.remove('on');
  const def = w.waves[w.wave];
  waveEl.textContent = def ? def.label : '';
  // spell cooldown rings
  p.spells.forEach((id, slot) => {
    const sdef = SPELLS[id];
    const cd = p.spellCd[slot];
    const total = sdef.cd * p.spellCdMult;
    const frac = cd > 0 ? cd / total : 0;
    const b = spellBtns[slot];
    if (!b) return;
    b.querySelector('.cd').style.setProperty('--cd', (frac * 360) + 'deg');
    b.classList.toggle('ready', cd <= 0);
  });
}

function toast(text) { if (!toastEl) return; toastEl.textContent = text; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }

// ---------------- Run flow ----------------
function startRun() {
  resumeAudio(); startMusic();
  clearFX();
  Game.world = new World();
  Game.world.onWaveClear = onWaveClear;
  Game.world.onGameOver = onGameOver;
  Game.world.startWave(0);
  Game.meta.runs++; saveMeta();
  Game.screen = 'playing';
  clearApp();
  buildHUD();
  loop.start();
  toast(Game.world.waves[0].label);
  if (Game.meta.runs <= 1) {
    setTimeout(() => { if (Game.screen === 'playing') toast('DRAG TO MOVE'); }, 1900);
    setTimeout(() => { if (Game.screen === 'playing') toast('STOP TO FIRE'); }, 3700);
  }
  syncDebug();
}

function onWaveClear() {
  Game.screen = 'upgrade';
  setMusicIntensity(0.2);
  showUpgrade();
}

function resumeAfterUpgrade() {
  const w = Game.world;
  const next = w.wave + 1;
  Game.screen = 'playing';
  clearApp();
  setMusicIntensity(Math.min(1, next / 8));
  w.startWave(next);
  const def = w.waves[next];
  if (def) toast(def.boss ? 'BOSS' : def.elite ? 'ELITE WAVE' : def.label);
}

function resumeEndless() {
  const w = Game.world;
  w.endless = true; w.over = false; w.won = false;
  Game.screen = 'playing';
  clearApp();
  buildHUD();
  resumeAudio(); startMusic(); setMusicIntensity(1);
  w.startWave(w.wave + 1);
  const def = w.waves[w.wave];
  toast(def && def.boss ? 'BOSS' : (def ? def.label : 'ENDLESS'));
  loop.start();
  syncDebug();
}

function onGameOver(won) {
  Game.screen = 'gameover';
  loop.stop();
  setTimeout(() => loop.start(), 0); // keep rendering FX/background behind overlay
  stopMusic();
  const w = Game.world;
  if (w.score > Game.meta.best) Game.meta.best = w.score;
  if (won) Game.meta.wins++;
  saveMeta();
  removeHUD();
  showGameOver(won);
  syncDebug();
}

// ---------------- Screens ----------------
function showTitle() {
  Game.screen = 'title';
  loop.start(); // render starfield behind
  clearApp();
  const s = el('div', 'screen');
  s.append(
    el('div', 'title-logo', 'STAR<br>WEAVER'),
    el('div', 'title-tag', 'weave · dodge · break the swarm'),
  );
  const play = el('button', 'btn', '▶ Play');
  play.addEventListener('click', () => { resumeAudio(); startRun(); });
  s.append(play);
  if (Game.meta.best > 0) s.append(el('div', 'stat-line', `Best run: ${Game.meta.best}`));
  s.append(el('div', 'hint', 'Drag to fly — your ship floats above your finger. You only <b>shoot while still</b>, so dodge, then stand and unload. Tap the orbs to <b>Blink</b> and cast arcana. Clear a wave, pick a power, repeat.'));
  clearApp(); app.append(s);
  syncDebug();
}

function weightedPick(rng = Math.random) {
  const w = Game.world;
  const counts = w.upCounts || (w.upCounts = {});
  // build candidate pool (respect max), plus possible new-spell offers
  const pool = UPGRADES.filter((u) => (counts[u.id] || 0) < u.max);
  const chosen = [];
  // chance to offer a new spell if a slot is free
  const p = w.player;
  const unequipped = Object.keys(SPELLS).filter((id) => !SPELLS[id].dash && !p.spells.includes(id));
  if (p.spells.length < 3 && unequipped.length && rng() < 0.5) {
    const id = unequipped[Math.floor(rng() * unequipped.length)];
    chosen.push({ spell: id, id: 'spell_' + id, name: 'Learn ' + SPELLS[id].name, icon: SPELLS[id].icon, rarity: 'epic', desc: SPELLS[id].desc + ' (new arcana)' });
  }
  const bag = pool.slice();
  while (chosen.length < 3 && bag.length) {
    let total = 0; for (const u of bag) total += RARITY_WEIGHT[u.rarity] || 50;
    let r = rng() * total, idx = 0;
    for (let i = 0; i < bag.length; i++) { r -= RARITY_WEIGHT[bag[i].rarity] || 50; if (r <= 0) { idx = i; break; } }
    chosen.push(bag.splice(idx, 1)[0]);
  }
  return chosen;
}

function showUpgrade() {
  sfx.levelup();
  clearApp();
  const w = Game.world;
  const s = el('div', 'screen');
  s.append(el('div', 'pick-title', `Wave Cleared — Choose a Power`));
  const cards = el('div', 'cards');
  const picks = weightedPick();
  picks.forEach((u) => {
    const c = el('div', `card rar-${u.rarity}`);
    const iconKey = u.spell || u.id;
    c.append(
      el('div', 'card-icon', iconSVG(iconKey) || u.icon),
      (() => { const b = el('div', 'card-body'); b.append(el('div', 'card-name', u.name), el('div', 'card-desc', u.desc)); return b; })(),
      el('div', 'card-tag', u.rarity),
    );
    c.addEventListener('click', () => {
      resumeAudio(); sfx.pickup();
      if (u.spell) { w.player.spells.push(u.spell); w.player.spellCd.push(0); }
      else { w.applyUpgrade(u); w.upCounts[u.id] = (w.upCounts[u.id] || 0) + 1; }
      buildHUD();
      resumeAfterUpgrade();
    });
    cards.append(c);
  });
  s.append(cards);
  // show current loadout chips
  const lo = el('div', 'loadout');
  const counts = w.upCounts || {};
  Object.keys(counts).forEach((id) => { const u = UPGRADES.find((x) => x.id === id); if (u) lo.append(el('div', 'chip', `${iconSVG(id)}<span>${u.name}${counts[id] > 1 ? ' ×' + counts[id] : ''}</span>`)); });
  if (lo.children.length) s.append(lo);
  app.append(s);
  syncDebug();
}

function showGameOver(won) {
  clearApp();
  const w = Game.world;
  const s = el('div', 'screen');
  s.append(el('div', `dead-title ${won ? 'win' : 'lose'}`, won ? 'SWARM BROKEN' : 'SHIP LOST'));
  s.append(el('div', 'stat-line', won ? 'You shattered the Weaver Queen.' : `You fell on ${w.waves[w.wave] ? w.waves[w.wave].label : 'the swarm'}.`));
  s.append(el('div', 'stat-big', String(w.score)));
  s.append(el('div', 'stat-line', `Best: ${Game.meta.best}`));
  if (won) {
    const cont = el('button', 'btn', '▸ Endless');
    cont.addEventListener('click', () => resumeEndless());
    s.append(cont);
    s.append(el('div', 'hint', 'The swarm regroups, endlessly. Keep your build and chase a high score.'));
  }
  const again = el('button', 'btn' + (won ? ' ghost' : ''), '↻ Play Again');
  again.addEventListener('click', () => { resumeAudio(); startRun(); });
  const menu = el('button', 'btn ghost', 'Menu');
  menu.addEventListener('click', () => { stopMusic(); showTitle(); });
  const row = el('div', 'row'); row.append(again, menu);
  s.append(row);
  app.append(s);
}

// ---------------- Boot ----------------
function boot() {
  if (Game.meta.muted) setMuted(true);
  initAudio();
  const splash = document.getElementById('splash');
  setTimeout(() => { splash && splash.classList.add('hide'); setTimeout(() => splash && splash.remove(), 600); }, 500);
  showTitle();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}
boot();

// expose for debugging/tests
window.__startRun = startRun;
window.Game = Game;
window.__view = view;
window.__toScreen = (x, y) => ({ x: view.offX + x * view.scale, y: view.offY + y * view.scale });
window.pauseGame = pauseGame;
