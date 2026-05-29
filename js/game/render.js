import { WORLD_W, WORLD_H } from '../engine/canvas.js';
import { TAU } from '../engine/vec.js';
import { FX, drawFX } from '../engine/fx.js';
import { SPELLS } from './content.js';

// Parallax starfield + nebula (built once; render-time randomness is fine).
const LAYERS = [
  { n: 50, speed: 14, size: 1.0, color: 'rgba(150,170,255,0.5)' },
  { n: 36, speed: 30, size: 1.6, color: 'rgba(200,220,255,0.7)' },
  { n: 18, speed: 60, size: 2.4, color: 'rgba(255,255,255,0.9)' },
];
const stars = LAYERS.map((l) => Array.from({ length: l.n }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H })));

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

let nebulaGrad = null;
function drawBackground(ctx, w) {
  const t = w ? w.bgShift : performance.now() / 60;
  // nebula glow (gradient is fixed -> build once and reuse)
  if (!nebulaGrad) {
    nebulaGrad = ctx.createRadialGradient(WORLD_W * 0.5, WORLD_H * 0.25, 40, WORLD_W * 0.5, WORLD_H * 0.3, WORLD_H * 0.8);
    nebulaGrad.addColorStop(0, 'rgba(40,28,90,0.55)');
    nebulaGrad.addColorStop(0.5, 'rgba(18,12,46,0.5)');
    nebulaGrad.addColorStop(1, 'rgba(5,3,15,0.2)');
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
  const inv = p.iframes > 0;
  const blink = inv && Math.floor(performance.now() / 60) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;

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
    ctx.fillStyle = b.meteor ? '#ff9f43' : (b.crit ? '#ffd166' : '#aef6ff');
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
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill();   // halo
    ctx.globalAlpha = 1;
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
    const s = e.spawnAnim > 0 ? 1 - e.spawnAnim / 0.35 : 1;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(s, s);
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
    ctx.restore();
    // hp pip for tanky enemies
    if (e.maxHp > 8 && e.hp < e.maxHp) {
      const wd = e.r * 1.8; const hpf = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - wd / 2, e.y - e.r - 12, wd, 4);
      ctx.fillStyle = '#5dffb0'; ctx.fillRect(e.x - wd / 2, e.y - e.r - 12, wd * hpf, 4);
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
  const s = e.spawnAnim > 0 ? 0.6 + 0.4 * (1 - e.spawnAnim / 1.2) : 1;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(s, s);
  // outer halo
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, e.r * 1.6);
  g.addColorStop(0, 'rgba(255,77,157,0.5)'); g.addColorStop(1, 'rgba(255,77,157,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, e.r * 1.6, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // rotating crown of blades
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#ff4d9d';
  ctx.shadowColor = '#ff4d9d'; ctx.shadowBlur = 18;
  for (let i = 0; i < 8; i++) {
    const a = e.spin + i / 8 * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
    ctx.lineTo(Math.cos(a + 0.18) * e.r * 0.6, Math.sin(a + 0.18) * e.r * 0.6);
    ctx.lineTo(Math.cos(a) * e.r * 1.4, Math.sin(a) * e.r * 1.4);
    ctx.closePath(); ctx.fill();
  }
  // core
  ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#05030f'; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.4, 0, TAU); ctx.fill();
  // charging core telegraph: grows + brightens just before an attack
  const tele = e.tele || 0;
  const coreR = e.r * (0.22 + tele * 0.22);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = tele > 0.5 ? '#fff' : (e.phase === 2 ? '#ffd166' : '#34f5ff');
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8 + tele * 22;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.restore();
  // boss hp bar at top
  const bw = WORLD_W - 80, bx = 40, by = 70;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 9);
  ctx.fillStyle = '#ff4d9d'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 9);
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
