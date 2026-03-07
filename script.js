
/* ─────────────────────────────────────────────
   Constants
   EGYPT, HINDU, WIN_LINES come from gameLogic.js
───────────────────────────────────────────── */
const SYMBOLS = { egypt: '☥', hindu: 'ॐ' };
const LABELS  = { egypt: "Egypt's turn — Place the Ankh ☥",
                  hindu: "India's turn — Invoke the Om ॐ" };

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
let hintUsedThisGame  = false;   // true once showHint() fires this round
let trailedInMatch    = false;   // true once opponent had 2+ wins while player had 0
let spectatorMode = false;       // AI vs AI demo mode
let _prevAiMode   = null;        // aiMode saved before spectator starts
let moveLog  = [];               // [{player, pos, turn}] per-round move history
let chaosLog = [];               // [{icon, name}] chaos events that fired this round
const POS_LABELS = ['A1','B1','C1','A2','B2','C2','A3','B3','C3'];

/* ─────────────────────────────────────────────
   All-time stats (localStorage)
───────────────────────────────────────────── */
function loadAllTimeStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch (_) { return {}; }
}
function saveAllTimeStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (_) {}
}
/* ─────────────────────────────────────────────
   Win-line name — called after a win to briefly
   describe how the game was decided.
───────────────────────────────────────────── */
const WIN_LINE_NAMES = {
  '0,1,2': '⬛ Top Row',
  '3,4,5': '⬛ Middle Row',
  '6,7,8': '⬛ Bottom Row',
  '0,3,6': '| Left Column',
  '1,4,7': '| Centre Column',
  '2,5,8': '| Right Column',
  '0,4,8': '↘ Main Diagonal',
  '2,4,6': '↙ Anti Diagonal',
};
function getWinLineName(cells) {
  return WIN_LINE_NAMES[(cells || []).join(',')] || '';
}

function getRank(wins) {
  if (wins >= 50) return { label: '★ Legend',       color: '#FF4444' };
  if (wins >= 30) return { label: '◆ Grand Master',  color: '#CF9FFF' };
  if (wins >= 15) return { label: '● Champion',      color: '#FFD700' };
  if (wins >= 5)  return { label: '▲ Strategist',    color: '#4FC3F7' };
  return                  { label: '◌ Novice',        color: 'rgba(255,255,255,.32)' };
}
function updateRankBadges() {
  const s = loadAllTimeStats();
  const r1 = getRank(s.egypt || 0);
  const r2 = getRank(s.hindu || 0);
  const el1 = document.getElementById('rank-egypt');
  const el2 = document.getElementById('rank-hindu');
  if (el1) { el1.textContent = r1.label; el1.style.color = r1.color; }
  if (el2) { el2.textContent = r2.label; el2.style.color = r2.color; }
}

function updateAllTimeStats(outcome) {
  const s = loadAllTimeStats();
  const oldR1 = getRank(s.egypt || 0).label;
  const oldR2 = getRank(s.hindu || 0).label;
  s.gamesPlayed  = (s.gamesPlayed  || 0) + 1;
  s.totalMoves   = (s.totalMoves   || 0) + moveLog.length;
  if (outcome === 'draw') {
    s.draws = (s.draws || 0) + 1;
  } else {
    s[outcome] = (s[outcome] || 0) + 1;
    s.longestStreak = Math.max(s.longestStreak || 0, gameState.streaks[outcome]);
  }
  if (!s.recentGames) s.recentGames = [];
  s.recentGames.push(outcome);
  if (s.recentGames.length > 10) s.recentGames.shift();
  // Per-theme stats (exclude the procedural 'random' key)
  if (currentThemeKey !== 'random') {
    if (!s.themes) s.themes = {};
    if (!s.themes[currentThemeKey]) s.themes[currentThemeKey] = { wins: 0, draws: 0, games: 0 };
    s.themes[currentThemeKey].games++;
    if (outcome === 'draw') s.themes[currentThemeKey].draws++;
    else                    s.themes[currentThemeKey].wins++;
  }
  saveAllTimeStats(s);
  // Rank-up announcements
  if (outcome !== 'draw') {
    const newR1 = getRank(s.egypt || 0);
    const newR2 = getRank(s.hindu || 0);
    if (newR1.label !== oldR1 && s.egypt > 0) {
      setTimeout(() => showChaosEvent(`⬆️ ${currentTheme.players.egypt.name} RANKS UP: ${newR1.label}!`, 3200), 2000);
    }
    if (newR2.label !== oldR2 && s.hindu > 0) {
      setTimeout(() => showChaosEvent(`⬆️ ${currentTheme.players.hindu.name} RANKS UP: ${newR2.label}!`, 3200), 2000);
    }
  }
  updateRankBadges();
}
function showStatsModal() {
  // Clear previously-inserted dynamic sections to prevent duplication on re-open
  document.querySelectorAll('.recent-games, .heat-section, .theme-stats-section').forEach(el => el.remove());
  const s  = loadAllTimeStats();
  const p1 = currentTheme.players.egypt;
  const p2 = currentTheme.players.hindu;
  const winRate  = s.gamesPlayed
    ? Math.round(((s.egypt || 0) / s.gamesPlayed) * 100) : 0;
  const avgMoves = s.gamesPlayed && s.totalMoves
    ? (s.totalMoves / s.gamesPlayed).toFixed(1) : '—';
  const _cFreq   = s.cellFreq || Array(9).fill(0);
  const _maxFIdx = _cFreq.indexOf(Math.max(..._cFreq));
  const favCell  = _cFreq[_maxFIdx] > 0 ? (POS_LABELS[_maxFIdx] || `#${_maxFIdx+1}`) : '—';
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-val">${s.gamesPlayed || 0}</div><div class="stat-lbl">GAMES PLAYED</div></div>
    <div class="stat-card"><div class="stat-val">${s.draws || 0}</div><div class="stat-lbl">DRAWS</div></div>
    <div class="stat-card"><div class="stat-val">${s.egypt || 0}</div><div class="stat-lbl">${p1.name.toUpperCase()} WINS</div></div>
    <div class="stat-card"><div class="stat-val">${s.hindu || 0}</div><div class="stat-lbl">${p2.name.toUpperCase()} WINS</div></div>
    <div class="stat-card"><div class="stat-val">${s.longestStreak || 0}</div><div class="stat-lbl">BEST STREAK</div></div>
    <div class="stat-card"><div class="stat-val">${winRate}%</div><div class="stat-lbl">${p1.name.toUpperCase()} WIN RATE</div></div>
    <div class="stat-card"><div class="stat-val">${avgMoves}</div><div class="stat-lbl">AVG MOVES</div></div>
    <div class="stat-card"><div class="stat-val">${favCell}</div><div class="stat-lbl">FAV CELL</div></div>
  `;
  // Recent games row
  const afterGrid = document.getElementById('stats-grid');
  if (s.recentGames && s.recentGames.length) {
    const dots = s.recentGames.map(g => {
      const color = g === EGYPT ? 'var(--egypt-gold)' : g === HINDU ? 'var(--hindu-saffron)' : 'rgba(255,255,255,.35)';
      const label = g === EGYPT ? p1.name : g === HINDU ? p2.name : 'Draw';
      return `<span class="recent-dot" style="background:${color}" title="${label}"></span>`;
    }).join('');
    afterGrid.insertAdjacentHTML('afterend',
      `<div class="recent-games"><div class="recent-label">LAST ${s.recentGames.length} GAMES</div><div class="recent-dots">${dots}</div></div>`
    );
  }
  // Cell heat map
  const freq = s.cellFreq || Array(9).fill(0);
  const maxF = Math.max(...freq, 1);
  const heatCells = freq.map((f, idx) => {
    const heat = f / maxF;
    const bg = `rgba(var(--p1-rgb),${(heat * 0.72).toFixed(2)})`;
    return `<div class="heat-cell" style="background:${bg}" title="Position ${idx+1}: ${f} play${f!==1?'s':''}">${f || ''}</div>`;
  }).join('');
  const modal = document.getElementById('stats-modal');
  modal.querySelector('.stats-actions').insertAdjacentHTML('beforebegin',
    `<div class="heat-section"><div class="heat-title">CELL HOT SPOTS</div><div class="heat-grid">${heatCells}</div></div>`
  );
  // Per-theme win rates
  const themeData = s.themes || {};
  const themeKeys = Object.keys(themeData).filter(k => THEMES[k]);
  if (themeKeys.length) {
    const rows = themeKeys.map(k => {
      const td   = themeData[k];
      const rate = td.games ? Math.round(td.wins / td.games * 100) : 0;
      return `<div class="theme-stat-row">
        <span class="theme-stat-name">${THEMES[k].label}</span>
        <div class="theme-stat-bar"><div class="theme-stat-fill" style="width:${rate}%"></div></div>
        <span class="theme-stat-pct">${rate}%</span>
      </div>`;
    }).join('');
    modal.querySelector('.stats-actions').insertAdjacentHTML('beforebegin',
      `<div class="theme-stats-section"><div class="theme-stats-title">WIN RATE BY THEME</div>${rows}</div>`
    );
  }
  modal.classList.add('visible');
}
function resetAllTimeStats() {

  try { localStorage.removeItem(STATS_KEY); } catch (_) {}
  showStatsModal();
}

/* ─────────────────────────────────────────────
   Achievements
───────────────────────────────────────────── */

function loadAchievements() {
  try { return JSON.parse(localStorage.getItem(ACH_KEY)) || {}; } catch (_) { return {}; }
}
function saveAchievements(a) {
  try { localStorage.setItem(ACH_KEY, JSON.stringify(a)); } catch (_) {}
}

let achQueue = [];
let achToastTimer = null;

function showNextAch() {
  if (!achQueue.length) return;
  const ach = achQueue.shift();
  document.getElementById('ach-icon').textContent = ach.icon;
  document.getElementById('ach-name').textContent = ach.name;
  const toast = document.getElementById('ach-toast');
  toast.classList.add('show');
  achToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextAch, 500);
  }, 3500);
}

function unlockAchievement(ach) {
  if (!ach) return;
  const a = loadAchievements();
  if (a[ach.id]) return;
  a[ach.id] = Date.now();
  saveAchievements(a);
  achQueue.push(ach);
  if (achQueue.length === 1) setTimeout(showNextAch, 700);
}

function checkAchievements(winner) {
  const a = loadAchievements();
  const tryUnlock = id => {
    if (!a[id]) unlockAchievement(ACHIEVEMENTS.find(x => x.id === id));
  };
  // Time-based — fires for any outcome
  const hr = new Date().getHours();
  if (hr >= 22 || hr < 4) tryUnlock('night-owl');

  if (winner === 'draw') {
    tryUnlock('first-draw');
  } else {
    tryUnlock('first-win');
    if (gameState.streaks[winner] >= 3) tryUnlock('triple-threat');
    if (aiMode === 'hard' && winner === EGYPT)  tryUnlock('ai-slayer');
    if (chaosMode)  tryUnlock('chaos-winner');
    if (timedMode)  tryUnlock('speed-win');
    if (cosmicMode) tryUnlock('cosmic-winner');
    if (matchTarget >= 5 && gameState.scores[winner] >= Math.ceil(matchTarget / 2)) tryUnlock('match-master');
    // Fastest possible win: 5 pieces total (3 for winner, 2 for loser)
    if (gameState.board.filter(v => v).length === 5) tryUnlock('speed-round');
    // Undisputed: win Best of 3 with opponent at 0 wins
    const loser = winner === EGYPT ? HINDU : EGYPT;
    if (matchTarget === 3 && gameState.scores[winner] >= 2 && gameState.scores[loser] === 0) tryUnlock('undisputed');
    // Batch-10 achievements
    if (currentThemeKey === 'dragon-phoenix') tryUnlock('dragon-lord');
    if (gameState.streaks[winner] >= 5) tryUnlock('penta-streak');
    if (!hintUsedThisGame) tryUnlock('pure-intuition');
    if (chaosMode && activeChaosRules.length >= 3) tryUnlock('chaos-champ');
    if (trailedInMatch && matchTarget >= 5 && gameState.scores[winner] >= Math.ceil(matchTarget / 2)) tryUnlock('comeback');
    // Perfect game: all of the winner's moves were optimal
    const winnerMoves = moveLog.filter(m => m.player === winner);
    if (winnerMoves.length >= 3 && winnerMoves.every(m => m.quality === 'best')) tryUnlock('perfect-game');
  }
}

function trackThemeAchievement(key) {
  if (key === 'random') return;
  const a = loadAchievements();
  if (!a._themes) a._themes = {};
  a._themes[key] = true;
  saveAchievements(a);
  if (Object.keys(a._themes).length >= 5) {
    if (!a['all-themes']) unlockAchievement(ACHIEVEMENTS.find(x => x.id === 'all-themes'));
  }
}

/* ─────────────────────────────────────────────
   Streak fire badges
───────────────────────────────────────────── */
function updateStreakBadges() {
  [EGYPT, HINDU].forEach(p => {
    const badge = document.getElementById(`streak-${p}`);
    if (!badge) return;
    const s = gameState.streaks[p];
    if (s >= 2) {
      badge.textContent = `🔥 ${s} in a row`;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  });
}

/* ─────────────────────────────────────────────
   Editable player names
───────────────────────────────────────────── */
function initEditableNames() {
  [{ id: 'name-egypt', player: EGYPT }, { id: 'name-hindu', player: HINDU }].forEach(({ id, player }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      // Prevent pasting rich text or line breaks
    });
    el.addEventListener('blur', () => {
      const raw  = el.textContent.replace(/\n/g, '').trim().slice(0, 20);
      const name = raw || currentTheme.players[player].name;
      el.textContent = name;
      LABELS[player] = `${name}'s turn — ${currentTheme.players[player].label.split('—')[1]?.trim() || ''}`;
      // Refresh status bar if it's currently this player's turn
      if (!gameState.gameOver && gameState.currentPlayer === player) {
        statusEl.textContent = LABELS[player];
      }
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
   Chaos state
───────────────────────────────────────────── */
let chaosMode        = false;
let chaosShowing     = false;
let activeChaosRules = [];
// IDs of chaos rules eligible for selection (default: all)
let chaosEnabled     = new Set(CHAOS_RULES.map(r => r.id));
let chaosState       = {
  ghostCell: -1, ghostOwner: null,
  wildUsed: false, swapUsed: false, smiteUsed: false,
  blessingUsed: false, skipUsed: false, skipNext: null,
  mirrorUsed: false, mirror: false,
  solarUsed: false, lagUsed: false, lagActive: false,
};

/* ─────────────────────────────────────────────
   Character intro
───────────────────────────────────────────── */
function showIntro() {
  const overlay = document.getElementById('intro-overlay');
  const left    = document.getElementById('intro-left');
  const right   = document.getElementById('intro-right');
  const vs      = overlay.querySelector('.intro-vs');
  const begin   = document.getElementById('intro-begin');

  document.getElementById('intro-sym1').textContent  = currentTheme.players.egypt.symbol;
  document.getElementById('intro-name1').textContent = currentTheme.players.egypt.name.toUpperCase();
  document.getElementById('intro-tag1').textContent  = currentTheme.players.egypt.intro;
  document.getElementById('intro-sym1').style.color  = currentTheme.players.egypt.primary;
  document.getElementById('intro-name1').style.color = currentTheme.players.egypt.primary;

  document.getElementById('intro-sym2').textContent  = currentTheme.players.hindu.symbol;
  document.getElementById('intro-name2').textContent = currentTheme.players.hindu.name.toUpperCase();
  document.getElementById('intro-tag2').textContent  = currentTheme.players.hindu.intro;
  document.getElementById('intro-sym2').style.color  = currentTheme.players.hindu.primary;
  document.getElementById('intro-name2').style.color = currentTheme.players.hindu.primary;

  left.classList.remove('shown');
  right.classList.remove('shown');
  vs.classList.remove('shown');
  begin.classList.remove('shown');

  if (introTimer) clearTimeout(introTimer);
  introShowing = true;
  overlay.classList.add('active');

  setTimeout(() => left.classList.add('shown'),  150);
  setTimeout(() => right.classList.add('shown'), 480);
  setTimeout(() => vs.classList.add('shown'),    720);
  setTimeout(() => begin.classList.add('shown'), 2100);

  const dismiss = () => {
    overlay.classList.remove('active');
    overlay.removeEventListener('click', dismiss);
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    introShowing = false;
    scheduleAI();
    if (!aiMode || gameState.currentPlayer === EGYPT) startTimer();
  };
  introTimer = setTimeout(dismiss, 4000);
  overlay.addEventListener('click', dismiss);
}

/* ─────────────────────────────────────────────
   Lore popup (1-in-20 chance after a game)
───────────────────────────────────────────── */
function checkLorePopup() {
  if (Math.random() > 0.15) return;
  const facts = currentTheme.loreFacts;
  if (!facts || !facts.length) return;
  const toast = document.getElementById('lore-toast');
  document.getElementById('lore-toast-text').textContent =
    facts[Math.floor(Math.random() * facts.length)];
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 5800);
}

/* ─────────────────────────────────────────────
   Dynamic board color — hue shifts as board fills
───────────────────────────────────────────── */
function updateBoardColor() {
  const filled = gameState.board.filter(v => v).length;
  if (filled > 0) {
    const p = filled / 9;
    boardEl.style.filter = `hue-rotate(${p * 38}deg) saturate(${1 + p * 0.45})`;
  } else {
    boardEl.style.filter = '';
  }
}

/* ─────────────────────────────────────────────
   Render board
───────────────────────────────────────────── */
function renderBoard(winCells = []) {
  boardEl.innerHTML = '';
  // Keep hover-preview symbol current with the active player
  boardEl.style.setProperty('--hover-sym-display', `"${SYMBOLS[gameState.currentPlayer] || ''}"`);

  gameState.board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label',
      val ? `${currentTheme.players[val].name} at position ${i + 1}` : `Empty position ${i + 1}`);
    if (val) {
      cell.classList.add('taken', `${val}-cell`);
      const _fogHide = fogMode && !gameState.gameOver
        && val !== gameState.currentPlayer;
      cell.textContent = _fogHide ? '●' : SYMBOLS[val];
      if (_fogHide) cell.classList.add('fog-hidden');
    }
    if (chaosMode && chaosState.ghostCell === i && val) cell.classList.add('ghost-cell');
    if (chaosMode && chaosState.holyCell === i && !val) cell.classList.add('holy-cell');
    if (i === lastPlacedCell && val) cell.classList.add('fresh');
    if (winCells.includes(i)) {
      cell.classList.add('win-cell');
      cell.style.setProperty('--win-delay', winCells.indexOf(i) * 80);
    }
    if (!spectatorMode) cell.addEventListener('click', () => handleClick(i));
    boardEl.appendChild(cell);
  });
}

/* ─────────────────────────────────────────────
   Update card highlights
───────────────────────────────────────────── */
function updateTurnUI() {
  const { currentPlayer, gameOver } = gameState;
  cardEgypt.classList.toggle('active-turn', currentPlayer === EGYPT && !gameOver);
  cardHindu.classList.toggle('active-turn', currentPlayer === HINDU && !gameOver);
}

/* ─────────────────────────────────────────────
   Board aura color
───────────────────────────────────────────── */
function hexToRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function setAura(player, win = false) {
  if (player === EGYPT) {
    const rgb = hexToRgb(currentTheme.players.egypt.primary);
    auraEl.style.background = win
      ? `radial-gradient(ellipse at center, rgba(${rgb},.35) 0%, transparent 75%)`
      : `radial-gradient(ellipse at center, rgba(${rgb},.12) 0%, transparent 70%)`;
  } else if (player === HINDU) {
    const rgb = hexToRgb(currentTheme.players.hindu.primary);
    auraEl.style.background = win
      ? `radial-gradient(ellipse at center, rgba(${rgb},.45) 0%, transparent 75%)`
      : `radial-gradient(ellipse at center, rgba(${rgb},.18) 0%, transparent 70%)`;
  } else {
    auraEl.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,.07) 0%, transparent 70%)';
  }
}

/* ─────────────────────────────────────────────
   Win-line animation
───────────────────────────────────────────── */
function drawWinLine(cells, winner) {
  const wrapperRect = boardEl.parentElement.getBoundingClientRect();
  const r1 = boardEl.children[cells[0]].getBoundingClientRect();
  const r2 = boardEl.children[cells[cells.length - 1]].getBoundingClientRect();

  const x1 = r1.left + r1.width  / 2 - wrapperRect.left;
  const y1 = r1.top  + r1.height / 2 - wrapperRect.top;
  const x2 = r2.left + r2.width  / 2 - wrapperRect.left;
  const y2 = r2.top  + r2.height / 2 - wrapperRect.top;

  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle  = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const rgb    = winner === EGYPT
    ? currentTheme.players.egypt.vars['--p1-rgb']
    : currentTheme.players.hindu.vars['--p2-rgb'];
  const color  = `rgba(${rgb},0.9)`;

  winLineEl.classList.remove('animate');
  winLineEl.style.cssText = [
    'display:block',
    `left:${x1}px`,
    `top:${y1}px`,
    `width:${length}px`,
    `transform:translateY(-50%) rotate(${angle}deg)`,
    `background:${color}`,
    `color:${color}`,
  ].join(';');
  void winLineEl.offsetWidth; // force reflow
  winLineEl.classList.add('animate');
}

function clearWinLine() {
  winLineEl.style.display = 'none';
  winLineEl.classList.remove('animate');
}

/* ─────────────────────────────────────────────
   Position evaluation bar (minimax score → bar)
───────────────────────────────────────────── */
function updateEvalBar(isHinduTurn) {
  const eEl = document.getElementById('eval-egypt');
  const hEl = document.getElementById('eval-hindu');
  if (!eEl || !hEl) return;
  if (gameState.board.every(v => !v)) { eEl.style.width = '50%'; hEl.style.width = '50%'; return; }
  const score = minimax([...gameState.board], isHinduTurn, -Infinity, Infinity);
  // +10 = HINDU wins, -10 = EGYPT wins → hinduPct in [0,100]
  const hinduPct = Math.round((score + 10) / 20 * 100);
  eEl.style.width = `${100 - hinduPct}%`;
  hEl.style.width = `${hinduPct}%`;
}

/* ─────────────────────────────────────────────
   Move quality — badge (✓ / ≈ / ✗) on placed cell
───────────────────────────────────────────── */
/* Returns {quality, bestIdx} in a single minimax pass over all options */
function computeMoveDetails(snap, player, moveIdx) {
  const b = [...snap];
  const empty = b.reduce((a, v, i) => v ? a : [...a, i], []);
  if (empty.length <= 1) return { quality: 'best', bestIdx: moveIdx };
  const isMax = player === HINDU;
  let bestEval = isMax ? -Infinity : Infinity;
  let bestIdx = empty[0];
  for (const idx of empty) {
    b[idx] = player;
    const val = minimax(b, !isMax, -Infinity, Infinity);
    b[idx] = null;
    if (isMax ? val > bestEval : val < bestEval) { bestEval = val; bestIdx = idx; }
  }
  b[moveIdx] = player;
  const actualEval = minimax(b, !isMax, -Infinity, Infinity);
  b[moveIdx] = null;
  const delta = isMax ? (bestEval - actualEval) : (actualEval - bestEval);
  const quality = delta <= 0 ? 'best' : delta < 10 ? 'fine' : 'blunder';
  return { quality, bestIdx };
}
function showMoveBadge(cellIdx, quality) {
  const cells = boardEl.querySelectorAll('.cell');
  if (!cells[cellIdx]) return;
  const badge = document.createElement('div');
  badge.className = `move-badge quality-${quality}`;
  badge.textContent = quality === 'best' ? '✓' : quality === 'fine' ? '≈' : '✗';
  cells[cellIdx].appendChild(badge);
  setTimeout(() => badge.remove(), 1600);
}

/* ─────────────────────────────────────────────
   Hint — show optimal cell for current player
───────────────────────────────────────────── */
let hintTimer = null;

function getHintMove(b, player) {
  const empty = b.reduce((a, v, i) => v ? a : [...a, i], []);
  if (!empty.length) return -1;
  // HINDU maximises, EGYPT minimises — run full minimax regardless of aiMode
  if (player === HINDU) {
    let best = -Infinity, move = empty[0];
    for (const i of empty) {
      b[i] = HINDU;
      const val = minimax(b, false, -Infinity, Infinity);
      b[i] = null;
      if (val > best) { best = val; move = i; }
    }
    return move;
  } else {
    let best = Infinity, move = empty[0];
    for (const i of empty) {
      b[i] = EGYPT;
      const val = minimax(b, true, -Infinity, Infinity);
      b[i] = null;
      if (val < best) { best = val; move = i; }
    }
    return move;
  }
}

function showHint() {
  if (gameState.gameOver || aiThinking || replaying) return;
  if (aiMode && gameState.currentPlayer === HINDU) return;
  clearTimeout(hintTimer);
  boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('hint-cell'));
  hintUsedThisGame = true;
  const best = getHintMove([...gameState.board], gameState.currentPlayer);
  if (best < 0) return;
  const cell = boardEl.querySelectorAll('.cell')[best];
  if (cell && !cell.classList.contains('taken')) {
    cell.classList.add('hint-cell');
    hintTimer = setTimeout(() => cell.classList.remove('hint-cell'), 1800);
  }
}

/* ─────────────────────────────────────────────
   AI vs AI spectator mode
───────────────────────────────────────────── */
function scheduleSpectatorAI() {
  if (!spectatorMode || gameState.currentPlayer !== EGYPT || gameState.gameOver ||
      aiThinking || introShowing || chaosShowing) return;
  aiThinking = true;
  boardEl.classList.add('ai-thinking');
  const p = currentTheme.players.egypt;
  statusEl.className = 'status-text egypt-msg';
  statusEl.innerHTML = `${p.name} ponders<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>`;
  const delay = 480 + Math.random() * 520;
  const snapBoard = [...gameState.board];
  setTimeout(() => {
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
  const btn = document.getElementById('btn-spectator');
  if (spectatorMode) {
    _prevAiMode = aiMode;
    aiMode = 'hard';  // HINDU will auto-play via existing scheduleAI()
    btn.textContent = '⏹ Stop';
    btn.classList.add('on');
    showChaosEvent('👁 AI Demo — sit back and watch!', 2800);
    newRound();
  } else {
    aiMode = _prevAiMode;
    btn.textContent = '👁 Demo';
    btn.classList.remove('on');
    // Restore mode-button UI
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(aiMode ? `mode-${aiMode}` : 'mode-2p').classList.add('active');
    newRound();
  }
}

/* ─────────────────────────────────────────────
   Move history log
───────────────────────────────────────────── */
function updateMoveLog() {
  const body = document.getElementById('move-log-body');
  if (!body) return;
  if (!moveLog.length) { body.innerHTML = '<div class="log-empty">No moves yet</div>'; return; }
  const qIcon = { best: '✓', fine: '≈', blunder: '✗' };
  body.innerHTML = moveLog.map(m =>
    `<div class="log-entry ${m.player}-entry"><span class="log-turn">${m.turn}</span><span class="log-sym">${SYMBOLS[m.player] || ''}</span><span class="log-pos">${m.pos}</span><span class="log-badge quality-${m.quality || 'fine'}">${qIcon[m.quality] || '≈'}</span></div>`
  ).join('');
  body.scrollTop = body.scrollHeight;
}

/* ─────────────────────────────────────────────
   Post-game move analysis
───────────────────────────────────────────── */
function showAnalysis() {
  const list = document.getElementById('analysis-list');
  if (!moveLog.length) {
    list.innerHTML = '<div class="analysis-empty">No moves recorded.</div>';
  } else {
    const qIcon  = q => q === 'best' ? '✓' : q === 'fine' ? '≈' : '✗';
    const qLabel = q => q === 'best' ? 'Optimal' : q === 'fine' ? 'Suboptimal' : 'Blunder';
    let html = moveLog.map(m =>
      `<div class="analysis-entry">
        <span class="analysis-turn">${m.turn}.</span>
        <span class="analysis-sym ${m.player}-entry">${SYMBOLS[m.player] || ''}</span>
        <span class="analysis-pos">${m.pos}</span>
        <span class="analysis-badge quality-${m.quality}" title="${qLabel(m.quality)}">${qIcon(m.quality)}</span>
        ${m.bestPos ? `<span class="analysis-best">best: ${m.bestPos}</span>` : ''}
      </div>`
    ).join('');
    if (chaosLog.length) {
      html += `<div class="analysis-chaos-section">
        <div class="analysis-chaos-title">⚡ Chaos Events</div>
        ${chaosLog.map(e => `<div class="analysis-chaos-entry"><span>${e.icon}</span> ${e.name}</div>`).join('')}
      </div>`;
    }
    list.innerHTML = html;
  }
  document.getElementById('analysis-modal').classList.add('visible');
}

/* ─────────────────────────────────────────────
   Post-game summary toast
───────────────────────────────────────────── */
function showGameSummary() {
  const el = document.getElementById('game-summary');
  if (!el) return;
  const total    = moveLog.length;
  const optimal  = moveLog.filter(m => m.quality === 'best').length;
  const blunders = moveLog.filter(m => m.quality === 'blunder').length;
  const chaos    = chaosLog.length;
  if (!total) return;
  const parts = [`${total} moves`];
  if (optimal  > 0) parts.push(`${optimal} optimal`);
  if (blunders > 0) parts.push(`${blunders} blunder${blunders > 1 ? 's' : ''}`);
  if (chaos    > 0) parts.push(`${chaos} chaos event${chaos > 1 ? 's' : ''}`);
  el.textContent = parts.join(' · ');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4500);
}

/* ─────────────────────────────────────────────
   Achievements gallery
───────────────────────────────────────────── */
function showAchievementsModal() {
  const a = loadAchievements();
  const unlocked = ACHIEVEMENTS.filter(ach => a[ach.id]);
  document.getElementById('achievements-count').textContent =
    `${unlocked.length} / ${ACHIEVEMENTS.length} Unlocked`;
  document.getElementById('achievements-list').innerHTML = ACHIEVEMENTS.map(ach => {
    const isUnlocked = !!a[ach.id];
    const ts = typeof a[ach.id] === 'number'
      ? new Date(a[ach.id]).toLocaleDateString() : '';
    return `<div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
      <div class="ach-card-icon">${ach.icon}</div>
      <div class="ach-card-body">
        <div class="ach-card-name">${ach.name}</div>
        <div class="ach-card-desc">${ach.desc}</div>
        ${isUnlocked && ts ? `<div class="ach-card-date">✓ ${ts}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  document.getElementById('achievements-modal').classList.add('visible');
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
   Replay — animate the last game's board states
───────────────────────────────────────────── */
function replayGame() {
  if (!gameLog.length || replaying) return;
  replaying = true;
  const btnReplay = document.getElementById('btn-replay');
  btnReplay.disabled = true;

  const snapshots = [[...Array(9).fill(null)], ...gameLog];  // prepend empty board
  let step = 0;

  const doStep = () => {
    if (step >= snapshots.length) {
      // Restore actual final state
      renderBoard(gameState.lastWinCells || []);
      replaying = false;
      btnReplay.disabled = false;
      return;
    }
    const snap = snapshots[step];
    // Render this snapshot directly (no event listeners needed during replay)
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--hover-sym-display', '""');
    snap.forEach((val, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (val) {
        cell.classList.add('taken', `${val}-cell`);
        cell.textContent = SYMBOLS[val];
        // Highlight the newly placed piece
        if (step > 0 && snap[i] !== snapshots[step - 1][i]) cell.classList.add('fresh');
      }
      boardEl.appendChild(cell);
    });
    step++;
    setTimeout(doStep, step === 1 ? 300 : 520);
  };
  doStep();
}

/* ─────────────────────────────────────────────
   Chaos helpers
───────────────────────────────────────────── */
function randInt(n)    { return Math.floor(Math.random() * n); }
function chaosHas(id)  { return activeChaosRules.some(r => r.id === id); }

function pickChaosRules() {
  const eligible = CHAOS_RULES.filter(r => chaosEnabled.has(r.id));
  if (!eligible.length) return CHAOS_RULES.slice(0, 1); // fallback: never empty
  const n        = Math.min(1 + randInt(3), eligible.length);
  return [...eligible].sort(() => Math.random() - .5).slice(0, n);
}

function initChaosState() {
  chaosState = {
    ghostCell: -1, ghostOwner: null,
    wildUsed: false, swapUsed: false, smiteUsed: false,
    blessingUsed: false, skipUsed: false, skipNext: null,
    mirrorUsed: false, mirror: false,
    solarUsed: false, lagUsed: false, lagActive: false,
    holyCell: chaosHas('holy-ground') ? randInt(9) : -1,
    treacheryUsed: false,
  };
}

function updateBoardTransform() {
  const parts = [];
  if (cosmicAngle !== 0) parts.push(`rotate(${cosmicAngle}deg)`);
  if (chaosState.mirror) parts.push('scaleX(-1)');
  boardEl.style.transform = parts.join(' ');
}

function updateChaosBar() {
  const bar = document.getElementById('chaos-bar');
  bar.innerHTML = '';
  if (!chaosMode) { bar.classList.remove('active'); return; }
  bar.classList.add('active');
  if (activeChaosRules.length) {
    activeChaosRules.forEach(rule => {
      const chip = document.createElement('div');
      chip.className   = 'chaos-rule-chip';
      chip.id          = `chaos-chip-${rule.id}`;
      chip.textContent = `${rule.icon} ${rule.name}`;
      bar.appendChild(chip);
    });
  }
  // Config gear
  const gear = document.createElement('button');
  gear.className   = 'chaos-gear-btn';
  gear.textContent = '⚙';
  gear.title       = 'Customize chaos rules';
  gear.addEventListener('click', toggleChaosConfig);
  bar.appendChild(gear);
}

function renderChaosConfig() {
  const panel = document.getElementById('chaos-config-panel');
  panel.innerHTML = '<div class="chaos-config-title">Select eligible rules</div>' +
    CHAOS_RULES.map(r =>
      `<button class="chaos-rule-toggle ${chaosEnabled.has(r.id) ? 'on' : ''}" data-id="${r.id}" title="${r.desc}">
        ${r.icon} ${r.name}
      </button>`
    ).join('');
  panel.querySelectorAll('.chaos-rule-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (chaosEnabled.has(id)) {
        if (chaosEnabled.size > 3) { // require at least 3 eligible rules
          chaosEnabled.delete(id);
          btn.classList.remove('on');
        }
      } else {
        chaosEnabled.add(id);
        btn.classList.add('on');
      }
      saveChaosConfig();
    });
  });
}

function toggleChaosConfig() {
  const panel = document.getElementById('chaos-config-panel');
  const open  = panel.style.display !== 'none';
  if (open) {
    panel.style.display = 'none';
  } else {
    renderChaosConfig();
    panel.style.display = '';
  }
}

function saveChaosConfig() {
  try {
    const prefs = JSON.parse(localStorage.getItem('ehttt') || '{}');
    prefs.chaosRules = [...chaosEnabled];
    localStorage.setItem('ehttt', JSON.stringify(prefs));
  } catch (_) {}
}

function loadChaosConfig(prefs) {
  if (Array.isArray(prefs.chaosRules) && prefs.chaosRules.length >= 3) {
    chaosEnabled = new Set(prefs.chaosRules.filter(id => CHAOS_RULES.some(r => r.id === id)));
    if (chaosEnabled.size < 3) chaosEnabled = new Set(CHAOS_RULES.map(r => r.id)); // safety
  }
}

function markChaosUsed(id) {
  const chip = document.getElementById(`chaos-chip-${id}`);
  if (chip) chip.classList.add('used');
}

/* ─────────────────────────────────────────────
   Move timer
───────────────────────────────────────────── */
function onTimerExpire() {
  if (gameState.gameOver || aiThinking) return;
  if (aiMode && gameState.currentPlayer === HINDU) return; // AI handles itself
  const empty = gameState.board.reduce((a, v, i) => v === null ? [...a, i] : a, []);
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
    if (timerLeft <= 0) { clearTimer(); onTimerExpire(); }
  }, 1000);
}

/* ─────────────────────────────────────────────
   Confetti burst on win
───────────────────────────────────────────── */
function burstParticles(winner) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const boardRect = boardEl.getBoundingClientRect();
  const cx = boardRect.left + boardRect.width  / 2;
  const cy = boardRect.top  + boardRect.height / 2;

  const c1  = currentTheme.players[winner].primary;
  const opp = getNextPlayer(winner);
  const c2  = currentTheme.players[opp].primary;
  const colors = [c1, c2, '#ffffff', '#ffe566', c1, c2];

  const particles = Array.from({ length: 90 }, () => ({
    x:     cx,
    y:     cy,
    vx:    (Math.random() - 0.5) * 14,
    vy:    (Math.random() - 0.85) * 16,
    r:     3 + Math.random() * 6,
    color: colors[randInt(colors.length)],
    alpha: 1,
    rot:   Math.random() * Math.PI * 2,
    rvel:  (Math.random() - 0.5) * 0.35,
    wide:  0.4 + Math.random() * 0.6,
  }));

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.45;           // gravity
      p.alpha -= 0.016;
      p.rot  += p.rvel;
      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r * p.wide / 2, -p.r / 2, p.r * p.wide, p.r);
        ctx.restore();
      }
    });
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(animate);
}

/* ─────────────────────────────────────────────
   Undo
───────────────────────────────────────────── */
function updateUndoBtn() {
  const btn = document.getElementById('btn-undo');
  if (btn) btn.disabled = !gameState.history.length || gameState.gameOver || !!aiThinking;
}

function saveSnapshot() {
  gameState.history.push({
    board:         [...gameState.board],
    currentPlayer: gameState.currentPlayer,
    cosmicAngle,
    boardFilter:   boardEl.style.filter,
    chaosState:    { ...chaosState },
  });
  if (gameState.history.length > 12) gameState.history.shift();
  updateUndoBtn();
}

function undo() {
  if (!gameState.history.length || gameState.gameOver || aiThinking) return;
  const snap = gameState.history.pop();

  gameState.board         = snap.board;
  gameState.currentPlayer = snap.currentPlayer;
  gameState.gameOver      = false;

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

  if (timedMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
}

function showChaosEvent(text, ms = 2600) {
  const el = document.getElementById('chaos-event');
  el.textContent = text;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), ms);
}

function triggerSolarFlare() {
  const el = document.getElementById('solar-flare');
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function triggerCellShake(i) {
  const cells = boardEl.querySelectorAll('.cell');
  if (!cells[i]) return;
  cells[i].classList.remove('shaking');
  void cells[i].offsetWidth;
  cells[i].classList.add('shaking');
  setTimeout(() => cells[i].classList.remove('shaking'), 500);
}

function showChaosOverlay() {
  const overlay = document.getElementById('chaos-overlay');
  const list    = document.getElementById('chaos-list');
  list.innerHTML = '';
  activeChaosRules.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'chaos-item';
    item.innerHTML =
      `<div class="chaos-item-icon">${rule.icon}</div>` +
      `<div class="chaos-item-text"><strong>${rule.name}</strong><span>${rule.desc}</span></div>`;
    list.appendChild(item);
  });
  chaosShowing = true;
  overlay.classList.add('active');

  const dismiss = () => {
    overlay.classList.remove('active');
    overlay.removeEventListener('click', dismiss);
    clearTimeout(dismissTimer);
    chaosShowing = false;
    scheduleAI();
    if (!aiMode || gameState.currentPlayer === EGYPT) startTimer();
  };
  const dismissTimer = setTimeout(dismiss, 4600);
  overlay.addEventListener('click', dismiss);
}

function startChaos() {
  activeChaosRules = pickChaosRules();
  initChaosState();
  updateChaosBar();
  showChaosOverlay();
}

/* ─────────────────────────────────────────────
   Procedural theme generator
───────────────────────────────────────────── */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k     = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}


function generateRandomTheme() {
  const pair = RAND_PAIRS[randInt(RAND_PAIRS.length)];
  const h1   = randInt(360);
  const h2   = (h1 + 140 + randInt(80)) % 360;
  const c1   = hslToHex(h1, 72 + randInt(18), 54 + randInt(12));
  const c2   = hslToHex(h2, 68 + randInt(22), 50 + randInt(16));
  const r1   = hexToRgb(c1);
  const r2   = hexToRgb(c2);
  const musicThemes = Object.values(THEMES).filter(t => t.music).map(t => t.music);
  const music = musicThemes[randInt(musicThemes.length)];

  const mkPlayer = (p, col, rgb, isP1) => ({
    symbol: p.sym, name: p.name, title: p.title,
    lore:   `Born of ${p.name.toLowerCase()}, forged in the crucible of procedural chance`,
    intro:  `${p.name} emerges from the generative mists...`,
    label:  `${p.name}'s turn — Place the ${p.sym}`,
    winMsgs: [
      `🏆 ${p.name.toUpperCase()} WINS! The RNG gods have spoken and they are PLEASED!`,
      `🏆 Procedurally generated AND victorious! ${p.name} defies all probability!`,
      `🏆 The algorithm chose ${p.name}. The algorithm is wise. The algorithm is just.`,
    ],
    primary: col,
    vars: isP1
      ? { '--egypt-gold': col, '--egypt-sand': hslToHex(h1,60,80),
          '--egypt-dark': hslToHex(h1,55,8), '--egypt-brown': hslToHex(h1,50,22),
          '--egypt-teal': hslToHex((h1+40)%360,55,32), '--p1-rgb': rgb }
      : { '--hindu-orange': col, '--hindu-saffron': hslToHex(h2,75,62),
          '--hindu-purple': hslToHex(h2,60,10), '--hindu-rose': hslToHex((h2+25)%360,68,50),
          '--p2-rgb': rgb },
  });

  return {
    label:     `✦ ${pair.p1.name} vs ${pair.p2.name}`,
    corners:   [pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym],
    footer:    [pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym],
    loreFacts: [
      'This theme was generated at random just for you. Contemplate its uniqueness.',
      'Every random theme is a universe that exists only once. This is yours.',
      'The procedural cosmos contains infinite themes. You chose to witness this one.',
    ],
    music,
    players: { egypt: mkPlayer(pair.p1, c1, r1, true), hindu: mkPlayer(pair.p2, c2, r2, false) },
  };
}

function applyRandomTheme() {
  THEMES['random'] = generateRandomTheme();
  applyTheme('random');
}

/* ─────────────────────────────────────────────
   Background particles — floating theme symbols
───────────────────────────────────────────── */
function spawnBgParticles() {
  const container = document.getElementById('bg-particles');
  container.innerHTML = '';
  const syms  = currentTheme.footer;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className   = 'bg-sym';
    span.textContent = syms[i % syms.length];
    span.style.left            = `${Math.random() * 100}%`;
    span.style.animationDuration  = `${14 + Math.random() * 22}s`;
    span.style.animationDelay     = `${Math.random() * -36}s`;
    span.style.fontSize           = `${0.7 + Math.random() * 1.3}rem`;
    container.appendChild(span);
  }
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
  const text = `${p1.symbol} ${p1.name} ${egypt}–${hindu} ${p2.name} ${p2.symbol}${drawPart}\n${gridRows.join('\n')}\nEgyptian & Hindu Tic-Tac-Toe`;
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
   Apply theme
───────────────────────────────────────────── */
function applyTheme(key) {
  currentTheme    = THEMES[key];
  currentThemeKey = key;
  trackThemeAchievement(key);
  const root = document.documentElement.style;
  Object.entries(currentTheme.players.egypt.vars).forEach(([k, v]) => root.setProperty(k, v));
  Object.entries(currentTheme.players.hindu.vars).forEach(([k, v]) => root.setProperty(k, v));

  const [tl, tr, bl, br] = currentTheme.corners;
  document.querySelector('.corner.tl').textContent = tl;
  document.querySelector('.corner.tr').textContent = tr;
  document.querySelector('.corner.bl').textContent = bl;
  document.querySelector('.corner.br').textContent = br;

  const footerSpans = document.querySelectorAll('.footer-symbols span');
  currentTheme.footer.forEach((sym, i) => { if (footerSpans[i]) footerSpans[i].textContent = sym; });
  spawnBgParticles();

  document.querySelector('#card-egypt .player-symbol').textContent = currentTheme.players.egypt.symbol;
  document.getElementById('name-egypt').textContent                = currentTheme.players.egypt.name;
  document.querySelector('#card-egypt .player-title').textContent  = currentTheme.players.egypt.title;
  document.querySelector('#card-egypt .player-lore').textContent   = currentTheme.players.egypt.lore;
  document.querySelector('#card-hindu .player-symbol').textContent = currentTheme.players.hindu.symbol;
  document.getElementById('name-hindu').textContent                = currentTheme.players.hindu.name;
  document.querySelector('#card-hindu .player-title').textContent  = currentTheme.players.hindu.title;
  document.querySelector('#card-hindu .player-lore').textContent   = currentTheme.players.hindu.lore;

  SYMBOLS.egypt = currentTheme.players.egypt.symbol;
  SYMBOLS.hindu = currentTheme.players.hindu.symbol;
  LABELS.egypt  = currentTheme.players.egypt.label;
  LABELS.hindu  = currentTheme.players.hindu.label;

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === key);
  });

  // Crossfade music to new theme if currently playing
  if (musicPlaying) {
    clearTimeout(melodyTimer);
    stopDrone();
    melodyStep = 0;
    droneNodes = startDrone();
    tickMelody();
  }

  // Cancel any AI thinking from the previous theme/round
  aiThinking = false;
  boardEl.classList.remove('ai-thinking');

  resetScores();
  showIntro();
  savePrefs();
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
  document.getElementById('mv-title').textContent   = `${p.name} Conquers the Match!`;
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
function handleClick(i) {
  const { board, currentPlayer } = gameState;

  // Guards
  if (gameState.gameOver || board[i] || aiThinking || chaosState.lagActive) return;
  if (aiMode && currentPlayer === HINDU) return;
  if (chaosMode && chaosHas('holy-ground') && chaosState.holyCell === i) {
    sfxChaos('holy-ground');
    showChaosEvent('⛪ HOLY GROUND! That sacred cell is divinely forbidden!', 1600);
    return;
  }

  // Clear move timer as soon as a move is registered
  clearTimer();

  // Save snapshot for undo (human moves only)
  if (!aiMode || currentPlayer === EGYPT) saveSnapshot();

  // ── CHAOS: Cursed Skip ─────────────────────────────────────────────
  if (chaosMode && chaosState.skipNext === currentPlayer) {
    chaosState.skipNext = null;
    markChaosUsed('cursed-skip');
    showChaosEvent(`💀 CURSED SKIP! ${currentTheme.players[currentPlayer].name}'s turn is OBLITERATED by ancient forces!`);
    gameState.currentPlayer = getNextPlayer(currentPlayer);
    statusEl.className   = `status-text ${gameState.currentPlayer}-msg`;
    statusEl.textContent = LABELS[gameState.currentPlayer];
    setAura(gameState.currentPlayer);
    updateTurnUI();
    scheduleAI();
    scheduleSpectatorAI();
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
  // Track cell frequency for heatmap
  { const st = loadAllTimeStats(); if (!st.cellFreq) st.cellFreq = Array(9).fill(0); st.cellFreq[i]++; saveAllTimeStats(st); }

  // ── CHAOS: Wild Turn (30 % chance once, after ≥ 2 pieces on board) ─
  if (chaosMode && chaosHas('wild-turn') && !chaosState.wildUsed && board.filter(v => v).length >= 2) {
    if (Math.random() < 0.3) {
      const empty = board.reduce((a, v, idx) => v === null ? [...a, idx] : a, []);
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
      showChaosEvent(`⚡ SMITE! A divine bolt obliterates ${currentTheme.players[opp].name}'s piece!`);
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
    setTimeout(() => { chaosState.lagActive = false; }, 3000);
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
  // Does player have 2 in a line with the third empty?
  function _hasThreaten(b, player) {
    return _WIN_LINES.some(l => _lineCount(b, player, l) === 2 && l.some(c => !b[c]));
  }

  if (_preCount === 0) {
    const _opening = _clickedI === 4 ? '⚔ Center Gambit'
                   : [0,2,6,8].includes(_clickedI) ? '♟ Corner Opening' : '◈ Edge Play';
    setTimeout(() => showChaosEvent(_opening + '!', 1800), 350);
  } else if (_preCount === 1) {
    // Opponent's first response
    const _oppFirst = _snapForBadge.indexOf(_opponent);
    if (_oppFirst === 4 && [0,2,6,8].includes(_clickedI)) {
      setTimeout(() => showChaosEvent('🪞 Mirror Denied — Center Claimed!', 2000), 350);
    } else if ([0,2,6,8].includes(_oppFirst) && [0,2,6,8].includes(_clickedI)
               && _oppFirst + _clickedI === 8) {
      setTimeout(() => showChaosEvent('⚔ Opposite Corners — Double Threat!', 2000), 350);
    }
  } else if (_preCount === 2) {
    const _boardNow = [..._snapForBadge]; _boardNow[_clickedI] = currentPlayer;
    const _myCorners = [0,2,6,8].filter(c => _boardNow[c] === currentPlayer);
    if (_myCorners.length === 2 && (_myCorners[0] + _myCorners[1] === 8)) {
      setTimeout(() => showChaosEvent('⚡ Fork Setup! Danger!', 2000), 350);
    } else if (_hasThreaten(_boardNow, currentPlayer)) {
      setTimeout(() => showChaosEvent('🎯 Line Pressure!', 1800), 350);
    }
  } else if (_preCount >= 4) {
    // Mid-game: detect match point (player 1 win away) or block
    const _boardNow = [..._snapForBadge]; _boardNow[_clickedI] = currentPlayer;
    const _blockMove = _WIN_LINES.some(l => _lineCount(_snapForBadge, _opponent, l) === 2
                       && l.includes(_clickedI) && !_snapForBadge[_clickedI]);
    const _threatNow = _hasThreaten(_boardNow, currentPlayer);
    if (_blockMove) {
      setTimeout(() => showChaosEvent('🛡 Crisis Averted! Block!', 1800), 350);
    } else if (_threatNow && _preCount === 4) {
      setTimeout(() => showChaosEvent('⚡ Match Point!', 1800), 350);
    }
  }

  // ── Check winner (after all chaos mutations) ──────────────────────
  const result = checkWinner(board);

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
      sfxDraw();
      gameState.scores.draws++;
      drawsEl.textContent  = gameState.scores.draws;
      gameState.lastWinner = null;
      gameState.streaks    = { egypt: 0, hindu: 0 };
      statusEl.className   = 'status-text draw-msg';
      statusEl.textContent = DRAW_MESSAGES[currentThemeKey] || '⚖️  A sacred draw — The gods are balanced';
      cardEgypt.classList.remove('active-turn', 'winner-glow');
      cardHindu.classList.remove('active-turn', 'winner-glow');
      setAura(null);
      updateAllTimeStats('draw');
      updateMatchPips();
      updateStreakBadges();
      checkAchievements('draw');
      document.getElementById('btn-replay').style.display = '';
      document.getElementById('btn-hint').disabled = true;
      document.getElementById('btn-analysis').style.display = '';
      setTimeout(showGameSummary, 900);
    } else {
      const w = result.winner;
      sfxWin(w);
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
          ? `🔥 ${currentTheme.players[w].name} IS ON FIRE! THREE IN A ROW!`
          : `🔥 ${streak} IN A ROW! ${currentTheme.players[w].name} IS SIMPLY UNSTOPPABLE!`;
        setTimeout(() => showChaosEvent(fire, 3000), 900);
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
      const _lineName = getWinLineName(result.cells);
      if (_lineName) setTimeout(() => showChaosEvent(_lineName + '!', 2000), 750);
      updateAllTimeStats(w);
      updateMatchPips();
      updateStreakBadges();
      checkAchievements(w);
      document.getElementById('btn-replay').style.display = '';
      document.getElementById('btn-hint').disabled = true;
      document.getElementById('btn-analysis').style.display = '';
      setTimeout(showGameSummary, 900);
      if (matchTarget && gameState.scores[w] >= Math.ceil(matchTarget / 2)) {
        setTimeout(() => showMatchVictory(w), 1200);
      }
    }
    updateUndoBtn();
    // Spectator auto-restart — skip if a match-victory overlay is about to show;
    // in that case the mv-btn handler triggers the restart instead.
    const matchOver = result.winner !== 'draw' && matchTarget &&
      gameState.scores[result.winner] >= Math.ceil(matchTarget / 2);
    if (spectatorMode && !matchOver) {
      setTimeout(() => { if (spectatorMode) newRound(); }, 2800);
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
      showChaosEvent(`✨ BLESSING OF TWOFOLD! ${currentTheme.players[currentPlayer].name} PLAYS AGAIN!`);
    }

    // ── CHAOS: Cursed Skip (schedule skip for opponent's next turn) ───
    if (chaosMode && chaosHas('cursed-skip') && !chaosState.skipUsed && Math.random() < 0.18) {
      chaosState.skipUsed = true;
      const toSkip = getNextPlayer(currentPlayer);
      chaosState.skipNext = toSkip;
      sfxChaos('cursed-skip');
      chaosLog.push({ icon: '💀', name: 'Cursed Skip' });
      showChaosEvent(`💀 CURSED SKIP incoming! ${currentTheme.players[toSkip].name}'s NEXT turn will vanish into darkness!`);
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
      setTimeout(() => showMoveBadge(_fc, _q), 80);
    }

    // ── CHAOS: Phantom Veil — pieces invisible for 1.5 s ─────────────
    if (chaosMode && chaosHas('phantom-veil')) {
      sfxChaos('phantom-veil');
      boardEl.classList.add('phantom-veil');
      setTimeout(() => boardEl.classList.remove('phantom-veil'), 1500);
    }

    if (!grantBlessing) gameState.currentPlayer = getNextPlayer(currentPlayer);

    const nextLabel = LABELS[gameState.currentPlayer];
    if (quipText) {
      statusEl.className   = `status-text ${currentPlayer}-msg`;
      statusEl.textContent = `💬 ${quipText}`;
      setTimeout(() => {
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
        setTimeout(() => { if (!gameState.gameOver) showChaosEvent(`🤖 ${taunts[randInt(taunts.length)]}`, 2400); }, 600);
      }
    }

    setAura(gameState.currentPlayer);
    updateTurnUI();
    updateUndoBtn();
    updateEvalBar(gameState.currentPlayer === HINDU);
    scheduleAI();
    scheduleSpectatorAI();
    // Start timer for the next human move
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
  }
}

/* ─────────────────────────────────────────────
   New round
   Resets the board and turn via resetBoard(),
   but intentionally preserves scores so the
   session tally carries over across rounds.
───────────────────────────────────────────── */
function newRound() {
  resetBoard();
  clearWinLine();
  clearTimer();
  lastPlacedCell = -1;
  gameLog = [];
  moveLog  = [];
  chaosLog = [];
  updateMoveLog();
  replaying = false;
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
      name1:      document.getElementById('name-egypt').textContent.trim() || '',
      name2:      document.getElementById('name-hindu').textContent.trim() || '',
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

    // Apply theme — this calls resetScores → newRound (→ startChaos if chaosMode) + showIntro
    const key = p.key && THEMES[p.key] ? p.key : 'egypt-hindu';
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
    if (p.name1) { const el = document.getElementById('name-egypt'); if (el) el.textContent = p.name1; }
    if (p.name2) { const el = document.getElementById('name-hindu'); if (el) el.textContent = p.name2; }
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
document.addEventListener('keydown', e => {
  // Escape closes any open modal / overlay
  if (e.code === 'Escape') {
    document.getElementById('stats-modal').classList.remove('visible');
    document.getElementById('match-victory').classList.remove('visible');
    document.getElementById('shortcut-help').classList.remove('visible');
    document.getElementById('analysis-modal').classList.remove('visible');
    document.getElementById('achievements-modal').classList.remove('visible');
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
  }
});

/* ─────────────────────────────────────────────
   Event listeners
───────────────────────────────────────────── */
document.getElementById('btn-restart').addEventListener('click', newRound);
document.getElementById('btn-reset').addEventListener('click', resetScores);
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
   Init — restore saved prefs or default startup
───────────────────────────────────────────── */
initEditableNames();
if (!loadPrefs()) {
  setAura(EGYPT);
  renderBoard();
  showIntro();
}
updateRankBadges();
