// Central game state + tiny persistence. window.__gameState/__errors are test hooks.
const SAVE_KEY = 'starweaver_meta_v1';

export const Game = {
  screen: 'title',      // title | playing | upgrade | gameover
  world: null,          // live simulation
  run: null,            // { wave, score, ... } snapshot for screens
  meta: loadMeta(),     // persistent: best score, runs, unlocks
};

function defaultMeta() {
  return { best: 0, runs: 0, kills: 0, wins: 0, muted: false, dust: 0, upg: {}, loadout: 'nova', settings: { music: true, sfx: true, haptics: true, reduceMotion: false } };
}
function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (m && typeof m === 'object') {
      const d = defaultMeta();
      return Object.assign(d, m, { upg: Object.assign({}, m.upg), settings: Object.assign(d.settings, m.settings) });
    }
  } catch (e) {}
  return defaultMeta();
}

export function saveMeta() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(Game.meta)); } catch (e) {}
}

export function syncDebug() {
  window.__gameState = {
    screen: Game.screen,
    wave: Game.world ? Game.world.wave : 0,
    score: Game.world ? Game.world.score : 0,
    hp: Game.world ? Math.round(Game.world.player.hp) : 0,
    enemies: Game.world ? Game.world.enemies.countAlive : 0,
    over: Game.world ? Game.world.over : false,
    best: Game.meta.best,
  };
}

// error collector for verification
window.__errors = [];
window.addEventListener('error', (e) => { window.__errors.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', (e) => { window.__errors.push('promise: ' + String(e.reason)); });
