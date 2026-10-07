/* ─────────────────────────────────────────────
   board.js — drawing the board: cells, grid and win lines,
   aura, win seal, eval bar, move badges, hint, replay, confetti
   Plain <script>: shares the page's global scope with the
   other game files (load order: see index.html).
───────────────────────────────────────────── */

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
  const _hoverInk = gameState.currentPlayer === EGYPT
    ? (currentTheme.p1ink || '#9b3b14')
    : (currentTheme.p2ink || '#3a4a8a');
  boardEl.style.setProperty('--hover-ink', _hoverInk);

  const _rb = rulesBoard();   // Holy Ground cell can't be played, so no threat there
  gameState.board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'button');
    const _pos = POS_LABELS[i] || `${i + 1}`;
    const _fogged = val && fogMode && !gameState.gameOver && val !== gameState.currentPlayer;
    cell.setAttribute('aria-label',
      !val ? `${_pos}, empty` : _fogged ? `${_pos}, hidden piece` : `${_pos}, ${playerName(val)}`);
    if (val) {
      cell.classList.add('taken', `${val}-cell`);
      const _fogHide = fogMode && !gameState.gameOver
        && val !== gameState.currentPlayer;
      if (_fogHide) {
        cell.classList.add('fog-hidden');
        cell.textContent = '●';
      } else {
        const ink = val === EGYPT
          ? (currentTheme.p1ink || currentTheme.players.egypt.primary || '#9b3b14')
          : (currentTheme.p2ink || currentTheme.players.hindu.primary || '#3a4a8a');
        const sym = document.createElement('span');
        sym.className = 'cell-sym';
        sym.textContent = SYMBOLS[val];
        sym.style.color = ink;
        cell.appendChild(sym);
      }
    } else {
      // Coordinate label on empty cells
      const _cl = document.createElement('span');
      _cl.className   = 'coord-label';
      _cl.textContent = POS_LABELS[i] || '';
      cell.appendChild(_cl);
      if (!gameState.gameOver && !spectatorMode) cell.setAttribute('tabindex', '0');
    }
    if (chaosMode && chaosState.ghostCell === i && val) cell.classList.add('ghost-cell');
    if (chaosMode && chaosState.holyCell === i && !val) cell.classList.add('holy-cell');
    if (i === lastPlacedCell && val) cell.classList.add('fresh');
    if (winCells.includes(i)) {
      cell.classList.add('win-cell');
      cell.style.setProperty('--win-delay', winCells.indexOf(i) * 80);
    }
    // Threat highlighting — only during human turn (no point showing while AI thinks)
    const _humanTurn = !aiMode || gameState.currentPlayer === EGYPT;
    if (_rb[i] === null && !gameState.gameOver && !fogMode && _humanTurn && !spectatorMode) {
      for (const player of [EGYPT, HINDU]) {
        const testB = [..._rb];
        testB[i] = player;
        if (boardWinner(testB) === player) cell.classList.add(`threat-${player}`);
      }
    }
    if (!spectatorMode) cell.addEventListener('click', () => handleClick(i));
    boardEl.appendChild(cell);
  });
  // Inject SVG grid lines after layout via rAF
  requestAnimationFrame(() => injectGridLines());
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
   SVG grid lines (injected after board renders)
───────────────────────────────────────────── */
// A cell's box in the board's own (untransformed) coordinate space.
// .board is position:relative, so it is every cell's offsetParent.
function cellBox(el) {
  const left = el.offsetLeft, top = el.offsetTop, width = el.offsetWidth, height = el.offsetHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function injectGridLines() {
  const existing = boardEl.querySelector('.grid-lines-svg');
  if (existing) existing.remove();
  const cells = boardEl.querySelectorAll('.cell');
  if (!cells.length) return;
  // Layout (offset*) coordinates, not getBoundingClientRect: the board may be
  // rotated (cosmic) or mirrored, and the SVG inherits that transform itself.
  const W = boardEl.clientWidth || 300, H = boardEl.clientHeight || 300;
  if (W < 10) return;
  const r0 = cellBox(cells[0]), r1 = cellBox(cells[1]), r2 = cellBox(cells[2]);
  const r3 = cellBox(cells[3]);
  const r6 = cells[6] ? cellBox(cells[6]) : null;
  if (!r0.width) return;
  const vx1 = (r0.right + r1.left) / 2;
  const vx2 = (r1.right + r2.left) / 2;
  const hy1 = (r0.bottom + r3.top) / 2;
  const hy2 = r6 ? (r3.bottom + r6.top) / 2 : hy1 * 2;
  const ov = 14;
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2a1a08';
  const j = s => (Math.sin(s * 12.9898 + 43758.5453) % 1) * 2 - 1;
  const lp = (x1, y1, x2, y2, s) =>
    `M ${(x1+j(s+2)*1.2).toFixed(1)} ${(y1+j(s+3)*1.2).toFixed(1)} Q ${((x1+x2)/2+j(s)*1.5).toFixed(1)} ${((y1+y2)/2+j(s+1)*1.5).toFixed(1)} ${(x2+j(s+4)*1.2).toFixed(1)} ${(y2+j(s+5)*1.2).toFixed(1)}`;
  const svg = `<svg class="grid-lines-svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" aria-hidden="true"><defs><filter id="gl-bleed" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs><g filter="url(#gl-bleed)" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.68"><path d="${lp(vx1,-ov,vx1,H+ov,1)}"/><path d="${lp(vx2,-ov,vx2,H+ov,2)}"/><path d="${lp(-ov,hy1,W+ov,hy1,3)}"/><path d="${lp(-ov,hy2,W+ov,hy2,4)}"/></g><g stroke="${ink}" stroke-width="0.7" stroke-linecap="round" fill="none" opacity="0.32"><path d="${lp(vx1,-ov,vx1,H+ov,5)}"/><path d="${lp(vx2,-ov,vx2,H+ov,6)}"/><path d="${lp(-ov,hy1,W+ov,hy1,7)}"/><path d="${lp(-ov,hy2,W+ov,hy2,8)}"/></g></svg>`;
  boardEl.insertAdjacentHTML('beforeend', svg);
}

/* ─────────────────────────────────────────────
   Win-line animation
───────────────────────────────────────────── */
function drawWinLine(cells, winner) {
  // Remove any existing SVG win line
  const old = boardEl.querySelector('.win-line-svg');
  if (old) old.remove();

  const W = boardEl.clientWidth || 300, H = boardEl.clientHeight || 300;
  const cellEls = boardEl.querySelectorAll('.cell');
  if (!cellEls[cells[0]] || !cellEls[cells[cells.length-1]]) return;

  // Untransformed coordinates — see injectGridLines()
  const r1 = cellBox(cellEls[cells[0]]);
  const r2 = cellBox(cellEls[cells[cells.length-1]]);
  const x1 = r1.left + r1.width/2;
  const y1 = r1.top + r1.height/2;
  const x2 = r2.left + r2.width/2;
  const y2 = r2.top + r2.height/2;
  const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy) || 1;
  const ov = Math.min(20, len * 0.1);
  const px = -dy/len*4, py = dx/len*4;
  const d = `M ${(x1-dx/len*ov).toFixed(1)} ${(y1-dy/len*ov).toFixed(1)} Q ${((x1+x2)/2+px).toFixed(1)} ${((y1+y2)/2+py).toFixed(1)} ${(x2+dx/len*ov).toFixed(1)} ${(y2+dy/len*ov).toFixed(1)}`;
  const color = winner === EGYPT
    ? (currentTheme.p1ink || `rgba(${currentTheme.players.egypt.vars['--p1-rgb']},0.9)`)
    : (currentTheme.p2ink || `rgba(${currentTheme.players.hindu.vars['--p2-rgb']},0.9)`);
  const svg = `<svg class="win-line-svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" aria-hidden="true"><defs><filter id="wl-bleed" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></defs><path d="${d}" stroke="${color}" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.82" filter="url(#wl-bleed)" class="win-line-path" pathLength="1"/><path d="${d}" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.38" class="win-line-path" pathLength="1" style="animation-delay:120ms"/></svg>`;
  boardEl.insertAdjacentHTML('beforeend', svg);

  // Show win seal after win line draws
  roundTimeout(() => showWinSeal(winner), 900);
}


function clearWinLine() {
  const svgLine = boardEl.querySelector('.win-line-svg');
  if (svgLine) svgLine.remove();
  winLineEl.style.display = 'none';
  winLineEl.classList.remove('animate');
}

/* ─────────────────────────────────────────────
   Win Seal — papyrus stamp card overlay
───────────────────────────────────────────── */
function showWinSeal(winner) {
  const seal = document.getElementById('win-seal');
  if (!seal) return;
  const isDraw = winner === 'draw';
  const p = isDraw ? null : currentTheme.players[winner];
  const ink = isDraw
    ? (currentTheme.ink || '#2a1a08')
    : (winner === EGYPT ? (currentTheme.p1ink || '#9b3b14') : (currentTheme.p2ink || '#3a4a8a'));
  const stampEl  = document.getElementById('win-seal-stamp');
  const cryEl    = document.getElementById('win-seal-cry');
  const lineEl   = document.getElementById('win-seal-line');
  const cardEl   = seal.querySelector('.win-seal-card');
  const btnEl    = document.getElementById('win-seal-btn');
  if (stampEl)  { stampEl.textContent = isDraw ? '⚖' : (p.symbol || '?'); stampEl.style.color = ink; stampEl.style.borderColor = ink; }
  if (cryEl)    { cryEl.textContent = isDraw ? 'A SACRED DRAW' : (p.winCry || playerName(winner).toUpperCase() + ' WINS!'); cryEl.style.color = ink; }
  if (lineEl)   lineEl.textContent = isDraw ? 'Both armies retreat with honor intact.' : (p.winLine || (p.winMsgs ? p.winMsgs[0].replace(/^🏆\s*/,'') : ''));
  if (cardEl)   cardEl.style.borderColor = ink;
  if (btnEl)    { btnEl.style.borderColor = ink; btnEl.style.color = ink; }
  seal.classList.add('visible');
}

function hideWinSeal() {
  const seal = document.getElementById('win-seal');
  if (seal) seal.classList.remove('visible');
}

/* ─────────────────────────────────────────────
   Position evaluation bar (minimax score → bar)
───────────────────────────────────────────── */
function updateEvalBar(isHinduTurn) {
  const eEl  = document.getElementById('eval-egypt');
  const hEl  = document.getElementById('eval-hindu');
  const pE   = document.getElementById('eval-pct-egypt');
  const pH   = document.getElementById('eval-pct-hindu');
  if (!eEl || !hEl) return;
  if (gameState.board.every(v => !v)) {
    eEl.style.width = '50%'; hEl.style.width = '50%';
    if (pE) pE.textContent = '50%';
    if (pH) pH.textContent = '50%';
    return;
  }
  // Only the outcome with best play: +10 = HINDU wins, -10 = EGYPT wins, 0 = draw
  const score = Math.sign(minimax(rulesBoard(), isHinduTurn, -Infinity, Infinity)) * 10;
  const hinduPct = Math.round((score + 10) / 20 * 100);
  eEl.style.width = `${100 - hinduPct}%`;
  hEl.style.width = `${hinduPct}%`;
  if (pE) pE.textContent = `${100 - hinduPct}%`;
  if (pH) pH.textContent = `${hinduPct}%`;
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
    const val = minimax(b, !isMax, -Infinity, Infinity, 1);
    b[idx] = null;
    if (isMax ? val > bestEval : val < bestEval) { bestEval = val; bestIdx = idx; }
  }
  b[moveIdx] = player;
  const actualEval = minimax(b, !isMax, -Infinity, Infinity, 1);
  b[moveIdx] = null;
  // best: as good as it gets · fine: same result, just slower (a later win or
  // an earlier loss) · blunder: throws away a win or a draw
  const quality = actualEval === bestEval ? 'best'
                : Math.sign(actualEval) === Math.sign(bestEval) ? 'fine' : 'blunder';
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
      const val = minimax(b, false, -Infinity, Infinity, 1);
      b[i] = null;
      if (val > best) { best = val; move = i; }
    }
    return move;
  } else {
    let best = Infinity, move = empty[0];
    for (const i of empty) {
      b[i] = EGYPT;
      const val = minimax(b, true, -Infinity, Infinity, 1);
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
  const best = getHintMove(rulesBoard(), gameState.currentPlayer);
  if (best < 0) return;
  const cell = boardEl.querySelectorAll('.cell')[best];
  if (cell && !cell.classList.contains('taken')) {
    cell.classList.add('hint-cell');
    const _hintPos     = POS_LABELS[best] || `#${best + 1}`;
    const _savedText   = statusEl.textContent;
    const _savedClass  = statusEl.className;
    statusEl.textContent = `💡 Best move: ${_hintPos}`;
    statusEl.className   = 'status-text hint-msg';
    hintTimer = setTimeout(() => {
      cell.classList.remove('hint-cell');
      statusEl.textContent = _savedText;
      statusEl.className   = _savedClass;
    }, 1800);
  }
}

/* ─────────────────────────────────────────────
   Replay — animate the last game's board states
───────────────────────────────────────────── */
function stopReplay() {
  clearTimeout(replayTimer);
  replayTimer = null;
  replaying   = false;
  const btn = document.getElementById('btn-replay');
  if (btn) btn.disabled = false;
}

function replayGame() {
  if (!gameLog.length || replaying) return;
  replaying = true;
  const btnReplay = document.getElementById('btn-replay');
  btnReplay.disabled = true;

  const snapshots = [[...Array(9).fill(null)], ...gameLog];  // prepend empty board
  let step = 0;

  const totalMoves = snapshots.length - 1;
  const doStep = () => {
    if (step >= snapshots.length) {
      // Restore actual final state
      replayTimer = null;
      renderBoard(gameState.lastWinCells || []);
      statusEl.className   = `status-text ${gameState.lastWinner || EGYPT}-msg`;
      statusEl.textContent = `↺ Replay complete`;
      replaying = false;
      btnReplay.disabled = false;
      return;
    }
    // Step counter in status bar
    if (step === 0) {
      statusEl.className   = 'status-text egypt-msg';
      statusEl.textContent = `↺ Replaying ${totalMoves}-move game…`;
    } else {
      // gameLog can be shorter than moveLog (game restored from an older save)
      const logEntry = moveLog[moveLog.length - totalMoves + step - 1];
      const pl = logEntry ? logEntry.player : EGYPT;
      statusEl.className   = `status-text ${pl}-msg`;
      statusEl.textContent = `↺ Move ${step} / ${totalMoves} — ${SYMBOLS[pl] || ''} ${logEntry ? logEntry.pos : ''}`;
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
        const ink = val === EGYPT
          ? (currentTheme.p1ink || '#9b3b14')
          : (currentTheme.p2ink || '#3a4a8a');
        const sym = document.createElement('span');
        sym.className = 'cell-sym';
        sym.textContent = SYMBOLS[val];
        sym.style.color = ink;
        cell.appendChild(sym);
        // Highlight the newly placed piece
        if (step > 0 && snap[i] !== snapshots[step - 1][i]) cell.classList.add('fresh');
      }
      boardEl.appendChild(cell);
    });
    step++;
    replayTimer = setTimeout(doStep, step === 1 ? 300 : 520);
  };
  doStep();
}

/* ─────────────────────────────────────────────
   Confetti burst on win
───────────────────────────────────────────── */
function burstParticles(winner) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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

  const _shapes = ['rect', 'rect', 'circle', 'tri'];
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
    shape: _shapes[randInt(_shapes.length)],
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
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'tri') {
          ctx.beginPath();
          ctx.moveTo(0, -p.r / 2);
          ctx.lineTo(p.r / 2, p.r / 2);
          ctx.lineTo(-p.r / 2, p.r / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.r * p.wide / 2, -p.r / 2, p.r * p.wide, p.r);
        }
        ctx.restore();
      }
    });
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(animate);
}
