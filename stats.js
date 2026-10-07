/* ─────────────────────────────────────────────
   stats.js — all-time stats, ranks, achievements, streak
   badges, move log and post-game analysis/summary
   Plain <script>: shares the page's global scope with the
   other game files (load order: see index.html).
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Session win-rate on player cards
───────────────────────────────────────────── */
function updateSessionRate() {
  const s = gameState.scores;
  const total = (s.egypt || 0) + (s.hindu || 0) + (s.draws || 0);
  const rEl = document.getElementById('rate-egypt');
  const hEl = document.getElementById('rate-hindu');
  if (!total || !rEl || !hEl) { if (rEl) rEl.textContent = ''; if (hEl) hEl.textContent = ''; return; }
  rEl.textContent = `${Math.round((s.egypt  || 0) / total * 100)}% win`;
  hEl.textContent = `${Math.round((s.hindu  || 0) / total * 100)}% win`;
}

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
  if (spectatorMode) return;   // AI-vs-AI demo games don't count
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
      roundTimeout(() => showChaosEvent(`⬆️ ${playerName(EGYPT)} RANKS UP: ${newR1.label}!`, 3200), 2000);
    }
    if (newR2.label !== oldR2 && s.hindu > 0) {
      roundTimeout(() => showChaosEvent(`⬆️ ${playerName(HINDU)} RANKS UP: ${newR2.label}!`, 3200), 2000);
    }
  }
  updateRankBadges();
  // Score milestone toasts (total wins ever, both players combined)
  if (outcome !== 'draw') {
    const totalWins = (s.egypt || 0) + (s.hindu || 0);
    const prevTotal = totalWins - 1;
    const _milestones = {
      5:  '🏆 5 Victories! The Ancient Game Begins!',
      10: '🔥 10 Victories! A True Warrior Rises!',
      25: '⭐ 25 Victories! Legend Status Achieved!',
      50: '👑 50 Victories! You Are Mythic!',
      100:'✨ 100 Victories! The Gods Take Notice!',
    };
    Object.entries(_milestones).forEach(([n, msg]) => {
      if (prevTotal < +n && totalWins >= +n)
        roundTimeout(() => showChaosEvent(msg, 3500), 2500);
    });
  }
}
function showStatsModal() {
  // Clear previously-inserted dynamic sections to prevent duplication on re-open
  document.querySelectorAll('.recent-games, .heat-section, .theme-stats-section').forEach(el => el.remove());
  const s  = loadAllTimeStats();
  const n1 = escapeHtml(playerName(EGYPT)).toUpperCase();
  const n2 = escapeHtml(playerName(HINDU)).toUpperCase();
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
    <div class="stat-card"><div class="stat-val">${s.egypt || 0}</div><div class="stat-lbl">${n1} WINS</div></div>
    <div class="stat-card"><div class="stat-val">${s.hindu || 0}</div><div class="stat-lbl">${n2} WINS</div></div>
    <div class="stat-card"><div class="stat-val">${s.longestStreak || 0}</div><div class="stat-lbl">BEST STREAK</div></div>
    <div class="stat-card"><div class="stat-val">${winRate}%</div><div class="stat-lbl">${n1} WIN RATE</div></div>
    <div class="stat-card"><div class="stat-val">${avgMoves}</div><div class="stat-lbl">AVG MOVES</div></div>
    <div class="stat-card"><div class="stat-val">${favCell}</div><div class="stat-lbl">FAV CELL</div></div>
  `;
  // Recent games row
  const afterGrid = document.getElementById('stats-grid');
  if (s.recentGames && s.recentGames.length) {
    const dots = s.recentGames.map(g => {
      const color = g === EGYPT ? 'var(--egypt-gold)' : g === HINDU ? 'var(--hindu-saffron)' : 'rgba(255,255,255,.35)';
      const label = g === EGYPT ? escapeHtml(playerName(EGYPT)) : g === HINDU ? escapeHtml(playerName(HINDU)) : 'Draw';
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
  // Achievements belong to the human: none in AI-vs-AI demo, and no win
  // achievements when the AI (India) is the winner.
  if (spectatorMode) return;
  if (aiMode && winner === HINDU) return;
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
