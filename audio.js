/* ─────────────────────────────────────────────
   audio.js — Web Audio API (no files needed)
   Exposes: sfxEgypt, sfxHindu, sfxWin, sfxDraw,
            toggleMusic, startDrone, stopDrone
───────────────────────────────────────────── */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function note(freq, type, gainPeak, attackT, decayT, startOffset = 0) {
  const ctx  = getCtx();
  const t    = ctx.currentTime + startOffset;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + attackT);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attackT + decayT);
  osc.start(t);
  osc.stop(t + attackT + decayT);
}

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

function sfxWin(player) {
  const base = player === 'egypt' ? 220 : 330;
  [1, 1.25, 1.5, 2].forEach((mul, i) => {
    note(base * mul, 'sine', 0.3, 0.01, 0.35, i * 0.13);
  });
}

function sfxDraw() {
  [440, 370, 330].forEach((f, i) => {
    note(f, 'sine', 0.2, 0.01, 0.4, i * 0.15);
  });
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
  out.connect(ctx.destination);

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
    note(hz,     'sine', 0.10, 0.04, 0.48);
    note(hz * 2, 'sine', 0.04, 0.04, 0.38);
    note(hz,     'sine', 0.04, 0.04, 0.38, 0.40);
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
