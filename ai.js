/* ─────────────────────────────────────────────
   ai.js — Minimax AI with alpha-beta pruning
   Exposes: aiMode, aiThinking, getBestMove,
            scheduleAI, setMode
───────────────────────────────────────────── */
let aiMode     = null;   // null | 'easy' | 'medium' | 'hard'
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
  if (aiMode === 'easy')   return empty[randInt(empty.length)];
  if (aiMode === 'medium' && Math.random() < 0.5) return empty[randInt(empty.length)];
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
  if (!aiMode || gameState.currentPlayer !== HINDU || gameState.gameOver || introShowing || chaosShowing) return;
  aiThinking = true;
  boardEl.classList.add('ai-thinking');
  const p = currentTheme.players.hindu;
  statusEl.className = 'status-text hindu-msg';
  statusEl.innerHTML = `${p.name} ponders<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>`;
  const delay = aiMode === 'easy' ? 400 + Math.random() * 400
                                  : 500 + Math.random() * 300;
  setTimeout(() => {
    if (!aiThinking) return;
    aiThinking = false;
    boardEl.classList.remove('ai-thinking');
    handleClick(getBestMove([...gameState.board]), true);
  }, delay);
}

function setMode(mode) {
  aiMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(mode ? `mode-${mode}` : 'mode-2p').classList.add('active');
  document.querySelector('#card-hindu .player-title').textContent =
    mode ? (mode === 'hard' ? 'Ancient AI' : mode === 'medium' ? 'Medium AI' : 'Easy AI')
         : currentTheme.players.hindu.title;
  aiThinking = false;
  boardEl.classList.remove('ai-thinking');
  resetScores();
  savePrefs();
}
