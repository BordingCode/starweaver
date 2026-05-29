import { WORLD_W, WORLD_H } from '../engine/canvas.js';
import { TAU } from '../engine/vec.js';
import { FX, drawFX } from '../engine/fx.js';
import { SPELLS, AFFIXES } from './content.js';

// Parallax starfield + nebula (built once; render-time randomness is fine).
const LAYERS = [
  { n: 50, speed: 14, size: 1.0, color: 'rgba(150,170,255,0.5)' },
  { n: 36, speed: 30, size: 1.6, color: 'rgba(200,220,255,0.7)' },
  { n: 18, speed: 60, size: 2.4, color: 'rgba(255,255,255,0.9)' },
];
const stars = LAYERS.map((l) => Array.from({ length: l.n }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H })));

// ease-out-back: overshoots then settles — a satisfying spawn pop (Swink/Eiserloh)
function easeOutBack(t) { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

export function drawWorld(ctx, w, view, alpha) {
  // Background is drawn stable (no shake) and covers every pixel, so we don't
  // need a separate full-screen clear. Only the foreground shakes.
  drawBackground(ctx, w);
  if (!w) { drawFlash(ctx, view); return; }

  ctx.save();
  ctx.translate(FX.shakeX, FX.shakeY);

  drawEnemyBullets(ctx, w);
  drawEnemies(ctx, w);
  drawBoss(ctx, w);
  drawPlayerBullets(ctx, w);
  drawPickups(ctx, w);
  drawOrbits(ctx, w);
  drawPlayer(ctx, w);

  drawFX(ctx);

  ctx.restore();
  drawVignette(ctx, w);
  drawFlash(ctx, view);
}

let vignetteGrad = null;
function drawVignette(ctx, w) {
  // subtle constant edge darkening for focus, plus a red danger pulse at low HP
  if (!vignetteGrad) {
    vignetteGrad = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.35, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.72);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
  }
  ctx.fillStyle = vignetteGrad; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  if (!w || w.over) return;
  const frac = w.player.hp / w.player.maxHp;
  if (frac < 0.35) {
    const pulse = 0.18 + Math.sin(performance.now() / 180) * 0.1;
    const a = (0.35 - frac) / 0.35 * pulse;
    const rg = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.25, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.7);
    rg.addColorStop(0, 'rgba(255,40,70,0)');
    rg.addColorStop(1, `rgba(255,40,70,${a})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}

// Each sector gets its own nebula palette so it reads as a distinct place.
const SECTOR_NEBULA = {
  1: ['rgba(40,28,90,0.55)', 'rgba(18,12,46,0.5)', 'rgba(5,3,15,0.2)'],   // The Weave — violet
  2: ['rgba(22,34,84,0.55)', 'rgba(9,16,44,0.5)', 'rgba(4,6,16,0.2)'],    // The Hollows — cold indigo
  3: ['rgba(74,52,26,0.52)', 'rgba(34,24,34,0.5)', 'rgba(8,5,13,0.22)'],  // The Glare — warm exposure
};
let nebulaGrad = null, nebulaKey = null;
function drawBackground(ctx, w) {
  const t = w ? w.bgShift : performance.now() / 60;
  const sector = (w && w.waves && w.waves[w.wave] && w.waves[w.wave].sector) || 1;
  const key = SECTOR_NEBULA[sector] ? sector : 1;
  // nebula glow — rebuild only when the sector (palette) changes
  if (!nebulaGrad || nebulaKey !== key) {
    nebulaKey = key;
    const cols = SECTOR_NEBULA[key];
    nebulaGrad = ctx.createRadialGradient(WORLD_W * 0.5, WORLD_H * 0.25, 40, WORLD_W * 0.5, WORLD_H * 0.3, WORLD_H * 0.8);
    nebulaGrad.addColorStop(0, cols[0]);
    nebulaGrad.addColorStop(0.5, cols[1]);
    nebulaGrad.addColorStop(1, cols[2]);
  }
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < LAYERS.length; i++) {
    const l = LAYERS[i]; const arr = stars[i];
    ctx.fillStyle = l.color;
    for (const s of arr) {
      const y = (s.y + t * l.speed) % WORLD_H;
      ctx.beginPath(); ctx.arc(s.x, y, l.size, 0, TAU); ctx.fill();
    }
  }
}

function drawPlayer(ctx, w) {
  const p = w.player;
  if (w.over && !w.won) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // "guns ready" pulse — a soft ring when firing re-engages after moving (teaches the core rule)
  if (p.readyPulse > 0 && !p.moving) {
    const k = p.readyPulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * k;
    ctx.strokeStyle = '#aef6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 5 + (1 - k) * 20, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const inv = p.iframes > 0;
  const blink = inv && Math.floor(performance.now() / 60) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.translate(0, p.recoil); // gun kickback nudges the hull back

  // engine trail
  if (!p.moving) {
    ctx.globalCompositeOperation = 'lighter';
    const fl = 8 + Math.sin(performance.now() / 50) * 3;
    const grad = ctx.createLinearGradient(0, 10, 0, 10 + fl + 14);
    grad.addColorStop(0, 'rgba(52,245,255,0.9)'); grad.addColorStop(1, 'rgba(52,245,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 24 + fl); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ship body (arrow/delta)
  const body = p.flash > 0 ? '#ffffff' : '#dff6ff';
  ctx.shadowColor = '#34f5ff'; ctx.shadowBlur = 16;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -p.r - 4);
  ctx.lineTo(p.r, p.r);
  ctx.lineTo(0, p.r * 0.5);
  ctx.lineTo(-p.r, p.r);
  ctx.closePath(); ctx.fill();
  // cockpit
  ctx.shadowBlur = 0;
  ctx.fillStyle = p.moving ? '#ffd166' : '#9d6bff';
  ctx.beginPath(); ctx.arc(0, -2, 4.5, 0, TAU); ctx.fill();

  // shield ring
  if (p.shield > 0) {
    ctx.globalAlpha = 0.5 * (p.shield / Math.max(1, p.maxShield)) + 0.2;
    ctx.strokeStyle = '#34f5ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 9, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawPickups(ctx, w) {
  if (!w.pickups) return;
  w.pickups.forEach((o) => {
    const col = o.kind === 'shield' ? '#34f5ff' : '#5dffb0';
    const blink = o.life < 2 && Math.floor(performance.now() / 120) % 2 === 0;
    const yy = o.y + Math.sin(o.bob) * 2;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    ctx.globalAlpha = (blink ? 0.4 : 1) * 0.3; ctx.beginPath(); ctx.arc(o.x, yy, o.r * 1.9, 0, TAU); ctx.fill();
    ctx.globalAlpha = blink ? 0.4 : 1; ctx.beginPath(); ctx.arc(o.x, yy, o.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // glyph
    ctx.fillStyle = '#05030f'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#05030f';
    if (o.kind === 'shield') {
      ctx.beginPath(); ctx.arc(o.x, yy, o.r * 0.5, 0, TAU); ctx.stroke();
    } else { // plus
      ctx.fillRect(o.x - 1.6, yy - o.r * 0.5, 3.2, o.r); ctx.fillRect(o.x - o.r * 0.5, yy - 1.6, o.r, 3.2);
    }
    ctx.restore();
  });
}

function drawOrbits(ctx, w) {
  const p = w.player;
  if (p.orbits <= 0) return;
  const R = 52;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.orbits; i++) {
    const a = p.orbitAngle + (i / p.orbits) * TAU;
    const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
    ctx.fillStyle = '#34f5ff';
    ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(ox, oy, 12, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a + p.orbitAngle * 2);
    ctx.fillRect(-3, -10, 6, 20);
    ctx.restore();
  }
  ctx.restore();
}

function drawPlayerBullets(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  w.pBullets.forEach((b) => {
    // tint by the shot's element so your build is visible in your own fire (Brotato-style "distinct feel")
    let col = '#aef6ff';
    if (b.burn > 0) col = '#ff9f43'; else if (b.freeze > 0) col = '#7fe9ff'; else if (b.chain > 0) col = '#c79dff';
    if (b.meteor) col = '#ff9f43';
    if (b.crit) col = '#ffd166';
    ctx.fillStyle = col;
    // streak + halo (additive) then bright core — no shadowBlur
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, b.r * 1.1, b.r * 2.4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemyBullets(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  w.eBullets.forEach((b) => {
    ctx.fillStyle = b.color;
    if (b.mine) {
      // pulsing proximity orb with a ring
      const pulse = 1 + Math.sin(performance.now() / 120) * 0.15;
      ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2 * pulse, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * pulse, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#eaffd6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.5 * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.35, 0, TAU); ctx.fill();
      return;
    }
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill();   // halo
    ctx.globalAlpha = b.holdT > 0 ? 0.7 : 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemies(ctx, w) {
  w.enemies.forEach((e) => {
    if (e.isBoss) return;
    const st = e.spawnAnim > 0 ? 1 - e.spawnAnim / 0.35 : 1;
    const s = e.spawnAnim > 0 ? (FX.reducedMotion ? st : easeOutBack(st)) : 1;
    const punch = e.flash > 0 ? 1 + Math.min(e.flash, 1) * 0.14 : 1; // Vlambeer hit-punch (scale pop)
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(s * punch, s * punch);
    const col = e.flash > 0 ? '#ffffff' : e.def.color;
    // cheap additive halo instead of shadowBlur
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28; ctx.fillStyle = e.def.color;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = col;
    drawEnemyShape(ctx, e);
    // frozen tint
    if (e.frozen > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#aef0ff'; drawEnemyShape(ctx, e); ctx.globalAlpha = 1; }
    // shield bracket
    if (e.shield) { ctx.strokeStyle = '#5dffb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -e.r - 3, e.r * 0.8, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke(); }
    // champion affix rings — one tinted halo+ring per affix so threats read at a glance
    if (e.affixes && e.affixes.length) {
      const spin = FX.reducedMotion ? 0 : performance.now() / 600;
      for (let i = 0; i < e.affixes.length; i++) {
        const a = AFFIXES[e.affixes[i]]; if (!a) continue;
        const rr = e.r + 5 + i * 4.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22; ctx.fillStyle = a.tint;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = a.tint; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.9;
        ctx.setLineDash([rr * 0.5, rr * 0.32]); ctx.lineDashOffset = spin * (i % 2 ? -14 : 14);
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    // hp pip for tanky enemies
    if (e.maxHp > 8 && e.hp < e.maxHp) {
      const wd = e.r * 1.8; const hpf = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - wd / 2, e.y - e.r - 12, wd, 4);
      ctx.fillStyle = '#5dffb0'; ctx.fillRect(e.x - wd / 2, e.y - e.r - 12, wd * hpf, 4);
    }
    // Warden beam telegraph: a charging line + reticle at the locked spot
    if (e.def.shoot === 'beam' && e.teleP > 0) {
      const k = e.teleP;
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.55;
      ctx.strokeStyle = '#ff8ad8'; ctx.lineWidth = 1 + k * 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.lockX, e.lockY); ctx.stroke();
      const rr = 26 - k * 16;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.lockX, e.lockY, Math.max(6, rr), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.lockX - rr, e.lockY); ctx.lineTo(e.lockX + rr, e.lockY);
      ctx.moveTo(e.lockX, e.lockY - rr); ctx.lineTo(e.lockX, e.lockY + rr); ctx.stroke();
      ctx.restore();
    }
    // Pulsar pulse telegraph: a ring that closes in as the beat charges (reduced-motion safe — no flash)
    if (e.def.shoot === 'pulse' && e.teleP > 0) {
      const k = e.teleP;
      ctx.save();
      ctx.globalAlpha = 0.2 + k * 0.5;
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1 + k * 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + (1 - k) * 46, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  });
}

function drawEnemyShape(ctx, e) {
  const r = e.r;
  const t = e.type;
  ctx.beginPath();
  if (t === 'diver') { // dart pointing down
    ctx.moveTo(0, r); ctx.lineTo(r * 0.7, -r * 0.6); ctx.lineTo(0, -r * 0.2); ctx.lineTo(-r * 0.7, -r * 0.6); ctx.closePath();
  } else if (t === 'bomber') { // hexagon
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const fn = i ? 'lineTo' : 'moveTo'; ctx[fn](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
  } else if (t === 'shielded') { // rounded square
    ctx.roundRect ? ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 6) : ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  } else if (t === 'weaver') { // diamond
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath();
  } else if (t === 'splitter' || t === 'mini') { // blob circle with bumps
    ctx.arc(0, 0, r * 0.85, 0, TAU);
  } else if (t === 'warden') { // sentinel — vertical eye lozenge
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.85, 0, 0, r); ctx.quadraticCurveTo(-r * 0.85, 0, 0, -r); ctx.closePath();
  } else if (t === 'seeder') { // pod — octagon
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; const fn = i ? 'lineTo' : 'moveTo'; ctx[fn](Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); } ctx.closePath();
  } else { // grunt/drone — invader-ish capsule
    ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.4, -r); ctx.lineTo(r * 0.4, -r); ctx.lineTo(r, -r * 0.3);
    ctx.lineTo(r * 0.6, r * 0.7); ctx.lineTo(-r * 0.6, r * 0.7); ctx.closePath();
  }
  ctx.fill();
  // eye
  ctx.save(); ctx.fillStyle = 'rgba(5,3,15,0.8)';
  ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.28, 0, TAU); ctx.fill(); ctx.restore();
}

function drawBoss(ctx, w) {
  const e = w.boss;
  if (!e || !e.alive) return;
  const warden = e.bossId === 'warden';
  const chrono = e.bossId === 'chrono';
  const main = warden ? '#6b6bff' : chrono ? '#ffd14d' : '#ff4d9d';
  const haloRGB = warden ? '107,107,255' : chrono ? '255,209,77' : '255,77,157';
  const s = e.spawnAnim > 0 ? 0.6 + 0.4 * (1 - e.spawnAnim / 1.2) : 1;
  const punch = e.flash > 0 ? 1 + Math.min(e.flash, 1) * 0.05 : 1; // subtle hit-punch (boss is big)
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(s * punch, s * punch);
  // outer halo
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, e.r * 1.6);
  g.addColorStop(0, `rgba(${haloRGB},0.5)`); g.addColorStop(1, `rgba(${haloRGB},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, e.r * 1.6, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = e.flash > 0 ? '#fff' : main;
  ctx.shadowColor = main; ctx.shadowBlur = 18;
  if (warden) {
    // heavy fractured crown — 6 broad obsidian shards, slow
    for (let i = 0; i < 6; i++) {
      const a = e.spin + i / 6 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.r * 0.7, Math.sin(a) * e.r * 0.7);
      ctx.lineTo(Math.cos(a + 0.32) * e.r * 1.25, Math.sin(a + 0.32) * e.r * 1.25);
      ctx.lineTo(Math.cos(a - 0.32) * e.r * 1.25, Math.sin(a - 0.32) * e.r * 1.25);
      ctx.closePath(); ctx.fill();
    }
  } else if (chrono) {
    // clockwork cog: 12 short teeth around the rim + two ticking clock hands
    for (let i = 0; i < 12; i++) {
      const a = e.spin + i / 12 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.10) * e.r, Math.sin(a - 0.10) * e.r);
      ctx.lineTo(Math.cos(a - 0.07) * e.r * 1.18, Math.sin(a - 0.07) * e.r * 1.18);
      ctx.lineTo(Math.cos(a + 0.07) * e.r * 1.18, Math.sin(a + 0.07) * e.r * 1.18);
      ctx.lineTo(Math.cos(a + 0.10) * e.r, Math.sin(a + 0.10) * e.r);
      ctx.closePath(); ctx.fill();
    }
    // clock hands in a bright contrasting tone so the clockwork reads clearly
    ctx.save();
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#fff4c8';
    const hand = (ang, len, wdt) => { ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(wdt, -wdt); ctx.lineTo(wdt, 0); ctx.lineTo(-wdt, 0); ctx.lineTo(-wdt, -wdt); ctx.closePath(); ctx.fill(); ctx.restore(); };
    hand(e.spin * 3, e.r * 1.35, 4);    // long minute hand
    hand(e.spin * 1.1, e.r * 0.85, 6);  // short hour hand
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); // center hub
    ctx.restore();
  } else {
    // rotating crown of blades
    for (let i = 0; i < 8; i++) {
      const a = e.spin + i / 8 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      ctx.lineTo(Math.cos(a + 0.18) * e.r * 0.6, Math.sin(a + 0.18) * e.r * 0.6);
      ctx.lineTo(Math.cos(a) * e.r * 1.4, Math.sin(a) * e.r * 1.4);
      ctx.closePath(); ctx.fill();
    }
  }
  // core
  ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#05030f'; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.4, 0, TAU); ctx.fill();
  // charging core telegraph: grows + brightens just before an attack
  const tele = e.tele || 0;
  const coreR = e.r * (0.22 + tele * 0.22);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = tele > 0.5 ? '#fff' : (warden ? '#9fb0ff' : chrono ? '#ffe14d' : e.phase === 2 ? '#ffd166' : '#34f5ff');
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8 + tele * 22;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.restore();
  // boss hp bar at top
  const bw = WORLD_W - 80, bx = 40, by = 70;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 9);
  ctx.fillStyle = main; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 9);
  ctx.fillStyle = '#eaf2ff'; ctx.font = "700 12px Orbitron, sans-serif"; ctx.textAlign = 'center';
  ctx.fillText(e.def.name, WORLD_W / 2, by - 6);
}

function drawFlash(ctx, view) {
  if (FX.flash <= 0.001) return;
  ctx.save();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = `rgba(${FX.flashColor},${FX.flash})`;
  ctx.fillRect(0, 0, view.cssW, view.cssH);
  ctx.restore();
}
