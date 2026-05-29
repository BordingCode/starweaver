// Crisp inline-SVG icons so the UI looks identical on every device (no emoji-font
// dependency). Keyed by spell/upgrade id; stroke uses currentColor for CSS tinting.
const P = {
  // arcana
  dash: '<path d="M13 2 5 14h6l-2 8 10-13h-6l2-7z"/>',
  nova: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  chain: '<path d="M9 7a3 3 0 0 1 3-3 3 3 0 0 1 3 3v2"/><path d="M15 17a3 3 0 0 1-3 3 3 3 0 0 1-3-3v-2"/><path d="M12 8v8"/>',
  storm: '<circle cx="17" cy="6" r="3"/><path d="M14.5 8.5 4 19M9 16l-2 4M13 17l-1.5 3"/>',
  // weapon
  multishot: '<path d="M12 21V8M12 8 8 12M12 8l4 4M6 21l3-9M18 21l-3-9"/>',
  firerate: '<path d="M7 14l5-7 5 7M7 19l5-7 5 7"/>',
  damage: '<path d="M14 3l7 7-9 9-3-1-1-3 9-9z"/><path d="M5 19l3 3"/>',
  pierce: '<path d="M3 12h18M14 7l5 5-5 5"/><path d="M3 8v8"/>',
  ricochet: '<path d="M4 6l6 6-6 6"/><path d="M10 12h6l-2-2M16 12l-2 2"/>',
  crit: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  critdmg: '<path d="M12 2l2 6 6-1-4 5 4 5-6-1-2 6-2-6-6 1 4-5-4-5 6 1z"/>',
  rear: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  side: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  homing: '<path d="M4 4v6a8 8 0 0 0 8 8"/><circle cx="18" cy="16" r="3"/><path d="M12 18l3-1"/>',
  big: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
  burn: '<path d="M12 3c4 4 5 7 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6-1-9z"/>',
  freeze: '<path d="M12 2v20M4 7l16 10M20 7L4 17M12 6l-3 3 3 3 3-3-3-3M12 18l-3-3M12 18l3-3"/>',
  chainhit: '<path d="M13 2 5 14h6l-2 8 10-13h-6l2-7z"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9" ry="4"/><circle cx="21" cy="12" r="1.6" fill="currentColor"/>',
  maxhp: '<path d="M12 21S4 14 4 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 2.5C20 14 12 21 12 21z"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"/>',
  lifesteal: '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z"/>',
  speed: '<path d="M3 8h11M3 12h8M3 16h11M16 6l4 6-4 6"/>',
  spellpow: '<path d="M12 3l2.5 6L21 11l-6.5 2L12 19l-2.5-6L3 11l6.5-2z"/>',
  spellcd: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  overcharge: '<path d="M11 2 4 13h6l-1 9 8-12h-6l1-8z"/><path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
};

export function iconSVG(id) {
  const inner = P[id];
  if (!inner) return '';
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
