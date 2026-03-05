/* ─────────────────────────────────────────────
   Audio (Web Audio API — no files needed)
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

/* ─────────────────────────────────────────────
   Background Music — Bhairav raga
───────────────────────────────────────────── */
let musicPlaying = false;
let droneNodes   = null;
let melodyTimer  = null;
let melodyStep   = 0;

const SCALE_HZ = [110, 116.54, 138.59, 146.83, 164.81, 174.61, 207.65, 220, 246.94];
const PATTERN  = [4,3,2,4, 6,4,3,2, 1,0,2,3, -1, 6,7,6,4, 3,4,-1, 2,0,-1, 4,2,0,-1];
const STEP_MS  = 560;

function startDrone() {
  const ctx = getCtx();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
  out.connect(ctx.destination);

  const layers = [
    { freq: 55,     vol: 0.22 },
    { freq: 82.41,  vol: 0.13 },
    { freq: 110,    vol: 0.10 },
    { freq: 164.81, vol: 0.06 },
  ];
  const oscs = layers.map(({ freq, vol }) => {
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
  lfo.frequency.setValueAtTime(0.11, ctx.currentTime);
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
  const idx = PATTERN[melodyStep % PATTERN.length];
  melodyStep++;
  if (idx >= 0) {
    const hz = SCALE_HZ[idx];
    note(hz,     'sine', 0.10, 0.04, 0.48);
    note(hz * 2, 'sine', 0.04, 0.04, 0.38);
    note(hz,     'sine', 0.04, 0.04, 0.38, 0.40);
  }
  melodyTimer = setTimeout(tickMelody, STEP_MS);
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

/* ─────────────────────────────────────────────
   AI — minimax with alpha-beta pruning
───────────────────────────────────────────── */
let aiMode     = null;
let aiThinking = false;

function boardWinner(b) {
  for (const [a, x, c] of WIN_LINES) {
    if (b[a] && b[a] === b[x] && b[a] === b[c]) return b[a];
  }
  return null;
}

function minimax(b, isMax, alpha, beta) {
  const w = boardWinner(b);
  if (w === HINDU) return  10;
  if (w === EGYPT) return -10;
  if (b.every(v => v))    return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = HINDU;
      best  = Math.max(best, minimax(b, false, alpha, beta));
      b[i]  = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = EGYPT;
      best  = Math.min(best, minimax(b, true, alpha, beta));
      b[i]  = null;
      beta  = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function getBestMove(b) {
  const empty = b.reduce((a, v, i) => (v ? a : [...a, i]), []);
  if (aiMode === 'easy') return empty[Math.floor(Math.random() * empty.length)];
  let best = -Infinity, move = empty[0];
  for (const i of empty) {
    b[i]      = HINDU;
    const val = minimax(b, false, -Infinity, Infinity);
    b[i]      = null;
    if (val > best) { best = val; move = i; }
  }
  return move;
}

function scheduleAI() {
  if (!aiMode || current !== HINDU || gameOver) return;
  aiThinking = true;
  boardEl.classList.add('ai-thinking');
  const delay = aiMode === 'easy' ? 400 + Math.random() * 400
                                  : 500 + Math.random() * 300;
  setTimeout(() => {
    if (!aiThinking) return;
    aiThinking = false;
    boardEl.classList.remove('ai-thinking');
    handleClick(getBestMove([...board]));
  }, delay);
}

function setMode(mode) {
  aiMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(mode ? `mode-${mode}` : 'mode-2p').classList.add('active');
  document.querySelector('#card-hindu .player-title').textContent =
    mode ? (mode === 'hard' ? 'Ancient AI' : 'Easy AI') : 'Divine Om';
  aiThinking = false;
  boardEl.classList.remove('ai-thinking');
  resetScores();
}

/* ─────────────────────────────────────────────
   Game state
───────────────────────────────────────────── */
const EGYPT = 'egypt';
const HINDU = 'hindu';

const SYMBOLS = { egypt: '☥', hindu: 'ॐ' };
const LABELS  = { egypt: "Egypt's turn — Place the Ankh ☥",
                  hindu: "India's turn — Invoke the Om ॐ" };
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

let board    = Array(9).fill(null);
let current  = EGYPT;
let gameOver = false;
let scores   = { egypt: 0, hindu: 0, draws: 0 };

/* ─────────────────────────────────────────────
   DOM refs
───────────────────────────────────────────── */
const boardEl    = document.getElementById('board');
const statusEl   = document.getElementById('status');
const auraEl     = document.getElementById('board-aura');
const cardEgypt  = document.getElementById('card-egypt');
const cardHindu  = document.getElementById('card-hindu');
const scoreEgypt = document.getElementById('score-egypt');
const scoreHindu = document.getElementById('score-hindu');
const drawsEl    = document.getElementById('draws');

/* ─────────────────────────────────────────────
   Render board
───────────────────────────────────────────── */
function renderBoard(winCells = []) {
  boardEl.innerHTML = '';
  board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (val) {
      cell.classList.add('taken', `${val}-cell`);
      cell.textContent = SYMBOLS[val];
    }
    if (winCells.includes(i)) cell.classList.add('win-cell');
    cell.addEventListener('click', () => handleClick(i));
    boardEl.appendChild(cell);
  });
}

/* ─────────────────────────────────────────────
   Update card highlights
───────────────────────────────────────────── */
function updateTurnUI() {
  cardEgypt.classList.toggle('active-turn', current === EGYPT && !gameOver);
  cardHindu.classList.toggle('active-turn', current === HINDU && !gameOver);
}

/* ─────────────────────────────────────────────
   Board aura color
───────────────────────────────────────────── */
function setAura(player, win = false) {
  if (player === EGYPT) {
    auraEl.style.background = win
      ? 'radial-gradient(ellipse at center, rgba(212,160,23,.35) 0%, transparent 75%)'
      : 'radial-gradient(ellipse at center, rgba(212,160,23,.12) 0%, transparent 70%)';
  } else if (player === HINDU) {
    auraEl.style.background = win
      ? 'radial-gradient(ellipse at center, rgba(255,107,53,.45) 0%, transparent 75%)'
      : 'radial-gradient(ellipse at center, rgba(255,107,53,.18) 0%, transparent 70%)';
  } else {
    auraEl.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,.07) 0%, transparent 70%)';
  }
}

/* ─────────────────────────────────────────────
   Check winner
───────────────────────────────────────────── */
function checkWinner() {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], cells: line };
    }
  }
  if (board.every(v => v !== null)) return { winner: 'draw', cells: [] };
  return null;
}

/* ─────────────────────────────────────────────
   Handle cell click
───────────────────────────────────────────── */
function handleClick(i) {
  if (gameOver || board[i] || aiThinking) return;
  if (aiMode && current === HINDU) return;
  board[i] = current;
  const result = checkWinner();

  if (result) {
    gameOver = true;
    renderBoard(result.cells);

    if (result.winner === 'draw') {
      sfxDraw();
      scores.draws++;
      drawsEl.textContent  = scores.draws;
      statusEl.className   = 'status-text draw-msg';
      statusEl.textContent = '⚖️  A sacred draw — The gods are balanced';
      cardEgypt.classList.remove('active-turn');
      cardHindu.classList.remove('active-turn');
      setAura(null);
    } else {
      const w = result.winner;
      sfxWin(w);
      scores[w]++;
      (w === EGYPT ? scoreEgypt : scoreHindu).textContent = scores[w];
      statusEl.className   = `status-text ${w}-msg`;
      statusEl.textContent = w === EGYPT
        ? '🏆 Egypt Triumphs! The Pharaoh\u2019s Ankh prevails! \u2625'
        : '🏆 India Triumphs! The Divine Om is victorious! ॐ';
      cardEgypt.classList.toggle('active-turn', w === EGYPT);
      cardHindu.classList.toggle('active-turn', w === HINDU);
      setAura(w, true);
    }
  } else {
    current === EGYPT ? sfxEgypt() : sfxHindu();
    renderBoard();
    current = current === EGYPT ? HINDU : EGYPT;
    statusEl.className  = `status-text ${current}-msg`;
    statusEl.textContent = LABELS[current];
    setAura(current);
    updateTurnUI();
    scheduleAI();
  }
}

/* ─────────────────────────────────────────────
   New round
───────────────────────────────────────────── */
function newRound() {
  board    = Array(9).fill(null);
  gameOver = false;
  current  = (scores.egypt + scores.hindu + scores.draws) % 2 === 0 ? EGYPT : HINDU;
  statusEl.className  = `status-text ${current}-msg`;
  statusEl.textContent = LABELS[current];
  setAura(current);
  renderBoard();
  updateTurnUI();
  scheduleAI();
}

/* ─────────────────────────────────────────────
   Reset scores
───────────────────────────────────────────── */
function resetScores() {
  scores = { egypt: 0, hindu: 0, draws: 0 };
  scoreEgypt.textContent = 0;
  scoreHindu.textContent = 0;
  drawsEl.textContent    = 0;
  newRound();
}

/* ─────────────────────────────────────────────
   Event listeners
───────────────────────────────────────────── */
document.getElementById('btn-restart').addEventListener('click', newRound);
document.getElementById('btn-reset').addEventListener('click', resetScores);
document.getElementById('btn-music').addEventListener('click', toggleMusic);
document.getElementById('mode-2p').addEventListener('click',   () => setMode(null));
document.getElementById('mode-easy').addEventListener('click', () => setMode('easy'));
document.getElementById('mode-hard').addEventListener('click', () => setMode('hard'));

/* ─────────────────────────────────────────────
   Init
───────────────────────────────────────────── */
setAura(EGYPT);
renderBoard();
