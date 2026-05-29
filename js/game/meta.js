// Meta-progression: permanent upgrades bought with Stardust between runs.
// SHOP defines each upgrade; cost grows per level. applyMeta() stamps the bonuses
// onto a fresh player + run at the start of every run.
//
// Design: fewer flat number-bumps, more build-DEFINING perks (sustain, crit, glass,
// momentum, XP head-start). Stardust is a deliberate grind — a meaningful tier is
// several runs, not one.

export const SHOP = [
  // --- staples ---
  { id: 'hp',      name: 'Reinforced Hull',  icon: 'maxhp',   max: 8, base: 60,  grow: 1.55, desc: (l) => `+${15 * l} max HP` },
  { id: 'shield',  name: 'Aegis Plating',    icon: 'shield',  max: 5, base: 90,  grow: 1.6,  desc: (l) => `Start with +${12 * l} regenerating shield` },
  { id: 'luck',    name: 'Fortune Engine',   icon: 'crit',    max: 4, base: 100, grow: 1.6,  desc: (l) => `+${20 * l}% rare/epic card odds` },
  { id: 'reroll',  name: 'Recalibrator',     icon: 'ricochet',max: 3, base: 120, grow: 1.7,  desc: (l) => `+${l} card reroll${l > 1 ? 's' : ''} per run` },
  { id: 'dust',    name: 'Refinery',         icon: 'spellpow',max: 5, base: 90,  grow: 1.55, desc: (l) => `+${15 * l}% Stardust earned` },
  { id: 'revive',  name: 'Phoenix Core',     icon: 'burn',    max: 1, base: 320, grow: 2,    desc: () => `Revive once per run at half HP` },
  // --- build-defining ---
  { id: 'siphon',  name: 'Siphon Reactor',   icon: 'lifesteal',max: 3, base: 130, grow: 1.6, desc: (l) => `Heal ${(0.6 * l).toFixed(1)} HP on every kill` },
  { id: 'overflow',name: 'Overflow Capacitor',icon:'critdmg', max: 3, base: 110, grow: 1.55, desc: (l) => `+${4 * l}% crit chance, +${(0.3 * l).toFixed(1)}× crit damage` },
  { id: 'momentum',name: 'Momentum Core',    icon: 'speed',   max: 1, base: 200, grow: 2,    desc: () => `Standing still ramps your damage up to +50%` },
  { id: 'glass',   name: 'Glass Frame',      icon: 'overcharge',max: 1, base: 220, grow: 2,  desc: () => `+50% bullet damage, but −30% max HP` },
  { id: 'veteran', name: "Veteran's Cache",  icon: 'homing',  max: 3, base: 120, grow: 1.6,  desc: (l) => `Begin each run +${25 * l} XP toward your first powers` },
];

export function costOf(item, level) {
  return Math.round(item.base * Math.pow(item.grow, level));
}

// dust earned from a finished run — a deliberately lean faucet (it's meant to be a grind)
export function dustEarned(score, wave, won, upg) {
  const base = Math.floor(score / 14) + wave * 8 + (won ? 200 : 0);
  const mult = 1 + 0.15 * (upg.dust || 0);
  return Math.max(1, Math.round(base * mult));
}

// apply permanent bonuses to a fresh player; returns run-level grants
export function applyMeta(player, upg) {
  const L = (id) => upg[id] || 0;
  player.maxHp += 15 * L('hp');
  if (L('shield') > 0) { player.maxShield += 12 * L('shield'); player.shield = player.maxShield; }
  if (L('siphon') > 0) player.lifesteal += 0.6 * L('siphon');
  if (L('overflow') > 0) { player.crit += 0.04 * L('overflow'); player.critMult += 0.3 * L('overflow'); }
  if (L('momentum') > 0) player.momentum = true;
  if (L('glass') > 0) { player.bulletDmg *= 1.5; player.maxHp = Math.max(30, Math.round(player.maxHp * 0.7)); }
  player.hp = player.maxHp; // settle after all max-HP changes
  return {
    rerolls: L('reroll'),
    revives: L('revive'),
    luck: L('luck'),
    xpStart: 25 * L('veteran'),
  };
}
