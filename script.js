
/* ─────────────────────────────────────────────
   Constants
   EGYPT, HINDU, WIN_LINES come from gameLogic.js
───────────────────────────────────────────── */
const SYMBOLS = { egypt: '☥', hindu: 'ॐ' };
const LABELS  = { egypt: "Egypt's turn — Place the Ankh ☥",
                  hindu: "India's turn — Invoke the Om ॐ" };

/* Appends move-count / urgency suffix when game is in its later moves */
function buildTurnLabel(player) {
  const moveNum = moveLog.length + 1;
  const base    = LABELS[player];
  if (moveNum <= 4) return base;
  if (moveNum >= 9) return base + ' · ⚡ Final move!';
  if (moveNum >= 7) return base + ` · Move ${moveNum} · Last chance!`;
  return base + ` · Move ${moveNum}`;
}

/* ─────────────────────────────────────────────
   Game state
   Single source of truth for everything that
   changes during play. Audio and AI flags live
   separately because they are not game logic.

   gameState.board         — flat 9-cell array, each null | EGYPT | HINDU
   gameState.currentPlayer — whose turn it is right now
   gameState.gameOver      — true once a winner/draw is found; blocks moves
   gameState.scores        — session tally; survives newRound(), cleared only
                             by resetScores()
───────────────────────────────────────────── */
const gameState = {
  board:         Array(9).fill(null),
  currentPlayer: EGYPT,
  gameOver:      false,
  scores:        { egypt: 0, hindu: 0, draws: 0 },
  streaks:       { egypt: 0, hindu: 0 },
  lastWinner:    null,
  history:       [],   // move snapshots for undo
};

// Resets only the per-round fields; leaves scores untouched.
function resetBoard() {
  gameState.board     = Array(9).fill(null);
  gameState.gameOver  = false;
}

/* ─────────────────────────────────────────────
   DOM refs
───────────────────────────────────────────── */
const boardEl    = document.getElementById('board');
const boardWrapEl = boardEl.closest('.board-wrapper');
const statusEl   = document.getElementById('status');
const auraEl     = document.getElementById('board-aura');
const winLineEl  = document.getElementById('win-line');
const cardEgypt  = document.getElementById('card-egypt');
const cardHindu  = document.getElementById('card-hindu');
const scoreEgypt = document.getElementById('score-egypt');
const scoreHindu = document.getElementById('score-hindu');
const drawsEl    = document.getElementById('draws');

/* ─────────────────────────────────────────────
   Fun-mode state
───────────────────────────────────────────── */
let cosmicMode    = false;
let cosmicAngle   = 0;
let sandstormMode = false;
let fogMode       = false;
let introShowing   = false;
let introTimer     = null;
let lastPlacedCell = -1;   // index of most-recently placed piece (drives .fresh animation)

/* ─────────────────────────────────────────────
   Tournament / match state
───────────────────────────────────────────── */
let matchTarget = 0;   // 0 = free play, 3/5/7 = best-of-N

/* ─────────────────────────────────────────────
   Move log (board snapshots for replay)
───────────────────────────────────────────── */
let gameLog   = [];   // Array of board snapshots after each move
let replaying = false;
let replayTimer = null;
// Round-scoped timers: delayed actions that belong to the current round
// (move toasts, status restores, Divine Lag end, win seal, match victory,
// demo auto-restart, …). newRound() and undo() cancel them all, so nothing
// from an old round or an undone move can fire late. Use plain setTimeout
// only for cosmetic cleanup that must always run (e.g. removing a CSS class).
const _roundTimers = new Set();
function roundTimeout(fn, ms) {
  const id = setTimeout(() => { _roundTimers.delete(id); fn(); }, ms);
  _roundTimers.add(id);
  return id;
}
function cancelRoundTimers() {
  _roundTimers.forEach(clearTimeout);
  _roundTimers.clear();
  clearTimeout(hintTimer);
}
let hintUsedThisGame  = false;   // true once showHint() fires this round
let trailedInMatch    = false;   // true once opponent had 2+ wins while player had 0
let spectatorMode  = false;       // AI vs AI demo mode
let _prevAiMode    = null;        // aiMode saved before spectator starts
let spectatorDelay = 2800;        // ms between auto-rounds in demo mode
let moveLog  = [];               // [{player, pos, turn}] per-round move history
let chaosLog = [];               // [{icon, name}] chaos events that fired this round
const POS_LABELS = ['A1','B1','C1','A2','B2','C2','A3','B3','C3'];
let _dykIdx  = Math.floor(Math.random() * (DID_YOU_KNOW ? DID_YOU_KNOW.length : 20));
function maybeShowTip() {
  if (!DID_YOU_KNOW || Math.random() > 0.25) return;
  const tip = DID_YOU_KNOW[_dykIdx % DID_YOU_KNOW.length];
  _dykIdx++;
  roundTimeout(() => showChaosEvent(tip, 4800), 3500);
}

/* ─────────────────────────────────────────────
   Auto-save / restore mid-game
───────────────────────────────────────────── */
const GAME_SAVE_KEY = 'ehttt-game';

function autoSaveGame() {
  // Demo games aren't the player's to resume.
  if (gameState.gameOver || spectatorMode) { clearGameSave(); return; }
  try {
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify({
      board:         gameState.board,
      currentPlayer: gameState.currentPlayer,
      scores:        gameState.scores,
      cosmicAngle:   cosmicAngle,
      moveLog:       moveLog,
      gameLog:       gameLog,
      lastPlacedCell: lastPlacedCell,
      streaks:       gameState.streaks,
      lastWinner:    gameState.lastWinner,
      chaosRules:    chaosMode ? activeChaosRules.map(r => r.id) : [],
      chaosState:    chaosState,
      chaosLog:      chaosLog,
    }));
  } catch(_) {}
}

function clearGameSave() {
  try { localStorage.removeItem(GAME_SAVE_KEY); } catch(_) {}
}

// The save offered by the restore banner. Kept in memory because playing on
// before answering the banner auto-saves over it in localStorage.
let offeredSave = null;

function tryRestoreGame() {
  try {
    const raw = localStorage.getItem(GAME_SAVE_KEY);
    if (!raw) return;
    const g = JSON.parse(raw);
    if (!g.board || !g.board.some(v => v)) { clearGameSave(); return; }
    offeredSave = g;
    // Show restore banner
    const banner = document.getElementById('restore-banner');
    if (banner) banner.style.display = '';
  } catch(_) {}
}

function applyRestore() {
  try {
    const g = offeredSave;
    offeredSave = null;
    if (!g) return;
    cancelAI();
    cancelRoundTimers();
    stopReplay();
    clearTimer();
    gameState.history       = [];   // undo snapshots belong to the replaced board
    gameState.board         = g.board;
    gameState.currentPlayer = g.currentPlayer || EGYPT;
    gameState.scores        = g.scores || { egypt: 0, hindu: 0, draws: 0 };
    cosmicAngle   = g.cosmicAngle || 0;
    moveLog       = g.moveLog    || [];
    // Older saves have no replay log; replay then can't line up with the moves.
    gameLog       = Array.isArray(g.gameLog) && g.gameLog.length === moveLog.length ? g.gameLog : [];
    lastPlacedCell = g.lastPlacedCell != null ? g.lastPlacedCell : -1;
    gameState.streaks    = g.streaks || { egypt: 0, hindu: 0 };
    gameState.lastWinner = g.lastWinner || null;
    gameState.gameOver = false;
    restoreChaos(g);
    updateBoardTransform();   // cosmic angle (+ mirror, if restored)
    clearGameSave();
    scoreEgypt.textContent = gameState.scores.egypt;
    scoreHindu.textContent = gameState.scores.hindu;
    drawsEl.textContent    = gameState.scores.draws;
    renderBoard([]);
    updateTurnUI();
    updateMoveLog();
    updateUndoBtn();
    updateBoardColor();
    updateEvalBar(gameState.currentPlayer === HINDU);
    updateSessionRate();
    updateStreakBadges();
    statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
    statusEl.textContent = LABELS[gameState.currentPlayer];
    showChaosEvent('♻ Game restored!', 2200);
    // Saved mid-think (India to move vs AI)? Resume the AI; otherwise the human's timer.
    scheduleAI();
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
  } catch(_) {}
}

// Bring back the saved game's chaos rules (only if Chaos mode is still on).
const CHAOS_USED_FLAGS = {
  'wild-turn': 'wildUsed', 'swap-souls': 'swapUsed', smite: 'smiteUsed',
  blessing: 'blessingUsed', mirror: 'mirrorUsed', 'solar-flare': 'solarUsed',
  'divine-lag': 'lagUsed', treachery: 'treacheryUsed',
};
function restoreChaos(g) {
  if (!chaosMode || !Array.isArray(g.chaosRules) || !g.chaosRules.length) return;
  const rules = CHAOS_RULES.filter(r => g.chaosRules.includes(r.id));
  if (!rules.length) return;
  activeChaosRules = rules;
  // A Divine Lag freeze has no timer left to end it after a reload.
  chaosState = { ...chaosState, ...(g.chaosState || {}), lagActive: false };
  chaosLog   = Array.isArray(g.chaosLog) ? g.chaosLog : [];
  updateChaosBar();
  Object.entries(CHAOS_USED_FLAGS).forEach(([id, flag]) => { if (chaosState[flag]) markChaosUsed(id); });
  if (chaosLog.some(e => e.name === 'Cursed Skip') && !chaosState.skipNext) markChaosUsed('cursed-skip');
}

/* ─────────────────────────────────────────────
   Editable player names
───────────────────────────────────────────── */
// Names the players typed in; '' = use the theme's name. Kept across theme
// changes. Everything that shows a player's name goes through playerName().
const customNames = { egypt: '', hindu: '' };
function playerName(player) {
  return customNames[player] || currentTheme.players[player].name;
}
function setCustomName(player, raw) {
  const name = (raw || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  customNames[player] = name && name !== currentTheme.players[player].name ? name : '';
  const el = document.getElementById(`name-${player}`);
  if (el) el.textContent = playerName(player);
  setPlayerLabel(player);
}

// Custom names can contain anything, so escape them before using innerHTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// "<name> ponders..." status while an AI is thinking
function showPondering(player) {
  statusEl.className = `status-text ${player}-msg`;
  statusEl.innerHTML = `${escapeHtml(playerName(player))} ponders<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>`;
}

// Turn label uses the player's (possibly custom) name.
function setPlayerLabel(player) {
  const theme = currentTheme.players[player].label;
  LABELS[player] = customNames[player]
    ? `${customNames[player]}'s turn — ${theme.split('—')[1]?.trim() || ''}`
    : theme;
  // Refresh status bar if it's currently this player's turn
  if (!gameState.gameOver && gameState.currentPlayer === player) {
    statusEl.textContent = LABELS[player];
  }
}

function initEditableNames() {
  [{ id: 'name-egypt', player: EGYPT }, { id: 'name-hindu', player: HINDU }].forEach(({ id, player }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      // Prevent pasting rich text or line breaks
    });
    el.addEventListener('blur', () => {
      setCustomName(player, el.textContent);
      savePrefs();
    });
  });
}

/* ─────────────────────────────────────────────
   Timed-mode state
───────────────────────────────────────────── */
let timedMode     = false;
let timerInterval = null;
let timerLeft     = 15;
let timerSeconds  = 15;  // configurable timer duration

/* ─────────────────────────────────────────────
   AI vs AI spectator mode
───────────────────────────────────────────── */
function scheduleSpectatorAI() {
  if (!spectatorMode || gameState.currentPlayer !== EGYPT || gameState.gameOver ||
      aiThinking || introShowing || chaosShowing || chaosState.lagActive) return;
  aiThinking = true;
  boardEl.classList.add('ai-thinking');
  showPondering(EGYPT);
  const _speedScale = spectatorDelay / 2800;
  const delay = (480 + Math.random() * 520) * _speedScale;
  const snapBoard = rulesBoard();
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (!spectatorMode || gameState.currentPlayer !== EGYPT || gameState.gameOver) {
      aiThinking = false;
      boardEl.classList.remove('ai-thinking');
      return;
    }
    aiThinking = false;
    boardEl.classList.remove('ai-thinking');
    handleClick(getHintMove(snapBoard, EGYPT));
  }, delay);
}

function toggleSpectator() {
  spectatorMode = !spectatorMode;
  const btn       = document.getElementById('btn-spectator');
  const speedSel  = document.getElementById('spectator-speed');
  if (spectatorMode) {
    _prevAiMode = aiMode;
    aiMode = 'hard';  // HINDU will auto-play via existing scheduleAI()
    btn.textContent = '⏹ Stop';
    btn.classList.add('on');
    if (speedSel) speedSel.style.display = '';
    showChaosEvent('👁 AI Demo — sit back and watch!', 2800);
    newRound();
  } else {
    aiMode = _prevAiMode;
    btn.textContent = '👁 Demo';
    btn.classList.remove('on');
    if (speedSel) speedSel.style.display = 'none';
    // Restore mode-button UI
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(aiMode ? `mode-${aiMode}` : 'mode-2p').classList.add('active');
    newRound();
  }
}

/* ─────────────────────────────────────────────
   AI personality taunts (per theme)
───────────────────────────────────────────── */
const AI_TAUNTS = {
  'egypt-hindu': [
    "The scales of Ma'at tip in my favour. Your fate is sealed. ☥",
    "Ra himself guided that move. You cannot outrun divinity.",
    "Even the Great Pyramid fell one stone at a time. So does your defence.",
    "The Divine Om resonates with inevitable victory. 🪷",
  ],
  'classic': [
    "Geometrically inevitable.",
    "Your next three moves all end the same way.",
    "The algorithm does not forgive suboptimal play.",
    "Mathematical certainty achieved.",
  ],
  'greek-norse': [
    "By Zeus's thunder, this position is mine! ⚡",
    "Odin sacrificed an eye for wisdom. I used it to crush you. ⚔️",
    "The Fates have already woven your defeat, mortal.",
    "Valhalla awaits the bold — and the tactically superior.",
  ],
  'dragon-phoenix': [
    "The Dragon's fire consumes all obstacles. 龍",
    "The Phoenix rises from YOUR ashes. 🌟",
    "Five thousand years of strategy. I remember all of it.",
    "Ancient wisdom from the time of the Yellow Emperor.",
  ],
  'samurai-ninja': [
    "Bushido demands excellence. That move was excellent. ⛩",
    "The shadow strikes before you see it move. 🥷",
    "My blade finds the gap in every defence.",
    "In silence, the battle was won three moves ago.",
  ],
};

/* ─────────────────────────────────────────────
   Haptic feedback
───────────────────────────────────────────── */
function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
}

/* ─────────────────────────────────────────────
   Move timer
───────────────────────────────────────────── */
function onTimerExpire() {
  if (gameState.gameOver || aiThinking) return;
  if (aiMode && gameState.currentPlayer === HINDU) return; // AI handles itself
  const empty = rulesBoard().reduce((a, v, i) => v === null ? [...a, i] : a, []);
  if (empty.length) handleClick(empty[randInt(empty.length)]);
}

function clearTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  const wrap = document.getElementById('timer-wrap');
  if (wrap) wrap.classList.remove('active');
}

function startTimer() {
  clearTimer();
  if (!timedMode || gameState.gameOver || introShowing || chaosShowing) return;
  if (aiMode && gameState.currentPlayer === HINDU) return; // no timer for AI

  const SECS = timerSeconds;
  timerLeft = SECS;
  const fill = document.getElementById('timer-fill');
  const wrap = document.getElementById('timer-wrap');

  fill.classList.remove('urgent');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  wrap.classList.add('active');
  void fill.offsetWidth; // force reflow before animation
  fill.style.transition = `width ${SECS}s linear`;
  fill.style.width = '0%';

  timerInterval = setInterval(() => {
    timerLeft--;
    if (timerLeft <= Math.min(5, Math.floor(SECS / 3))) fill.classList.add('urgent');
    if (timerLeft > 0 && timerLeft <= 3) sfxTimerTick();
    if (timerLeft <= 0) { clearTimer(); onTimerExpire(); }
  }, 1000);
}

/* ─────────────────────────────────────────────
   Undo
───────────────────────────────────────────── */
function updateUndoBtn() {
  const btn = document.getElementById('btn-undo');
  if (btn) btn.disabled = !gameState.history.length || !!aiThinking || spectatorMode;
}

function saveSnapshot() {
  gameState.history.push({
    board:         [...gameState.board],
    currentPlayer: gameState.currentPlayer,
    cosmicAngle,
    boardFilter:   boardEl.style.filter,
    chaosState:    { ...chaosState },
    // Undo may follow a win/draw, so keep everything the result changes.
    scores:        { ...gameState.scores },
    streaks:       { ...gameState.streaks },
    lastWinner:    gameState.lastWinner,
    trailedInMatch,
    allTimeStats:  JSON.stringify(loadAllTimeStats()),
    moveLogLen:    moveLog.length,
    gameLogLen:    gameLog.length,
    chaosLogLen:   chaosLog.length,
  });
  if (gameState.history.length > 12) gameState.history.shift();
  updateUndoBtn();
}

function undo() {
  if (!gameState.history.length || aiThinking || spectatorMode) return;
  const snap = gameState.history.pop();
  const wasOver = gameState.gameOver;
  cancelRoundTimers();

  gameState.board         = snap.board;
  gameState.currentPlayer = snap.currentPlayer;
  gameState.gameOver      = false;
  gameState.lastWinCells  = [];

  // Take back the undone moves from the logs (move list, replay, summary)
  moveLog.length  = snap.moveLogLen;
  gameLog.length  = snap.gameLogLen;
  chaosLog.length = snap.chaosLogLen;
  updateMoveLog();

  // Undoing a finished game also takes back its result (achievements stay)
  if (wasOver) {
    stopReplay();
    hideWinSeal();
    document.getElementById('match-victory').classList.remove('visible');
    gameState.scores     = { ...snap.scores };
    gameState.streaks    = { ...snap.streaks };
    gameState.lastWinner = snap.lastWinner;
    trailedInMatch       = snap.trailedInMatch;
    saveAllTimeStats(JSON.parse(snap.allTimeStats));
    scoreEgypt.textContent = gameState.scores.egypt;
    scoreHindu.textContent = gameState.scores.hindu;
    drawsEl.textContent    = gameState.scores.draws;
    updateMatchPips();
    updateStreakBadges();
    updateSessionRate();
    updateRankBadges();
    document.getElementById('btn-replay').style.display   = 'none';
    document.getElementById('btn-analysis').style.display = 'none';
    document.getElementById('btn-hint').disabled = false;
  }

  cosmicAngle  = snap.cosmicAngle;
  chaosState   = { ...snap.chaosState };

  aiThinking = false;
  lastPlacedCell = -1;
  boardEl.classList.remove('ai-thinking', 'game-over');
  boardEl.style.filter = snap.boardFilter;
  updateBoardTransform();
  clearWinLine();
  clearTimer();
  cardEgypt.classList.remove('winner-glow', 'match-point');
  cardHindu.classList.remove('winner-glow', 'match-point');

  statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
  statusEl.textContent = LABELS[gameState.currentPlayer];
  setAura(gameState.currentPlayer);
  renderBoard();
  updateTurnUI();
  updateUndoBtn();
  boardEl.classList.add('undo-shake');
  setTimeout(() => boardEl.classList.remove('undo-shake'), 380);
  if (timedMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
}

/* ─────────────────────────────────────────────
   Share result
───────────────────────────────────────────── */
function shareResult() {
  const p1 = currentTheme.players.egypt;
  const p2 = currentTheme.players.hindu;
  const { egypt, hindu, draws } = gameState.scores;
  const drawPart = draws ? ` (${draws} draw${draws > 1 ? 's' : ''})` : '';
  // Emoji board grid (Wordle-style)
  const sym = v => v === EGYPT ? p1.symbol : v === HINDU ? p2.symbol : '·';
  const gridRows = [0, 3, 6].map(r => [0,1,2].map(c => sym(gameState.board[r+c])).join(' '));
  const text = `${p1.symbol} ${playerName(EGYPT)} ${egypt}–${hindu} ${playerName(HINDU)} ${p2.symbol}${drawPart}\n${gridRows.join('\n')}\nEgyptian & Hindu Tic-Tac-Toe`;
  const btn  = document.getElementById('btn-share');
  if (navigator.share) {
    navigator.share({ title: 'Ancient Tic-Tac-Toe', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    }).catch(() => {});
  }
}

/* ─────────────────────────────────────────────
   Tournament — match pips & victory overlay
───────────────────────────────────────────── */
function updateMatchPips() {
  const pipsEgypt = document.getElementById('pips-egypt');
  const pipsHindu = document.getElementById('pips-hindu');
  if (!matchTarget) { pipsEgypt.innerHTML = ''; pipsHindu.innerHTML = ''; return; }
  const winsNeeded = Math.ceil(matchTarget / 2);
  [[EGYPT, pipsEgypt], [HINDU, pipsHindu]].forEach(([p, el]) => {
    const wins = gameState.scores[p];
    el.innerHTML = '';
    for (let i = 0; i < winsNeeded; i++) {
      const pip = document.createElement('div');
      pip.className = 'match-pip' + (i < wins ? ' filled' : '');
      el.appendChild(pip);
    }
    const remaining = winsNeeded - wins;
    if (remaining > 0 && !gameState.gameOver) {
      const need = document.createElement('div');
      need.className = 'match-need';
      need.textContent = remaining === 1 ? '⚡ MATCH POINT' : `need ${remaining} more`;
      el.appendChild(need);
    }
    // Pulse the card when at match point
    const card = document.getElementById(`card-${p}`);
    if (card) card.classList.toggle('match-point', remaining === 1 && !gameState.gameOver && matchTarget > 0);
  });
}

function showMatchVictory(winner) {
  const p = currentTheme.players[winner];
  const winsNeeded = Math.ceil(matchTarget / 2);
  document.getElementById('mv-symbol').textContent  = p.symbol;
  document.getElementById('mv-title').textContent   = `${playerName(winner)} Conquers the Match!`;
  document.getElementById('mv-subtitle').textContent =
    `First to ${winsNeeded} — Best of ${matchTarget} complete`;
  document.getElementById('match-victory').classList.add('visible');
  burstParticles(winner);
}

/* ─────────────────────────────────────────────
   Handle cell click
   Central game-loop function — called by both
   human clicks and the AI after its delay.
───────────────────────────────────────────── */
function handleClick(i, fromAI = false) {
  const { board, currentPlayer } = gameState;

  // Guards
  if (gameState.gameOver || board[i] || aiThinking || chaosState.lagActive) return;
  if (!fromAI && aiMode && currentPlayer === HINDU) return;
  if (chaosMode && chaosHas('holy-ground') && chaosState.holyCell === i) {
    sfxChaos('holy-ground');
    showChaosEvent('⛪ HOLY GROUND! That sacred cell is divinely forbidden!', 1600);
    return;
  }

  // Clear move timer as soon as a move is registered, and drop a pending hint
  // restore — it would put the previous player's status text back.
  clearTimer();
  clearTimeout(hintTimer);

  // Save snapshot for undo (human moves only)
  if (!aiMode || currentPlayer === EGYPT) saveSnapshot();

  // ── CHAOS: Cursed Skip ─────────────────────────────────────────────
  if (chaosMode && chaosState.skipNext === currentPlayer) {
    chaosState.skipNext = null;
    markChaosUsed('cursed-skip');
    showChaosEvent(`💀 CURSED SKIP! ${playerName(currentPlayer)}'s turn is OBLITERATED by ancient forces!`);
    gameState.currentPlayer = getNextPlayer(currentPlayer);
    statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
    statusEl.textContent = LABELS[gameState.currentPlayer];
    setAura(gameState.currentPlayer);
    renderBoard();   // fog and the hover symbol depend on whose turn it is
    updateTurnUI();
    scheduleAI();
    scheduleSpectatorAI();
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
    autoSaveGame();
    return;
  }

  // Haptic feedback on placement
  vibrate(22);

  // Capture board for move quality badge (before placing)
  const _snapForBadge = [...board];
  const _isHumanMove  = !aiMode || currentPlayer === EGYPT;
  const _clickedI     = i;

  // Place piece
  board[i] = currentPlayer;
  let actualI = i;
  lastPlacedCell = i;
  // Track cell frequency for heatmap (human moves only)
  if (_isHumanMove && !spectatorMode) { const st = loadAllTimeStats(); if (!st.cellFreq) st.cellFreq = Array(9).fill(0); st.cellFreq[i]++; saveAllTimeStats(st); }

  // ── CHAOS: Wild Turn (30 % chance once, after ≥ 2 pieces on board) ─
  if (chaosMode && chaosHas('wild-turn') && !chaosState.wildUsed && board.filter(v => v).length >= 2) {
    if (Math.random() < 0.3) {
      const empty = rulesBoard().reduce((a, v, idx) => v === null ? [...a, idx] : a, []);
      if (empty.length) {
        chaosState.wildUsed = true;
        markChaosUsed('wild-turn');
        board[i] = null;
        actualI  = empty[randInt(empty.length)];
        board[actualI] = currentPlayer;
        lastPlacedCell = actualI;
        sfxChaos('wild-turn');
        chaosLog.push({ icon: '🎲', name: 'Wild Turn' });
        showChaosEvent('🎲 WILD TURN! The gods have rerouted your piece to a random square!');
        triggerCellShake(actualI);
      }
    }
  }

  // ── CHAOS: Smite (25 % once — removes a random opponent piece) ────
  if (chaosMode && chaosHas('smite') && !chaosState.smiteUsed) {
    const opp      = getNextPlayer(currentPlayer);
    const oppCells = board.reduce((a, v, idx) => v === opp ? [...a, idx] : a, []);
    if (oppCells.length && Math.random() < 0.25) {
      chaosState.smiteUsed = true;
      markChaosUsed('smite');
      const target = oppCells[randInt(oppCells.length)];
      board[target] = null;
      if (chaosState.ghostCell === target) chaosState.ghostCell = -1;
      sfxChaos('smite');
      chaosLog.push({ icon: '⚡', name: 'Smite' });
      showChaosEvent(`⚡ SMITE! A divine bolt obliterates ${playerName(opp)}'s piece!`);
      triggerSolarFlare();
    }
  }

  // ── CHAOS: Swap Souls (22 % once — swap one piece from each side) ─
  if (chaosMode && chaosHas('swap-souls') && !chaosState.swapUsed && board.filter(v => v).length >= 3) {
    const eCells = board.reduce((a, v, idx) => v === EGYPT ? [...a, idx] : a, []);
    const hCells = board.reduce((a, v, idx) => v === HINDU ? [...a, idx] : a, []);
    if (eCells.length && hCells.length && Math.random() < 0.22) {
      chaosState.swapUsed = true;
      markChaosUsed('swap-souls');
      const e = eCells[randInt(eCells.length)];
      const h = hCells[randInt(hCells.length)];
      [board[e], board[h]] = [board[h], board[e]];
      sfxChaos('swap-souls');
      chaosLog.push({ icon: '🔄', name: 'Swap Souls' });
      showChaosEvent('🔄 SOUL SWAP! Two pieces have switched allegiances in a moment of cosmic betrayal!');
    }
  }

  // ── CHAOS: Mirror Board (22 % once) ──────────────────────────────
  if (chaosMode && chaosHas('mirror') && !chaosState.mirrorUsed && Math.random() < 0.22) {
    chaosState.mirrorUsed = true;
    chaosState.mirror     = !chaosState.mirror;
    markChaosUsed('mirror');
    updateBoardTransform();
    sfxChaos('mirror');
    chaosLog.push({ icon: '🪞', name: 'Mirror Realm' });
    showChaosEvent('🪞 MIRROR REALM! The board has been reflected into a parallel dimension!');
  }

  // ── CHAOS: Solar Flare (25 % once) ───────────────────────────────
  if (chaosMode && chaosHas('solar-flare') && !chaosState.solarUsed && Math.random() < 0.25) {
    chaosState.solarUsed = true;
    markChaosUsed('solar-flare');
    sfxChaos('solar-flare');
    chaosLog.push({ icon: '🌟', name: 'Solar Flare' });
    triggerSolarFlare();
    showChaosEvent('🌟 SOLAR FLARE! Blinding divine light has descended upon the battlefield!');
  }

  // ── CHAOS: Divine Lag (22 % once — freeze input 3 s) ─────────────
  if (chaosMode && chaosHas('divine-lag') && !chaosState.lagUsed && Math.random() < 0.22) {
    chaosState.lagUsed   = true;
    chaosState.lagActive = true;
    markChaosUsed('divine-lag');
    sfxChaos('divine-lag');
    chaosLog.push({ icon: '⏳', name: 'Divine Lag' });
    showChaosEvent('⏳ DIVINE LAG! The celestial servers are buffering... please hold...', 3300);
    // When the lag ends, resume whichever AI was waiting (it can't start during lag).
    roundTimeout(() => {
      chaosState.lagActive = false;
      scheduleAI();
      scheduleSpectatorAI();
    }, 3000);
  }

  // ── CHAOS: Treachery (25 % once — placed piece switches allegiance) ─
  if (chaosMode && chaosHas('treachery') && !chaosState.treacheryUsed && Math.random() < 0.25) {
    chaosState.treacheryUsed = true;
    markChaosUsed('treachery');
    board[actualI] = getNextPlayer(currentPlayer);
    sfxChaos('treachery');
    chaosLog.push({ icon: '🗡', name: 'Treachery' });
    showChaosEvent(`🗡 TREACHERY! The piece betrays its master and now serves the enemy!`);
  }

  // ── Record board snapshot for replay ─────────────────────────────
  gameLog.push([...board]);

  // ── Move quality + move log ─────────────────────────────────────
  const _details = computeMoveDetails(_snapForBadge, currentPlayer, _clickedI);
  moveLog.push({
    player:  currentPlayer,
    pos:     POS_LABELS[lastPlacedCell] || `#${lastPlacedCell}`,
    turn:    moveLog.length + 1,
    quality: _details.quality,
    bestPos: (_details.bestIdx !== _clickedI && _details.bestIdx !== lastPlacedCell)
             ? (POS_LABELS[_details.bestIdx] || null) : null,
  });
  updateMoveLog();

  // ── Blunder alert (human moves only) ────────────────────────────
  const _isAiMove = (aiMode && currentPlayer === HINDU) || spectatorMode;
  if (_details.quality === 'blunder' && !_isAiMove) {
    const _lastM = moveLog[moveLog.length - 1];
    const _hint  = _lastM && _lastM.bestPos ? ` · Best: ${_lastM.bestPos}` : '';
    roundTimeout(() => showChaosEvent(`⚠ Blunder!${_hint}`, 2200), 200);
  }

  // ── Floating quality badge on placed cell ───────────────────────
  const _qBadgeEl = boardEl.children[lastPlacedCell];
  if (_qBadgeEl) {
    const _qBadge = document.createElement('span');
    _qBadge.className = `cell-quality-badge quality-${_details.quality}`;
    _qBadge.textContent = _details.quality === 'best' ? '✓' : _details.quality === 'fine' ? '≈' : '✗';
    _qBadgeEl.appendChild(_qBadge);
    setTimeout(() => _qBadge.remove(), 1400);
  }

  // ── Opening / tactical pattern flash ────────────────────────────
  const _preCount = _snapForBadge.filter(v => v).length;
  const _opponent  = currentPlayer === EGYPT ? HINDU : EGYPT;
  const _WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  // Count how many cells of a line a given player owns (excluding nulls)
  function _lineCount(b, player, line) { return line.filter(c => b[c] === player).length; }
  // Count active threats (2-in-line with empty third)
  function _threatCount(b, player) {
    return _WIN_LINES.filter(l => _lineCount(b, player, l) === 2 && l.some(c => !b[c])).length;
  }
  function _hasThreaten(b, player) { return _threatCount(b, player) >= 1; }

  if (_preCount === 0) {
    const _opening = _clickedI === 4 ? '⚔ Center Gambit'
                   : [0,2,6,8].includes(_clickedI) ? '♟ Corner Opening' : '◈ Edge Play';
    roundTimeout(() => showChaosEvent(_opening + '!', 1800), 350);
  } else if (_preCount === 1) {
    // Opponent's first response
    const _oppFirst = _snapForBadge.indexOf(_opponent);
    if (_oppFirst === 4 && [0,2,6,8].includes(_clickedI)) {
      roundTimeout(() => showChaosEvent('🪞 Mirror Denied — Center Claimed!', 2000), 350);
    } else if ([0,2,6,8].includes(_oppFirst) && [0,2,6,8].includes(_clickedI)
               && _oppFirst + _clickedI === 8) {
      roundTimeout(() => showChaosEvent('⚔ Opposite Corners — Double Threat!', 2000), 350);
    }
  } else if (_preCount === 2) {
    const _boardNow = [..._snapForBadge]; _boardNow[_clickedI] = currentPlayer;
    const _myCorners = [0,2,6,8].filter(c => _boardNow[c] === currentPlayer);
    if (_myCorners.length === 2 && (_myCorners[0] + _myCorners[1] === 8)) {
      roundTimeout(() => showChaosEvent('⚡ Fork Setup! Danger!', 2000), 350);
    } else if (_hasThreaten(_boardNow, currentPlayer)) {
      roundTimeout(() => showChaosEvent('🎯 Line Pressure!', 1800), 350);
    }
  } else if (_preCount >= 3) {
    // Mid/late game: detect fork, block, or match point
    const _boardNow  = [..._snapForBadge]; _boardNow[_clickedI] = currentPlayer;
    const _blockMove = _WIN_LINES.some(l => _lineCount(_snapForBadge, _opponent, l) === 2
                       && l.includes(_clickedI) && !_snapForBadge[_clickedI]);
    const _forks     = _threatCount(_boardNow, currentPlayer);
    if (_forks >= 2) {
      roundTimeout(() => showChaosEvent('⚡ FORK! Two Threats — Unblockable!', 2400), 350);
    } else if (_blockMove) {
      roundTimeout(() => showChaosEvent('🛡 Crisis Averted! Block!', 1800), 350);
    } else if (_forks === 1 && _preCount <= 4) {
      roundTimeout(() => showChaosEvent('⚡ Match Point!', 1800), 350);
    }
  }

  // ── Check winner (after all chaos mutations) ──────────────────────
  const result = checkWinner(rulesBoard());  // Holy Ground cell counts as filled for the draw check

  if (result) {
    // ── Game over ─────────────────────────────────────────────────────
    gameState.gameOver = true;
    gameState.lastWinCells = result.cells || [];
    renderBoard(result.cells);
    boardEl.classList.add('game-over');
    updateBoardColor();
    if (cosmicMode) cosmicAngle += 3;
    updateBoardTransform();
    checkLorePopup();

    if (result.winner === 'draw') {
      sfxDraw(currentThemeKey);
      gameState.scores.draws++;
      drawsEl.textContent  = gameState.scores.draws;
      gameState.lastWinner = null;
      gameState.streaks    = { egypt: 0, hindu: 0 };
      statusEl.className   = 'status-text draw-msg';
      statusEl.textContent = DRAW_MESSAGES[currentThemeKey] || '⚖️  A sacred draw — The gods are balanced';
      cardEgypt.classList.remove('active-turn', 'winner-glow');
      cardHindu.classList.remove('active-turn', 'winner-glow');
      setAura(null);
      roundTimeout(() => showWinSeal('draw'), 600);
      updateAllTimeStats('draw');
      updateMatchPips();
      updateStreakBadges();
      updateSessionRate();
      checkAchievements('draw');
      document.getElementById('btn-replay').style.display = '';
      document.getElementById('btn-hint').disabled = true;
      document.getElementById('btn-analysis').style.display = '';
      roundTimeout(showGameSummary, 900);
      maybeShowTip();
    } else {
      const w = result.winner;
      sfxWin(w, currentThemeKey);
      vibrate([80, 40, 80]);
      // Track trailing condition for Comeback King achievement
      if (matchTarget >= 5) {
        const loserCur = w === EGYPT ? HINDU : EGYPT;
        if (gameState.scores[loserCur] >= 2 && gameState.scores[w] === 0) {
          trailedInMatch = true;
        }
      }
      gameState.scores[w]++;
      const scoreEl = w === EGYPT ? scoreEgypt : scoreHindu;
      scoreEl.textContent = gameState.scores[w];
      scoreEl.classList.remove('pop');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('pop');
      scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('pop'), { once: true });

      // Win-streak tracking
      if (gameState.lastWinner === w) {
        gameState.streaks[w]++;
      } else {
        gameState.streaks = { egypt: 0, hindu: 0 };
        gameState.streaks[w] = 1;
        gameState.lastWinner = w;
      }
      const streak = gameState.streaks[w];
      if (streak >= 3) {
        const fire = streak === 3
          ? `🔥 ${playerName(w)} IS ON FIRE! THREE IN A ROW!`
          : `🔥 ${streak} IN A ROW! ${playerName(w)} IS SIMPLY UNSTOPPABLE!`;
        roundTimeout(() => showChaosEvent(fire, 3000), 900);
      }

      statusEl.className   = `status-text ${w}-msg`;
      const msgs = currentTheme.players[w].winMsgs;
      statusEl.textContent = msgs[randInt(msgs.length)];
      cardEgypt.classList.toggle('active-turn',  w === EGYPT);
      cardHindu.classList.toggle('active-turn',  w === HINDU);
      cardEgypt.classList.toggle('winner-glow',  w === EGYPT);
      cardHindu.classList.toggle('winner-glow',  w === HINDU);
      setAura(w, true);
      drawWinLine(result.cells, w);
      burstParticles(w);
      // Board flash in winner's colour
      boardWrapEl.classList.add(`win-flash-${w}`);
      boardWrapEl.addEventListener('animationend', () => boardWrapEl.classList.remove(`win-flash-${w}`), { once: true });
      const _lineName = getWinLineName(result.cells);
      if (_lineName) roundTimeout(() => showChaosEvent(_lineName + '!', 2000), 750);
      updateAllTimeStats(w);
      updateMatchPips();
      updateStreakBadges();
      updateSessionRate();
      checkAchievements(w);
      document.getElementById('btn-replay').style.display = '';
      document.getElementById('btn-hint').disabled = true;
      document.getElementById('btn-analysis').style.display = '';
      roundTimeout(showGameSummary, 900);
      maybeShowTip();
      if (matchTarget && gameState.scores[w] >= Math.ceil(matchTarget / 2)) {
        roundTimeout(() => showMatchVictory(w), 1200);
      }
    }
    updateUndoBtn();
    // Spectator auto-restart — skip if a match-victory overlay is about to show;
    // in that case the mv-btn handler triggers the restart instead.
    const matchOver = result.winner !== 'draw' && matchTarget &&
      gameState.scores[result.winner] >= Math.ceil(matchTarget / 2);
    if (spectatorMode && !matchOver) {
      roundTimeout(() => { if (spectatorMode) newRound(); }, spectatorDelay);
    }
  } else {
    // ── Turn switching ────────────────────────────────────────────────

    // ── CHAOS: Ghost Move (18 % once — mark placed piece as spectral) ─
    if (chaosMode && chaosHas('ghost-move') && chaosState.ghostCell < 0 &&
        board.filter(v => v).length >= 2 && Math.random() < 0.18) {
      chaosState.ghostCell  = actualI;
      chaosState.ghostOwner = currentPlayer;
      sfxChaos('ghost-move');
      chaosLog.push({ icon: '👻', name: 'Ghost Move' });
      showChaosEvent('👻 GHOST MOVE! A spectral piece materializes on the board... barely real!');
    }

    // ── CHAOS: Blessing of Twofold (20 % once — extra turn) ──────────
    let grantBlessing = false;
    if (chaosMode && chaosHas('blessing') && !chaosState.blessingUsed && Math.random() < 0.2) {
      chaosState.blessingUsed = true;
      grantBlessing = true;
      markChaosUsed('blessing');
      sfxChaos('blessing');
      chaosLog.push({ icon: '✨', name: 'Blessing of Twofold' });
      showChaosEvent(`✨ BLESSING OF TWOFOLD! ${playerName(currentPlayer)} PLAYS AGAIN!`);
    }

    // ── CHAOS: Cursed Skip (schedule skip for opponent's next turn) ───
    if (chaosMode && chaosHas('cursed-skip') && !chaosState.skipUsed && Math.random() < 0.18) {
      chaosState.skipUsed = true;
      const toSkip = getNextPlayer(currentPlayer);
      chaosState.skipNext = toSkip;
      sfxChaos('cursed-skip');
      chaosLog.push({ icon: '💀', name: 'Cursed Skip' });
      showChaosEvent(`💀 CURSED SKIP incoming! ${playerName(toSkip)}'s NEXT turn will vanish into darkness!`);
    }

    // ── Quip (15 % chance) ────────────────────────────────────────────
    let quipText = null;
    if (Math.random() < 0.15) {
      const themeQ = QUIPS[currentThemeKey] || QUIPS['egypt-hindu'];
      const arr    = themeQ && themeQ[currentPlayer];
      if (arr && arr.length) quipText = arr[randInt(arr.length)];
    }

    sfxPlace(currentThemeKey, currentPlayer);
    updateBoardColor();
    if (cosmicMode) cosmicAngle += 3;
    updateBoardTransform();

    // Shaking — sandstorm mode or chaos storm rule
    if ((sandstormMode && Math.random() < 0.38) || (chaosMode && chaosHas('chaos-storm'))) {
      const wrapper = boardEl.parentElement;
      wrapper.classList.remove('shaking');
      void wrapper.offsetWidth;
      wrapper.classList.add('shaking');
      setTimeout(() => wrapper.classList.remove('shaking'), 400);
    }

    renderBoard();

    // Move quality badge (human moves only, not on game-over)
    if (_isHumanMove) {
      const _fc = lastPlacedCell;
      const _q  = _details.quality;
      roundTimeout(() => showMoveBadge(_fc, _q), 80);
    }

    // ── CHAOS: Phantom Veil — pieces invisible for 1.5 s ─────────────
    if (chaosMode && chaosHas('phantom-veil')) {
      sfxChaos('phantom-veil');
      boardEl.classList.add('phantom-veil');
      setTimeout(() => boardEl.classList.remove('phantom-veil'), 1500);
    }

    if (!grantBlessing) gameState.currentPlayer = getNextPlayer(currentPlayer);

    const nextLabel = buildTurnLabel(gameState.currentPlayer);
    if (quipText) {
      statusEl.className   = `status-text ${currentPlayer}-msg`;
      statusEl.textContent = `💬 ${quipText}`;
      roundTimeout(() => {
        if (!gameState.gameOver) {
          statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
          statusEl.textContent = nextLabel;
        }
      }, 1700);
    } else {
      statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
      statusEl.textContent = nextLabel;
    }

    // AI taunt (20 % chance after AI moves, no overlap with quip)
    if (aiMode && currentPlayer === HINDU && !spectatorMode && !quipText && Math.random() < 0.20) {
      const taunts = AI_TAUNTS[currentThemeKey] || AI_TAUNTS['egypt-hindu'];
      if (taunts && taunts.length) {
        roundTimeout(() => { if (!gameState.gameOver) showChaosEvent(`🤖 ${taunts[randInt(taunts.length)]}`, 2400); }, 600);
      }
    }

    setAura(gameState.currentPlayer);
    updateTurnUI();
    updateUndoBtn();
    updateEvalBar(gameState.currentPlayer === HINDU);
    // Warn human player when they're in a forced-loss position (only meaningful after move 4)
    if (aiMode && !spectatorMode && gameState.currentPlayer === EGYPT && !gameState.gameOver && moveLog.length >= 4) {
      const _score = minimax(rulesBoard(), false, -Infinity, Infinity);
      if (_score > 0) roundTimeout(() => { if (!gameState.gameOver) showChaosEvent('⚠ Forced loss — find your best move!', 2600); }, 500);
    }
    scheduleAI();
    scheduleSpectatorAI();
    // Start timer for the next human move
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
  }
  autoSaveGame();
}

/* ─────────────────────────────────────────────
   New round
   Resets the board and turn via resetBoard(),
   but intentionally preserves scores so the
   session tally carries over across rounds.
───────────────────────────────────────────── */
function newRound() {
  cancelAI();   // a move pending from the previous round must not land on this board
  cancelRoundTimers();
  stopReplay();
  clearGameSave();
  hideWinSeal();
  resetBoard();
  clearWinLine();
  clearTimer();
  lastPlacedCell = -1;
  gameLog = [];
  moveLog  = [];
  chaosLog = [];
  updateMoveLog();
  gameState.lastWinCells = [];
  hintUsedThisGame = false;
  boardEl.classList.remove('game-over');
  updateStreakBadges();
  document.getElementById('btn-replay').style.display = 'none';
  document.getElementById('btn-analysis').style.display = 'none';
  document.getElementById('btn-hint').disabled = false;
  updateEvalBar(false); // reset to neutral
  boardEl.style.filter = '';
  cosmicAngle = 0;
  initChaosState();       // reset all chaos state for the new round
  updateBoardTransform(); // clears cosmic + mirror transforms
  gameState.history = [];
  cardEgypt.classList.remove('winner-glow', 'match-point');
  cardHindu.classList.remove('winner-glow', 'match-point');

  // Alternate who goes first each round so neither player is always
  // disadvantaged. The total number of completed games (wins + draws)
  // determines the starter: even total → Egypt, odd total → India.
  const { scores } = gameState;
  gameState.currentPlayer =
    (scores.egypt + scores.hindu + scores.draws) % 2 === 0 ? EGYPT : HINDU;

  statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
  statusEl.textContent = LABELS[gameState.currentPlayer];
  setAura(gameState.currentPlayer);
  renderBoard();
  updateTurnUI();

  updateUndoBtn();
  updateMatchPips();

  // Start chaos for this round (picks rules, shows overlay)
  if (chaosMode) startChaos();

  // If AI mode is active and India goes first this round, trigger it now.
  scheduleAI();
  scheduleSpectatorAI();
  // Start move timer for human's turn (suppressed in spectator mode)
  if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
}

/* ─────────────────────────────────────────────
   Reset scores
   The only place where the session tally is
   wiped. Calls newRound() to also clear the board.
───────────────────────────────────────────── */
function resetScores() {
  // Reinitialise the scores inside gameState — the single source of truth
  // for the session tally displayed on the player cards.
  gameState.scores     = { egypt: 0, hindu: 0, draws: 0 };
  gameState.streaks    = { egypt: 0, hindu: 0 };
  gameState.lastWinner = null;
  trailedInMatch       = false;
  scoreEgypt.textContent = 0;
  scoreHindu.textContent = 0;
  drawsEl.textContent    = 0;
  updateSessionRate();
  clearGameSave();
  newRound();
}

/* ─────────────────────────────────────────────
   Preferences — localStorage
───────────────────────────────────────────── */
function savePrefs() {
  try {
    localStorage.setItem('ehttt', JSON.stringify({
      key:        currentThemeKey === 'random' ? 'egypt-hindu' : currentThemeKey,
      mode:       aiMode,
      cosmic:     cosmicMode,
      sand:       sandstormMode,
      chaos:      chaosMode,
      fog:        fogMode,
      match:      matchTarget,
      name1:      customNames.egypt,
      name2:      customNames.hindu,
      timerSecs:  timerSeconds,
      volSfx:     parseFloat(document.getElementById('vol-slider').value) / 100,
      volMusic:   parseFloat(document.getElementById('vol-music').value)  / 100,
    }));
  } catch (_) {}
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem('ehttt');
    if (!raw) return false;
    const p = JSON.parse(raw);

    // Set fun modes BEFORE applyTheme so newRound() picks them up
    if (p.cosmic) { cosmicMode    = true; document.getElementById('btn-cosmic').classList.add('active'); }
    if (p.sand)   { sandstormMode = true; document.getElementById('btn-sandstorm').classList.add('active'); }
    if (p.chaos)  { chaosMode     = true; document.getElementById('btn-chaos').classList.add('active'); }
    if (p.fog)    { fogMode       = true; document.getElementById('btn-fog').classList.add('on'); }
    loadChaosConfig(p);
    if (p.match != null) {
      matchTarget = p.match;
      document.querySelectorAll('.match-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.match) === matchTarget);
      });
    }

    // Custom names before applyTheme, which shows them and re-saves prefs.
    // (Older saves stored the theme's own name here; that's not a custom name.)
    const key = p.key && THEMES[p.key] ? p.key : 'egypt-hindu';
    const themeName = pl => THEMES[key].players[pl].name;
    if (p.name1 && p.name1 !== themeName(EGYPT)) customNames.egypt = String(p.name1).slice(0, 20);
    if (p.name2 && p.name2 !== themeName(HINDU)) customNames.hindu = String(p.name2).slice(0, 20);

    // Apply theme — this calls resetScores → newRound (→ startChaos if chaosMode) + showIntro
    applyTheme(key);

    // Restore AI mode without re-triggering a full reset
    if (p.mode) {
      aiMode = p.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById(`mode-${p.mode}`);
      if (btn) btn.classList.add('active');
      document.querySelector('#card-hindu .player-title').textContent =
        p.mode === 'hard' ? 'Ancient AI' : p.mode === 'medium' ? 'Medium AI' : 'Easy AI';
    }
    // Restore custom player names (applied after applyTheme which sets defaults)
    // Restore audio levels
    if (p.volSfx != null) {
      setVolume(p.volSfx);
      document.getElementById('vol-slider').value = Math.round(p.volSfx * 100);
    }
    if (p.volMusic != null) {
      setMusicVolume(p.volMusic);
      document.getElementById('vol-music').value = Math.round(p.volMusic * 100);
    }
    // Restore timer duration
    if (p.timerSecs) {
      timerSeconds = p.timerSecs;
      const sel = document.getElementById('timer-secs');
      if (sel) sel.value = timerSeconds;
    }
    return true;
  } catch (_) { return false; }
}

/* ─────────────────────────────────────────────
   Keyboard shortcuts
   1–9  → place on cell (reading order)
   Numpad 1–9 → board-position-intuitive mapping
   N → new round   M → toggle music
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Board keyboard navigation (Arrow keys + Enter/Space)
───────────────────────────────────────────── */
boardEl.addEventListener('keydown', e => {
  if (gameState.gameOver || aiThinking || replaying || spectatorMode) return;
  const cells = [...boardEl.querySelectorAll('.cell')];
  const focused = document.activeElement;
  const idx = cells.indexOf(focused);
  if (idx < 0) return;

  const col = idx % 3, row = Math.floor(idx / 3);
  const dirs = {
    ArrowRight: row * 3 + ((col + 1) % 3),
    ArrowLeft:  row * 3 + ((col + 2) % 3),
    ArrowDown:  ((row + 1) % 3) * 3 + col,
    ArrowUp:    ((row + 2) % 3) * 3 + col,
  };
  if (dirs[e.key] !== undefined) {
    e.preventDefault();
    cells[dirs[e.key]].focus();
  } else if ((e.key === 'Enter' || e.key === ' ') && !focused.classList.contains('taken')) {
    e.preventDefault();
    handleClick(idx);
  }
});

document.addEventListener('keydown', e => {
  // Typing in a name field / input must not trigger game shortcuts
  const tgt = e.target;
  if (tgt && tgt.closest &&
      tgt.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  // Escape closes any open modal / overlay
  if (e.code === 'Escape') {
    hideWinSeal();
    document.getElementById('stats-modal').classList.remove('visible');
    document.getElementById('match-victory').classList.remove('visible');
    document.getElementById('shortcut-help').classList.remove('visible');
    document.getElementById('analysis-modal').classList.remove('visible');
    document.getElementById('achievements-modal').classList.remove('visible');
    document.getElementById('lore-modal').classList.remove('visible');
    document.getElementById('chaos-config-panel').style.display = 'none';
    return;
  }
  // ? opens shortcut help (works even during intro/chaos)
  if ((e.key === '?' || e.key === '/') && !e.repeat) {
    document.getElementById('shortcut-help').classList.toggle('visible');
    return;
  }
  if (introShowing || chaosShowing) return;
  if (/^Digit[1-9]$/.test(e.code)) {
    handleClick(parseInt(e.code.slice(-1)) - 1);
  } else if (/^Numpad[1-9]$/.test(e.code)) {
    // Numpad 7=top-left … 1=bottom-left → maps intuitively to board cells
    const map = [6, 7, 8, 3, 4, 5, 0, 1, 2];
    handleClick(map[parseInt(e.code.slice(-1)) - 1]);
  } else if (e.code === 'KeyN' && !e.repeat) {
    newRound();
  } else if (e.code === 'KeyM' && !e.repeat) {
    toggleMusic();
  } else if (e.code === 'KeyU' && !e.repeat) {
    undo();
  } else if (e.code === 'KeyH' && !e.repeat) {
    showHint();
  } else if (e.code === 'KeyF' && !e.repeat) {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  } else if (e.code === 'KeyA' && !e.repeat) {
    if (gameState.gameOver) {
      const am = document.getElementById('analysis-modal');
      if (am.classList.contains('visible')) am.classList.remove('visible');
      else showAnalysis();
    }
  } else if (e.code === 'KeyS' && !e.repeat) {
    toggleSpectator();
  } else if (e.code === 'KeyR' && !e.repeat) {
    if (gameState.gameOver && !replaying) replayGame();
  } else if (e.code === 'KeyC' && !e.repeat) {
    if (chaosMode) {
      const cp = document.getElementById('chaos-config-panel');
      cp.style.display = cp.style.display === 'none' ? '' : 'none';
    }
  }
});

/* ─────────────────────────────────────────────
   Event listeners
───────────────────────────────────────────── */
document.getElementById('btn-restart').addEventListener('click', newRound);
document.getElementById('btn-reset').addEventListener('click', resetScores);
document.getElementById('win-seal-btn').addEventListener('click', () => {
  hideWinSeal();
  newRound();
});
document.getElementById('btn-music').addEventListener('click', toggleMusic);
document.getElementById('vol-slider').addEventListener('input', e => { setVolume(e.target.value / 100); savePrefs(); });
document.getElementById('vol-music').addEventListener('input',  e => { setMusicVolume(e.target.value / 100); savePrefs(); });
document.getElementById('timer-secs').addEventListener('change', e => {
  timerSeconds = parseInt(e.target.value);
  savePrefs();
});
document.getElementById('mode-2p').addEventListener('click',     () => setMode(null));
document.getElementById('mode-easy').addEventListener('click',   () => setMode('easy'));
document.getElementById('mode-medium').addEventListener('click', () => setMode('medium'));
document.getElementById('mode-hard').addEventListener('click',   () => setMode('hard'));
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.theme === 'random') applyRandomTheme();
    else applyTheme(btn.dataset.theme);
  });
});

document.getElementById('btn-cosmic').addEventListener('click', () => {
  cosmicMode = !cosmicMode;
  document.getElementById('btn-cosmic').classList.toggle('active', cosmicMode);
  if (!cosmicMode) { cosmicAngle = 0; updateBoardTransform(); }
  savePrefs();
});

document.getElementById('btn-sandstorm').addEventListener('click', () => {
  sandstormMode = !sandstormMode;
  document.getElementById('btn-sandstorm').classList.toggle('active', sandstormMode);
  savePrefs();
});

document.getElementById('btn-fog').addEventListener('click', () => {
  fogMode = !fogMode;
  document.getElementById('btn-fog').classList.toggle('on', fogMode);
  renderBoard(gameState.lastWinCells || []);
  savePrefs();
});

document.getElementById('btn-chaos').addEventListener('click', () => {
  chaosMode = !chaosMode;
  document.getElementById('btn-chaos').classList.toggle('active', chaosMode);
  if (!chaosMode) {
    activeChaosRules = [];
    initChaosState();
    updateChaosBar();
    updateBoardTransform();
    document.getElementById('chaos-config-panel').style.display = 'none';
  }
  savePrefs();
  newRound();
});

document.getElementById('btn-timed').addEventListener('click', () => {
  timedMode = !timedMode;
  document.getElementById('btn-timed').classList.toggle('active', timedMode);
  document.getElementById('timer-secs').style.display = timedMode ? '' : 'none';
  if (!timedMode) clearTimer();
  else if (!gameState.gameOver && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
});

document.getElementById('btn-undo').addEventListener('click', undo);

document.querySelectorAll('.match-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    matchTarget = parseInt(btn.dataset.match);
    document.querySelectorAll('.match-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateMatchPips();
    savePrefs();
    newRound();
  });
});

document.getElementById('btn-hint').addEventListener('click', showHint);
document.getElementById('btn-replay').addEventListener('click', replayGame);
document.getElementById('shortcut-help').addEventListener('click', () => {
  document.getElementById('shortcut-help').classList.remove('visible');
});
document.getElementById('btn-stats').addEventListener('click', showStatsModal);
document.getElementById('btn-share').addEventListener('click', shareResult);
document.getElementById('btn-stats-close').addEventListener('click', () => {
  document.getElementById('stats-modal').classList.remove('visible');
});
document.getElementById('btn-stats-reset').addEventListener('click', resetAllTimeStats);

// Board skin picker
document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const wrapper = boardEl.closest('.board-wrapper');
    wrapper.className = 'board-wrapper' + (btn.dataset.skin ? ' ' + btn.dataset.skin : '');
  });
});

// Lore encyclopedia
function showLoreModal() {
  const facts = currentTheme.loreFacts || [];
  document.getElementById('lore-title').textContent = `📖 ${currentTheme.label}`;
  document.getElementById('lore-list').innerHTML = facts.map((f, i) =>
    `<div class="lore-item"><span class="lore-num">${i + 1}.</span>${f}</div>`
  ).join('');
  document.getElementById('lore-modal').classList.add('visible');
}
document.getElementById('btn-lore').addEventListener('click', showLoreModal);
document.getElementById('btn-lore-close').addEventListener('click', () => {
  document.getElementById('lore-modal').classList.remove('visible');
});
document.getElementById('lore-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
});

document.getElementById('mv-btn').addEventListener('click', () => {
  document.getElementById('match-victory').classList.remove('visible');
  resetScores(); // resetScores → newRound → scheduleSpectatorAI if spectatorMode
});

// Spectator / Demo mode
document.getElementById('btn-spectator').addEventListener('click', toggleSpectator);
document.getElementById('spectator-speed').addEventListener('change', e => {
  spectatorDelay = +e.target.value;
});

// Achievements gallery
document.getElementById('btn-achievements').addEventListener('click', showAchievementsModal);
document.getElementById('btn-achievements-close').addEventListener('click', () => {
  document.getElementById('achievements-modal').classList.remove('visible');
});
document.getElementById('achievements-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
});

// Post-game move analysis
document.getElementById('btn-analysis').addEventListener('click', showAnalysis);
document.getElementById('btn-analysis-close').addEventListener('click', () => {
  document.getElementById('analysis-modal').classList.remove('visible');
});
document.getElementById('analysis-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
});

// Move history log toggle
document.getElementById('btn-log').addEventListener('click', () => {
  const body = document.getElementById('move-log-body');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  document.getElementById('btn-log').classList.toggle('on', !open);
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener('fullscreenchange', () => {
  document.getElementById('btn-fullscreen').textContent =
    document.fullscreenElement ? '✕ Exit Full' : '⛶ Full';
});

/* ─────────────────────────────────────────────
   Copy move list to clipboard
───────────────────────────────────────────── */
function copyMoves() {
  const btn = document.getElementById('btn-copy-moves');
  if (!moveLog.length) {
    if (btn) { btn.textContent = '✗ No moves'; setTimeout(() => btn.textContent = '📋 Moves', 1600); }
    return;
  }
  const qIcon = { best: '✓', fine: '·', blunder: '✗' };
  const lines = moveLog.map(m =>
    `${String(m.turn).padStart(2)}. ${SYMBOLS[m.player] || m.player}  ${m.pos.padEnd(2)}  ${qIcon[m.quality] || '·'}`
  );
  const header = `${playerName(EGYPT)} vs ${playerName(HINDU)}`;
  const text   = `${header}\n${lines.join('\n')}`;
  const done = () => {
    if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '📋 Moves', 1800); }
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      _fallbackCopy(text); done();
    });
  } else { _fallbackCopy(text); done(); }
}
function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
}
document.getElementById('btn-copy-moves').addEventListener('click', copyMoves);

/* ─────────────────────────────────────────────
   Touch swipe gestures
   Left → undo  |  Right → new round  |  Down → music toggle
   Board only: on the rest of the page these are just scrolling.
───────────────────────────────────────────── */
let _swipeX = 0, _swipeY = 0;
boardWrapEl.addEventListener('touchstart', e => {
  _swipeX = e.changedTouches[0].clientX;
  _swipeY = e.changedTouches[0].clientY;
}, { passive: true });
boardWrapEl.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _swipeX;
  const dy = e.changedTouches[0].clientY - _swipeY;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 55 && ady < 55) return; // too short
  // ignore swipes that originate on interactive elements
  const tag = (e.target || {}).tagName;
  if (/INPUT|SELECT|BUTTON/.test(tag)) return;
  // Only clear, mostly-straight swipes count; a page scroll that starts on the
  // board is a short-ish vertical drag, so music needs a long one.
  if (adx > ady * 2) {
    if (dx < 0) undo();       // swipe left → undo
    else        newRound();   // swipe right → new round
  } else if (ady > adx * 2 && dy > 140) {
    toggleMusic();            // long swipe down → music
  }
}, { passive: true });

/* ─────────────────────────────────────────────
   PWA Install prompt
───────────────────────────────────────────── */
let deferredInstallPrompt = null;
const btnInstall = document.getElementById('btn-install');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstall.style.display = '';
});

btnInstall.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    btnInstall.style.display = 'none';
    deferredInstallPrompt = null;
  }
});

window.addEventListener('appinstalled', () => {
  btnInstall.style.display = 'none';
  deferredInstallPrompt = null;
});

/* ─────────────────────────────────────────────
   Accessibility wiring
───────────────────────────────────────────── */
// Toggle buttons show on/off only by colour; mirror it into aria-pressed.
function syncPressed(btn) {
  btn.setAttribute('aria-pressed', String(btn.classList.contains('active') || btn.classList.contains('on')));
}
const _pressedObserver = new MutationObserver(ms => ms.forEach(m => syncPressed(m.target)));
document.querySelectorAll('.mode-btn, .match-btn, .theme-btn, .skin-btn, .fun-btn:not(#btn-fullscreen):not(#btn-install)')
  .forEach(btn => {
    syncPressed(btn);
    _pressedObserver.observe(btn, { attributes: true, attributeFilter: ['class'] });
  });

// Dialogs open/close by toggling .visible. While closed they're only faded
// out, so make them inert (not focusable / not read out); when one opens,
// move focus into it and put focus back where it was when it closes.
['win-seal', 'match-victory', 'stats-modal', 'analysis-modal',
 'achievements-modal', 'lore-modal', 'shortcut-help'].forEach(id => {
  const dlg = document.getElementById(id);
  if (!dlg) return;
  let isOpen = false, returnTo = null;
  const sync = () => {
    const open = dlg.classList.contains('visible');
    const hadFocus = dlg.contains(document.activeElement);  // check before inert drops it
    dlg.toggleAttribute('inert', !open);
    if (open === isOpen) return;
    isOpen = open;
    if (open) {
      returnTo = document.activeElement;
      (dlg.querySelector('button, [href], input, select') || dlg).focus();
    } else if (hadFocus && returnTo && document.contains(returnTo)) {
      returnTo.focus();
    }
  };
  sync();
  new MutationObserver(sync).observe(dlg, { attributes: true, attributeFilter: ['class'] });
});

/* ─────────────────────────────────────────────
   Init — restore saved prefs or default startup
───────────────────────────────────────────── */
initEditableNames();
// loadPrefs → applyTheme → resetScores → newRound clears the mid-game save,
// so hold on to it across startup and put it back before offering a restore.
let _pendingSave = null;
try { _pendingSave = localStorage.getItem(GAME_SAVE_KEY); } catch (_) {}
if (!loadPrefs()) {
  setAura(EGYPT);
  renderBoard();
  showIntro();
}
try { if (_pendingSave) localStorage.setItem(GAME_SAVE_KEY, _pendingSave); } catch (_) {}
updateRankBadges();
tryRestoreGame();

document.getElementById('restore-yes').addEventListener('click', () => {
  document.getElementById('restore-banner').style.display = 'none';
  applyRestore();
});
document.getElementById('restore-no').addEventListener('click', () => {
  document.getElementById('restore-banner').style.display = 'none';
  offeredSave = null;
  autoSaveGame();   // replace the declined save with the current game (if any)
});
