import { Game, saveMeta, syncDebug } from './state.js';
import { CanvasView } from './engine/canvas.js';
import { GameLoop } from './engine/loop.js';
import { Input } from './engine/input.js';
import { FX, updateFX, clearFX } from './engine/fx.js';
import { World } from './game/world.js';
import { drawWorld } from './game/render.js';
import { UPGRADES, SPELLS, RARITY_WEIGHT, PACTS, ENEMIES, AFFIXES } from './game/content.js';
import { initAudio, resumeAudio, setMuted, isMuted, sfx, startMusic, stopMusic, setMusicIntensity, setSfx, setBossMusic } from './audio.js';
import { iconSVG, cardIcon } from './icons.js';
import { SHOP, costOf, dustEarned, applyMeta } from './game/meta.js';

const canvas = document.getElementById('game');
const app = document.getElementById('app');
const view = new CanvasView(canvas);
const input = new Input(canvas, view);
window.addEventListener('resize', () => view.resize());

FX.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let bossMusicOn = false;
const loop = new GameLoop({
  update: (dt) => {
    if (Game.world && Game.screen === 'playing') {
      Game.world.update(dt, input); syncDebug();
      const boss = !!Game.world.boss;
      if (boss !== bossMusicOn) { bossMusicOn = boss; setBossMusic(boss); } // adaptive boss layer
    }
    updateFX(dt);
  },
  render: (alpha) => { view.begin(); drawWorld(view.ctx, Game.world, view, alpha); if (Game.world && Game.screen === 'playing') drawHUD(); },
});

// ---------------- DOM helpers ----------------
const SECTOR_NAMES = { 1: 'THE WEAVE', 2: 'THE HOLLOWS', 3: 'THE GLARE' };
const BOSS_NAMES = { queen: 'THE WEAVER QUEEN', warden: 'THE GRAVE WARDEN', chrono: 'THE CHRONOMETH' };
let bossBannerEl = null;
function bossBanner(name) {
  if (bossBannerEl) bossBannerEl.remove();
  const b = el('div', 'boss-banner show', `<div class="bb-warn">${iconSVG('warn')}<span>WARNING</span>${iconSVG('warn')}</div><div class="bb-name">${name || 'BOSS'}</div>`);
  document.body.append(b); bossBannerEl = b;
  setTimeout(() => { if (b.isConnected) { b.classList.add('out'); setTimeout(() => b.remove(), 520); } }, 1600);
}
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

  muteBtn = el('button', 'mute-btn', iconSVG(isMuted() ? 'muted' : 'sound'));
  muteBtn.addEventListener('click', () => { const m = setMuted(!isMuted()); muteBtn.innerHTML = iconSVG(m ? 'muted' : 'sound'); Game.meta.muted = isMuted(); saveMeta(); });
  document.body.append(muteBtn);

  pauseBtn = el('button', 'mute-btn pause-btn', iconSVG('pause'));
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
  s.append(el('div', 'stat-line', `Wave ${Game.world.wave + 1}  ·  Score ${Game.world.score}`));
  // current build — upgrade chips + any pacts forged
  const w = Game.world;
  const lo = el('div', 'loadout');
  const counts = w.upCounts || {};
  Object.keys(counts).forEach((id) => { const u = UPGRADES.find((x) => x.id === id); if (u) lo.append(el('div', 'chip', `${cardIcon(u)}<span>${u.name}${counts[id] > 1 ? ' ×' + counts[id] : ''}</span>`)); });
  (w.pacts || []).forEach((id) => { const pc = PACTS.find((x) => x.id === id); if (pc) lo.append(el('div', 'chip pact-chip', `${iconSVG(pc.icon)}<span>${pc.name.replace('Pact of ', '')}</span>`)); });
  if (lo.children.length) s.append(lo);
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
  resumeAudio(); if (Game.meta.settings.music !== false) startMusic();
  bossMusicOn = false; setBossMusic(false);
  clearFX();
  Game.world = new World();
  Game.world.player.spells = ['dash', Game.meta.loadout || 'nova'];
  Game.world.player.spellCd = [0, 0];
  const grants = applyMeta(Game.world.player, Game.meta.upg || {});
  Game.world.rerolls = grants.rerolls; Game.world.maxRerolls = grants.rerolls;
  Game.world.revives = grants.revives; Game.world.luck = grants.luck;
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
    setTimeout(() => { if (Game.screen === 'playing') toast('DRAG TO STEER'); }, 1900);
    setTimeout(() => { if (Game.screen === 'playing') toast('RELEASE TO FIRE'); }, 3700);
  }
  syncDebug();
}

function onWaveClear() {
  setMusicIntensity(0.2);
  const w = Game.world;
  const cleared = w.waves[w.wave];
  if (cleared && cleared.elite) { Game.screen = 'upgrade'; showPacts(); return; }
  // Only offer an upgrade if you've banked a level-up from kills (XP curve). Otherwise
  // carry straight on — so power growth is earned, not one-free-per-wave.
  if (w.pendingPicks > 0) { Game.screen = 'upgrade'; showUpgrade(); return; }
  resumeAfterUpgrade();
}

function resumeAfterUpgrade() {
  const w = Game.world;
  const next = w.wave + 1;
  Game.screen = 'playing';
  clearApp();
  setMusicIntensity(Math.min(1, next / 8));
  w.startWave(next);
  const def = w.waves[next];
  // sector banner when crossing into a new sector
  const prev = w.waves[w.wave];
  if (def && def.sector && (!prev || prev.sector !== def.sector) && SECTOR_NAMES[def.sector]) {
    toast(`SECTOR ${def.sector} · ${SECTOR_NAMES[def.sector]}`);
    setTimeout(() => { if (Game.screen === 'playing') toast(def.boss ? 'BOSS' : def.elite ? 'ELITE · CHAMPIONS' : def.label); }, 1900);
  } else if (def && def.boss) bossBanner(BOSS_NAMES[def.bossId] || 'BOSS');
  else if (def) toast(def.elite ? 'ELITE · CHAMPIONS' : def.label);
  // first-ever champion wave: explain the rings so a new player can read the threat
  if (def && def.elite && !Game.meta.seenChampions) {
    Game.meta.seenChampions = true; saveMeta();
    setTimeout(() => { if (Game.screen === 'playing') toast('RINGED FOES ARE CHAMPIONS — DEADLIER, RICHER LOOT'); }, 2000);
  }
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
  const earned = Math.round(dustEarned(w.score, w.wave, won, Game.meta.upg || {}) * (w.dustMult || 1));
  Game.meta.dust = (Game.meta.dust || 0) + earned;
  w.dustEarned = earned;
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
  s.append(el('div', 'dust-line', `${iconSVG('spellpow')}<span>${Game.meta.dust || 0} Stardust</span>`));
  s.append(loadoutPicker());
  const play = el('button', 'btn', '▶ Play');
  play.addEventListener('click', () => { resumeAudio(); startRun(); });
  s.append(play);
  const row = el('div', 'row');
  const hangar = el('button', 'btn ghost', 'Hangar');
  hangar.addEventListener('click', () => { resumeAudio(); showHangar(); });
  const guideBtn = el('button', 'btn ghost', 'Field Guide');
  guideBtn.addEventListener('click', () => { resumeAudio(); showGuide(); });
  const setBtn = el('button', 'btn ghost', 'Settings');
  setBtn.addEventListener('click', () => { resumeAudio(); showSettings(); });
  row.append(hangar, guideBtn, setBtn);
  s.append(row);
  if (Game.meta.best > 0) s.append(el('div', 'stat-line', `Best run: ${Game.meta.best}`));
  s.append(el('div', 'hint', 'Drag from anywhere to steer — the further you drag, the faster you fly; <b>release to stop and fire</b>. So weave through bullets, then plant and unload. Tap the orbs to <b>Blink</b> (a safe dash) and cast arcana. Kill foes to <b>level up</b> and pick powers.'));
  clearApp(); app.append(s);
  syncDebug();
}

// Starting-arcana picker: choose which secondary spell you begin every run with.
function loadoutPicker() {
  const wrap = el('div', 'arcana-pick');
  wrap.append(el('div', 'arcana-label', 'Starting Arcana'));
  const opts = el('div', 'arcana-opts');
  const desc = el('div', 'arcana-desc', '');
  const ids = ['nova', 'chain', 'storm'];
  if (!ids.includes(Game.meta.loadout)) Game.meta.loadout = 'nova';
  const btns = {};
  const select = (id) => {
    Game.meta.loadout = id; saveMeta();
    ids.forEach((k) => btns[k].classList.toggle('sel', k === id));
    desc.textContent = SPELLS[id].desc;
  };
  ids.forEach((id) => {
    const def = SPELLS[id];
    const o = el('div', 'arcana-opt', `${iconSVG(id) || `<span>${def.icon}</span>`}<span class="a-name">${def.name}</span>`);
    o.addEventListener('click', () => { resumeAudio(); sfx.pickup(); select(id); });
    btns[id] = o; opts.append(o);
  });
  wrap.append(opts, desc);
  select(Game.meta.loadout);
  return wrap;
}

// Field Guide / codex — teaches the (now deep) cast of enemies, champions, arcana & pacts.
const GUIDE_ENEMY_TIPS = {
  grunt: 'Basic drifter. The bones of the swarm.',
  drone: 'Fires quick double shots.',
  weaver: 'Snakes side to side — hard to pin down.',
  bomber: 'Slow tank that lobs a 3-way spread.',
  shielded: 'Bulwark — shrugs off half your bullet damage.',
  diver: 'Lancer — locks on and dives. Kill it or sidestep.',
  splitter: 'Spore — bursts into two Sporelings on death.',
  mini: 'Sporeling — a fast little fragment.',
  warden: 'Anchors high, then fires where you stood. Don\'t camp.',
  seeder: 'Drops proximity mines that bloom into rings.',
  pulsar: 'Charges on a beat, then a slow ring — fire in the gap after.',
  strobe: 'Fast strafer raking spread shots; keeps you moving.',
};
const GUIDE_AFFIX_TIPS = {
  armored: 'Takes 45% less damage.',
  swift: 'Moves and fires noticeably faster.',
  volatile: 'Bursts into a ring of bullets on death.',
  vampiric: 'Slowly heals its own wounds.',
  warding: 'Has a chance to nullify your shots.',
  splitting: 'Spawns Sporelings when it dies.',
};
function guideRow(swatchColor, name, tip, shape) {
  const r = el('div', 'guide-row');
  const sw = el('span', 'guide-swatch' + (shape ? ' ' + shape : ''));
  sw.style.setProperty('--sw', swatchColor);
  r.append(sw, (() => { const b = el('div', 'guide-text'); b.append(el('div', 'guide-name', name), el('div', 'guide-tip', tip)); return b; })());
  return r;
}
function showGuide() {
  Game.screen = 'guide';
  clearApp();
  const s = el('div', 'screen guide');
  s.append(el('div', 'pick-title', 'Field Guide'));
  const scroll = el('div', 'guide-scroll');
  // Enemies
  scroll.append(el('div', 'guide-head', 'Swarm'));
  Object.keys(GUIDE_ENEMY_TIPS).forEach((id) => { const e = ENEMIES[id]; if (e) scroll.append(guideRow(e.color, e.name, GUIDE_ENEMY_TIPS[id], 'dot')); });
  // Champions / affixes
  scroll.append(el('div', 'guide-head', 'Champions — ringed elites'));
  scroll.append(el('div', 'guide-note', 'Elite waves and deep runs upgrade foes with these traits. Deadlier, but they drop more.'));
  Object.keys(AFFIXES).forEach((id) => { const a = AFFIXES[id]; scroll.append(guideRow(a.tint, a.name, GUIDE_AFFIX_TIPS[id] || '', 'ring')); });
  // Arcana
  scroll.append(el('div', 'guide-head', 'Arcana'));
  ['dash', 'nova', 'chain', 'storm'].forEach((id) => { const sp = SPELLS[id]; if (sp) { const r = el('div', 'guide-row'); r.append(el('span', 'guide-swatch ic-wrap', iconSVG(id) || ''), (() => { const b = el('div', 'guide-text'); b.append(el('div', 'guide-name', sp.name), el('div', 'guide-tip', sp.desc)); return b; })()); scroll.append(r); } });
  // Pacts
  scroll.append(el('div', 'guide-head', 'Pacts — the Elite gamble'));
  PACTS.forEach((p) => { const r = el('div', 'guide-row'); r.append(el('span', 'guide-swatch ic-wrap', iconSVG(p.icon) || ''), (() => { const b = el('div', 'guide-text'); b.append(el('div', 'guide-name', p.name), el('div', 'guide-tip', `<span class="g-boon">${p.boon}</span> <span class="g-curse">${p.curse}</span>`)); return b; })()); scroll.append(r); });
  s.append(scroll);
  const back = el('button', 'btn', '◂ Back');
  back.addEventListener('click', () => showTitle());
  s.append(back);
  app.append(s);
  syncDebug();
}

function showHangar() {
  Game.screen = 'hangar';
  clearApp();
  const s = el('div', 'screen hangar');
  s.append(el('div', 'pick-title', 'Hangar — Permanent Upgrades'));
  const dustEl = el('div', 'dust-line', `${iconSVG('spellpow')}<span>${Game.meta.dust || 0} Stardust</span>`);
  s.append(dustEl);
  const list = el('div', 'shop');
  const render = () => {
    list.replaceChildren();
    dustEl.innerHTML = `${iconSVG('spellpow')}<span>${Game.meta.dust || 0} Stardust</span>`;
    SHOP.forEach((item) => {
      const lvl = (Game.meta.upg && Game.meta.upg[item.id]) || 0;
      const maxed = lvl >= item.max;
      const cost = costOf(item, lvl);
      const afford = (Game.meta.dust || 0) >= cost;
      const c = el('div', `card shop-card${maxed ? ' maxed' : afford ? '' : ' poor'}`);
      c.append(
        el('div', 'card-icon', iconSVG(item.icon)),
        (() => { const b = el('div', 'card-body');
          b.append(el('div', 'card-name', item.name), el('div', 'card-desc', item.desc(Math.min(lvl + 1, item.max))));
          const pips = el('div', 'pips'); for (let i = 0; i < item.max; i++) pips.append(el('span', 'pip' + (i < lvl ? ' on' : ''))); b.append(pips);
          return b; })(),
        el('div', 'shop-cost', maxed ? 'MAX' : `${iconSVG('spellpow')}${cost}`),
      );
      if (!maxed) c.addEventListener('click', () => {
        const lv = (Game.meta.upg[item.id]) || 0; const cst = costOf(item, lv);
        if ((Game.meta.dust || 0) < cst) { sfx.hit(); return; }
        Game.meta.dust -= cst; Game.meta.upg[item.id] = lv + 1; saveMeta(); sfx.pickup(); render();
      });
      list.append(c);
    });
  };
  render();
  s.append(list);
  const back = el('button', 'btn', '◂ Back');
  back.addEventListener('click', () => showTitle());
  s.append(back);
  app.append(s);
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
  // luck shifts weight toward rare/epic
  const luck = w.luck || 0;
  const rw = { common: RARITY_WEIGHT.common, rare: RARITY_WEIGHT.rare * (1 + 0.25 * luck), epic: RARITY_WEIGHT.epic * (1 + 0.35 * luck) };
  const bag = pool.slice();
  while (chosen.length < 3 && bag.length) {
    let total = 0; for (const u of bag) total += rw[u.rarity] || 50;
    let r = rng() * total, idx = 0;
    for (let i = 0; i < bag.length; i++) { r -= rw[bag[i].rarity] || 50; if (r <= 0) { idx = i; break; } }
    chosen.push(bag.splice(idx, 1)[0]);
  }
  return chosen;
}

// Elite reward: gamble a curse for a boon, or hold steady for a normal pick.
function showPacts() {
  sfx.levelup();
  clearApp();
  const w = Game.world;
  const s = el('div', 'screen');
  s.append(el('div', 'title-tag danger', 'the swarm grows restless'));
  s.append(el('div', 'pick-title', 'Forge a Pact'));
  const cards = el('div', 'cards');
  // offer 2 distinct random pacts not already taken (fall back to any if exhausted)
  let avail = PACTS.filter((p) => !w.pacts.includes(p.id));
  if (avail.length < 2) avail = PACTS.slice();
  const picks = avail.slice();
  for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  picks.slice(0, 2).forEach((pact) => {
    const c = el('div', 'card pact-card');
    c.append(
      el('div', 'card-icon', iconSVG(pact.icon) || '✦'),
      (() => { const b = el('div', 'card-body');
        b.append(
          el('div', 'card-name', pact.name),
          el('div', 'pact-boon', `${iconSVG('spellpow') || ''}<span>${pact.boon}</span>`),
          el('div', 'pact-curse', `${iconSVG('critdmg') || ''}<span>${pact.curse}</span>`),
        );
        return b; })(),
    );
    c.addEventListener('click', () => {
      resumeAudio(); sfx.pact();
      w._pactGrant = null;
      pact.apply(w); w.pacts.push(pact.id);
      buildHUD();
      const extra = w._pactGrant ? `  ·  ${w._pactGrant}` : '';
      toast(`PACT SEALED${extra}`);
      resumeAfterUpgrade();
    });
    cards.append(c);
  });
  s.append(cards);
  const decline = el('button', 'btn ghost', 'Hold Steady — take a power instead');
  decline.addEventListener('click', () => { resumeAudio(); sfx.dash(); showUpgrade(); });
  s.append(decline);
  app.append(s);
  syncDebug();
}

function showUpgrade() {
  sfx.levelup();
  clearApp();
  const w = Game.world;
  const s = el('div', 'screen');
  s.append(el('div', 'pick-title', `Level ${w.level} — Choose a Power`));
  const cards = el('div', 'cards');
  const picks = weightedPick();
  picks.forEach((u) => {
    const c = el('div', `card rar-${u.rarity}`);
    c.append(
      el('div', 'card-icon', cardIcon(u)),
      (() => { const b = el('div', 'card-body'); b.append(el('div', 'card-name', u.name), el('div', 'card-desc', u.desc)); return b; })(),
      el('div', 'card-tag', u.rarity),
    );
    c.addEventListener('click', () => {
      resumeAudio(); sfx.pickup();
      if (u.spell) { w.player.spells.push(u.spell); w.player.spellCd.push(0); }
      else { w.applyUpgrade(u); w.upCounts[u.id] = (w.upCounts[u.id] || 0) + 1; }
      w.pendingPicks = Math.max(0, w.pendingPicks - 1); // consumed one banked level-up
      buildHUD();
      resumeAfterUpgrade();
    });
    cards.append(c);
  });
  s.append(cards);
  // reroll button (uses run rerolls from the Recalibrator meta upgrade)
  if (w.rerolls > 0) {
    const rr = el('button', 'btn ghost reroll-btn', `${iconSVG('ricochet')}<span>Reroll (${w.rerolls})</span>`);
    rr.addEventListener('click', () => { if (w.rerolls <= 0) return; w.rerolls--; resumeAudio(); sfx.dash(); showUpgrade(); });
    s.append(rr);
  }
  // show current loadout chips
  const lo = el('div', 'loadout');
  const counts = w.upCounts || {};
  Object.keys(counts).forEach((id) => { const u = UPGRADES.find((x) => x.id === id); if (u) lo.append(el('div', 'chip', `${cardIcon(u)}<span>${u.name}${counts[id] > 1 ? ' ×' + counts[id] : ''}</span>`)); });
  if (lo.children.length) s.append(lo);
  app.append(s);
  syncDebug();
}

function applySettings() {
  const st = Game.meta.settings;
  setSfx(st.sfx !== false);
  FX.reducedMotion = st.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('reduce-motion', FX.reducedMotion); // gate CSS animations too
  window.__haptics = st.haptics !== false;
}

function showSettings() {
  Game.screen = 'settings';
  clearApp();
  const st = Game.meta.settings;
  const s = el('div', 'screen');
  s.append(el('div', 'pick-title', 'Settings'));
  const mk = (label, key) => {
    const row = el('div', 'toggle-row');
    const on = st[key] !== false;
    row.append(el('span', 'toggle-label', label));
    const sw = el('button', 'switch' + (on ? ' on' : ''), '<span class="knob"></span>');
    sw.addEventListener('click', () => {
      st[key] = !(st[key] !== false); sw.classList.toggle('on', st[key]);
      saveMeta(); applySettings();
      if (key === 'music') { if (st.music) { resumeAudio(); startMusic(); } else stopMusic(); }
      sfx.pickup();
    });
    row.append(sw); return row;
  };
  s.append(mk('Music', 'music'), mk('Sound effects', 'sfx'), mk('Vibration', 'haptics'), mk('Reduce motion', 'reduceMotion'));
  s.append(el('div', 'hint', 'Reduce motion turns off screen-shake and flashing for comfort.'));
  const back = el('button', 'btn', '◂ Back');
  back.addEventListener('click', () => showTitle());
  s.append(back);
  app.append(s);
  syncDebug();
}

function showGameOver(won) {
  clearApp();
  const w = Game.world;
  const s = el('div', 'screen');
  s.append(el('div', `dead-title ${won ? 'win' : 'lose'}`, won ? 'SWARM BROKEN' : 'SHIP LOST'));
  s.append(el('div', 'stat-line', won ? 'You unwound the Chronometh and broke the Glare.' : `You fell on ${w.waves[w.wave] ? w.waves[w.wave].label : 'the swarm'}.`));
  s.append(el('div', 'stat-big', String(w.score)));
  s.append(el('div', 'stat-line', `Best: ${Game.meta.best}`));
  s.append(el('div', 'dust-line earned', `${iconSVG('spellpow')}<span>+${w.dustEarned || 0} Stardust  ·  ${Game.meta.dust || 0} total</span>`));
  // pacts forged this run — gives the run a little story
  if (w.pacts && w.pacts.length) {
    const lo = el('div', 'loadout');
    w.pacts.forEach((id) => { const p = PACTS.find((x) => x.id === id); if (p) lo.append(el('div', 'chip', `${iconSVG(p.icon)}<span>${p.name.replace('Pact of ', '')}</span>`)); });
    s.append(el('div', 'stat-line', 'Pacts forged'), lo);
  }
  if (won) {
    const cont = el('button', 'btn', '▸ Endless');
    cont.addEventListener('click', () => resumeEndless());
    s.append(cont);
    s.append(el('div', 'hint', 'The swarm regroups, endlessly. Keep your build and chase a high score.'));
  }
  const again = el('button', 'btn' + (won ? ' ghost' : ''), '↻ Play Again');
  again.addEventListener('click', () => { resumeAudio(); startRun(); });
  const hangar = el('button', 'btn ghost', 'Hangar');
  hangar.addEventListener('click', () => { stopMusic(); showHangar(); });
  const menu = el('button', 'btn ghost', 'Menu');
  menu.addEventListener('click', () => { stopMusic(); showTitle(); });
  const row = el('div', 'row'); row.append(again, hangar, menu);
  s.append(row);
  app.append(s);
}

// ---------------- Boot ----------------
function boot() {
  if (Game.meta.muted) setMuted(true);
  initAudio();
  applySettings();
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
