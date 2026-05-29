import { WORLD_W, WORLD_H } from '../engine/canvas.js';
import { Pool } from '../engine/pool.js';
import { TAU, clamp, dist, dist2, angle, hit } from '../engine/vec.js';
import { FX, burst, shockwave, floatText, addTrauma, hitStop, screenFlash } from '../engine/fx.js';
import { sfx } from '../audio.js';
import { ENEMIES, SPELLS, buildWaves } from './content.js';
import { makePlayer } from './player.js';

const MOVE_DEADZONE = 1.6;   // world units of pointer move below which we count as "still"
const MOVE_HOLD = 0.07;      // seconds the pointer must settle before guns re-engage (jitter guard)
const FIRE_OFFSET_Y = 64;    // ship floats this far above the finger

export class World {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.player = makePlayer();
    this.enemies = new Pool(() => ({}), (o) => resetEnemy(o));
    this.pBullets = new Pool(() => ({ hitSet: new Set() }), (o) => { o.hitSet.clear(); });
    this.eBullets = new Pool(() => ({}), (o) => {});
    this.pickups = new Pool(() => ({}), (o) => {});
    this.waves = buildWaves();
    this.wave = 0;
    this.score = 0;
    this.combo = 0; this.comboT = 0; this.mult = 1;
    this.state = 'fighting';   // fighting | cleared | dead | won
    this.over = false; this.won = false;
    this.spawnQueue = [];
    this.formPhase = 0; this.formDir = 1;
    this.waveClearT = 0;
    this.boss = null;
    this.endless = false;
    this.rerolls = 0; this.revives = 0; this.luck = 0;
    this.time = 0;
    this.shotsToCredit = 0;
    this.targetX = this.player.x; this.targetY = this.player.y;
    this.onWaveClear = null;   // set by main: callback to open upgrade screen
    this.onGameOver = null;
    this.bgShift = 0;
  }

  // -------- wave lifecycle --------
  startWave(i) {
    this.wave = i;
    this.state = 'fighting';
    this.over = false;
    this.spawnQueue.length = 0;
    if (i >= this.waves.length) this.waves[i] = this.genWave(i); // endless: procedural
    const def = this.waves[i];
    if (!def) { this.win(); return; }
    this.player.invuln = Math.max(this.player.invuln, i === 0 ? 1.4 : 0.7); // grace as a wave begins
    if (def.boss) { this.spawnBoss(def.bossId || 'queen'); return; }
    let order = 0;
    for (const g of def.groups) {
      const pts = layout(g, this.rng);
      for (let k = 0; k < pts.length; k++) {
        const d = (g.formation === 'stream') ? (g.delay || 1) * k : 0;
        this.spawnQueue.push({ type: g.type, x: pts[k].x, y: pts[k].y, baseX: pts[k].x, baseY: pts[k].y, mode: pts[k].mode, t: d + order * 0.04 });
        order++;
      }
    }
    this.elite = !!def.elite;
  }

  // Procedural escalating wave for endless mode (wave index >= scripted length).
  genWave(i) {
    const n = i - this.waves.length + 1;          // endless wave number (1+)
    if (n % 5 === 0) { const k = n / 5; return { label: 'BOSS ' + (2 + k), boss: true, bossId: k % 2 ? 'warden' : 'queen', groups: [] }; }
    const pool = ['grunt', 'drone', 'weaver', 'bomber', 'shielded', 'splitter', 'diver', 'warden', 'seeder'];
    const forms = { grunt: 'grid', drone: 'grid', weaver: 'arc', bomber: 'sides', shielded: 'arc', splitter: 'grid', diver: 'stream', warden: 'arc', seeder: 'sides' };
    const groups = [];
    const picks = 2 + (n % 3 === 0 ? 1 : 0);
    for (let k = 0; k < picks; k++) {
      const type = pool[Math.floor(this.rng() * pool.length)];
      const heavy = type === 'shielded' || type === 'bomber' || type === 'warden' || type === 'seeder';
      const count = heavy ? 2 + Math.floor(n / 5) : 4 + Math.floor(n / 2);
      groups.push({ type, count: Math.min(heavy ? 5 : 12, count), formation: forms[type], delay: 0.9 });
    }
    return { label: 'WAVE ' + (this.waves.length - 1 + n), groups, endlessWave: true };
  }

  spawnEnemy(type, x, y, baseX, baseY, mode) {
    const def = ENEMIES[type];
    if (!def) return; // safety: ignore unknown types rather than crash
    const hpScale = 1 + this.wave * 0.12;
    this.enemies.spawn((e) => {
      e.type = type; e.def = def;
      e.x = x; e.y = y - 40; e.baseX = baseX; e.baseY = baseY;
      e.r = def.r; e.maxHp = Math.round(def.hp * hpScale); e.hp = e.maxHp;
      e.score = def.score; e.contact = def.contact || 8;
      e.mode = mode || 'formation';
      e.sinePhase = this.rng() * TAU;
      e.fireT = def.fireEvery ? def.fireEvery[0] + this.rng() * (def.fireEvery[1] - def.fireEvery[0]) : 999;
      e.spawnAnim = 0.35;
      e.diveT = 0.5 + this.rng() * 1.5;
      e.locked = false; e.lvx = 0; e.lvy = 0;
      e.frozen = 0; e.burnT = 0; e.burnDmg = 0; e.flash = 0;
      e.shield = def.shield ? 1 : 0;
      e.isBoss = false; e.descend = def.slow ? 7 : 11;
    });
  }

  spawnBoss(bossId = 'queen') {
    sfx.bossWarn();
    this.state = 'fighting';
    const warden = bossId === 'warden';
    const hp = (warden ? 1100 : 900) + this.wave * 30;
    this.boss = this.enemies.spawn((e) => {
      e.type = 'boss'; e.bossId = bossId;
      e.def = warden
        ? { name: 'THE GRAVE WARDEN', color: '#6b6bff', contact: 22 }
        : { name: 'THE WEAVER QUEEN', color: '#ff4d9d', contact: 22 };
      e.x = WORLD_W / 2; e.y = -120; e.baseX = WORLD_W / 2; e.baseY = 170;
      e.r = warden ? 64 : 60; e.maxHp = hp; e.hp = hp; e.score = 1000; e.contact = 22;
      e.mode = 'boss'; e.isBoss = true; e.flash = 0; e.frozen = 0; e.burnT = 0; e.burnDmg = 0;
      e.spawnAnim = 1.2; e.phase = 0; e.atkT = 2.4; e.atkMode = 0; e.spin = 0; e.dir = 1; e.shield = 0; e.tele = 0; e.pullT = 0;
    });
  }

  win() { this.state = 'won'; this.over = true; this.won = true; sfx.win(); if (this.onGameOver) this.onGameOver(true); }
  die() {
    if (this.over) return;
    const p = this.player;
    // Phoenix Core: revive once per run
    if (this.revives > 0) {
      this.revives -= 1;
      p.hp = Math.round(p.maxHp * 0.5); p.invuln = 2.0; p.shield = p.maxShield;
      this.eBullets.clear();
      sfx.levelup(); FX.trauma = 0.6; screenFlash(0.5, '93,255,176');
      shockwave(p.x, p.y, { color: '#5dffb0', max: 260, dur: 0.6, width: 6 });
      burst(p.x, p.y, 40, { color: '#5dffb0', speed: 280, life: 0.8, r: 3 });
      floatText(p.x, p.y - 30, 'REVIVED', { color: '#5dffb0', size: 22, crit: true });
      return;
    }
    this.state = 'dead'; this.over = true; this.won = false;
    sfx.explode(true); sfx.lose();
    FX.trauma = 1; hitStop(0.12); screenFlash(0.6, '255,84,112');
    burst(p.x, p.y, 70, { color: '#aef6ff', speed: 360, life: 1.0, r: 4 });
    burst(p.x, p.y, 40, { color: '#ff5470', speed: 240, life: 0.8, r: 3 });
    shockwave(p.x, p.y, { color: '#fff', max: 220, dur: 0.7, width: 6 });
    if (navigator.vibrate && window.__haptics !== false) navigator.vibrate([60, 40, 80]);
    if (this.onGameOver) this.onGameOver(false);
  }

  // -------- main step --------
  update(dt, input) {
    if (this.over) { return; }
    if (FX.freeze > 0) { FX.freeze -= dt; if (FX.freeze > 0) return; }
    this.time += dt; this.bgShift += dt * 14;

    // combo decay
    if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.mult = 1; } }

    this.stepPlayer(dt, input);
    this.stepSpawns(dt);
    this.stepEnemies(dt);
    this.stepPlayerBullets(dt);
    this.stepEnemyBullets(dt);
    this.stepOrbits(dt);
    this.stepPickups(dt);

    // wave clear check
    if (this.state === 'fighting' && this.spawnQueue.length === 0 && this.enemies.countAlive === 0 && this.time > 0.5) {
      this.state = 'cleared';
      this.waveClearT = 0.5;
    }
    if (this.state === 'cleared') {
      this.waveClearT -= dt;
      if (this.waveClearT <= 0) {
        const def = this.waves[this.wave];
        if (def && def.boss && !this.endless) { this.win(); }
        else if (this.onWaveClear) this.onWaveClear();
      }
    }
  }

  // -------- player --------
  stepPlayer(dt, input) {
    const p = this.player;
    p.flash = Math.max(0, p.flash - dt * 4);
    if (p.iframes > 0) p.iframes -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    // dash motion
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashVx * dt; p.y += p.dashVy * dt;
      if (Math.random() < 0.8) burst(p.x, p.y, 2, { color: '#ffd166', speed: 40, life: 0.3, r: 3 });
    }

    // drag-to-move: ship target is above the finger
    let moveMag = 0;
    if (input.active) {
      const tx = clamp(input.x, p.r, WORLD_W - p.r);
      const ty = clamp(input.y - FIRE_OFFSET_Y, 90, WORLD_H - 40);
      moveMag = input.consume();
      // remember target (drives dash direction)
      this.targetX = tx; this.targetY = ty;
      // smooth follow toward target (responsive but weighted)
      const speed = 18 * p.moveSpeed;
      p.x += (tx - p.x) * Math.min(1, dt * speed);
      p.y += (ty - p.y) * Math.min(1, dt * speed);
    } else {
      input.consume();
    }
    p.x = clamp(p.x, p.r, WORLD_W - p.r);
    p.y = clamp(p.y, 90, WORLD_H - 40);
    // settle timer: any real drag keeps guns off for a few frames, so finger jitter
    // doesn't flicker firing; releasing the finger re-engages guns immediately.
    if (input.active && moveMag > MOVE_DEADZONE) p.moveHold = MOVE_HOLD;
    else if (p.moveHold > 0) p.moveHold -= dt;
    p.moving = input.active && p.moveHold > 0 && p.dashT <= 0;

    // shield regen
    if (p.maxShield > 0) {
      p.shieldDelay -= dt;
      if (p.shieldDelay <= 0 && p.shield < p.maxShield) p.shield = Math.min(p.maxShield, p.shield + p.shieldRegen * dt);
    }

    // Momentum: standing still ramps damage up to +50% (resets the instant you move)
    if (p.momentum) {
      if (!p.moving && p.dashT <= 0) p.stillT += dt; else p.stillT = 0;
      p.damageMult = 1 + clamp((p.stillT - 0.4) / 1.6, 0, 1) * 0.5;
    }

    // FIRE ONLY WHEN STILL (the Archero tension). Dashing counts as moving.
    p.fireT -= dt;
    const canFire = !p.moving && p.dashT <= 0;
    if (canFire && p.fireT <= 0) {
      this.fire();
      p.fireT = 1 / p.fireRate;
      if (p.burstShots > 1) { p.pendingBursts = p.burstShots - 1; p.burstT = 0.07; }
    }
    // staggered extra volleys (Volley card) — fire even while moving so the burst completes
    if (p.pendingBursts > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0) { this.fire(true); p.pendingBursts -= 1; p.burstT = 0.07; }
    }

    // spell cooldowns
    for (let i = 0; i < p.spellCd.length; i++) if (p.spellCd[i] > 0) p.spellCd[i] -= dt;

    // orbit angle
    p.orbitAngle += dt * 2.6;
  }

  fire(quiet) {
    const p = this.player;
    if (!quiet) sfx.shoot();
    const dirs = [];
    const n = p.bulletCount;
    const spread = p.spread;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) * 2;
      dirs.push(-Math.PI / 2 + off); // up
    }
    if (p.rearShot) dirs.push(Math.PI / 2);
    if (p.sideShot) { dirs.push(0); dirs.push(Math.PI); }
    for (const a of dirs) this.spawnPBullet(p.x, p.y - p.r, a);
    burst(p.x, p.y - p.r - 4, 3, { color: '#34f5ff', speed: 60, dir: -Math.PI / 2, spread: 0.5, life: 0.18, r: 2 });
  }

  spawnPBullet(x, y, a) {
    const p = this.player;
    const isCrit = this.rng() < p.crit;
    const dmg = p.bulletDmg * (isCrit ? p.critMult : 1) * p.damageMult;
    this.pBullets.spawn((b) => {
      b.x = x; b.y = y;
      b.vx = Math.cos(a) * p.bulletSpeed; b.vy = Math.sin(a) * p.bulletSpeed;
      b.r = p.bulletSize; b.dmg = dmg; b.crit = isCrit;
      b.pierce = p.pierce; b.ricochet = p.ricochet; b.homing = p.homing;
      b.burn = p.burn; b.freeze = p.freeze; b.chain = p.chainOnHit;
      b.life = 2.4; b.hitSet.clear();
    });
  }

  // -------- spells --------
  castSpell(slot) {
    const p = this.player;
    const id = p.spells[slot];
    if (!id) return;
    const def = SPELLS[id];
    if (p.spellCd[slot] > 0) return;
    if (def.dash) { this.doDash(); }
    else if (def.cast) { def.cast(this); sfx.spell(slot); }
    p.spellCd[slot] = def.cd * p.spellCdMult;
  }

  doDash() {
    const p = this.player;
    sfx.dash();
    // dash toward where the finger is (the move target), else upward
    let ax = 0, ay = -1;
    const dx = this.targetX - p.x, dy = this.targetY - p.y;
    const m = Math.hypot(dx, dy);
    if (m > 8) { ax = dx / m; ay = dy / m; }
    const DASH = 1500;
    p.dashVx = ax * DASH; p.dashVy = ay * DASH * 0.7;
    p.dashT = 0.16; p.iframes = 0.34;
    shockwave(p.x, p.y, { color: '#ffd166', max: 50, dur: 0.35, width: 3 });
    addTrauma(0.12);
  }

  castNova() {
    const p = this.player;
    const radius = 200 * p.spellPower;
    const dmg = 26 * p.spellPower;
    shockwave(p.x, p.y, { color: '#9d6bff', max: radius, dur: 0.45, width: 6 });
    burst(p.x, p.y, 30, { color: '#9d6bff', speed: 300, life: 0.5, r: 3 });
    addTrauma(0.3); screenFlash(0.25, '157,107,255');
    this.enemies.forEach((e) => { if (dist(e.x, e.y, p.x, p.y) < radius + e.r) this.damageEnemy(e, dmg, p.x, p.y, true); });
    // clear nearby enemy bullets
    this.eBullets.forEach((b) => { if (dist(b.x, b.y, p.x, p.y) < radius) b.alive = false; });
  }

  castChain() {
    const p = this.player;
    const dmg = 30 * p.spellPower;
    let fromX = p.x, fromY = p.y - 10;
    const hitIds = new Set();
    let jumps = 6;
    while (jumps-- > 0) {
      let best = null, bestD = 1e9;
      this.enemies.forEach((e) => { if (hitIds.has(e) ) return; const d = dist2(fromX, fromY, e.x, e.y); if (d < bestD && d < 320 * 320) { bestD = d; best = e; } });
      if (!best) break;
      hitIds.add(best);
      this.lightning(fromX, fromY, best.x, best.y, '#34f5ff');
      this.damageEnemy(best, dmg, best.x, best.y, true);
      fromX = best.x; fromY = best.y;
    }
    addTrauma(0.18); screenFlash(0.18, '52,245,255');
  }

  castStorm() {
    const p = this.player;
    const dmg = 22 * p.spellPower;
    // queue 8 meteors that fall and explode on enemies
    const targets = [];
    this.enemies.forEach((e) => targets.push(e));
    for (let i = 0; i < 10; i++) {
      const tgt = targets.length ? targets[Math.floor(this.rng() * targets.length)] : null;
      const tx = tgt ? tgt.x + (this.rng() - 0.5) * 60 : this.rng() * WORLD_W;
      this.eBullets; // (no-op)
      this.pBullets.spawn((b) => {
        b.x = tx + (this.rng() - 0.5) * 30; b.y = -20 - i * 30;
        b.vx = 0; b.vy = 520; b.r = 9; b.dmg = dmg; b.crit = false;
        b.pierce = 99; b.ricochet = 0; b.homing = 0.3; b.burn = 1.5; b.freeze = 0; b.chain = 0;
        b.life = 3; b.meteor = true; b.hitSet.clear();
      });
    }
    addTrauma(0.2);
  }

  lightning(x1, y1, x2, y2, color) {
    // visual only: spawn particles along the segment
    const segs = 6;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = x1 + (x2 - x1) * t + (this.rng() - 0.5) * 18;
      const y = y1 + (y2 - y1) * t + (this.rng() - 0.5) * 18;
      burst(x, y, 2, { color, speed: 30, life: 0.25, r: 2.4 });
    }
    shockwave(x2, y2, { color, max: 36, dur: 0.3, width: 3 });
  }

  // -------- spawns --------
  stepSpawns(dt) {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.spawnEnemy(s.type, s.x, s.y, s.baseX, s.baseY, s.mode);
        this.spawnQueue.splice(i, 1);
      }
    }
  }

  // -------- enemies --------
  stepEnemies(dt) {
    this.formPhase += dt * 0.9;
    const p = this.player;
    this.enemies.forEach((e) => {
      if (!e.def) { e.alive = false; return; } // safety: never step a half-built enemy
      if (e.spawnAnim > 0) e.spawnAnim -= dt;
      if (e.flash > 0) e.flash -= dt * 5;
      // burn DoT
      if (e.burnT > 0) {
        e.burnT -= dt; e.hp -= e.burnDmg * dt;
        if (Math.random() < 0.3) burst(e.x, e.y, 1, { color: '#ff9f43', speed: 30, life: 0.3, r: 2 });
        if (e.hp <= 0) { this.killEnemy(e); return; }
      }
      const speedMult = e.frozen > 0 ? 0.45 : 1;
      if (e.frozen > 0) e.frozen -= dt;

      if (e.isBoss) { this.stepBoss(e, dt); return; }

      // movement by mode
      if (e.mode === 'dive') {
        if (!e.locked) {
          e.diveT -= dt;
          // hold a moment then lock onto player
          e.baseY += 16 * dt;
          e.x = e.baseX + Math.sin(this.formPhase + e.sinePhase) * 18;
          e.y = e.baseY;
          if (e.diveT <= 0) { e.locked = true; const a = angle(e.x, e.y, p.x, p.y); const sp = 300; e.lvx = Math.cos(a) * sp; e.lvy = Math.sin(a) * sp; }
        } else {
          e.x += e.lvx * dt * speedMult; e.y += e.lvy * dt * speedMult;
          if (Math.random() < 0.5) burst(e.x, e.y, 1, { color: e.def.color, speed: 20, life: 0.25, r: 2 });
        }
      } else if (e.def.anchor) {
        // descend to a hold line, then hang and sway in place (never reaches the floor)
        const hold = e.def.holdY || 230;
        if (e.baseY < hold) e.baseY = Math.min(hold, e.baseY + e.descend * dt * speedMult);
        e.x = e.baseX + Math.sin(this.formPhase + e.sinePhase) * 14;
        e.y = e.baseY;
      } else {
        // formation / arc / sides: sway + descend
        const swayAmp = e.def.sine ? 46 : 22;
        const swaySpd = e.def.sine ? 1.8 : 1;
        e.baseY += e.descend * dt * speedMult;
        e.x = e.baseX + Math.sin(this.formPhase * swaySpd + e.sinePhase) * swayAmp;
        e.y = e.baseY;
      }

      // reaching the bottom hurts the player and removes the enemy (anchors never do)
      if (!e.def.anchor && e.y > WORLD_H - 70) { this.hurtPlayer(8); this.killEnemy(e, true); return; }

      // shooting
      if (e.def.fireEvery && e.spawnAnim <= 0) {
        e.fireT -= dt * speedMult;
        if (e.def.shoot === 'beam') {
          // two-stage: lock the player's position 0.7s out (telegraph), then fire there
          if (!e.locking && e.fireT <= 0.7) { e.locking = true; e.lockX = p.x; e.lockY = p.y; }
          e.teleP = e.locking ? clamp(1 - e.fireT / 0.7, 0, 1) : 0;
          if (e.fireT <= 0) { this.fireBeam(e); e.locking = false; e.teleP = 0; e.fireT = e.def.fireEvery[0] + this.rng() * (e.def.fireEvery[1] - e.def.fireEvery[0]); }
        } else if (e.fireT <= 0) {
          this.enemyShoot(e);
          e.fireT = e.def.fireEvery[0] + this.rng() * (e.def.fireEvery[1] - e.def.fireEvery[0]);
        }
      }

      // contact with player
      if (p.iframes <= 0 && p.invuln <= 0 && hit(e.x, e.y, e.r, p.x, p.y, p.r)) {
        this.hurtPlayer(e.contact);
        if (e.mode === 'dive') this.killEnemy(e, true);
      }
    });
  }

  enemyShoot(e) {
    const p = this.player;
    const shoot = e.def.shoot;
    const a = angle(e.x, e.y, p.x, p.y);
    const speed = 175 + this.wave * 6;
    const fire = (ang, sp = speed) => this.spawnEBullet(e.x, e.y + e.r, ang, sp, e.def.color);
    if (shoot === 'aimed') fire(a);
    else if (shoot === 'double') { fire(a - 0.12); fire(a + 0.12); }
    else if (shoot === 'spread3') { fire(a - 0.26); fire(a); fire(a + 0.26); }
    else if (shoot === 'mine') this.spawnMine(e);
    else fire(Math.PI / 2);
  }

  // Warden: fire a tight 5-bullet cross at the position it locked 0.7s ago (slow + readable)
  fireBeam(e) {
    const a = angle(e.x, e.y, e.lockX, e.lockY);
    const sp = 165;
    for (const off of [-0.06, -0.03, 0, 0.03, 0.06]) this.spawnEBullet(e.x, e.y + e.r, a + off, sp, '#ff8ad8');
    sfx.hit();
  }

  // Seeder: drop a slow proximity orb that pops into a ring
  spawnMine(e) {
    this.eBullets.spawn((b) => {
      b.x = e.x; b.y = e.y + e.r; b.vx = 0; b.vy = 62; b.r = 9; b.dmg = 7;
      b.color = '#9bff6b'; b.life = 6; b.mine = true; b.fuse = 4.5; b.holdT = 0;
    });
  }

  spawnEBullet(x, y, a, speed, color, opts) {
    this.eBullets.spawn((b) => {
      b.x = x; b.y = y; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
      b.r = (opts && opts.r) || 6.5; b.dmg = (opts && opts.dmg) || 6; b.color = color || '#ff5470'; b.life = (opts && opts.life) || 5;
      b.mine = false; b.fuse = 0; b.holdT = 0; // clear pooled mine/hold state
    });
  }

  // -------- boss --------
  stepBoss(e, dt) {
    const p = this.player;
    if (e.spawnAnim > 0) { e.y += (e.baseY - e.y) * Math.min(1, dt * 2); return; }
    const warden = e.bossId === 'warden';
    // movement: Queen sways briskly; Grave Warden hovers heavily
    if (warden) {
      e.x += e.dir * 26 * dt;
      if (e.x < 110) { e.x = 110; e.dir = 1; } else if (e.x > WORLD_W - 110) { e.x = WORLD_W - 110; e.dir = -1; }
      e.y = e.baseY + Math.sin(this.time * 0.8) * 12;
    } else {
      e.x += e.dir * 60 * dt;
      if (e.x < 90) { e.x = 90; e.dir = 1; } else if (e.x > WORLD_W - 90) { e.x = WORLD_W - 90; e.dir = -1; }
      e.y = e.baseY + Math.sin(this.time * 1.2) * 20;
    }
    e.spin += dt * (warden ? 0.8 : 2);
    // phase by hp
    const frac = e.hp / e.maxHp;
    e.phase = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
    e.atkT -= dt * (1 + (1 - frac) * 0.5);
    // telegraph charge
    e.tele = clamp(1 - e.atkT / 0.6, 0, 1);
    if (e.tele > 0.4 && Math.random() < 0.5) burst(e.x, e.y, 1, { color: warden ? '#cfe' : '#fff', speed: 60, dir: -Math.PI / 2 + (Math.random() - 0.5), spread: 0.4, life: 0.2, r: 2 });
    // gravity pull (Grave Warden phase 2)
    if (e.pullT > 0) {
      e.pullT -= dt;
      const a = angle(p.x, p.y, e.x, e.y);
      p.x += Math.cos(a) * 120 * dt; p.y += Math.sin(a) * 120 * dt;
    }
    if (e.atkT <= 0) {
      if (warden) this.wardenAttack(e); else this.bossAttack(e);
      e.atkMode = (e.atkMode + 1) % 3;
      const base = warden ? 2.6 : 2.2;
      e.atkT = base - e.phase * (warden ? 0.4 : 0.5);
    }
    if (p.iframes <= 0 && p.invuln <= 0 && hit(e.x, e.y, e.r, p.x, p.y, p.r)) this.hurtPlayer(e.contact);
  }

  bossAttack(e) {
    const p = this.player;
    const a = angle(e.x, e.y, p.x, p.y);
    const sp = 210;
    if (e.atkMode === 0) {
      // radial ring
      const n = 18 + e.phase * 6;
      for (let i = 0; i < n; i++) this.spawnEBullet(e.x, e.y, (i / n) * TAU + e.spin, sp, '#ff4d9d');
      addTrauma(0.2);
    } else if (e.atkMode === 1) {
      // aimed spread
      for (let i = -3; i <= 3; i++) this.spawnEBullet(e.x, e.y, a + i * 0.14, sp + 60, '#ff9f43');
    } else {
      // spiral
      const arms = 3;
      for (let k = 0; k < arms; k++) {
        for (let i = 0; i < 5; i++) this.spawnEBullet(e.x, e.y, e.spin * 2 + k * (TAU / arms) + i * 0.08, sp - 20, '#9d6bff');
      }
    }
    sfx.hit();
  }

  // Grave Warden: denial & timing. Walls-with-a-gap / gravity pull+ring / fake-out cross + lance.
  wardenAttack(e) {
    const p = this.player;
    const IND = '#6b6bff';
    if (e.phase === 0 || (e.phase === 2 && e.atkMode === 0)) {
      // Tidal wall: a row of bullets across the screen with one ~90px gap
      const gapX = 60 + this.rng() * (WORLD_W - 120);
      const step = 44;
      for (let x = 20; x < WORLD_W - 10; x += step) {
        if (Math.abs(x - gapX) < 55) continue;
        this.spawnEBullet(x, 30, Math.PI / 2, 165, IND, { r: 8 });
      }
      addTrauma(0.2);
    } else if (e.phase === 1 && e.atkMode !== 2) {
      // The Pull: drag the player inward while a slow ring blooms
      e.pullT = 0.8; screenFlash(0.18, '107,107,255');
      const n = 16;
      for (let i = 0; i < n; i++) this.spawnEBullet(e.x, e.y, (i / n) * TAU + e.spin, 120, IND, { r: 7 });
      addTrauma(0.25);
    } else if (e.atkMode === 1) {
      // Aimed triple lance — the only fast attack; punishes standing still
      const a = angle(e.x, e.y, p.x, p.y);
      for (const off of [-0.1, 0, 0.1]) this.spawnEBullet(e.x, e.y, a + off, 300, '#cfe6ff', { r: 7 });
    } else {
      // Cross-beam fake-out: 4 fat bullets on the axes that hang, then resume
      for (let i = 0; i < 4; i++) {
        const ang = i * (TAU / 4) + 0.0;
        this.eBullets.spawn((b) => {
          b.x = e.x; b.y = e.y; b.vx = Math.cos(ang) * 150; b.vy = Math.sin(ang) * 150;
          b.r = 9; b.dmg = 8; b.color = IND; b.life = 6; b.mine = false; b.fuse = 0; b.holdT = 0.5;
        });
      }
    }
    sfx.hit();
  }

  // -------- player bullets --------
  stepPlayerBullets(dt) {
    this.pBullets.forEach((b) => {
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; return; }
      // homing
      if (b.homing > 0) {
        const tgt = this.nearestEnemy(b.x, b.y, 260);
        if (tgt) {
          const desired = angle(b.x, b.y, tgt.x, tgt.y);
          const cur = Math.atan2(b.vy, b.vx);
          let d = desired - cur;
          while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const sp = Math.hypot(b.vx, b.vy);
          const na = cur + clamp(d, -b.homing * 6 * dt, b.homing * 6 * dt);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.meteor && Math.random() < 0.6) burst(b.x, b.y, 1, { color: '#ff9f43', speed: 20, life: 0.3, r: 3 });
      if (b.y < -20 || b.y > WORLD_H + 20 || b.x < -20 || b.x > WORLD_W + 20) { b.alive = false; return; }

      // collide with enemies
      this.enemies.forEach((e) => {
        if (!b.alive || b.hitSet.has(e)) return;
        if (hit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          b.hitSet.add(e);
          let dmg = b.dmg;
          if (e.shield && !b.meteor) dmg *= 0.5; // bulwark shrugs off half
          this.damageEnemy(e, dmg, b.x, b.y, b.crit);
          if (b.burn > 0) { e.burnT = Math.max(e.burnT, 2.5); e.burnDmg = b.burn * 3; }
          if (b.freeze > 0) e.frozen = Math.max(e.frozen, b.freeze * 4);
          if (b.chain > 0) this.staticArc(e, b.chain, b.dmg * 0.5);
          // pierce / ricochet
          if (b.pierce > 0) { b.pierce -= 1; }
          else if (b.ricochet > 0) {
            const nxt = this.nearestEnemy(b.x, b.y, 240, b.hitSet);
            if (nxt) { const aa = angle(b.x, b.y, nxt.x, nxt.y); const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(aa) * sp; b.vy = Math.sin(aa) * sp; b.ricochet -= 1; }
            else b.alive = false;
          } else b.alive = false;
        }
      });
    });
  }

  staticArc(from, count, dmg) {
    let fx = from.x, fy = from.y; const seen = new Set([from]);
    for (let i = 0; i < count; i++) {
      const t = this.nearestEnemy(fx, fy, 160, seen);
      if (!t) break; seen.add(t);
      this.lightning(fx, fy, t.x, t.y, '#9d6bff');
      this.damageEnemy(t, dmg, t.x, t.y, false);
      fx = t.x; fy = t.y;
    }
  }

  nearestEnemy(x, y, maxR, exclude) {
    let best = null, bd = maxR * maxR;
    this.enemies.forEach((e) => { if (exclude && exclude.has(e)) return; const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } });
    return best;
  }

  // -------- enemy bullets --------
  stepEnemyBullets(dt) {
    const p = this.player;
    this.eBullets.forEach((b) => {
      // bullet-hold (Grave Warden fake-out): freeze in place, then resume
      if (b.holdT > 0) { b.holdT -= dt; b.life -= dt; if (b.life <= 0) b.alive = false; return; }
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      // mine: arm a fuse, detonate near the player or on timeout into a ring
      if (b.mine) {
        b.fuse -= dt;
        const near = dist2(b.x, b.y, p.x, p.y) < 72 * 72;
        if (b.fuse <= 0 || near) { this.detonateMine(b); return; }
      }
      if (b.life <= 0 || b.y < -30 || b.y > WORLD_H + 30 || b.x < -30 || b.x > WORLD_W + 30) { b.alive = false; return; }
      if (p.iframes <= 0 && p.invuln <= 0 && hit(b.x, b.y, b.r, p.x, p.y, p.r * 0.8)) {
        b.alive = false; this.hurtPlayer(b.dmg);
      }
    });
  }

  detonateMine(b) {
    b.alive = false;
    shockwave(b.x, b.y, { color: '#9bff6b', max: 60, dur: 0.35, width: 3 });
    burst(b.x, b.y, 8, { color: '#9bff6b', speed: 120, life: 0.4, r: 2.5 });
    for (let i = 0; i < 6; i++) this.spawnEBullet(b.x, b.y, (i / 6) * TAU, 135, '#9bff6b');
    addTrauma(0.08);
  }

  // -------- orbits (Aegis Blades) --------
  stepOrbits(dt) {
    const p = this.player;
    if (p.orbits <= 0) return;
    const R = 52;
    for (let i = 0; i < p.orbits; i++) {
      const a = p.orbitAngle + (i / p.orbits) * TAU;
      const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
      this.enemies.forEach((e) => { if (hit(ox, oy, 12, e.x, e.y, e.r)) this.damageEnemy(e, p.orbitDmg * dt * 8, ox, oy, false); });
      this.eBullets.forEach((b) => { if (hit(ox, oy, 12, b.x, b.y, b.r)) b.alive = false; });
    }
  }

  // -------- damage & death --------
  damageEnemy(e, dmg, fx, fy, crit) {
    if (!e.alive) return;
    const p = this.player;
    e.hp -= dmg; e.flash = 1;
    sfx.hit();
    burst(fx, fy, crit ? 7 : 3, { color: crit ? '#ffd166' : '#fff', speed: crit ? 180 : 90, life: 0.3, r: crit ? 3 : 2 });
    floatText(fx, fy, String(Math.round(dmg)), { color: crit ? '#ffd166' : '#eaf2ff', size: crit ? 24 : 16, crit });
    if (crit) { addTrauma(0.08); if (p.critLifesteal) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.02); }
    // Cull the Weak: finish low-HP non-boss enemies outright
    if (e.hp > 0 && !e.isBoss && p.execute > 0 && e.hp <= e.maxHp * p.execute) e.hp = 0;
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, silent) {
    if (!e.alive) return;
    const wasFrozen = e.frozen > 0;
    e.alive = false;
    if (silent) return;
    const p = this.player;
    // Frostbite: a frozen enemy shatters, harming nearby foes
    if (p.shatter && wasFrozen && !e.isBoss) {
      const sd = p.bulletDmg * 1.5; const sx = e.x, sy = e.y;
      shockwave(sx, sy, { color: '#aef0ff', max: 80, dur: 0.35, width: 4 });
      burst(sx, sy, 12, { color: '#aef0ff', speed: 200, life: 0.4, r: 3 });
      this.enemies.forEach((o) => { if (o !== e && o.alive && !o.isBoss && dist2(sx, sy, o.x, o.y) < 80 * 80) this.damageEnemy(o, sd, o.x, o.y, false); });
    }
    // combo + score
    this.combo++; this.comboT = 2.4; this.mult = 1 + Math.floor(this.combo / 5) * 0.5;
    this.score += Math.round(e.score * this.mult);
    // lifesteal
    if (p.lifesteal > 0) { p.hp = Math.min(p.maxHp, p.hp + p.lifesteal); }
    // fx
    const big = e.isBoss;
    sfx.explode(big);
    burst(e.x, e.y, big ? 60 : 14, { color: e.def.color, speed: big ? 360 : 200, life: big ? 0.9 : 0.5, r: big ? 4 : 3 });
    shockwave(e.x, e.y, { color: e.def.color, max: big ? 240 : 50, dur: big ? 0.7 : 0.4, width: big ? 6 : 3 });
    addTrauma(big ? 0.8 : 0.16);
    hitStop(big ? 0.12 : 0.03);
    if (big) { screenFlash(0.5, '255,77,157'); this.boss = null; }
    // chance to drop a pickup (more likely from tanky foes / bosses); biased to what you lack
    if (!silent) {
      const tanky = e.maxHp >= 14 || big;
      const chance = big ? 1 : tanky ? 0.35 : 0.10;
      if (this.rng() < chance) {
        const wantHeal = p.hp < p.maxHp * 0.85 || p.maxShield === 0;
        const kind = big ? 'heal' : (wantHeal ? 'heal' : (this.rng() < 0.5 && p.maxShield > 0 ? 'shield' : 'heal'));
        const count = big ? 4 : 1;
        for (let k = 0; k < count; k++) this.dropPickup(e.x + (this.rng() - 0.5) * 40, e.y, kind);
      }
    }
    // splitter
    if (e.def.splits && !silent) {
      for (let i = 0; i < 2; i++) {
        const bx = e.x + (i ? 24 : -24);
        this.spawnEnemy(e.def.splits, bx, e.y, bx, e.y, 'formation');
      }
    }
  }

  // -------- pickups --------
  dropPickup(x, y, kind) {
    this.pickups.spawn((o) => { o.x = x; o.y = y; o.vy = 36 + this.rng() * 24; o.vx = (this.rng() - 0.5) * 30; o.r = 11; o.kind = kind; o.life = 8; o.bob = this.rng() * TAU; });
  }

  stepPickups(dt) {
    const p = this.player;
    this.pickups.forEach((o) => {
      o.life -= dt; o.bob += dt * 4;
      if (o.life <= 0) { o.alive = false; return; }
      const d = dist(o.x, o.y, p.x, p.y);
      const mag = p.magnet || 110;
      if (d < mag) { // magnet toward the ship
        const a = angle(o.x, o.y, p.x, p.y); const pull = 260 * (1 - d / mag) + 40;
        o.vx += Math.cos(a) * pull * dt * 6; o.vy += Math.sin(a) * pull * dt * 6;
      } else { o.vy = Math.min(o.vy + 20 * dt, 80); o.vx *= 0.96; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.y > WORLD_H + 20) { o.alive = false; return; }
      if (hit(o.x, o.y, o.r, p.x, p.y, p.r + 6)) {
        o.alive = false; this.collectPickup(o.kind);
      }
    });
  }

  collectPickup(kind) {
    const p = this.player;
    sfx.pickup();
    if (kind === 'shield' && p.maxShield > 0) {
      p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.5);
      floatText(p.x, p.y - 20, '+SHIELD', { color: '#34f5ff', size: 16 });
      burst(p.x, p.y, 10, { color: '#34f5ff', speed: 120, life: 0.4, r: 2.5 });
    } else {
      const heal = Math.round(p.maxHp * 0.12 * (p.healBonus || 1));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      floatText(p.x, p.y - 20, '+' + heal, { color: '#5dffb0', size: 18 });
      burst(p.x, p.y, 10, { color: '#5dffb0', speed: 120, life: 0.4, r: 2.5 });
    }
    shockwave(p.x, p.y, { color: kind === 'shield' ? '#34f5ff' : '#5dffb0', max: 44, dur: 0.3, width: 3 });
  }

  hurtPlayer(amt) {
    const p = this.player;
    if (p.iframes > 0 || p.invuln > 0 || this.over) return;
    if (p.shield > 0) {
      const a = Math.min(p.shield, amt); p.shield -= a; amt -= a;
      shockwave(p.x, p.y, { color: '#34f5ff', max: 40, dur: 0.3, width: 3 });
    }
    p.shieldDelay = 2.5;
    if (amt <= 0) { sfx.hit(); return; }
    p.hp -= amt; p.flash = 1; p.invuln = 0.6;
    sfx.hurt();
    addTrauma(0.4); screenFlash(0.3, '255,84,112'); hitStop(0.05);
    if (navigator.vibrate && window.__haptics !== false) navigator.vibrate(40);
    burst(p.x, p.y, 10, { color: '#ff5470', speed: 160, life: 0.4, r: 3 });
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  applyUpgrade(card) { card.apply(this.player); }
}

// ---- formation layout helpers ----
function layout(g, rng) {
  const pts = [];
  const n = g.count;
  if (g.formation === 'grid') {
    const cols = Math.min(6, n);
    const rows = Math.ceil(n / cols);
    const gapX = 76, gapY = 64;
    const startX = WORLD_W / 2 - ((cols - 1) * gapX) / 2;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const rowCount = Math.min(cols, n - r * cols);
      const sx = WORLD_W / 2 - ((rowCount - 1) * gapX) / 2;
      pts.push({ x: sx + c * gapX, y: 110 + r * gapY, mode: 'formation' });
    }
  } else if (g.formation === 'arc') {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = 80 + t * (WORLD_W - 160);
      const y = 120 + Math.sin(t * Math.PI) * -50 + 90;
      pts.push({ x, y: 130 + Math.sin(t * Math.PI) * 40, mode: 'formation' });
    }
  } else if (g.formation === 'sides') {
    for (let i = 0; i < n; i++) pts.push({ x: i % 2 ? WORLD_W - 70 : 70, y: 120 + Math.floor(i / 2) * 70, mode: 'formation' });
  } else { // stream (divers)
    for (let i = 0; i < n; i++) pts.push({ x: 80 + rng() * (WORLD_W - 160), y: 120, mode: 'dive' });
  }
  return pts;
}

function resetEnemy(o) {
  o.alive = false; o.burnT = 0; o.frozen = 0; o.flash = 0; o.isBoss = false; o.shield = 0;
}
