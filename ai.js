/* ─────────────────────────────────────────────
   ai.js — Minimax AI with alpha-beta pruning
   Exposes: aiMode, aiThinking, getBestMove,
            scheduleAI, cancelAI, setMode
───────────────────────────────────────────── */
let aiMode     = null;   // null | 'easy' | 'medium' | 'hard'
let aiThinking = false;
let aiTimer    = null;   // pending AI move timeout (India AI or demo-mode Egypt)

function boardWinner(b) {
  for (const [a, x, c] of WIN_LINES) {
    if (b[a] && b[a] === b[x] && b[a] === b[c]) return b[a];
  }
  return null;
}

// Score from India's side: a win is worth 10 minus the moves it takes, so
// faster wins (and slower losses) score better. Always in [-10, 10];
// the sign alone says who wins with best play (0 = draw).
function minimax(b, isMax, alpha, beta, depth = 0) {
  const w = boardWinner(b);
  if (w === HINDU) return  10 - depth;
  if (w === EGYPT) return depth - 10;
  if (b.every(v => v))    return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = HINDU;
      best  = Math.max(best, minimax(b, false, alpha, beta, depth + 1));
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
      best  = Math.min(best, minimax(b, true, alpha, beta, depth + 1));
      b[i]  = null;
      beta  = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// First empty cell that completes a line for `player`, or -1.
function findWinningMove(b, player) {
  for (let i = 0; i < 9; i++) {
    if (b[i] !== null) continue;
    b[i] = player;
    const wins = boardWinner(b) === player;
    b[i] = null;
    if (wins) return i;
  }
  return -1;
}

function getBestMove(b) {
  const empty = b.reduce((a, v, i) => (v === null ? [...a, i] : a), []);
  if (aiMode === 'easy') return empty[randInt(empty.length)];

  // Win now if possible; otherwise stop an immediate Egypt win.
  // (Also what keeps Medium from missing a win or a block.)
  const win = findWinningMove(b, HINDU);
  if (win >= 0) return win;
  const block = findWinningMove(b, EGYPT);
  if (block >= 0) return block;

  // Medium: sees one move ahead only — after win/block, 35 % of the time it
  // plays a random cell, which leaves forks and traps for the player to find.
  if (aiMode === 'medium' && Math.random() < 0.35) return empty[randInt(empty.length)];

  // Hard AI: randomise opening to avoid always playing the same game
  const pieces = b.filter(v => v === EGYPT || v === HINDU).length;
  if (pieces === 0) {
    const openings = [0, 2, 4, 6, 8].filter(i => b[i] === null);
    if (openings.length) return openings[randInt(openings.length)];
  }
  if (pieces === 1 && b[4] === null && Math.random() < 0.6) return 4;

  // Best minimax score; ties go to the lowest index
  let best = empty[0], bestVal = -Infinity;
  for (const i of empty) {
    b[i] = HINDU;
    const val = minimax(b, false, -Infinity, Infinity, 1);
    b[i] = null;
    if (val > bestVal) { bestVal = val; best = i; }
  }
  return best;
}

// Cancels a pending AI move (e.g. the round was restarted mid-think) so a
// stale move can never land on the next board.
function cancelAI() {
  clearTimeout(aiTimer);
  aiTimer    = null;
  aiThinking = false;
  boardEl.classList.remove('ai-thinking');
}

function scheduleAI() {
  if (!aiMode || gameState.currentPlayer !== HINDU || gameState.gameOver || aiThinking ||
      introShowing || chaosShowing || chaosState.lagActive) return;
  aiThinking = true;
  boardEl.classList.add('ai-thinking');
  const p = currentTheme.players.hindu;
  statusEl.className = 'status-text hindu-msg';
  statusEl.innerHTML = `${p.name} ponders<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>`;
  const delay = aiMode === 'easy' ? 400 + Math.random() * 400
                                  : 500 + Math.random() * 300;
  aiTimer = setTimeout(() => {
    aiTimer    = null;
    aiThinking = false;
    boardEl.classList.remove('ai-thinking');
    handleClick(getBestMove(rulesBoard()), true);
  }, delay);
}

function setMode(mode) {
  aiMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(mode ? `mode-${mode}` : 'mode-2p').classList.add('active');
  document.querySelector('#card-hindu .player-title').textContent =
    mode ? (mode === 'hard' ? 'Ancient AI' : mode === 'medium' ? 'Medium AI' : 'Easy AI')
         : currentTheme.players.hindu.title;
  cancelAI();
  resetScores();
  savePrefs();
}

// CommonJS export for Jest (browser loads this as a plain <script>).
if (typeof module !== 'undefined') {
  module.exports = { getBestMove, minimax, boardWinner, setAiMode: m => { aiMode = m; } };
}
