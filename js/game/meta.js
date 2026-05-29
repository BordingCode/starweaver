// Meta-progression: permanent upgrades bought with Stardust between runs.
// SHOP defines each upgrade; cost grows per level. applyMeta() stamps the bonuses
// onto a fresh player + run at the start of every run.

export const SHOP = [
  { id: 'hp',     name: 'Reinforced Hull',  icon: 'maxhp',   max: 8, base: 40,  grow: 1.45, desc: (l) => `+${15 * l} max HP` },
  { id: 'dmg',    name: 'Tuned Cannons',     icon: 'damage',  max: 8, base: 50,  grow: 1.5,  desc: (l) => `+${Math.round(l * 8)}% bullet damage` },
  { id: 'fire',   name: 'Coolant System',    icon: 'firerate',max: 6, base: 50,  grow: 1.5,  desc: (l) => `+${Math.round(l * 6)}% fire rate` },
  { id: 'shield', name: 'Aegis Plating',     icon: 'shield',  max: 5, base: 60,  grow: 1.55, desc: (l) => `Start with +${12 * l} shield` },
  { id: 'magnet', name: 'Tractor Beam',      icon: 'homing',  max: 4, base: 45,  grow: 1.5,  desc: (l) => `+${30 * l}% pickup range & heal` },
  { id: 'luck',   name: 'Fortune Engine',    icon: 'crit',    max: 4, base: 70,  grow: 1.6,  desc: (l) => `+${20 * l}% rare/epic odds` },
  { id: 'reroll', name: 'Recalibrator',      icon: 'ricochet',max: 3, base: 80,  grow: 1.7,  desc: (l) => `+${l} card reroll${l > 1 ? 's' : ''} per run` },
  { id: 'dust',   name: 'Refinery',          icon: 'spellpow',max: 5, base: 60,  grow: 1.55, desc: (l) => `+${15 * l}% Stardust earned` },
  { id: 'revive', name: 'Phoenix Core',      icon: 'critdmg', max: 1, base: 220, grow: 2,    desc: () => `Revive once per run at half HP` },
];

export function costOf(item, level) {
  return Math.round(item.base * Math.pow(item.grow, level));
}

// dust earned from a finished run
export function dustEarned(score, wave, won, upg) {
  const base = Math.floor(score / 8) + wave * 12 + (won ? 150 : 0);
  const mult = 1 + 0.15 * (upg.dust || 0);
  return Math.max(1, Math.round(base * mult));
}

// apply permanent bonuses to a fresh player; returns run-level grants
export function applyMeta(player, upg) {
  const L = (id) => upg[id] || 0;
  player.maxHp += 15 * L('hp');
  player.hp = player.maxHp;
  player.bulletDmg *= 1 + 0.08 * L('dmg');
  player.fireRate *= 1 + 0.06 * L('fire');
  if (L('shield') > 0) { player.maxShield += 12 * L('shield'); player.shield = player.maxShield; }
  player.magnet = 110 * (1 + 0.3 * L('magnet'));
  player.healBonus = 1 + 0.3 * L('magnet');
  return {
    rerolls: L('reroll'),
    revives: L('revive'),
    luck: L('luck'),
  };
}
