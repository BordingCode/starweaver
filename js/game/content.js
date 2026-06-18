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
  // --- Sector 2 archetypes ---
  warden: { // anchors high, locks your position, then fires where you WERE — punishes camping
    name: 'Warden', hp: 30, r: 25, color: '#ff8ad8', score: 40, contact: 12,
    anchor: true, holdY: 230, fireEvery: [2.6, 3.2], shoot: 'beam',
  },
  seeder: { // drops slow proximity mines that pop into rings — zones the floor
    name: 'Seeder', hp: 12, r: 20, color: '#9bff6b', score: 28, contact: 10,
    slow: true, fireEvery: [2.0, 2.7], shoot: 'mine',
  },
  // --- Sector 3 archetypes (pulse & exposure) ---
  pulsar: { // anchors, charges on a fixed beat, then unleashes a slow readable ring — creates fire/hold windows
    name: 'Pulsar', hp: 16, r: 22, color: '#ffe14d', score: 32, contact: 10,
    anchor: true, holdY: 200, fireEvery: [2.4, 2.4], shoot: 'pulse',
  },
  strobe: { // fast strafing skirmisher raking spread3 — keeps you from settling between pulses
    name: 'Strobe', hp: 8, r: 16, color: '#46e8ff', score: 20, contact: 12,
    sine: true, fast: true, fireEvery: [1.1, 1.8], shoot: 'spread3',
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
  { id: 'firerate', name: 'Overclock', icon: '⏩', rarity: 'common', desc: '+22% fire rate.', max: 5,
    apply: (p) => { p.fireRate *= 1.22; } },
  { id: 'damage', name: 'Hardpoint', icon: '🗡️', rarity: 'common', desc: '+30% bullet damage.', max: 6,
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
  // --- build-defining additions ---
  { id: 'glasscannon', name: 'Glass Cannon', icon: 'critdmg', rarity: 'epic', desc: '+60% damage, but max HP cut by 40%.', max: 1,
    apply: (p) => { p.bulletDmg *= 1.6; p.maxHp = Math.max(30, Math.round(p.maxHp * 0.6)); p.hp = Math.min(p.hp, p.maxHp); p.glass = true; } },
  { id: 'momentum', name: 'Momentum', icon: 'spellpow', rarity: 'epic', desc: 'Standing still ramps damage up to +50%.', max: 1,
    apply: (p) => { p.momentum = true; } },
  { id: 'volley', name: 'Volley', icon: 'multishot', rarity: 'rare', desc: 'Fire an extra staggered burst; +wider spread.', max: 2,
    apply: (p) => { p.burstShots += 1; p.spread = Math.min(p.spread + 0.12, 1.0); } },
  { id: 'cull', name: 'Cull the Weak', icon: 'damage', rarity: 'rare', desc: 'Instantly finish low-HP enemies.', max: 3,
    apply: (p) => { p.execute += 0.13; } },
  { id: 'frostbite', name: 'Frostbite', icon: 'freeze', rarity: 'epic', desc: 'Frozen enemies shatter on death, harming others.', max: 1,
    apply: (p) => { p.shatter = true; } },
  { id: 'vampcrit', name: 'Vampire Spike', icon: 'lifesteal', rarity: 'rare', desc: 'Critical hits heal you a little.', max: 1,
    apply: (p) => { p.critLifesteal = true; } },
  { id: 'giantslayer', name: 'Giantslayer', icon: 'critdmg', rarity: 'epic', desc: '+40% damage to Champions (ringed elites).', max: 3,
    apply: (p) => { p.championDmg *= 1.4; } },
  { id: 'spoils', name: 'Spoils of War', icon: 'spellpow', rarity: 'rare', desc: 'Champions drop +1 extra pickup.', max: 2,
    apply: (p) => { p.championLoot += 1; } },
  { id: 'adrenaline', name: 'Adrenaline', icon: 'firerate', rarity: 'epic', desc: 'Fire up to +45% faster the lower your health.', max: 1,
    apply: (p) => { p.adrenaline = true; } },
  { id: 'kinetic', name: 'Kinetic Barrier', icon: 'shield', rarity: 'rare', desc: 'Blink restores shield.', max: 1,
    apply: (p) => { p.kineticBarrier = true; } },
  { id: 'splinter', name: 'Splinter Rounds', icon: 'pierce', rarity: 'epic', desc: 'Slain foes spit 2 homing shards.', max: 2,
    apply: (p) => { p.splinter += 2; } },
];

// ---------------- WAVE SCRIPT ----------------
// Two authored sectors then procedural endless. Each wave lists groups
// {type, count, formation, delay}. formation: 'grid' | 'arc' | 'stream' | 'sides'.
// Sector 1 "The Weave" = density & offense. Sector 2 "The Hollows" = denial & positioning.
export function buildWaves() {
  return [
    // --- Sector 1: The Weave ---
    { label: 'WAVE 1', noFire: 4, groups: [ { type: 'grunt', count: 6, formation: 'grid' } ] },
    { label: 'WAVE 2', groups: [ { type: 'grunt', count: 6, formation: 'grid' }, { type: 'drone', count: 4, formation: 'arc' } ] },
    { label: 'WAVE 3', groups: [ { type: 'drone', count: 6, formation: 'grid' }, { type: 'diver', count: 3, formation: 'stream', delay: 1.2 } ] },
    { label: 'WAVE 4', groups: [ { type: 'weaver', count: 6, formation: 'arc' }, { type: 'bomber', count: 2, formation: 'sides' } ] },
    { label: 'WAVE 5', groups: [ { type: 'splitter', count: 4, formation: 'grid' }, { type: 'drone', count: 5, formation: 'arc' } ] },
    { label: 'ELITE', elite: true, groups: [ { type: 'shielded', count: 3, formation: 'arc' }, { type: 'diver', count: 4, formation: 'stream', delay: 0.9 } ] },
    { label: 'WAVE 7', groups: [ { type: 'weaver', count: 6, formation: 'grid' }, { type: 'bomber', count: 3, formation: 'sides' }, { type: 'diver', count: 4, formation: 'stream', delay: 1.4 } ] },
    { label: 'BOSS', boss: true, bossId: 'queen', groups: [] },
    // --- Sector 2: The Hollows (denial & positioning) ---
    { label: 'WAVE 9', sector: 2, groups: [ { type: 'warden', count: 3, formation: 'arc' }, { type: 'grunt', count: 4, formation: 'grid' } ] },
    { label: 'WAVE 10', sector: 2, groups: [ { type: 'seeder', count: 3, formation: 'sides' }, { type: 'drone', count: 5, formation: 'grid' } ] },
    { label: 'WAVE 11', sector: 2, groups: [ { type: 'shielded', count: 3, formation: 'grid' }, { type: 'weaver', count: 4, formation: 'arc' } ] },
    { label: 'WAVE 12', sector: 2, groups: [ { type: 'warden', count: 2, formation: 'sides' }, { type: 'seeder', count: 2, formation: 'sides' }, { type: 'diver', count: 4, formation: 'stream', delay: 0.9 } ] },
    { label: 'ELITE', sector: 2, elite: true, groups: [ { type: 'warden', count: 2, formation: 'arc' }, { type: 'shielded', count: 2, formation: 'grid' }, { type: 'splitter', count: 1, formation: 'grid' } ] },
    { label: 'WAVE 14', sector: 2, groups: [ { type: 'seeder', count: 4, formation: 'grid' }, { type: 'bomber', count: 4, formation: 'sides' } ] },
    { label: 'WAVE 15', sector: 2, groups: [ { type: 'warden', count: 2, formation: 'arc' }, { type: 'seeder', count: 2, formation: 'sides' }, { type: 'diver', count: 4, formation: 'stream', delay: 1.2 } ] },
    { label: 'BOSS', boss: true, bossId: 'warden', sector: 2, groups: [] },
    // --- Sector 3: The Glare (pulse & exposure — time your stillness) ---
    { label: 'WAVE 17', sector: 3, groups: [ { type: 'pulsar', count: 2, formation: 'arc' }, { type: 'grunt', count: 5, formation: 'grid' } ] },
    { label: 'WAVE 18', sector: 3, groups: [ { type: 'strobe', count: 5, formation: 'grid' }, { type: 'pulsar', count: 1, formation: 'arc' } ] },
    { label: 'WAVE 19', sector: 3, groups: [ { type: 'pulsar', count: 2, formation: 'sides' }, { type: 'strobe', count: 4, formation: 'stream', delay: 0.7 } ] },
    { label: 'WAVE 20', sector: 3, groups: [ { type: 'pulsar', count: 2, formation: 'arc' }, { type: 'warden', count: 1, formation: 'sides' }, { type: 'drone', count: 4, formation: 'grid' } ] },
    { label: 'ELITE', sector: 3, elite: true, groups: [ { type: 'pulsar', count: 2, formation: 'arc' }, { type: 'strobe', count: 3, formation: 'grid' }, { type: 'shielded', count: 1, formation: 'grid' } ] },
    { label: 'WAVE 22', sector: 3, groups: [ { type: 'strobe', count: 6, formation: 'grid' }, { type: 'seeder', count: 2, formation: 'sides' }, { type: 'pulsar', count: 1, formation: 'arc' } ] },
    { label: 'WAVE 23', sector: 3, groups: [ { type: 'pulsar', count: 3, formation: 'arc' }, { type: 'diver', count: 4, formation: 'stream', delay: 1.0 }, { type: 'strobe', count: 3, formation: 'sides' } ] },
    { label: 'BOSS', boss: true, bossId: 'chrono', sector: 3, groups: [] },
  ];
}

export const RARITY_WEIGHT = { common: 100, rare: 52, epic: 24 };

// ---------------- ELITE AFFIXES ("Champions") ----------------
// Modifiers stamped onto ordinary enemies (Elite waves + endless). Each is pure
// data + a behaviour flag read at an existing world hook — no new enemy code.
// `exclude` lists enemy types this affix must never roll on (avoids silliness/explosions).
export const AFFIXES = {
  armored:   { name: 'Armored',   tint: '#cfd8ff', glyph: 'shield',  dmgTaken: 0.55, exclude: ['shielded'] }, // damageEnemy: takes 45% less (not on the already-defensive Bulwark)
  swift:     { name: 'Swift',     tint: '#ffe49a', glyph: 'firerate', descendMult: 1.55, fireMult: 0.62 }, // stepEnemies: faster descent & shooting
  volatile:  { name: 'Volatile',  tint: '#ff9f43', glyph: 'burn',     detonate: 10 },                  // killEnemy: bursts a ring of bullets
  vampiric:  { name: 'Vampiric',  tint: '#5dffb0', glyph: 'lifesteal',heal: 0.05 },                    // stepEnemies: regenerates HP
  warding:   { name: 'Warding',   tint: '#7fd6ff', glyph: 'shield',   reflect: 0.3 },                  // stepPlayerBullets: nullifies some shots
  splitting: { name: 'Splitting', tint: '#ffd166', glyph: 'multishot',forceSplit: 'mini', exclude: ['mini', 'splitter'] }, // killEnemy: spawns minis
};
export const AFFIX_KEYS = Object.keys(AFFIXES);

// ---------------- PACTS (curse / blessing gamble) ----------------
// Offered when an Elite wave is cleared. Each pact pairs a permanent run-curse
// with a permanent run-boon. apply(w) mutates the world / its player. Declining
// is always an option (see main.js) and instead gives a normal upgrade pick.
export const PACTS = [
  { id: 'bloodlust', name: 'Pact of Bloodlust', icon: 'damage',
    curse: 'The swarm fires 25% faster.', boon: '+35% bullet damage.',
    apply: (w) => { w.enemyFireMult *= 0.75; w.player.bulletDmg *= 1.35; } },
  { id: 'frenzy', name: 'Pact of Frenzy', icon: 'critdmg',
    curse: 'More enemies become Champions.', boon: 'Gain a random Epic power now.',
    apply: (w) => { w.affixFracBonus += 0.25; w.affixNBonus += 1; w._pactGrant = w.grantRandomEpic(); } },
  { id: 'greed', name: 'Pact of Greed', icon: 'spellpow',
    curse: 'Half as many pickups drop.', boon: '+50% Stardust this run, heal to full.',
    apply: (w) => { w.pickupMult *= 0.5; w.dustMult *= 1.5; w.player.hp = w.player.maxHp; } },
  { id: 'glass', name: 'Pact of Glass', icon: 'overcharge',
    curse: 'Max HP cut by 30%.', boon: '+25% fire rate and +20% crit chance.',
    apply: (w) => { const p = w.player; p.maxHp = Math.max(30, Math.round(p.maxHp * 0.7)); p.hp = Math.min(p.hp, p.maxHp); p.fireRate *= 1.25; p.crit += 0.2; } },
  { id: 'storm', name: 'Pact of the Storm', icon: 'chainhit',
    curse: 'Champions carry an extra affix.', boon: '+50% spell power, -25% spell cooldowns.',
    apply: (w) => { w.affixNBonus += 1; w.player.spellPower *= 1.5; w.player.spellCdMult *= 0.75; } },
  { id: 'swarm', name: 'Pact of the Swarm', icon: 'multishot',
    curse: 'More enemies become Champions.', boon: '+1 projectile per volley.',
    apply: (w) => { w.affixFracBonus += 0.2; w.player.bulletCount += 1; w.player.spread = Math.max(w.player.spread, 0.18); } },
  { id: 'ruin', name: 'Pact of Ruin', icon: 'pierce',
    curse: 'Champions carry an extra affix.', boon: 'Bullets pierce +2 and fly 10% faster.',
    apply: (w) => { w.affixNBonus += 1; w.player.pierce += 2; w.player.bulletSpeed *= 1.1; } },
  { id: 'famine', name: 'Pact of Famine', icon: 'lifesteal',
    curse: 'No pickups drop.', boon: 'Heal on every kill; heal to full now.',
    apply: (w) => { w.pickupMult = 0; w.player.lifesteal += 2.5; w.player.hp = w.player.maxHp; } },
];
