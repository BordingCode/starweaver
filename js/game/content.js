// Data definitions: enemy archetypes, arcana (active spells), upgrade cards, wave script.
// Behaviour functions read/write the enemy `e` and the world `w`; they stay data-light.

// ---------------- ENEMIES ----------------
// movement: phase-based. Each enemy has hp, r (radius), color, score, and an ai(e,w,dt).
export const ENEMIES = {
  grunt: {
    name: 'Mote', hp: 3, r: 16, color: '#7c8cff', score: 10, contact: 8,
    fireEvery: [2.4, 4.5], shoot: 'aimed',
  },
  drone: {
    name: 'Drone', hp: 5, r: 17, color: '#34f5ff', score: 14, contact: 8,
    fireEvery: [1.8, 3.2], shoot: 'double',
  },
  weaver: {
    name: 'Weaver', hp: 6, r: 16, color: '#9d6bff', score: 18, contact: 9,
    sine: true, fireEvery: [1.4, 2.4], shoot: 'aimed',
  },
  bomber: {
    name: 'Bomber', hp: 14, r: 24, color: '#ff9f43', score: 30, contact: 12,
    slow: true, fireEvery: [1.6, 2.6], shoot: 'spread3',
  },
  shielded: {
    name: 'Bulwark', hp: 22, r: 26, color: '#5dffb0', score: 36, contact: 14,
    shield: true, fireEvery: [2.2, 3.4], shoot: 'aimed',
  },
  diver: {
    name: 'Lancer', hp: 7, r: 18, color: '#ff5470', score: 22, contact: 18,
    diver: true,
  },
  splitter: {
    name: 'Spore', hp: 10, r: 22, color: '#ffd166', score: 26, contact: 10,
    splits: 'mini', fireEvery: [2.6, 4], shoot: 'aimed',
  },
  mini: {
    name: 'Sporeling', hp: 3, r: 12, color: '#ffe49a', score: 8, contact: 8,
    fast: true, fireEvery: [3, 5], shoot: 'aimed',
  },
};

// ---------------- ARCANA (active spells) ----------------
// cast(w) fires the effect. cd = cooldown seconds (scaled by player.spellCdMult).
export const SPELLS = {
  dash: {
    name: 'Blink', icon: '⚡', cd: 2.2, key: 'Dash', dash: true,
    desc: 'Blink a short distance with brief invulnerability.',
  },
  nova: {
    name: 'Arc Nova', icon: '✷', cd: 6, key: 'Nova',
    desc: 'Burst of arcane energy damaging all nearby foes.',
    cast(w) { w.castNova(); },
  },
  chain: {
    name: 'Chain Bolt', icon: '↯', cd: 7, key: 'Chain',
    desc: 'A bolt that arcs between up to 6 enemies.',
    cast(w) { w.castChain(); },
  },
  storm: {
    name: 'Starfall', icon: '☄', cd: 9, key: 'Storm',
    desc: 'Call down a barrage of homing meteors.',
    cast(w) { w.castStorm(); },
  },
};

// ---------------- UPGRADE CARDS ----------------
// apply(p) mutates the player stat object. `weight` biases the pool; `max` caps stacks.
export const UPGRADES = [
  { id: 'multishot', name: 'Split Shot', icon: '🔱', rarity: 'rare', desc: '+1 projectile per volley.', max: 6,
    apply: (p) => { p.bulletCount += 1; p.spread = Math.max(p.spread, 0.18); } },
  { id: 'firerate', name: 'Overclock', icon: '⏩', rarity: 'common', desc: '+22% fire rate.', max: 8,
    apply: (p) => { p.fireRate *= 1.22; } },
  { id: 'damage', name: 'Hardpoint', icon: '🗡️', rarity: 'common', desc: '+30% bullet damage.', max: 10,
    apply: (p) => { p.bulletDmg *= 1.3; } },
  { id: 'pierce', name: 'Railshot', icon: '➶', rarity: 'rare', desc: 'Bullets pierce +1 enemy.', max: 4,
    apply: (p) => { p.pierce += 1; p.bulletSpeed *= 1.05; } },
  { id: 'ricochet', name: 'Ricochet', icon: '⤴', rarity: 'rare', desc: 'Bullets bounce to a new target +1.', max: 3,
    apply: (p) => { p.ricochet += 1; } },
  { id: 'crit', name: 'Focus Lens', icon: '🎯', rarity: 'common', desc: '+12% crit chance.', max: 6,
    apply: (p) => { p.crit += 0.12; } },
  { id: 'critdmg', name: 'Executioner', icon: '💥', rarity: 'rare', desc: '+0.6× critical damage.', max: 5,
    apply: (p) => { p.critMult += 0.6; } },
  { id: 'rear', name: 'Tailgun', icon: '⇕', rarity: 'rare', desc: 'Also fire backward.', max: 1,
    apply: (p) => { p.rearShot = true; } },
  { id: 'side', name: 'Broadside', icon: '⇆', rarity: 'rare', desc: 'Also fire to both sides.', max: 1,
    apply: (p) => { p.sideShot = true; } },
  { id: 'homing', name: 'Seeker Rounds', icon: '🧲', rarity: 'epic', desc: 'Bullets curve toward enemies.', max: 3,
    apply: (p) => { p.homing += 0.4; } },
  { id: 'big', name: 'Heavy Slugs', icon: '⬤', rarity: 'common', desc: '+35% bullet size & damage.', max: 4,
    apply: (p) => { p.bulletSize *= 1.35; p.bulletDmg *= 1.12; } },
  { id: 'burn', name: 'Plasma Rounds', icon: '🔥', rarity: 'epic', desc: 'Hits set enemies on fire.', max: 3,
    apply: (p) => { p.burn += 1.4; } },
  { id: 'freeze', name: 'Cryo Rounds', icon: '❄️', rarity: 'epic', desc: 'Hits slow enemies.', max: 3,
    apply: (p) => { p.freeze += 0.22; } },
  { id: 'chainhit', name: 'Static Charge', icon: '⚡', rarity: 'epic', desc: 'Hits zap a nearby enemy.', max: 3,
    apply: (p) => { p.chainOnHit += 1; } },
  { id: 'orbit', name: 'Aegis Blades', icon: '🛡️', rarity: 'rare', desc: '+1 orbiting blade that shields & cuts.', max: 4,
    apply: (p) => { p.orbits += 1; } },
  { id: 'maxhp', name: 'Vitality Core', icon: '❤️', rarity: 'common', desc: '+25 max HP and heal 25.', max: 8,
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'shield', name: 'Barrier Field', icon: '🔵', rarity: 'rare', desc: '+30 regenerating shield.', max: 4,
    apply: (p) => { p.maxShield += 30; p.shield = p.maxShield; } },
  { id: 'lifesteal', name: 'Siphon', icon: '🩸', rarity: 'epic', desc: 'Small heal on each kill.', max: 4,
    apply: (p) => { p.lifesteal += 1.2; } },
  { id: 'speed', name: 'Thrusters', icon: '💨', rarity: 'common', desc: '+15% move speed.', max: 5,
    apply: (p) => { p.moveSpeed *= 1.15; } },
  { id: 'spellpow', name: 'Arcane Surge', icon: '🔮', rarity: 'rare', desc: '+40% spell power.', max: 5,
    apply: (p) => { p.spellPower *= 1.4; } },
  { id: 'spellcd', name: 'Quickcast', icon: '⏱️', rarity: 'rare', desc: '-20% spell cooldowns.', max: 4,
    apply: (p) => { p.spellCdMult *= 0.8; } },
  { id: 'overcharge', name: 'Overcharge', icon: '🌟', rarity: 'epic', desc: '+18% damage, +12% fire rate, -10 max HP.', max: 5,
    apply: (p) => { p.bulletDmg *= 1.18; p.fireRate *= 1.12; p.maxHp = Math.max(40, p.maxHp - 10); p.hp = Math.min(p.hp, p.maxHp); } },
];

// ---------------- WAVE SCRIPT ----------------
// A sector of waves. Each wave lists groups {type, count, formation, delay}. Final wave = boss.
// formation: 'grid' (invaders block), 'arc', 'stream' (timed trickle), 'sides'.
export function buildWaves() {
  return [
    { label: 'WAVE 1', groups: [ { type: 'grunt', count: 8, formation: 'grid' } ] },
    { label: 'WAVE 2', groups: [ { type: 'grunt', count: 6, formation: 'grid' }, { type: 'drone', count: 4, formation: 'arc' } ] },
    { label: 'WAVE 3', groups: [ { type: 'drone', count: 6, formation: 'grid' }, { type: 'diver', count: 3, formation: 'stream', delay: 1.2 } ] },
    { label: 'WAVE 4', groups: [ { type: 'weaver', count: 6, formation: 'arc' }, { type: 'bomber', count: 2, formation: 'sides' } ] },
    { label: 'WAVE 5', groups: [ { type: 'splitter', count: 4, formation: 'grid' }, { type: 'drone', count: 5, formation: 'arc' } ] },
    { label: 'ELITE', elite: true, groups: [ { type: 'shielded', count: 3, formation: 'arc' }, { type: 'diver', count: 4, formation: 'stream', delay: 0.9 } ] },
    { label: 'WAVE 7', groups: [ { type: 'weaver', count: 6, formation: 'grid' }, { type: 'bomber', count: 3, formation: 'sides' }, { type: 'diver', count: 4, formation: 'stream', delay: 1.4 } ] },
    { label: 'BOSS', boss: true, groups: [] },
  ];
}

export const RARITY_WEIGHT = { common: 100, rare: 52, epic: 24 };
