/* ─────────────────────────────────────────────
   chaos.js — Chaos mode: rule state, rule picking/config,
   the rules bar, event toasts and the rules overlay
   Plain <script>: shares the page's global scope with the
   other game files (load order: see index.html).
───────────────────────────────────────────── */

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
   Chaos helpers
───────────────────────────────────────────── */
function randInt(n)    { return Math.floor(Math.random() * n); }
function chaosHas(id)  { return activeChaosRules.some(r => r.id === id); }
// Board as the rules see it: the Holy Ground cell (if active) is unplayable.
// Use this for AI/hint/timer move choice and for the win/draw check.
function rulesBoard() {
  return chaosMode && chaosHas('holy-ground')
    ? blockCell(gameState.board, chaosState.holyCell)
    : [...gameState.board];
}

function pickChaosRules() {
  const eligible = CHAOS_RULES.filter(r => chaosEnabled.has(r.id));
  if (!eligible.length) return CHAOS_RULES.slice(0, 1); // fallback: never empty
  const n        = Math.min(1 + randInt(3), eligible.length);
  // Fisher–Yates (sorting with a random comparator is biased)
  const pool = [...eligible];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
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

let chaosEventTimer = null;
function showChaosEvent(text, ms = 2600) {
  const el = document.getElementById('chaos-event');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(chaosEventTimer);
  chaosEventTimer = setTimeout(() => el.classList.remove('visible'), ms);
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
    scheduleSpectatorAI();
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
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
