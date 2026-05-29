import { WORLD_W, WORLD_H } from '../engine/canvas.js';

// Player = stat object + runtime fields. Upgrades mutate the stats between waves.
export function makePlayer() {
  return {
    x: WORLD_W / 2, y: WORLD_H - 150, r: 15,
    hp: 100, maxHp: 100,
    shield: 0, maxShield: 0, shieldRegen: 8, shieldDelay: 0, // shield regens after not being hit
    // weapon
    fireRate: 4.2, fireT: 0,
    bulletDmg: 7, bulletSpeed: 620, bulletCount: 1, spread: 0, bulletSize: 5,
    pierce: 0, ricochet: 0, homing: 0,
    crit: 0.05, critMult: 1.8,
    rearShot: false, sideShot: false,
    // elemental
    burn: 0, freeze: 0, chainOnHit: 0,
    // defensive / utility
    orbits: 0, orbitDmg: 6, orbitAngle: 0,
    lifesteal: 0,
    moveSpeed: 1,           // multiplier on drag follow
    damageMult: 1,
    // arcana
    spellPower: 1, spellCdMult: 1,
    spells: ['dash', 'nova'],  // dash is index 0 (special), others are active casts
    spellCd: [0, 0, 0],        // remaining cooldown per equipped spell
    // dash runtime
    iframes: 0, dashVx: 0, dashVy: 0, dashT: 0,
    moving: false, fireReadyShake: 0,
    invuln: 0,
    // visuals
    flash: 0,
  };
}
