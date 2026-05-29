// Procedural Web Audio: no files. Oscillators + filtered noise with envelopes.
// Unlocked on first user gesture. A soft pulsing pad provides music.
let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = null;
let sfxOn = true;
let musicTarget = 0;     // current music volume target, so ducking can restore it
export function setSfx(b) { sfxOn = b; }

// Sidechain duck: briefly dip the music so an important cue cuts through the mix,
// then ramp back to wherever the music level currently sits (research-backed clarity).
function duck(depth = 0.5, dur = 0.28) {
  if (!ctx || !musicGain || musicTarget <= 0) return;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setTargetAtTime(musicTarget * (1 - depth), now, 0.02);
  musicGain.gain.setTargetAtTime(musicTarget, now + dur, 0.18);
}

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  } catch (e) { ctx = null; }
}

export function resumeAudio() {
  if (!ctx) initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
  return muted;
}
export function isMuted() { return muted; }

function noiseBuf(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq, dur, { type = 'sine', gain = 0.3, slideTo = null, delay = 0, attack = 0.005, dest = null } = {}) {
  if (!ctx) return;
  if (!sfxOn && !dest) return; // sfx muted (music passes dest=musicGain and is unaffected)
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, { gain = 0.3, type = 'highpass', freq = 1200, q = 0.7, delay = 0 } = {}) {
  if (!ctx || !sfxOn) return; // noise is only used for sfx
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(dur);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

// ---- SFX ----
let lastShot = 0;
export const sfx = {
  shoot() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastShot < 0.04) return; lastShot = now;
    const v = 1 + (Math.random() - 0.5) * 0.06; // pitch-vary so rapid fire doesn't fatigue
    tone(880 * v, 0.08, { type: 'square', gain: 0.06, slideTo: 1400 * v });
    tone(440 * v, 0.06, { type: 'triangle', gain: 0.04, slideTo: 700 * v });
  },
  hit() { const v = 1 + (Math.random() - 0.5) * 0.12; tone(300 * v, 0.05, { type: 'square', gain: 0.05, slideTo: 180 * v }); },
  explode(big = false) {
    if (big) duck(0.55, 0.5);
    noise(big ? 0.5 : 0.25, { gain: big ? 0.5 : 0.28, type: 'lowpass', freq: big ? 900 : 1600, q: 0.6 });
    tone(big ? 90 : 160, big ? 0.5 : 0.22, { type: 'sine', gain: big ? 0.4 : 0.2, slideTo: big ? 30 : 60 });
  },
  pickup() {
    tone(660, 0.1, { type: 'sine', gain: 0.18, slideTo: 990 });
    tone(990, 0.12, { type: 'sine', gain: 0.12, delay: 0.06, slideTo: 1320 });
  },
  dash() { noise(0.18, { gain: 0.2, type: 'bandpass', freq: 2200, q: 2 }); tone(520, 0.16, { type: 'sawtooth', gain: 0.08, slideTo: 1200 }); },
  hurt() { duck(0.5, 0.3); tone(220, 0.22, { type: 'sawtooth', gain: 0.22, slideTo: 70 }); noise(0.2, { gain: 0.15, type: 'lowpass', freq: 700 }); },
  spell(kind = 0) {
    const base = [330, 392, 261][kind % 3];
    tone(base, 0.3, { type: 'sawtooth', gain: 0.14, slideTo: base * 3 });
    tone(base * 2, 0.4, { type: 'sine', gain: 0.1, delay: 0.04 });
    noise(0.3, { gain: 0.12, type: 'bandpass', freq: 1800, q: 1.5 });
  },
  levelup() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, { type: 'triangle', gain: 0.16, delay: i * 0.08 }));
  },
  bossWarn() { duck(0.7, 1.0); tone(110, 0.8, { type: 'sawtooth', gain: 0.25, slideTo: 70 }); tone(55, 1.0, { type: 'square', gain: 0.18 }); },
  // soft rising windup — an audio telegraph for charging attacks (pulsar/warden/boss)
  charge() { tone(300, 0.5, { type: 'sine', gain: 0.045, slideTo: 720 }); },
  // weighty, faintly ominous seal for forging a Pact
  pact() { duck(0.6, 0.55); tone(140, 0.55, { type: 'sawtooth', gain: 0.16, slideTo: 90 }); tone(420, 0.5, { type: 'sine', gain: 0.08, delay: 0.05, slideTo: 580 }); noise(0.3, { gain: 0.08, type: 'bandpass', freq: 1400, q: 1.2 }); },
  // short stinger when a boss escalates to a new phase
  phase() { duck(0.6, 0.45); tone(160, 0.45, { type: 'square', gain: 0.13, slideTo: 300 }); noise(0.22, { gain: 0.1, type: 'lowpass', freq: 1000 }); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.6, { type: 'sine', gain: 0.18, delay: i * 0.12 })); },
  lose() { [330, 294, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'sawtooth', gain: 0.16, delay: i * 0.16, slideTo: f * 0.6 })); },
};

// ---- Music: slow evolving pad, two interval voices ----
const scale = [196, 220, 261.63, 294, 330, 392];
let musicStep = 0;
export function startMusic() {
  if (!ctx || musicTimer) return;
  musicTarget = 0.5;
  musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  const beat = () => {
    if (!ctx) return;
    const root = scale[musicStep % scale.length];
    tone(root, 2.4, { type: 'sine', gain: 0.06, attack: 0.6, dest: musicGain });
    tone(root * 1.5, 2.4, { type: 'triangle', gain: 0.035, attack: 0.8, dest: musicGain });
    if (musicStep % 2 === 0) tone(root * 2, 1.8, { type: 'sine', gain: 0.025, attack: 0.4, dest: musicGain });
    musicStep++;
    musicTimer = setTimeout(beat, 1700);
  };
  beat();
}
export function setMusicIntensity(x) {
  musicTarget = 0.4 + x * 0.4;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicTarget, ctx.currentTime, 0.8);
}
export function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  musicTarget = 0;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
}
