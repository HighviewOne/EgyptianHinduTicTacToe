/* ─────────────────────────────────────────────
   audio.js — Web Audio API (no files needed)
   Exposes: sfxPlace, sfxWin, sfxDraw, sfxChaos,
            toggleMusic, startDrone, stopDrone,
            setVolume
───────────────────────────────────────────── */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/* Two independent gain nodes — SFX and music controlled separately */
let masterGainNode = null;   // SFX (placement, win, draw, chaos sounds)
let musicGainNode  = null;   // Music (melody + drone)

function getMasterGain() {
  const ctx = getCtx();
  if (!masterGainNode) {
    masterGainNode = ctx.createGain();
    masterGainNode.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGainNode.connect(ctx.destination);
  }
  return masterGainNode;
}
function getMusicGain() {
  const ctx = getCtx();
  if (!musicGainNode) {
    musicGainNode = ctx.createGain();
    musicGainNode.gain.setValueAtTime(0.55, ctx.currentTime);
    musicGainNode.connect(ctx.destination);
  }
  return musicGainNode;
}
function setVolume(v) {  // SFX volume
  const ctx = getCtx();
  getMasterGain().gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime + 0.04);
}
function setMusicVolume(v) {
  const ctx = getCtx();
  getMusicGain().gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime + 0.04);
}

function note(freq, type, gainPeak, attackT, decayT, startOffset = 0) {
  const ctx  = getCtx();
  const t    = ctx.currentTime + startOffset;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getMasterGain()); // SFX chain
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + attackT);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attackT + decayT);
  osc.start(t);
  osc.stop(t + attackT + decayT);
}

/* Music note — routes through musicGainNode, not sfx chain */
function noteM(freq, type, gainPeak, attackT, decayT, startOffset = 0) {
  const ctx  = getCtx();
  const t    = ctx.currentTime + startOffset;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getMusicGain()); // music chain
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + attackT);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attackT + decayT);
  osc.start(t);
  osc.stop(t + attackT + decayT);
}

/* ── Per-theme placement sounds ── */
function sfxEgypt() {
  note(110,  'sine',     0.5,  0.01, 0.6);
  note(220,  'sine',     0.18, 0.01, 0.35);
  note(330,  'triangle', 0.08, 0.01, 0.2);
}
function sfxHindu() {
  note(660,  'sine', 0.35, 0.005, 0.9);
  note(1320, 'sine', 0.15, 0.005, 0.55);
  note(1980, 'sine', 0.07, 0.005, 0.3);
}

function sfxPlace(themeKey, player) {
  switch (themeKey) {
    case 'classic':
      // clean digital beep — X is high, O is low
      player === 'egypt'
        ? note(880, 'square', 0.14, 0.005, 0.10)
        : note(440, 'square', 0.14, 0.005, 0.10);
      break;
    case 'greek-norse':
      // brass-flavoured interval — Zeus majestically high, Norse growling low
      if (player === 'egypt') {
        note(261.63, 'triangle', 0.28, 0.01, 0.3);
        note(392,    'triangle', 0.14, 0.01, 0.25, 0.07);
      } else {
        note(130.81, 'triangle', 0.30, 0.01, 0.35);
        note(196,    'triangle', 0.12, 0.01, 0.28, 0.08);
      }
      break;
    case 'samurai-ninja':
      // Samurai: sharp koto strike; Ninja: muted low thud
      if (player === 'egypt') {
        note(493.88, 'triangle', 0.35, 0.002, 0.22);
        note(659.25, 'sine',     0.10, 0.005, 0.18, 0.04);
      } else {
        note(110, 'triangle', 0.40, 0.002, 0.18);
        note(165, 'sine',     0.08, 0.005, 0.14, 0.03);
      }
      break;
    case 'dragon-phoenix':
      // Dragon: deep pentatonic hit; Phoenix: bright rising chime
      if (player === 'egypt') {
        note(146.83, 'sine', 0.32, 0.005, 0.5);
        note(220,    'sine', 0.12, 0.005, 0.4, 0.1);
      } else {
        note(329.63, 'sine', 0.28, 0.005, 0.45);
        note(493.88, 'sine', 0.12, 0.005, 0.38, 0.09);
      }
      break;
    default: // egypt-hindu + random
      player === 'egypt' ? sfxEgypt() : sfxHindu();
  }
}

function sfxWin(player, themeKey) {
  switch (themeKey) {
    case 'classic':
      // clean digital triumphant chord burst
      (player === 'egypt'
        ? [523.25, 659.25, 783.99, 1046.5]
        : [440, 554.37, 659.25, 880]
      ).forEach((f, i) => note(f, 'square', 0.10, 0.005, 0.25, i * 0.09));
      break;
    case 'greek-norse':
      // brass-flavoured triumphant fanfare
      (player === 'egypt'
        ? [261.63, 329.63, 392, 523.25, 659.25]
        : [130.81, 196, 261.63, 392, 523.25]
      ).forEach((f, i) => note(f, 'triangle', 0.22, 0.01, 0.45, i * 0.11));
      break;
    case 'dragon-phoenix':
      // pentatonic Chinese-flavoured rising scale
      (player === 'egypt'
        ? [220, 261.63, 329.63, 392, 523.25]
        : [329.63, 392, 523.25, 659.25, 783.99]
      ).forEach((f, i) => note(f, 'sine', 0.22, 0.01, 0.42, i * 0.12));
      break;
    case 'samurai-ninja':
      // sharp koto-style ascending strike
      (player === 'egypt'
        ? [493.88, 587.33, 739.99, 987.77]
        : [146.83, 196, 261.63, 349.23]
      ).forEach((f, i) => note(f, 'triangle', 0.28, 0.002, 0.32, i * 0.09));
      break;
    default: { // egypt-hindu + random
      const base = player === 'egypt' ? 220 : 330;
      [1, 1.25, 1.5, 2].forEach((mul, i) => {
        note(base * mul, 'sine', 0.3, 0.01, 0.35, i * 0.13);
      });
    }
  }
}

function sfxDraw() {
  [440, 370, 330].forEach((f, i) => {
    note(f, 'sine', 0.2, 0.01, 0.4, i * 0.15);
  });
}

function sfxChaos(id) {
  switch (id) {
    case 'wild-turn':    // rapid ascending glissando
      [1,1.19,1.41,1.68,2].forEach((m,i) => note(220*m,'sine',0.18,0.01,0.18,i*0.07)); break;
    case 'swap-souls':   // two tones crossing
      note(330,'sine',0.22,0.01,0.4); note(220,'sine',0.22,0.01,0.4,0.1); note(330,'sine',0.15,0.01,0.3,0.22); break;
    case 'ghost-move':   // eerie high shimmer
      note(880,'sine',0.10,0.12,0.9); note(1320,'sine',0.05,0.15,0.7,0.05); break;
    case 'smite':        // impact + high ping
      note(55,'triangle',0.5,0.002,0.25); note(1760,'sine',0.20,0.005,0.5,0.04); break;
    case 'blessing':     // ascending arpeggio
      [261.63,329.63,392,523.25].forEach((f,i) => note(f,'sine',0.18,0.01,0.35,i*0.1)); break;
    case 'cursed-skip':  // descending minor
      [330,277.18,220].forEach((f,i) => note(f,'triangle',0.20,0.01,0.35,i*0.12)); break;
    case 'mirror':       // parallel tones
      note(261.63,'sine',0.18,0.02,0.5); note(523.25,'sine',0.10,0.02,0.5); break;
    case 'solar-flare':  // bright white burst
      [880,1320,1760,2200].forEach((f,i) => note(f,'sine',0.12,0.005,0.25,i*0.03)); break;
    case 'divine-lag':   // deep slow drone hit
      note(55,'sine',0.4,0.05,1.2); note(82.41,'sine',0.18,0.05,0.9); break;
    case 'holy-ground':  // pure bell
      note(523.25,'sine',0.22,0.005,1.4); note(1046.5,'sine',0.08,0.005,1.0,0.02); break;
    case 'phantom-veil': // eerie fade
      note(440,'sine',0.12,0.25,0.8); note(660,'sine',0.06,0.30,0.6,0.1); break;
    case 'treachery':    // descending betrayal motif
      [392,349.23,311.13,261.63].forEach((f,i) => note(f,'sawtooth',0.14,0.01,0.28,i*0.09)); break;
    case 'chaos-storm':  // rumble
      [55,65.41].forEach((f,i) => note(f,'sawtooth',0.25,0.03,0.4,i*0.05)); break;
  }
}

/* Background music — themed per currentTheme.music */
let musicPlaying = false;
let droneNodes   = null;
let melodyTimer  = null;
let melodyStep   = 0;

function startDrone() {
  const ctx = getCtx();
  const { droneFreqs, droneLfoFreq } = currentTheme.music;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
  out.connect(getMusicGain());

  const oscs = droneFreqs.map(({ freq, vol }) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    osc.connect(g);
    g.connect(out);
    osc.start();
    return osc;
  });

  const lfo  = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.setValueAtTime(droneLfoFreq, ctx.currentTime);
  lfoG.gain.setValueAtTime(0.055, ctx.currentTime);
  lfo.connect(lfoG);
  lfoG.connect(out.gain);
  lfo.start();

  return { oscs, lfo, out };
}

function stopDrone() {
  if (!droneNodes) return;
  const ctx   = getCtx();
  const nodes = droneNodes;
  droneNodes  = null;
  nodes.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
  setTimeout(() => {
    nodes.oscs.forEach(o => { try { o.stop(); } catch (_) {} });
    try { nodes.lfo.stop(); } catch (_) {}
  }, 1900);
}

function tickMelody() {
  if (!musicPlaying) return;
  const { scale, pattern, stepMs } = currentTheme.music;
  const idx = pattern[melodyStep % pattern.length];
  melodyStep++;
  if (idx >= 0) {
    const hz = scale[idx];
    noteM(hz,     'sine', 0.10, 0.04, 0.48);
    noteM(hz * 2, 'sine', 0.04, 0.04, 0.38);
    noteM(hz,     'sine', 0.04, 0.04, 0.38, 0.40);
  }
  melodyTimer = setTimeout(tickMelody, stepMs);
}

function toggleMusic() {
  musicPlaying = !musicPlaying;
  const btn = document.getElementById('btn-music');
  if (musicPlaying) {
    droneNodes = startDrone();
    tickMelody();
    btn.textContent = '🔇 Mute';
    btn.classList.add('on');
  } else {
    clearTimeout(melodyTimer);
    stopDrone();
    btn.textContent = '🎵 Music';
    btn.classList.remove('on');
  }
}
